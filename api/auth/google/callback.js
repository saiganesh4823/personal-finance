// Google OAuth callback endpoint for Vercel serverless
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { code, error } = req.query;
        
        if (error) {
            console.error('Google OAuth error:', error);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=oauth_failed`);
        }
        
        if (!code) {
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=no_code`);
        }
        
        // Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            }),
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            console.error('Failed to get access token:', tokenData);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=token_failed`);
        }
        
        // Get user info from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        
        const googleUser = await userResponse.json();
        
        if (!googleUser.id) {
            console.error('Failed to get user info:', googleUser);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=user_info_failed`);
        }
        
        // Check if user exists
        let userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR google_id = $2',
            [googleUser.email, googleUser.id]
        );
        
        let user;
        
        if (userResult.rows.length === 0) {
            // Create new user
            const userId = uuidv4();
            const username = googleUser.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);
            const databaseName = `supabase_user_${userId}`;
            
            const insertResult = await pool.query(
                `INSERT INTO users (id, username, email, first_name, last_name, database_name, google_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [userId, username, googleUser.email, googleUser.given_name, googleUser.family_name, databaseName, googleUser.id]
            );
            
            user = insertResult.rows[0];
            
            // Create default categories for new user
            await createDefaultCategories(userId);
            
        } else {
            user = userResult.rows[0];
            
            // Update Google ID if not set
            if (!user.google_id) {
                await pool.query(
                    'UPDATE users SET google_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [googleUser.id, user.id]
                );
            }
        }
        
        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                email: user.email
            },
            process.env.JWT_SECRET,
            { 
                expiresIn: process.env.JWT_EXPIRES_IN || '24h',
                issuer: process.env.JWT_ISSUER || 'finance-tracker',
                audience: process.env.JWT_AUDIENCE || 'finance-tracker-users'
            }
        );
        
        // Redirect to frontend with token
        const redirectUrl = `${process.env.FRONTEND_URL}/index.html?token=${token}&login=success`;
        res.redirect(302, redirectUrl);
        
    } catch (error) {
        console.error('Google OAuth callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login.html?error=callback_failed`);
    }
}

// Helper function to create default categories
async function createDefaultCategories(userId) {
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
            await pool.query(
                'INSERT INTO categories (id, user_id, name, color, type, is_default) VALUES ($1, $2, $3, $4, $5, $6)',
                [categoryId, userId, category.name, category.color, category.type, true]
            );
        }
    } catch (error) {
        console.error('Failed to create default categories:', error);
        // Don't throw error as user creation should still succeed
    }
}