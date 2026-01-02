// Process Recurring Transactions API endpoint for Vercel
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Check if this is a cron job or user request
        const cronSecret = req.headers['x-cron-secret'];
        let userId = null;
        
        if (cronSecret === process.env.CRON_SECRET) {
            // Automated cron job - process all users
            console.log('Processing recurring transactions via cron job');
        } else {
            // User request - verify JWT token
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'No token provided' });
            }
            
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
        }
        
        // Call the database function to process recurring transactions
        const { data, error } = await supabase.rpc('process_recurring_transactions');
        
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ error: 'Failed to process recurring transactions' });
        }
        
        const transactionsCreated = data || 0;
        
        res.json({
            message: 'Recurring transactions processed successfully',
            transactionsCreated,
            processedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Process recurring transactions error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}