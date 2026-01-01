// Google OAuth endpoint for Vercel serverless
export default function handler(req, res) {
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
        // For now, redirect to Google OAuth manually
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&` +
            `response_type=code&` +
            `scope=profile email&` +
            `access_type=offline`;
        
        // Redirect to Google OAuth
        res.redirect(302, googleAuthUrl);
        
    } catch (error) {
        console.error('Google OAuth error:', error);
        res.status(500).json({ 
            error: 'OAuth initialization failed',
            message: error.message 
        });
    }
}