// User settings API endpoint for Vercel
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
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
            // Get user settings
            const { data: user, error } = await supabase
                .from('users')
                .select('email_notifications, email, first_name, last_name')
                .eq('id', userId)
                .single();
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to fetch user settings' });
            }
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json({
                emailNotifications: user.email_notifications,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            });
            
        } else if (req.method === 'PUT') {
            // Update user settings
            const { emailNotifications, firstName, lastName } = req.body;
            
            const updates = {};
            if (typeof emailNotifications === 'boolean') {
                updates.email_notifications = emailNotifications;
            }
            if (firstName !== undefined) {
                updates.first_name = firstName;
            }
            if (lastName !== undefined) {
                updates.last_name = lastName;
            }
            
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'No valid updates provided' });
            }
            
            updates.updated_at = new Date().toISOString();
            
            const { data: user, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', userId)
                .select('email_notifications, email, first_name, last_name')
                .single();
            
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ error: 'Failed to update user settings' });
            }
            
            res.json({
                message: 'Settings updated successfully',
                settings: {
                    emailNotifications: user.email_notifications,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name
                }
            });
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        console.error('User settings API error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}