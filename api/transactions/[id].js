// Individual transaction API endpoint for Vercel
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
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
        
        // Get transaction ID from URL path
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }
        
        if (req.method === 'GET') {
            // Get single transaction
            const { data: transaction, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    categories (
                        id,
                        name,
                        color
                    )
                `)
                .eq('id', id)
                .eq('user_id', userId)
                .single();
            
            if (error) {
                console.error('Database error:', error);
                if (error.code === 'PGRST116') {
                    return res.status(404).json({ error: 'Transaction not found' });
                }
                return res.status(500).json({ error: 'Failed to fetch transaction' });
            }
            
            res.json(transaction);
            
        } else if (req.method === 'PUT') {
            // Update transaction
            const { type, amount, date, note, category_id } = req.body;
            
            const { data: transaction, error } = await supabase
                .from('transactions')
                .update({
                    type,
                    amount: parseFloat(amount),
                    date,
                    note,
                    category_id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('user_id', userId)
                .select(`
                    *,
                    categories (
                        id,
                        name,
                        color
                    )
                `)
                .single();
            
            if (error) {
                console.error('Database error:', error);
                if (error.code === 'PGRST116') {
                    return res.status(404).json({ error: 'Transaction not found' });
                }
                return res.status(500).json({ error: 'Failed to update transaction' });
            }
            
            res.json(transaction);
            
        } else if (req.method === 'DELETE') {
            // Delete transaction
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to delete transaction' });
            }
            
            res.json({ message: 'Transaction deleted successfully' });
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        console.error('Transaction API error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}