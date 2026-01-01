/**
 * Authentication Service - PostgreSQL/Supabase Compatible
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
     */
    async comparePassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            throw new Error('Password comparison failed: ' + error.message);
        }
    }

    /**
     * Generate JWT tokens
     */
    generateTokens(user) {
        const payload = {
            userId: user.id,
            username: user.username,
            email: user.email
        };

        const accessToken = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn,
            issuer: process.env.JWT_ISSUER || 'finance-tracker',
            audience: process.env.JWT_AUDIENCE || 'finance-tracker-users'
        });

        const refreshToken = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtRefreshExpiresIn,
            issuer: process.env.JWT_ISSUER || 'finance-tracker',
            audience: process.env.JWT_AUDIENCE || 'finance-tracker-users'
        });

        return { accessToken, refreshToken };
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret, {
                issuer: process.env.JWT_ISSUER || 'finance-tracker',
                audience: process.env.JWT_AUDIENCE || 'finance-tracker-users'
            });
        } catch (error) {
            throw new Error('Token verification failed: ' + error.message);
        }
    }

    /**
     * Find user by email
     */
    async findUserByEmail(email) {
        try {
            const result = await this.dbManager.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );
            return result.rows[0] || null;
        } catch (error) {
            throw new Error('Database query failed: ' + error.message);
        }
    }

    /**
     * Find user by username
     */
    async findUserByUsername(username) {
        try {
            const result = await this.dbManager.query(
                'SELECT * FROM users WHERE username = $1',
                [username]
            );
            return result.rows[0] || null;
        } catch (error) {
            throw new Error('Database query failed: ' + error.message);
        }
    }

    /**
     * Find user by ID
     */
    async findUserById(userId) {
        try {
            const result = await this.dbManager.query(
                'SELECT * FROM users WHERE id = $1',
                [userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            throw new Error('Database query failed: ' + error.message);
        }
    }

    /**
     * Find user by Google ID
     */
    async findUserByGoogleId(googleId) {
        try {
            const result = await this.dbManager.query(
                'SELECT * FROM users WHERE google_id = $1',
                [googleId]
            );
            return result.rows[0] || null;
        } catch (error) {
            throw new Error('Database query failed: ' + error.message);
        }
    }

    /**
     * Create a new user
     */
    async createUser(userData) {
        try {
            const { username, email, password, firstName, lastName } = userData;
            
            // Check if user already exists
            const existingUser = await this.findUserByEmail(email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            const existingUsername = await this.findUserByUsername(username);
            if (existingUsername) {
                throw new Error('Username already taken');
            }

            // Hash password
            const passwordHash = await this.hashPassword(password);
            
            // Generate user ID and database name
            const userId = uuidv4();
            const databaseName = `supabase_user_${userId}`;

            // Create user
            const result = await this.dbManager.query(
                `INSERT INTO users (id, username, email, password_hash, first_name, last_name, database_name) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [userId, username, email, passwordHash, firstName, lastName, databaseName]
            );

            const user = result.rows[0];

            // Create default categories for the user
            await this.createDefaultCategories(userId);

            return user;
        } catch (error) {
            throw new Error('User creation failed: ' + error.message);
        }
    }

    /**
     * Create user from Google OAuth
     */
    async createUserFromGoogle(googleData) {
        try {
            const { googleId, email, firstName, lastName, profilePicture } = googleData;
            
            // Generate username from email
            const username = email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);
            
            const userId = uuidv4();
            const databaseName = `supabase_user_${userId}`;

            const result = await this.dbManager.query(
                `INSERT INTO users (id, username, email, first_name, last_name, database_name, google_id, profile_picture) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [userId, username, email, firstName, lastName, databaseName, googleId, profilePicture]
            );

            const user = result.rows[0];

            // Create default categories for the user
            await this.createDefaultCategories(userId);

            return user;
        } catch (error) {
            throw new Error('Google user creation failed: ' + error.message);
        }
    }

    /**
     * Link Google account to existing user
     */
    async linkGoogleAccount(userId, googleId, profilePicture) {
        try {
            await this.dbManager.query(
                'UPDATE users SET google_id = $1, profile_picture = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                [googleId, profilePicture, userId]
            );
        } catch (error) {
            throw new Error('Google account linking failed: ' + error.message);
        }
    }

    /**
     * Create default categories for a new user
     */
    async createDefaultCategories(userId) {
        try {
            const defaultCategories = [
                // Expense categories
                { name: 'Food & Dining', color: '#e74c3c', type: 'expense' },
                { name: 'Bills & Utilities', color: '#34495e', type: 'expense' },
                { name: 'Shopping', color: '#9b59b6', type: 'expense' },
                { name: 'Transportation', color: '#f39c12', type: 'expense' },
                { name: 'Entertainment', color: '#e67e22', type: 'expense' },
                { name: 'Healthcare', color: '#1abc9c', type: 'expense' },
                { name: 'Education', color: '#3498db', type: 'expense' },
                { name: 'Travel', color: '#2ecc71', type: 'expense' },
                { name: 'Personal Care', color: '#f1c40f', type: 'expense' },
                { name: 'Other Expenses', color: '#95a5a6', type: 'expense' },
                
                // Income categories
                { name: 'Salary', color: '#27ae60', type: 'income' },
                { name: 'Freelance', color: '#16a085', type: 'income' },
                { name: 'Investment', color: '#2980b9', type: 'income' },
                { name: 'Other Income', color: '#8e44ad', type: 'income' }
            ];

            for (const category of defaultCategories) {
                const categoryId = uuidv4();
                await this.dbManager.query(
                    'INSERT INTO categories (id, user_id, name, color, type, is_default) VALUES ($1, $2, $3, $4, $5, $6)',
                    [categoryId, userId, category.name, category.color, category.type, true]
                );
            }
        } catch (error) {
            console.error('Failed to create default categories:', error);
            // Don't throw error here as user creation should still succeed
        }
    }

    /**
     * Authenticate user login
     */
    async authenticateUser(identifier, password) {
        try {
            // Find user by email or username
            let user = await this.findUserByEmail(identifier);
            if (!user) {
                user = await this.findUserByUsername(identifier);
            }

            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Check password
            const isValidPassword = await this.comparePassword(password, user.password_hash);
            if (!isValidPassword) {
                throw new Error('Invalid credentials');
            }

            // Generate tokens
            const tokens = this.generateTokens(user);

            // Store refresh token
            await this.storeRefreshToken(user.id, tokens.refreshToken);

            return {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    databaseName: user.database_name
                },
                ...tokens
            };
        } catch (error) {
            throw new Error('Authentication failed: ' + error.message);
        }
    }

    /**
     * Store refresh token
     */
    async storeRefreshToken(userId, refreshToken) {
        try {
            const sessionId = uuidv4();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

            await this.dbManager.query(
                'INSERT INTO user_sessions (id, user_id, session_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4, $5)',
                [sessionId, userId, sessionId, refreshToken, expiresAt]
            );
        } catch (error) {
            console.error('Failed to store refresh token:', error);
            // Don't throw error as login should still succeed
        }
    }

    /**
     * Logout user
     */
    async logout(userId, sessionId = null) {
        try {
            if (sessionId) {
                await this.dbManager.query(
                    'DELETE FROM user_sessions WHERE user_id = $1 AND session_token = $2',
                    [userId, sessionId]
                );
            } else {
                // Logout from all sessions
                await this.dbManager.query(
                    'DELETE FROM user_sessions WHERE user_id = $1',
                    [userId]
                );
            }
        } catch (error) {
            console.error('Logout failed:', error);
            // Don't throw error as logout should be graceful
        }
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = this.verifyToken(refreshToken);
            
            // Find user
            const user = await this.findUserById(decoded.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Check if refresh token exists in database
            const session = await this.dbManager.query(
                'SELECT * FROM user_sessions WHERE user_id = $1 AND refresh_token = $2 AND expires_at > CURRENT_TIMESTAMP',
                [user.id, refreshToken]
            );

            if (session.rows.length === 0) {
                throw new Error('Invalid refresh token');
            }

            // Generate new tokens
            const tokens = this.generateTokens(user);

            // Update refresh token in database
            await this.dbManager.query(
                'UPDATE user_sessions SET refresh_token = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND refresh_token = $3',
                [tokens.refreshToken, user.id, refreshToken]
            );

            return tokens;
        } catch (error) {
            throw new Error('Token refresh failed: ' + error.message);
        }
    }
}

module.exports = AuthService;