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
        const masterConnection = this.dbManager.getMasterConnection();
        
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
        const masterConnection = this.dbManager.getMasterConnection();
        
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

    /**
     * Refresh access token using refresh token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<Object>} New tokens
     */
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = this.verifyToken(refreshToken);
            
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid refresh token');
            }

            // Get user
            const [users] = await this.pool.execute(
                'SELECT id, username, email, first_name, last_name, is_active FROM users WHERE id = ? AND is_active = TRUE',
                [decoded.userId]
            );

            if (users.length === 0) {
                throw new Error('User not found or inactive');
            }

            const user = users[0];
            
            // Generate new tokens
            const tokens = this.generateTokens(user);
            
            // Update session with new token hashes
            const tokenHash = await this.hashPassword(tokens.accessToken);
            const refreshTokenHash = await this.hashPassword(tokens.refreshToken);
            
            await this.pool.execute(
                `UPDATE user_sessions 
                 SET token_hash = ?, refresh_token_hash = ?, 
                     expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR),
                     refresh_expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY),
                     last_used = NOW()
                 WHERE user_id = ? AND is_active = TRUE`,
                [tokenHash, refreshTokenHash, user.id]
            );

            return tokens;
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Logout user and invalidate session
     * @param {string} userId - User ID
     * @param {string} sessionId - Session ID (optional)
     * @returns {Promise<void>}
     */
    async logout(userId, sessionId = null) {
        try {
            if (sessionId) {
                // Invalidate specific session
                await this.pool.execute(
                    'UPDATE user_sessions SET is_active = FALSE WHERE id = ? AND user_id = ?',
                    [sessionId, userId]
                );
            } else {
                // Invalidate all sessions for user
                await this.pool.execute(
                    'UPDATE user_sessions SET is_active = FALSE WHERE user_id = ?',
                    [userId]
                );
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User object
     */
    async getUserById(userId) {
        try {
            const [users] = await this.pool.execute(
                'SELECT id, username, email, first_name, last_name, profile_picture, created_at, last_login FROM users WHERE id = ? AND is_active = TRUE',
                [userId]
            );

            if (users.length === 0) {
                throw new Error('User not found');
            }

            return users[0];
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update user password
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<void>}
     */
    async updatePassword(userId, currentPassword, newPassword) {
        try {
            // Get current password hash
            const [users] = await this.pool.execute(
                'SELECT password_hash FROM users WHERE id = ? AND is_active = TRUE',
                [userId]
            );

            if (users.length === 0) {
                throw new Error('User not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await this.comparePassword(currentPassword, users[0].password_hash);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            // Validate new password strength
            const passwordValidation = this.validatePasswordStrength(newPassword);
            if (!passwordValidation.isValid) {
                throw new Error('Password validation failed: ' + passwordValidation.errors.join(', '));
            }

            // Hash new password
            const newPasswordHash = await this.hashPassword(newPassword);

            // Update password
            await this.pool.execute(
                'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
                [newPasswordHash, userId]
            );

            // Invalidate all sessions to force re-login
            await this.logout(userId);

        } catch (error) {
            throw error;
        }
    }

    /**
     * Clean up expired sessions
     * @returns {Promise<number>} Number of cleaned sessions
     */
    async cleanupExpiredSessions() {
        try {
            const [result] = await this.pool.execute(
                'DELETE FROM user_sessions WHERE expires_at < NOW() OR refresh_expires_at < NOW()'
            );

            return result.affectedRows;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create default categories for a new user
     * @param {Object} connection - Database connection
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async createDefaultCategories(connection, userId) {
        const defaultCategories = [
            // Income categories
            { name: 'Salary', color: '#27ae60', type: 'income', is_default: true },
            { name: 'Freelance', color: '#2ecc71', type: 'income', is_default: true },
            { name: 'Investment', color: '#16a085', type: 'income', is_default: true },
            { name: 'Other Income', color: '#1abc9c', type: 'income', is_default: true },
            
            // Expense categories
            { name: 'Food & Dining', color: '#e74c3c', type: 'expense', is_default: true },
            { name: 'Transportation', color: '#e67e22', type: 'expense', is_default: true },
            { name: 'Shopping', color: '#f39c12', type: 'expense', is_default: true },
            { name: 'Entertainment', color: '#9b59b6', type: 'expense', is_default: true },
            { name: 'Bills & Utilities', color: '#34495e', type: 'expense', is_default: true },
            { name: 'Healthcare', color: '#1abc9c', type: 'expense', is_default: true },
            { name: 'Education', color: '#3498db', type: 'expense', is_default: true },
            { name: 'Travel', color: '#e91e63', type: 'expense', is_default: true },
            { name: 'Home & Garden', color: '#795548', type: 'expense', is_default: true },
            { name: 'Other Expenses', color: '#607d8b', type: 'expense', is_default: true }
        ];

        for (const category of defaultCategories) {
            const categoryId = uuidv4();
            await connection.execute(
                'INSERT INTO categories (id, user_id, name, color, type, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [categoryId, userId, category.name, category.color, category.type, category.is_default]
            );
        }
    }

    /**
     * Create default settings for a new user
     * @param {Object} connection - Database connection
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async createDefaultSettings(connection, userId) {
        // Check if settings table exists
        try {
            const defaultSettings = [
                { key: 'currency', value: 'USD' },
                { key: 'date_format', value: 'MM/DD/YYYY' },
                { key: 'theme', value: 'light' },
                { key: 'notifications', value: 'true' }
            ];

            for (const setting of defaultSettings) {
                await connection.execute(
                    'INSERT INTO settings (setting_key, user_id, setting_value, created_at) VALUES (?, ?, ?, NOW())',
                    [setting.key, userId, setting.value]
                );
            }
        } catch (error) {
            // Settings table might not exist, that's okay for now
            console.log('Settings table not found, skipping default settings creation');
        }
    }

    /**
     * Find user by Google ID
     * @param {string} googleId - Google user ID
     * @returns {Promise<Object|null>} User object or null
     */
    async findUserByGoogleId(googleId) {
        try {
            const [users] = await this.pool.execute(
                'SELECT id, username, email, first_name, last_name, google_id, profile_picture, created_at, last_login FROM users WHERE google_id = ? AND is_active = TRUE',
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
            const [users] = await this.pool.execute(
                'SELECT id, username, email, first_name, last_name, google_id, profile_picture, created_at, last_login FROM users WHERE email = ? AND is_active = TRUE',
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
            const [users] = await this.pool.execute(
                'SELECT id, username, email, first_name, last_name, google_id, profile_picture, created_at, last_login FROM users WHERE id = ? AND is_active = TRUE',
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
        const connection = await this.pool.getConnection();
        
        try {
            await connection.beginTransaction();

            const { googleId, email, firstName, lastName, profilePicture } = googleUser;
            
            // Generate username from email (fallback if needed)
            let username = email.split('@')[0];
            
            // Check if username already exists and make it unique
            const [existingUsers] = await connection.execute(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );

            if (existingUsers.length > 0) {
                username = `${username}_${Date.now()}`;
            }

            // Create user
            const userId = uuidv4();
            await connection.execute(
                `INSERT INTO users (
                    id, username, email, google_id, first_name, last_name, profile_picture,
                    is_active, email_verified, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, NOW())`,
                [userId, username, email, googleId, firstName || null, lastName || null, profilePicture || null]
            );

            // Create default categories and settings in user's database
            await this.dbManager.createDefaultCategories(userId);
            await this.dbManager.createDefaultSettings(userId);

            await connection.commit();

            // Return user
            const [newUser] = await connection.execute(
                'SELECT id, username, email, first_name, last_name, google_id, profile_picture, created_at FROM users WHERE id = ?',
                [userId]
            );

            return newUser[0];
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
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
            // Check if Google ID is already linked to another user
            const [existingUsers] = await this.pool.execute(
                'SELECT id FROM users WHERE google_id = ? AND id != ?',
                [googleId, userId]
            );

            if (existingUsers.length > 0) {
                throw new Error('Google account is already linked to another user');
            }

            // Link Google account
            await this.pool.execute(
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
            await this.pool.execute(
                'UPDATE users SET google_id = NULL, updated_at = NOW() WHERE id = ?',
                [userId]
            );
        } catch (error) {
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
            const sessionId = uuidv4();
            const tokenHash = await this.hashPassword(accessToken);
            const refreshTokenHash = await this.hashPassword(refreshToken);
            
            await this.pool.execute(
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
}

module.exports = AuthService;