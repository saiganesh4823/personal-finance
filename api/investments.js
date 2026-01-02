// Investment Portfolio API endpoint for Vercel
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
            const { type } = req.query;
            
            if (type === 'summary') {
                // Get investment summary
                const { data: summary, error } = await supabase
                    .rpc('get_investment_summary', { p_user_id: userId });
                
                if (error) {
                    console.error('Database error:', error);
                    return res.status(500).json({ error: 'Failed to fetch investment summary' });
                }
                
                res.json(summary || []);
                
            } else {
                // Get all portfolio investments
                let query = supabase
                    .from('investment_portfolio')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .order('total_invested', { ascending: false });
                
                if (type && type !== 'all') {
                    query = query.eq('investment_type', type);
                }
                
                const { data: investments, error } = await query;
                
                if (error) {
                    console.error('Database error:', error);
                    return res.status(500).json({ error: 'Failed to fetch investments' });
                }
                
                res.json(investments || []);
            }
            
        } else if (req.method === 'POST') {
            const { action } = req.query;
            
            if (action === 'add-transaction') {
                // Add investment transaction
                const {
                    investment_type,
                    investment_name,
                    category,
                    transaction_type,
                    amount,
                    units,
                    price_per_unit,
                    transaction_date,
                    notes
                } = req.body;
                
                // Validation
                if (!investment_type || !investment_name || !transaction_type || !amount) {
                    return res.status(400).json({ 
                        error: 'Investment type, name, transaction type, and amount are required' 
                    });
                }
                
                if (!['buy', 'sell', 'dividend', 'bonus'].includes(transaction_type)) {
                    return res.status(400).json({ error: 'Invalid transaction type' });
                }
                
                // Call the database function to add investment transaction
                const { data: transactionId, error } = await supabase
                    .rpc('add_investment_transaction', {
                        p_user_id: userId,
                        p_investment_type: investment_type,
                        p_investment_name: investment_name,
                        p_category: category || null,
                        p_transaction_type: transaction_type,
                        p_amount: parseFloat(amount),
                        p_units: parseFloat(units) || 0,
                        p_price_per_unit: parseFloat(price_per_unit) || 0,
                        p_transaction_date: transaction_date || new Date().toISOString().split('T')[0],
                        p_notes: notes || null
                    });
                
                if (error) {
                    console.error('Database error:', error);
                    return res.status(500).json({ error: 'Failed to add investment transaction' });
                }
                
                res.status(201).json({ 
                    message: 'Investment transaction added successfully',
                    transactionId 
                });
                
            } else {
                // Create new portfolio entry manually
                const {
                    investment_type,
                    investment_name,
                    category,
                    total_invested,
                    current_value,
                    units_quantity,
                    notes
                } = req.body;
                
                if (!investment_type || !investment_name) {
                    return res.status(400).json({ 
                        error: 'Investment type and name are required' 
                    });
                }
                
                const { data: investment, error } = await supabase
                    .from('investment_portfolio')
                    .insert({
                        user_id: userId,
                        investment_type,
                        investment_name,
                        category: category || null,
                        total_invested: parseFloat(total_invested) || 0,
                        current_value: parseFloat(current_value) || 0,
                        units_quantity: parseFloat(units_quantity) || 0,
                        notes: notes || null
                    })
                    .select()
                    .single();
                
                if (error) {
                    console.error('Database error:', error);
                    if (error.code === '23505') { // Unique constraint violation
                        return res.status(400).json({ error: 'Investment with this name and type already exists' });
                    }
                    return res.status(500).json({ error: 'Failed to create investment' });
                }
                
                res.status(201).json(investment);
            }
            
        } else if (req.method === 'PUT') {
            // Update investment portfolio entry
            const { id } = req.query;
            const {
                investment_name,
                category,
                total_invested,
                current_value,
                units_quantity,
                average_price,
                notes,
                is_active
            } = req.body;
            
            if (!id) {
                return res.status(400).json({ error: 'Investment ID is required' });
            }
            
            const updates = {
                updated_at: new Date().toISOString()
            };
            
            if (investment_name !== undefined) updates.investment_name = investment_name;
            if (category !== undefined) updates.category = category;
            if (total_invested !== undefined) updates.total_invested = parseFloat(total_invested);
            if (current_value !== undefined) updates.current_value = parseFloat(current_value);
            if (units_quantity !== undefined) updates.units_quantity = parseFloat(units_quantity);
            if (average_price !== undefined) updates.average_price = parseFloat(average_price);
            if (notes !== undefined) updates.notes = notes;
            if (is_active !== undefined) updates.is_active = is_active;
            
            const { data: investment, error } = await supabase
                .from('investment_portfolio')
                .update(updates)
                .eq('id', id)
                .eq('user_id', userId)
                .select()
                .single();
            
            if (error) {
                console.error('Database error:', error);
                if (error.code === 'PGRST116') {
                    return res.status(404).json({ error: 'Investment not found' });
                }
                return res.status(500).json({ error: 'Failed to update investment' });
            }
            
            res.json(investment);
            
        } else if (req.method === 'DELETE') {
            // Delete investment portfolio entry
            const { id } = req.query;
            
            if (!id) {
                return res.status(400).json({ error: 'Investment ID is required' });
            }
            
            const { error } = await supabase
                .from('investment_portfolio')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to delete investment' });
            }
            
            res.json({ message: 'Investment deleted successfully' });
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        console.error('Investment portfolio API error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}