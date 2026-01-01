/**
 * Authentication Middleware - PostgreSQL/Supabase Compatible
 * Handles JWT token verification and user context
 */

const AuthService = require('../services/AuthService');

/**
 * Create authentication middleware
 * @param {Object} dbManager - Database Manager instance
 * @returns {Function} Express middleware function
 */
function createAuthMiddleware(dbManager) {
    const authService = new AuthService();

    /**
     * Middleware to verify JWT token and set user context
     */
    const authenticateToken = async (req, res, next) => {
        try {
            // Get token from Authorization header
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

            if (!token) {
                return res.status(401).json({
                    error: 'Access token required',
                    code: 'TOKEN_REQUIRED'
                });
            }

            // Verify token
            const decoded = authService.verifyToken(token);
            
            // Get user details from database
            const result = await dbManager.query(
                'SELECT id, username, email, first_name, last_name, database_name FROM users WHERE id = $1',
                [decoded.userId]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({
                    error: 'User not found or inactive',
                    code: 'USER_NOT_FOUND'
                });
            }
            
            const user = result.rows[0];
            
            // Set user context in request
            req.user = user;
            req.userId = user.id;
            req.userDatabaseName = user.database_name;
            
            next();
        } catch (error) {
            console.error('Authentication error:', error);
            
            if (error.message.includes('jwt expired')) {
                return res.status(401).json({
                    error: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            
            if (error.message.includes('jwt malformed') || error.message.includes('invalid token')) {
                return res.status(401).json({
                    error: 'Invalid token',
                    code: 'TOKEN_INVALID'
                });
            }
            
            return res.status(401).json({
                error: 'Authentication failed',
                code: 'AUTH_FAILED'
            });
        }
    };

    /**
     * Optional authentication middleware
     * Sets user context if token is present, but doesn't require it
     */
    const optionalAuth = async (req, res, next) => {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                // No token provided, continue without user context
                req.user = null;
                req.userId = null;
                req.userDatabaseName = null;
                return next();
            }

            // Verify token
            const decoded = authService.verifyToken(token);
            
            // Get user details
            const result = await dbManager.query(
                'SELECT id, username, email, first_name, last_name, database_name FROM users WHERE id = $1',
                [decoded.userId]
            );
            
            if (result.rows.length > 0) {
                const user = result.rows[0];
                req.user = user;
                req.userId = user.id;
                req.userDatabaseName = user.database_name;
            } else {
                req.user = null;
                req.userId = null;
                req.userDatabaseName = null;
            }
            
            next();
        } catch (error) {
            // If token verification fails, continue without user context
            req.user = null;
            req.userId = null;
            req.userDatabaseName = null;
            next();
        }
    };

    /**
     * Admin authentication middleware
     * Requires valid token and admin privileges
     */
    const requireAdmin = async (req, res, next) => {
        try {
            // First authenticate the token
            await new Promise((resolve, reject) => {
                authenticateToken(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Check if user has admin privileges
            const result = await dbManager.query(
                'SELECT is_admin FROM users WHERE id = $1',
                [req.userId]
            );

            if (result.rows.length === 0 || !result.rows[0].is_admin) {
                return res.status(403).json({
                    error: 'Admin privileges required',
                    code: 'ADMIN_REQUIRED'
                });
            }

            next();
        } catch (error) {
            console.error('Admin authentication error:', error);
            return res.status(401).json({
                error: 'Authentication failed',
                code: 'AUTH_FAILED'
            });
        }
    };

    /**
     * Rate limiting middleware for authentication endpoints
     */
    const authRateLimit = require('express-rate-limit')({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 5),
        message: {
            error: 'Too many authentication attempts',
            code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Skip rate limiting for successful requests
            return req.method === 'GET' || res.statusCode < 400;
        }
    });

    return {
        authenticateToken,
        optionalAuth,
        requireAdmin,
        authRateLimit
    };
}

module.exports = createAuthMiddleware;