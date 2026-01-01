// Categories API endpoint for Vercel
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
            // Get categories for user
            const { data: categories, error } = await supabase
                .from('categories')
                .select('*')
                .eq('user_id', userId)
                .order('name');
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to fetch categories' });
            }
            
            res.json(categories || []);
            
        } else if (req.method === 'POST') {
            // Create new category
            const { name, color, type } = req.body;
            
            const { data: category, error } = await supabase
                .from('categories')
                .insert([{
                    user_id: userId,
                    name,
                    color: color || '#007bff',
                    type,
                    is_default: false
                }])
                .select()
                .single();
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to create category' });
            }
            
            res.status(201).json(category);
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        console.error('Categories API error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}