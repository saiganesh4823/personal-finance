/**
 * Authentication Service
 * Handles user authentication, password management, and JWT tokens
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('./DatabaseManager');

class AuthService {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
        this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
        this.lockoutDuration = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;
        
        if (!this.jwtSecret) {
            throw new Error('JWT_SECRET environment variable is required');
        }
    }

    /**
     * Hash a password using bcrypt
     * @param {string} password - Plain text password
     * @returns {Promise<string>} Hashed password
     */
    async hashPassword(password) {
        try {
            const salt = await bcrypt.genSalt(this.bcryptRounds);
            return await bcrypt.hash(password, salt);
        } catch (error) {
            throw new Error('Password hashing failed: ' + error.message);
        }
    }

    /**
     * Compare a password with its hash
     * @param {string} password - Plain text password
     * @param {string} hash - Hashed password
     * @returns {Promise<boolean>} True if password matches
     */
    async comparePassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            throw new Error('Password comparison failed: ' + error.message);
        }
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} Validation result with isValid and errors
     */
    validatePasswordStrength(password) {
        const errors = [];
        
        if (!password || password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate JWT token for user
     * @param {Object} user - User object
     * @returns {Object} Token object with access and refresh tokens
     */
    generateTokens(user) {
        try {
            const payload = {
                userId: user.id,
                username: user.username,
                email: user.email
            };

            const accessToken = jwt.sign(payload, this.jwtSecret, {
                expiresIn: this.jwtExpiresIn,
                issuer: 'finance-tracker',
                audience: 'finance-tracker-users'
            });

            const refreshToken = jwt.sign(
                { userId: user.id, type: 'refresh' },
                this.jwtSecret,
                {
                    expiresIn: this.jwtRefreshExpiresIn,
                    issuer: 'finance-tracker',
                    audience: 'finance-tracker-users'
                }
            );

            return {
                accessToken,
                refreshToken,
                expiresIn: this.jwtExpiresIn
            };
        } catch (error) {
            throw new Error('Token generation failed: ' + error.message);
        }
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token to verify
     * @returns {Object} Decoded token payload
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret, {
                issuer: 'finance-tracker',
                audience: 'finance-tracker-users'
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            } else {
                throw new Error('Token verification failed: ' + error.message);
            }
        }
    }

    /**
     * Create a new user account
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Created user object
     */
    async createUser(userData) {
        const masterConnection = await this.dbManager.getMasterConnection();
        
        try {
            await masterConnection.beginTransaction();

            const { username, email, password, firstName, lastName } = userData;
            
            // Validate password strength
            const passwordValidation = this.validatePasswordStrength(password);
            if (!passwordValidation.isValid) {
                throw new Error('Password validation failed: ' + passwordValidation.errors.join(', '));
            }

            // Check if username or email already exists
            const [existingUsers] = await masterConnection.execute(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username, email]
            );

            if (existingUsers.length > 0) {
                throw new Error('Username or email already exists');
            }

            // Hash password
            const passwordHash = await this.hashPassword(password);
            
            // Create user ID and database name
            const userId = uuidv4();
            const dbName = await this.dbManager.createUserDatabase(userId, username);
            
            // Create user in master database
            await masterConnection.execute(
                `INSERT INTO users (
                    id, username, email, password_hash, first_name, last_name, database_name,
                    is_active, email_verified, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, FALSE, NOW())`,
                [userId, username, email, passwordHash, firstName || null, lastName || null, dbName]
            );

            // Create default categories and settings in user's database
            await this.dbManager.createDefaultCategories(userId);
            await this.dbManager.createDefaultSettings(userId);

            await masterConnection.commit();

            // Return user without password hash
            const [newUser] = await masterConnection.execute(
                'SELECT id, username, email, first_name, last_name, database_name, created_at, is_active FROM users WHERE id = ?',
                [userId]
            );

            return newUser[0];
            
        } catch (error) {
            await masterConnection.rollback();
            throw error;
        }
    }

    /**
     * Authenticate user with username/email and password
     * @param {string} identifier - Username or email
     * @param {string} password - Plain text password
     * @param {string} ipAddress - Client IP address
     * @returns {Promise<Object>} Authentication result with user and tokens
     */
    async authenticateUser(identifier, password, ipAddress = null) {
        const masterConnection = await this.dbManager.getMasterConnection();
        
        try {
            // Get user by username or email
            const [users] = await masterConnection.execute(
                `SELECT id, username, email, password_hash, first_name, last_name, database_name,
                        is_active, failed_login_attempts, locked_until
                 FROM users 
                 WHERE (username = ? OR email = ?) AND is_active = TRUE`,
                [identifier, identifier]
            );

            if (users.length === 0) {
                throw new Error('Invalid credentials');
            }

            const user = users[0];

            // Check if account is locked
            if (user.locked_until && new Date() < new Date(user.locked_until)) {
                const lockoutEnd = new Date(user.locked_until);
                throw new Error(`Account is locked until ${lockoutEnd.toLocaleString()}`);
            }

            // Verify password
            const isPasswordValid = await this.comparePassword(password, user.password_hash);
            
            if (!isPasswordValid) {
                // Increment failed login attempts
                const newFailedAttempts = user.failed_login_attempts + 1;
                let lockoutTime = null;
                
                if (newFailedAttempts >= this.maxLoginAttempts) {
                    lockoutTime = new Date(Date.now() + this.lockoutDuration * 60 * 1000);
                }
                
                await masterConnection.execute(
                    'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
                    [newFailedAttempts, lockoutTime, user.id]
                );
                
                throw new Error('Invalid credentials');
            }

            // Reset failed login attempts on successful login
            await masterConnection.execute(
                'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?',
                [user.id]
            );

            // Generate tokens
            const tokens = this.generateTokens(user);
            
            // Store session in master database
            const sessionId = uuidv4();
            const tokenHash = await this.hashPassword(tokens.accessToken);
            const refreshTokenHash = await this.hashPassword(tokens.refreshToken);
            
            await masterConnection.execute(
                `INSERT INTO user_sessions (
                    id, user_id, token_hash, refresh_token_hash,
                    expires_at, refresh_expires_at, ip_address, created_at
                ) VALUES (?, ?, ?, ?, 
                    DATE_ADD(NOW(), INTERVAL 24 HOUR),
                    DATE_ADD(NOW(), INTERVAL 30 DAY),
                    ?, NOW())`,
                [sessionId, user.id, tokenHash, refreshTokenHash, ipAddress]
            );

            // Return user data without sensitive information
            const userData = {
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                databaseName: user.database_name
            };

            return {
                user: userData,
                tokens,
                sessionId
            };
            
        } catch (error) {
            throw error;
        }
    }

    // Google OAuth Methods

    /**
     * Find user by Google ID
     * @param {string} googleId - Google user ID
     * @returns {Promise<Object|null>} User object or null
     */
    async findUserByGoogleId(googleId) {
        try {
            const masterConnection = await this.dbManager.getMasterConnection();
            const [users] = await masterConnection.execute(
                'SELECT id, username, email, first_name, last_name, google_id, profile_picture, database_name, created_at, last_login FROM users WHERE google_id = ? AND is_active = TRUE',
                [googleId]
            );

            return users.length > 0 ? users[0] : null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Find user by email
     * @param {string} email - Email address
     * @returns {Promise<Object|null>} User object or null
     */
    async findUserByEmail(email) {
        try {
            const masterConnection = await this.dbManager.getMasterConnection();
            const [users] = await masterConnection.execute(
                'SELECT id, username, email, first_name, last_name, google_id, profile_picture, database_name, created_at, last_login FROM users WHERE email = ? AND is_active = TRUE',
                [email]
            );

            return users.length > 0 ? users[0] : null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Find user by ID
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} User object or null
     */
    async findUserById(userId) {
        try {
            const masterConnection = await this.dbManager.getMasterConnection();
            const [users] = await masterConnection.execute(
                'SELECT id, username, email, first_name, last_name, google_id, profile_picture, database_name, created_at, last_login FROM users WHERE id = ? AND is_active = TRUE',
                [userId]
            );

            return users.length > 0 ? users[0] : null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create user from Google OAuth data
     * @param {Object} googleUser - Google user data
     * @returns {Promise<Object>} Created user object
     */
    async createUserFromGoogle(googleUser) {
        const masterConnection = await this.dbManager.getMasterConnection();
        
        try {
            await masterConnection.beginTransaction();

            const { googleId, email, firstName, lastName, profilePicture } = googleUser;
            
            // Generate username from email (fallback if needed)
            let username = email.split('@')[0];
            
            // Check if username already exists and make it unique
            const [existingUsers] = await masterConnection.execute(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );

            if (existingUsers.length > 0) {
                username = `${username}_${Date.now()}`;
            }

            // Create user ID and database
            const userId = uuidv4();
            const dbName = await this.dbManager.createUserDatabase(userId, username);
            
            // Create user in master database
            await masterConnection.execute(
                `INSERT INTO users (
                    id, username, email, google_id, first_name, last_name, profile_picture, database_name,
                    is_active, email_verified, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, NOW())`,
                [userId, username, email, googleId, firstName || null, lastName || null, profilePicture || null, dbName]
            );

            // Create default categories and settings in user's database
            await this.dbManager.createDefaultCategories(userId);
            await this.dbManager.createDefaultSettings(userId);

            await masterConnection.commit();

            // Return user
            const [newUser] = await masterConnection.execute(
                'SELECT id, username, email, first_name, last_name, google_id, profile_picture, database_name, created_at FROM users WHERE id = ?',
                [userId]
            );

            return newUser[0];
            
        } catch (error) {
            await masterConnection.rollback();
            throw error;
        }
    }

    /**
     * Create session for user
     * @param {string} userId - User ID
     * @param {string} accessToken - Access token
     * @param {string} refreshToken - Refresh token
     * @param {string} ipAddress - IP address
     * @returns {Promise<string>} Session ID
     */
    async createSession(userId, accessToken, refreshToken, ipAddress = null) {
        try {
            const masterConnection = await this.dbManager.getMasterConnection();
            const sessionId = uuidv4();
            const tokenHash = await this.hashPassword(accessToken);
            const refreshTokenHash = await this.hashPassword(refreshToken);
            
            await masterConnection.execute(
                `INSERT INTO user_sessions (
                    id, user_id, token_hash, refresh_token_hash,
                    expires_at, refresh_expires_at, ip_address, created_at
                ) VALUES (?, ?, ?, ?, 
                    DATE_ADD(NOW(), INTERVAL 24 HOUR),
                    DATE_ADD(NOW(), INTERVAL 30 DAY),
                    ?, NOW())`,
                [sessionId, userId, tokenHash, refreshTokenHash, ipAddress]
            );

            return sessionId;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Link Google account to existing user
     * @param {string} userId - User ID
     * @param {string} googleId - Google user ID
     * @param {string} profilePicture - Profile picture URL
     * @returns {Promise<void>}
     */
    async linkGoogleAccount(userId, googleId, profilePicture = null) {
        try {
            const masterConnection = await this.dbManager.getMasterConnection();
            
            // Check if Google ID is already linked to another user
            const [existingUsers] = await masterConnection.execute(
                'SELECT id FROM users WHERE google_id = ? AND id != ?',
                [googleId, userId]
            );

            if (existingUsers.length > 0) {
                throw new Error('Google account is already linked to another user');
            }

            // Link Google account
            await masterConnection.execute(
                'UPDATE users SET google_id = ?, profile_picture = ?, updated_at = NOW() WHERE id = ?',
                [googleId, profilePicture, userId]
            );

        } catch (error) {
            throw error;
        }
    }

    /**
     * Unlink Google account from user
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async unlinkGoogleAccount(userId) {
        try {
            const masterConnection = await this.dbManager.getMasterConnection();
            await masterConnection.execute(
                'UPDATE users SET google_id = NULL, updated_at = NOW() WHERE id = ?',
                [userId]
            );
        } catch (error) {
            throw error;
        }
    }
}

module.exports = AuthService;