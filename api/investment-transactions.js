// Investment Transactions API endpoint for Vercel
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
            const { portfolio_id, limit } = req.query;
            
            let query = supabase
                .from('investment_transactions')
                .select(`
                    *,
                    investment_portfolio (
                        investment_name,
                        investment_type,
                        category
                    )
                `)
                .eq('user_id', userId)
                .order('transaction_date', { ascending: false });
            
            if (portfolio_id) {
                query = query.eq('portfolio_id', portfolio_id);
            }
            
            if (limit) {
                query = query.limit(parseInt(limit));
            }
            
            const { data: transactions, error } = await query;
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to fetch investment transactions' });
            }
            
            res.json(transactions || []);
            
        } else if (req.method === 'POST') {
            // Add investment transaction (alternative to using the function)
            const {
                portfolio_id,
                transaction_type,
                amount,
                units,
                price_per_unit,
                transaction_date,
                notes
            } = req.body;
            
            // Validation
            if (!portfolio_id || !transaction_type || !amount) {
                return res.status(400).json({ 
                    error: 'Portfolio ID, transaction type, and amount are required' 
                });
            }
            
            if (!['buy', 'sell', 'dividend', 'bonus'].includes(transaction_type)) {
                return res.status(400).json({ error: 'Invalid transaction type' });
            }
            
            // Verify portfolio belongs to user
            const { data: portfolio, error: portfolioError } = await supabase
                .from('investment_portfolio')
                .select('id')
                .eq('id', portfolio_id)
                .eq('user_id', userId)
                .single();
            
            if (portfolioError || !portfolio) {
                return res.status(404).json({ error: 'Portfolio not found' });
            }
            
            const { data: transaction, error } = await supabase
                .from('investment_transactions')
                .insert({
                    user_id: userId,
                    portfolio_id,
                    transaction_type,
                    amount: parseFloat(amount),
                    units: parseFloat(units) || 0,
                    price_per_unit: parseFloat(price_per_unit) || 0,
                    transaction_date: transaction_date || new Date().toISOString().split('T')[0],
                    notes: notes || null
                })
                .select(`
                    *,
                    investment_portfolio (
                        investment_name,
                        investment_type,
                        category
                    )
                `)
                .single();
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to add investment transaction' });
            }
            
            res.status(201).json(transaction);
            
        } else if (req.method === 'PUT') {
            // Update investment transaction
            const { id } = req.query;
            const {
                transaction_type,
                amount,
                units,
                price_per_unit,
                transaction_date,
                notes
            } = req.body;
            
            if (!id) {
                return res.status(400).json({ error: 'Transaction ID is required' });
            }
            
            const updates = {};
            
            if (transaction_type !== undefined) updates.transaction_type = transaction_type;
            if (amount !== undefined) updates.amount = parseFloat(amount);
            if (units !== undefined) updates.units = parseFloat(units);
            if (price_per_unit !== undefined) updates.price_per_unit = parseFloat(price_per_unit);
            if (transaction_date !== undefined) updates.transaction_date = transaction_date;
            if (notes !== undefined) updates.notes = notes;
            
            const { data: transaction, error } = await supabase
                .from('investment_transactions')
                .update(updates)
                .eq('id', id)
                .eq('user_id', userId)
                .select(`
                    *,
                    investment_portfolio (
                        investment_name,
                        investment_type,
                        category
                    )
                `)
                .single();
            
            if (error) {
                console.error('Database error:', error);
                if (error.code === 'PGRST116') {
                    return res.status(404).json({ error: 'Investment transaction not found' });
                }
                return res.status(500).json({ error: 'Failed to update investment transaction' });
            }
            
            res.json(transaction);
            
        } else if (req.method === 'DELETE') {
            // Delete investment transaction
            const { id } = req.query;
            
            if (!id) {
                return res.status(400).json({ error: 'Transaction ID is required' });
            }
            
            const { error } = await supabase
                .from('investment_transactions')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to delete investment transaction' });
            }
            
            res.json({ message: 'Investment transaction deleted successfully' });
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        console.error('Investment transactions API error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}