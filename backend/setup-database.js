const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'personal_finance_db',
            port: process.env.DB_PORT || 3306,
            multipleStatements: true
        });

        console.log('✅ Connected to MySQL database');

        // Create users table
        console.log('📝 Creating users table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                google_id VARCHAR(255) UNIQUE,
                profile_picture VARCHAR(500),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                failed_login_attempts INT DEFAULT 0,
                locked_until TIMESTAMP NULL
            )
        `);

        // Create user sessions table
        console.log('📝 Creating user_sessions table...');
        await connection.execute(`
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
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Check if user_id columns exist in categories and transactions
        console.log('📝 Checking existing table structure...');
        
        // Add user_id to categories if it doesn't exist
        try {
            await connection.execute(`
                ALTER TABLE categories ADD COLUMN user_id VARCHAR(36) AFTER id
            `);
            console.log('✅ Added user_id column to categories table');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️  user_id column already exists in categories table');
            } else {
                throw error;
            }
        }

        // Add user_id to transactions if it doesn't exist
        try {
            await connection.execute(`
                ALTER TABLE transactions ADD COLUMN user_id VARCHAR(36) AFTER id
            `);
            console.log('✅ Added user_id column to transactions table');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️  user_id column already exists in transactions table');
            } else {
                throw error;
            }
        }

        // Add foreign key constraints
        console.log('📝 Adding foreign key constraints...');
        try {
            await connection.execute(`
                ALTER TABLE categories ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            `);
        } catch (error) {
            if (error.code !== 'ER_DUP_KEYNAME') {
                console.log('⚠️  Foreign key constraint for categories may already exist');
            }
        }

        try {
            await connection.execute(`
                ALTER TABLE transactions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            `);
        } catch (error) {
            if (error.code !== 'ER_DUP_KEYNAME') {
                console.log('⚠️  Foreign key constraint for transactions may already exist');
            }
        }

        // Create default user for existing data
        console.log('📝 Creating default user...');
        const defaultUserId = 'default-user-123';
        try {
            await connection.execute(`
                INSERT INTO users (id, username, email, first_name, is_active, email_verified) 
                VALUES (?, 'default_user', 'user@localhost', 'Default User', TRUE, TRUE)
            `, [defaultUserId]);
            console.log('✅ Created default user');
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                console.log('ℹ️  Default user already exists');
            } else {
                throw error;
            }
        }

        // Migrate existing data to default user
        console.log('📝 Migrating existing data...');
        const [categoriesResult] = await connection.execute(`
            UPDATE categories SET user_id = ? WHERE user_id IS NULL
        `, [defaultUserId]);
        console.log(`✅ Migrated ${categoriesResult.affectedRows} categories to default user`);

        const [transactionsResult] = await connection.execute(`
            UPDATE transactions SET user_id = ? WHERE user_id IS NULL
        `, [defaultUserId]);
        console.log(`✅ Migrated ${transactionsResult.affectedRows} transactions to default user`);

        // Verify setup
        console.log('📝 Verifying setup...');
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        const [sessions] = await connection.execute('SELECT COUNT(*) as count FROM user_sessions');
        const [categories] = await connection.execute('SELECT COUNT(*) as count FROM categories WHERE user_id IS NOT NULL');
        const [transactions] = await connection.execute('SELECT COUNT(*) as count FROM transactions WHERE user_id IS NOT NULL');

        console.log('\n🎉 Database setup complete!');
        console.log(`📊 Users: ${users[0].count}`);
        console.log(`📊 Sessions: ${sessions[0].count}`);
        console.log(`📊 Categories with user_id: ${categories[0].count}`);
        console.log(`📊 Transactions with user_id: ${transactions[0].count}`);
        console.log('\n✅ Your Google OAuth should now work properly!');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

setupDatabase();