// Monthly Balance API endpoint for Vercel
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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
        
        if (req.method === 'GET') {
            // Get monthly balance data
            const { year, month } = req.query;
            
            let query = supabase
                .from('monthly_balances')
                .select('*')
                .eq('user_id', userId);
            
            if (year && month) {
                query = query.eq('year', parseInt(year)).eq('month', parseInt(month));
            } else {
                // Get current month if no specific month requested
                const now = new Date();
                query = query.eq('year', now.getFullYear()).eq('month', now.getMonth() + 1);
            }
            
            const { data: balances, error } = await query.order('year', { ascending: false }).order('month', { ascending: false });
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to fetch balance data' });
            }
            
            res.json(balances || []);
            
        } else if (req.method === 'POST') {
            // Update user currency preference
            const { currency } = req.body;
            
            if (!currency) {
                return res.status(400).json({ error: 'Currency is required' });
            }
            
            const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD'];
            if (!validCurrencies.includes(currency)) {
                return res.status(400).json({ error: 'Invalid currency code' });
            }
            
            const { data: user, error } = await supabase
                .from('users')
                .update({ currency, updated_at: new Date().toISOString() })
                .eq('id', userId)
                .select('id, username, email, currency')
                .single();
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to update currency preference' });
            }
            
            res.json({ message: 'Currency updated successfully', user });
            
        } else if (req.method === 'PUT') {
            // Set opening balance for a month
            const { year, month, opening_balance } = req.body;
            
            if (!year || !month || opening_balance === undefined) {
                return res.status(400).json({ error: 'Year, month, and opening_balance are required' });
            }
            
            // Get or create monthly balance record
            const { data: existingBalance } = await supabase
                .from('monthly_balances')
                .select('*')
                .eq('user_id', userId)
                .eq('year', year)
                .eq('month', month)
                .single();
            
            if (existingBalance) {
                // Update existing record
                const { data: balance, error } = await supabase
                    .from('monthly_balances')
                    .update({
                        opening_balance: parseFloat(opening_balance),
                        closing_balance: parseFloat(opening_balance) + existingBalance.monthly_income - existingBalance.monthly_expenses,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)
                    .eq('year', year)
                    .eq('month', month)
                    .select()
                    .single();
                
                if (error) {
                    console.error('Database error:', error);
                    return res.status(500).json({ error: 'Failed to update opening balance' });
                }
                
                res.json(balance);
            } else {
                // Create new record
                const { data: balance, error } = await supabase
                    .from('monthly_balances')
                    .insert({
                        user_id: userId,
                        year: parseInt(year),
                        month: parseInt(month),
                        opening_balance: parseFloat(opening_balance),
                        monthly_income: 0.00,
                        monthly_expenses: 0.00,
                        closing_balance: parseFloat(opening_balance),
                        old_balance_used: 0.00
                    })
                    .select()
                    .single();
                
                if (error) {
                    console.error('Database error:', error);
                    return res.status(500).json({ error: 'Failed to create balance record' });
                }
                
                res.json(balance);
            }
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        console.error('Balance API error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}