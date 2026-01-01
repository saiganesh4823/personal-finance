// Google OAuth callback endpoint for Vercel serverless
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    console.log('=== CALLBACK FUNCTION STARTED ===');
    console.log('Method:', req.method);
    console.log('Query params:', req.query);
    console.log('Environment check:', {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasFrontendUrl: !!process.env.FRONTEND_URL,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    });
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { code, error } = req.query;
        
        console.log('OAuth callback received:', { code: !!code, error });
        
        if (error) {
            console.error('Google OAuth error:', error);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=oauth_failed`);
        }
        
        if (!code) {
            console.error('No authorization code received');
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=no_code`);
        }
        
        console.log('Exchanging code for token...');
        
        // Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            }),
        });
        
        const tokenData = await tokenResponse.json();
        console.log('Token response status:', tokenResponse.status);
        
        if (!tokenData.access_token) {
            console.error('Failed to get access token:', tokenData);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=token_failed`);
        }
        
        console.log('Getting user info from Google...');
        
        // Get user info from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        
        const googleUser = await userResponse.json();
        console.log('Google user info received:', { id: !!googleUser.id, email: !!googleUser.email });
        
        if (!googleUser.id) {
            console.error('Failed to get user info:', googleUser);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=user_info_failed`);
        }
        
        console.log('Checking if user exists in database...');
        
        // Check if user exists
        const { data: existingUsers, error: queryError } = await supabase
            .from('users')
            .select('*')
            .or(`email.eq.${googleUser.email},google_id.eq.${googleUser.id}`);
        
        if (queryError) {
            console.error('Database query error:', queryError);
            return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=db_error`);
        }
        
        console.log('Database query result:', { userExists: existingUsers.length > 0 });
        
        let user;
        
        if (existingUsers.length === 0) {
            console.log('Creating new user...');
            // Create new user
            const userId = uuidv4();
            const username = googleUser.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);
            const databaseName = `supabase_user_${userId}`;
            
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{
                    id: userId,
                    username: username,
                    email: googleUser.email,
                    first_name: googleUser.given_name,
                    last_name: googleUser.family_name,
                    database_name: databaseName,
                    google_id: googleUser.id
                }])
                .select()
                .single();
            
            if (insertError) {
                console.error('User creation error:', insertError);
                return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=user_creation_failed`);
            }
            
            user = newUser;
            console.log('New user created:', { id: user.id, email: user.email });
            
            // Default categories will be created automatically by database trigger
            
        } else {
            user = existingUsers[0];
            console.log('Existing user found:', { id: user.id, email: user.email });
            
            // Update Google ID if not set
            if (!user.google_id) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ google_id: googleUser.id, updated_at: new Date().toISOString() })
                    .eq('id', user.id);
                
                if (updateError) {
                    console.error('User update error:', updateError);
                } else {
                    console.log('Updated user with Google ID');
                }
            }
        }
        
        console.log('Generating JWT token...');
        
        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                email: user.email
            },
            process.env.JWT_SECRET,
            { 
                expiresIn: process.env.JWT_EXPIRES_IN || '24h'
            }
        );
        
        console.log('JWT token generated, redirecting to frontend...');
        
        // Redirect to frontend with token
        const redirectUrl = `${process.env.FRONTEND_URL}/index.html?token=${token}&login=success`;
        res.redirect(302, redirectUrl);
        
    } catch (error) {
        console.error('Google OAuth callback error:', error);
        console.error('Error stack:', error.stack);
        res.redirect(`${process.env.FRONTEND_URL}/login.html?error=callback_failed`);
    }
}