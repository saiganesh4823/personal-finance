// Analytics categories endpoint for Vercel
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
        
        // Get category analytics for the date range
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select(`
                amount,
                type,
                categories (
                    id,
                    name,
                    color
                )
            `)
            .eq('user_id', userId)
            .gte('date', start_date)
            .lte('date', end_date);
        
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ error: 'Failed to fetch category analytics' });
        }
        
        // Group by category
        const categoryStats = {};
        
        if (transactions) {
            transactions.forEach(transaction => {
                const categoryName = transaction.categories?.name || 'Uncategorized';
                const categoryColor = transaction.categories?.color || '#gray';
                
                if (!categoryStats[categoryName]) {
                    categoryStats[categoryName] = {
                        name: categoryName,
                        color: categoryColor,
                        income: 0,
                        expenses: 0,
                        total: 0
                    };
                }
                
                const amount = parseFloat(transaction.amount);
                if (transaction.type === 'income') {
                    categoryStats[categoryName].income += amount;
                } else if (transaction.type === 'expense') {
                    categoryStats[categoryName].expenses += amount;
                }
                categoryStats[categoryName].total += amount;
            });
        }
        
        res.json(Object.values(categoryStats));
        
    } catch (error) {
        console.error('Analytics categories error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}