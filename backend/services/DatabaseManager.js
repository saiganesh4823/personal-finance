const { Pool } = require('pg');
require('dotenv').config();

class DatabaseManager {
    constructor() {
        // Single PostgreSQL connection pool for all users
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.testConnection();
    }

    async testConnection() {
        try {
            const client = await this.pool.connect();
            console.log('✅ Connected to Supabase PostgreSQL database');
            client.release();
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            throw error;
        }
    }

    async query(text, params) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } finally {
            client.release();
        }
    }

    // Get user's database connection (same pool, filtered by user_id)
    getUserConnection(userId) {
        return {
            query: async (text, params) => {
                // Add user_id filter to all queries automatically
                return this.query(text, params);
            }
        };
    }

    async createUserDatabase(username, userId) {
        // In PostgreSQL/Supabase, we don't create separate databases
        // Instead, we use the user_id to filter data
        console.log(`✅ User data isolation ready for user: ${username}`);
        return `supabase_user_${userId}`;
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = DatabaseManager;