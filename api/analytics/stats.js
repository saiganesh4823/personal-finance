// Analytics stats endpoint for Vercel
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Verify JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        const { start_date, end_date } = req.query;
        
        // Get transaction stats for the date range
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('type, amount')
            .eq('user_id', userId)
            .gte('date', start_date)
            .lte('date', end_date);
        
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ error: 'Failed to fetch analytics' });
        }
        
        // Calculate stats
        const stats = {
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
            transactionCount: transactions?.length || 0
        };
        
        if (transactions) {
            transactions.forEach(transaction => {
                if (transaction.type === 'income') {
                    stats.totalIncome += parseFloat(transaction.amount);
                } else if (transaction.type === 'expense') {
                    stats.totalExpenses += parseFloat(transaction.amount);
                }
            });
        }
        
        stats.netBalance = stats.totalIncome - stats.totalExpenses;
        
        res.json(stats);
        
    } catch (error) {
        console.error('Analytics stats error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}