// Recurring Transactions API endpoint for Vercel
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
        const { action } = req.query;
        
        if (action === 'process') {
            // Handle recurring transaction processing
            return await handleProcessRecurring(req, res);
        } else {
            // Handle regular recurring transaction CRUD
            return await handleRecurringCRUD(req, res);
        }
        
    } catch (error) {
        console.error('Recurring transactions API error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Handle recurring transaction processing
async function handleProcessRecurring(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
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
}

// Handle regular recurring transaction CRUD
async function handleRecurringCRUD(req, res) {
    // Verify JWT token for CRUD operations
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
        
        if (req.method === 'GET') {
            // Get all recurring transactions for user
            const { data: recurringTransactions, error } = await supabase
                .from('recurring_transactions')
                .select(`
                    *,
                    categories (
                        id,
                        name,
                        color
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to fetch recurring transactions' });
            }
            
            res.json(recurringTransactions || []);
            
        } else if (req.method === 'POST') {
            // Create new recurring transaction
            const { 
                name, 
                type, 
                amount, 
                category_id, 
                frequency, 
                start_date, 
                end_date, 
                day_of_month, 
                day_of_week, 
                note 
            } = req.body;
            
            // Validation
            if (!name || !type || !amount || !frequency || !start_date) {
                return res.status(400).json({ 
                    error: 'Name, type, amount, frequency, and start_date are required' 
                });
            }
            
            if (!['income', 'expense'].includes(type)) {
                return res.status(400).json({ error: 'Type must be income or expense' });
            }
            
            if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
                return res.status(400).json({ error: 'Invalid frequency' });
            }
            
            const { data: recurringTransaction, error } = await supabase
                .from('recurring_transactions')
                .insert({
                    user_id: userId,
                    name,
                    type,
                    amount: parseFloat(amount),
                    category_id,
                    frequency,
                    start_date,
                    end_date: end_date || null,
                    day_of_month: day_of_month || null,
                    day_of_week: day_of_week || null,
                    note: note || null,
                    is_active: true
                })
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
                return res.status(500).json({ error: 'Failed to create recurring transaction' });
            }
            
            res.status(201).json(recurringTransaction);
            
        } else if (req.method === 'PUT') {
            // Update recurring transaction
            const { id } = req.query;
            const { 
                name, 
                type, 
                amount, 
                category_id, 
                frequency, 
                start_date, 
                end_date, 
                day_of_month, 
                day_of_week, 
                note,
                is_active
            } = req.body;
            
            if (!id) {
                return res.status(400).json({ error: 'Recurring transaction ID is required' });
            }
            
            const updates = {
                updated_at: new Date().toISOString()
            };
            
            if (name !== undefined) updates.name = name;
            if (type !== undefined) updates.type = type;
            if (amount !== undefined) updates.amount = parseFloat(amount);
            if (category_id !== undefined) updates.category_id = category_id;
            if (frequency !== undefined) updates.frequency = frequency;
            if (start_date !== undefined) updates.start_date = start_date;
            if (end_date !== undefined) updates.end_date = end_date;
            if (day_of_month !== undefined) updates.day_of_month = day_of_month;
            if (day_of_week !== undefined) updates.day_of_week = day_of_week;
            if (note !== undefined) updates.note = note;
            if (is_active !== undefined) updates.is_active = is_active;
            
            const { data: recurringTransaction, error } = await supabase
                .from('recurring_transactions')
                .update(updates)
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
                    return res.status(404).json({ error: 'Recurring transaction not found' });
                }
                return res.status(500).json({ error: 'Failed to update recurring transaction' });
            }
            
            res.json(recurringTransaction);
            
        } else if (req.method === 'DELETE') {
            // Delete recurring transaction
            const { id } = req.query;
            
            if (!id) {
                return res.status(400).json({ error: 'Recurring transaction ID is required' });
            }
            
            const { error } = await supabase
                .from('recurring_transactions')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to delete recurring transaction' });
            }
            
            res.json({ message: 'Recurring transaction deleted successfully' });
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    }
}