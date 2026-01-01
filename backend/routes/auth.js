/**
 * Authentication Routes
 * Handles user registration, login, logout, and token management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AuthService = require('../services/AuthService');
const createAuthMiddleware = require('../middleware/auth');

function createAuthRoutes(dbManager) {
    const router = express.Router();
    const authService = new AuthService();
    const { authenticateToken } = createAuthMiddleware(dbManager);

    // Configure Google OAuth Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_REDIRECT_URI
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // Extract user information from Google profile
                const googleUser = {
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName,
                    profilePicture: profile.photos[0]?.value
                };

                // Check if user already exists with this Google ID
                let user = await authService.findUserByGoogleId(googleUser.googleId);
                
                if (!user) {
                    // Check if user exists with this email
                    user = await authService.findUserByEmail(googleUser.email);
                    
                    if (user) {
                        // Link Google account to existing user
                        await authService.linkGoogleAccount(user.id, googleUser.googleId, googleUser.profilePicture);
                        user.google_id = googleUser.googleId;
                        user.profile_picture = googleUser.profilePicture;
                    } else {
                        // Create new user with Google account
                        user = await authService.createUserFromGoogle(googleUser);
                    }
                }

                return done(null, user);
            } catch (error) {
                console.error('Google OAuth error:', error);
                return done(error, null);
            }
        }));

        // Passport serialization (required for session-based auth, but we'll use JWT)
        passport.serializeUser((user, done) => done(null, user.id));
        passport.deserializeUser(async (id, done) => {
            try {
                const user = await authService.findUserById(id);
                done(null, user);
            } catch (error) {
                done(error, null);
            }
        });
    }

    // Rate limiting for authentication endpoints
    const authLimiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
        message: {
            error: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false
    });

    // Strict rate limiting for login attempts
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 attempts per window
        skipSuccessfulRequests: true,
        message: {
            error: 'Too many login attempts, please try again later',
            code: 'LOGIN_RATE_LIMIT_EXCEEDED'
        }
    });

    // Validation rules
    const registerValidation = [
        body('username')
            .isLength({ min: 3, max: 50 })
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username must be 3-50 characters and contain only letters, numbers, and underscores'),
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long'),
        body('firstName')
            .optional()
            .isLength({ max: 100 })
            .withMessage('First name must be less than 100 characters'),
        body('lastName')
            .optional()
            .isLength({ max: 100 })
            .withMessage('Last name must be less than 100 characters')
    ];

    const loginValidation = [
        body('identifier')
            .notEmpty()
            .withMessage('Username or email is required'),
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ];

    // Apply rate limiting to all auth routes
    router.use(authLimiter);   
 /**
     * POST /auth/register
     * Register a new user account
     */
    router.post('/register', registerValidation, async (req, res) => {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: errors.array()
                });
            }

            const { username, email, password, firstName, lastName } = req.body;
            
            // Create user
            const user = await authService.createUser({
                username,
                email,
                password,
                firstName,
                lastName
            });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name
                }
            });

        } catch (error) {
            console.error('Registration error:', error.message);
            
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    error: 'Username or email already exists',
                    code: 'USER_ALREADY_EXISTS'
                });
            } else if (error.message.includes('Password validation failed')) {
                return res.status(400).json({
                    error: error.message,
                    code: 'WEAK_PASSWORD'
                });
            } else {
                return res.status(500).json({
                    error: 'Registration failed',
                    code: 'REGISTRATION_ERROR'
                });
            }
        }
    });

    /**
     * POST /auth/login
     * Authenticate user and return tokens
     */
    router.post('/login', loginLimiter, loginValidation, async (req, res) => {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: errors.array()
                });
            }

            const { identifier, password, rememberMe } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;

            // Authenticate user
            const authResult = await authService.authenticateUser(identifier, password, ipAddress);

            // Set secure HTTP-only cookie for refresh token if remember me is enabled
            if (rememberMe) {
                res.cookie('refreshToken', authResult.tokens.refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
                });
            }

            res.json({
                success: true,
                message: 'Login successful',
                user: authResult.user,
                accessToken: authResult.tokens.accessToken,
                expiresIn: authResult.tokens.expiresIn,
                sessionId: authResult.sessionId
            });

        } catch (error) {
            console.error('Login error:', error.message);
            
            if (error.message.includes('Invalid credentials')) {
                return res.status(401).json({
                    error: 'Invalid username/email or password',
                    code: 'INVALID_CREDENTIALS'
                });
            } else if (error.message.includes('locked')) {
                return res.status(423).json({
                    error: error.message,
                    code: 'ACCOUNT_LOCKED'
                });
            } else {
                return res.status(500).json({
                    error: 'Login failed',
                    code: 'LOGIN_ERROR'
                });
            }
        }
    });

    /**
     * POST /auth/refresh
     * Refresh access token using refresh token
     */
    router.post('/refresh', async (req, res) => {
        try {
            const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
            
            if (!refreshToken) {
                return res.status(401).json({
                    error: 'Refresh token required',
                    code: 'REFRESH_TOKEN_REQUIRED'
                });
            }

            const tokens = await authService.refreshToken(refreshToken);

            res.json({
                success: true,
                accessToken: tokens.accessToken,
                expiresIn: tokens.expiresIn
            });

        } catch (error) {
            console.error('Token refresh error:', error.message);
            
            // Clear invalid refresh token cookie
            res.clearCookie('refreshToken');
            
            return res.status(401).json({
                error: 'Invalid or expired refresh token',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }
    });

    /**
     * POST /auth/logout
     * Logout user and invalidate session
     */
    router.post('/logout', authenticateToken, async (req, res) => {
        try {
            const sessionId = req.body.sessionId;
            
            await authService.logout(req.userId, sessionId);
            
            // Clear refresh token cookie
            res.clearCookie('refreshToken');

            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            console.error('Logout error:', error.message);
            
            return res.status(500).json({
                error: 'Logout failed',
                code: 'LOGOUT_ERROR'
            });
        }
    });

    /**
     * GET /auth/me
     * Get current user information
     */
    router.get('/me', authenticateToken, async (req, res) => {
        try {
            res.json({
                success: true,
                user: req.user
            });
        } catch (error) {
            console.error('Get user error:', error.message);
            
            return res.status(500).json({
                error: 'Failed to get user information',
                code: 'GET_USER_ERROR'
            });
        }
    });

    /**
     * POST /auth/change-password
     * Change user password
     */
    router.post('/change-password', authenticateToken, [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
    ], async (req, res) => {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: errors.array()
                });
            }

            const { currentPassword, newPassword } = req.body;
            
            await authService.updatePassword(req.userId, currentPassword, newPassword);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('Change password error:', error.message);
            
            if (error.message.includes('Current password is incorrect')) {
                return res.status(400).json({
                    error: 'Current password is incorrect',
                    code: 'INVALID_CURRENT_PASSWORD'
                });
            } else if (error.message.includes('Password validation failed')) {
                return res.status(400).json({
                    error: error.message,
                    code: 'WEAK_PASSWORD'
                });
            } else {
                return res.status(500).json({
                    error: 'Password change failed',
                    code: 'PASSWORD_CHANGE_ERROR'
                });
            }
        }
    });

    /**
     * POST /auth/cleanup-sessions
     * Clean up expired sessions (admin/maintenance endpoint)
     */
    router.post('/cleanup-sessions', authenticateToken, async (req, res) => {
        try {
            const cleanedCount = await authService.cleanupExpiredSessions();
            
            res.json({
                success: true,
                message: `Cleaned up ${cleanedCount} expired sessions`
            });

        } catch (error) {
            console.error('Session cleanup error:', error.message);
            
            return res.status(500).json({
                error: 'Session cleanup failed',
                code: 'CLEANUP_ERROR'
            });
        }
    });

    // Google OAuth Routes (only if configured)
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        /**
         * GET /auth/google
         * Initiate Google OAuth flow
         */
        router.get('/google', passport.authenticate('google', {
            scope: ['profile', 'email']
        }));

        /**
         * GET /auth/google/callback
         * Handle Google OAuth callback
         */
        router.get('/google/callback', 
            passport.authenticate('google', { session: false }),
            async (req, res) => {
                try {
                    const user = req.user;
                    const ipAddress = req.ip || req.connection.remoteAddress;

                    // Generate JWT tokens
                    const tokens = authService.generateTokens(user);
                    
                    // Create session
                    const sessionId = await authService.createSession(user.id, tokens.accessToken, tokens.refreshToken, ipAddress);

                    // Set secure HTTP-only cookie for refresh token
                    res.cookie('refreshToken', tokens.refreshToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
                    });

                    // Redirect to frontend with success
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
                    const redirectUrl = `${frontendUrl}/auth-google-success.html?token=${tokens.accessToken}&user=${encodeURIComponent(JSON.stringify({
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        profilePicture: user.profile_picture
                    }))}&sessionId=${sessionId}`;
                    
                    res.redirect(redirectUrl);

                } catch (error) {
                    console.error('Google OAuth callback error:', error);
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
                    res.redirect(`${frontendUrl}/auth-google-success.html?error=${encodeURIComponent('Authentication failed')}`);
                }
            }
        );

        /**
         * POST /auth/google/link
         * Link Google account to existing user
         */
        router.post('/google/link', authenticateToken, async (req, res) => {
            try {
                const { googleId, profilePicture } = req.body;
                
                if (!googleId) {
                    return res.status(400).json({
                        error: 'Google ID is required',
                        code: 'GOOGLE_ID_REQUIRED'
                    });
                }

                await authService.linkGoogleAccount(req.userId, googleId, profilePicture);

                res.json({
                    success: true,
                    message: 'Google account linked successfully'
                });

            } catch (error) {
                console.error('Google account linking error:', error);
                
                if (error.message.includes('already linked')) {
                    return res.status(409).json({
                        error: 'Google account is already linked to another user',
                        code: 'GOOGLE_ACCOUNT_ALREADY_LINKED'
                    });
                } else {
                    return res.status(500).json({
                        error: 'Failed to link Google account',
                        code: 'GOOGLE_LINK_ERROR'
                    });
                }
            }
        });

        /**
         * POST /auth/google/unlink
         * Unlink Google account from user
         */
        router.post('/google/unlink', authenticateToken, async (req, res) => {
            try {
                await authService.unlinkGoogleAccount(req.userId);

                res.json({
                    success: true,
                    message: 'Google account unlinked successfully'
                });

            } catch (error) {
                console.error('Google account unlinking error:', error);
                
                return res.status(500).json({
                    error: 'Failed to unlink Google account',
                    code: 'GOOGLE_UNLINK_ERROR'
                });
            }
        });
    }

    return router;
}

module.exports = createAuthRoutes;