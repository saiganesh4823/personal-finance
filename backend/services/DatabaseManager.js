/**
 * Database Manager
 * Handles creation and management of separate databases for each user
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

class DatabaseManager {
    constructor() {
        this.masterConnection = null;
        this.userConnections = new Map(); // Cache user database connections
        this.initPromise = null; // Track initialization promise
    }

    /**
     * Initialize master database connection for user management
     */
    async initializeMasterConnection() {
        if (this.initPromise) {
            return this.initPromise;
        }
        
        this.initPromise = this._doInitialization();
        return this.initPromise;
    }
    
    async _doInitialization() {
        try {
            // Create master database if it doesn't exist (using query instead of execute)
            const tempConnection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                port: process.env.DB_PORT || 3306
            });
            
            await tempConnection.query('CREATE DATABASE IF NOT EXISTS finance_tracker_master');
            await tempConnection.end();
            
            // Connect to master database
            this.masterConnection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: 'finance_tracker_master',
                port: process.env.DB_PORT || 3306,
                multipleStatements: true
            });
            
            // Create users table in master database
            await this.createMasterUserTable();
            
            console.log('✅ Master database connection initialized');
        } catch (error) {
            console.error('❌ Failed to initialize master database:', error);
            throw error;
        }
    }

    /**
     * Create users table in master database
     */
    async createMasterUserTable() {
        const createUserTableSQL = `
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                google_id VARCHAR(255) UNIQUE,
                profile_picture VARCHAR(500),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                database_name VARCHAR(100) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                failed_login_attempts INT DEFAULT 0,
                locked_until TIMESTAMP NULL,
                
                INDEX idx_username (username),
                INDEX idx_email (email),
                INDEX idx_google_id (google_id),
                INDEX idx_database_name (database_name),
                INDEX idx_is_active (is_active)
            )
        `;
        
        await this.masterConnection.execute(createUserTableSQL);
        
        // Create user sessions table in master database
        const createSessionsTableSQL = `
            CREATE TABLE IF NOT EXISTS user_sessions (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                refresh_token_hash VARCHAR(255),
                expires_at TIMESTAMP NOT NULL,
                refresh_expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                ip_address VARCHAR(45),
                user_agent TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_token_hash (token_hash),
                INDEX idx_expires_at (expires_at),
                INDEX idx_is_active (is_active)
            )
        `;
        
        await this.masterConnection.execute(createSessionsTableSQL);
    }

    /**
     * Create a new database for a user
     * @param {string} userId - User ID
     * @param {string} username - Username for database naming
     * @returns {Promise<string>} Database name
     */
    async createUserDatabase(userId, username) {
        try {
            // Generate unique database name
            const sanitizedUsername = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const dbName = `finance_${sanitizedUsername}_${userId.substring(0, 8)}`;
            
            // Create the database using query instead of execute
            await this.masterConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
            
            // Create user-specific connection
            const userConnection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: dbName,
                port: process.env.DB_PORT || 3306,
                multipleStatements: true
            });
            
            // Create tables in user database
            await this.createUserDatabaseTables(userConnection);
            
            // Cache the connection
            this.userConnections.set(userId, userConnection);
            
            console.log(`✅ Created database for user ${username}: ${dbName}`);
            return dbName;
            
        } catch (error) {
            console.error('❌ Failed to create user database:', error);
            throw error;
        }
    }

    /**
     * Create tables in user's database
     * @param {Object} connection - Database connection
     */
    async createUserDatabaseTables(connection) {
        // Categories table
        const createCategoriesTable = `
            CREATE TABLE IF NOT EXISTS categories (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                color VARCHAR(7) NOT NULL,
                type ENUM('income', 'expense', 'both') NOT NULL,
                is_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_type (type),
                INDEX idx_is_default (is_default),
                INDEX idx_name (name)
            )
        `;
        
        // Transactions table
        const createTransactionsTable = `
            CREATE TABLE IF NOT EXISTS transactions (
                id VARCHAR(36) PRIMARY KEY,
                amount DECIMAL(15,2) NOT NULL,
                type ENUM('income', 'expense') NOT NULL,
                category_id VARCHAR(36) NOT NULL,
                date DATE NOT NULL,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
                INDEX idx_type (type),
                INDEX idx_date (date),
                INDEX idx_category_id (category_id),
                INDEX idx_created_at (created_at)
            )
        `;
        
        // Settings table (optional)
        const createSettingsTable = `
            CREATE TABLE IF NOT EXISTS settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `;
        
        await connection.execute(createCategoriesTable);
        await connection.execute(createTransactionsTable);
        await connection.execute(createSettingsTable);
    }

    /**
     * Get user's database connection
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Database connection
     */
    async getUserConnection(userId) {
        try {
            // Check if connection is cached
            if (this.userConnections.has(userId)) {
                const connection = this.userConnections.get(userId);
                // Test connection
                try {
                    await connection.execute('SELECT 1');
                    return connection;
                } catch (error) {
                    // Connection is stale, remove from cache
                    this.userConnections.delete(userId);
                }
            }
            
            // Get user's database name from master database
            const [users] = await this.masterConnection.execute(
                'SELECT database_name FROM users WHERE id = ? AND is_active = TRUE',
                [userId]
            );
            
            if (users.length === 0) {
                throw new Error('User not found or inactive');
            }
            
            const dbName = users[0].database_name;
            
            // Create new connection
            const userConnection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: dbName,
                port: process.env.DB_PORT || 3306
            });
            
            // Cache the connection
            this.userConnections.set(userId, userConnection);
            
            return userConnection;
            
        } catch (error) {
            console.error('❌ Failed to get user connection:', error);
            throw error;
        }
    }

    /**
     * Get master database connection
     * @returns {Object} Master database connection
     */
    async getMasterConnection() {
        if (!this.masterConnection) {
            await this.initializeMasterConnection();
        }
        return this.masterConnection;
    }

    /**
     * Create default categories for user
     * @param {string} userId - User ID
     */
    async createDefaultCategories(userId) {
        try {
            const connection = await this.getUserConnection(userId);
            
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
                    'INSERT INTO categories (id, name, color, type, is_default, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                    [categoryId, category.name, category.color, category.type, category.is_default]
                );
            }
            
            console.log(`✅ Created default categories for user ${userId}`);
            
        } catch (error) {
            console.error('❌ Failed to create default categories:', error);
            throw error;
        }
    }

    /**
     * Create default settings for user
     * @param {string} userId - User ID
     */
    async createDefaultSettings(userId) {
        try {
            const connection = await this.getUserConnection(userId);
            
            const defaultSettings = [
                { key: 'currency', value: 'USD' },
                { key: 'date_format', value: 'MM/DD/YYYY' },
                { key: 'theme', value: 'light' },
                { key: 'notifications', value: 'true' }
            ];

            for (const setting of defaultSettings) {
                await connection.execute(
                    'INSERT INTO settings (setting_key, setting_value, created_at) VALUES (?, ?, NOW())',
                    [setting.key, setting.value]
                );
            }
            
            console.log(`✅ Created default settings for user ${userId}`);
            
        } catch (error) {
            console.error('❌ Failed to create default settings:', error);
            // Don't throw error for settings, it's optional
        }
    }

    /**
     * Delete user's database
     * @param {string} userId - User ID
     */
    async deleteUserDatabase(userId) {
        try {
            // Get user's database name
            const [users] = await this.masterConnection.execute(
                'SELECT database_name FROM users WHERE id = ?',
                [userId]
            );
            
            if (users.length === 0) {
                throw new Error('User not found');
            }
            
            const dbName = users[0].database_name;
            
            // Close user connection if cached
            if (this.userConnections.has(userId)) {
                const connection = this.userConnections.get(userId);
                await connection.end();
                this.userConnections.delete(userId);
            }
            
            // Drop the database
            await this.masterConnection.execute(`DROP DATABASE IF EXISTS \`${dbName}\``);
            
            console.log(`✅ Deleted database for user ${userId}: ${dbName}`);
            
        } catch (error) {
            console.error('❌ Failed to delete user database:', error);
            throw error;
        }
    }

    /**
     * Close all connections
     */
    async closeAllConnections() {
        try {
            // Close all user connections
            for (const [userId, connection] of this.userConnections) {
                await connection.end();
            }
            this.userConnections.clear();
            
            // Close master connection
            if (this.masterConnection) {
                await this.masterConnection.end();
            }
            
            console.log('✅ All database connections closed');
            
        } catch (error) {
            console.error('❌ Error closing connections:', error);
        }
    }
}

module.exports = DatabaseManager;