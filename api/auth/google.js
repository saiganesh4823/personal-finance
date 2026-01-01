// Simple Google OAuth redirect for testing
export default function handler(req, res) {
    console.log('Google OAuth endpoint hit:', req.method, req.url);
    
    // For now, just return a test response
    res.status(200).json({
        message: 'Google OAuth endpoint reached',
        method: req.method,
        url: req.url,
        note: 'OAuth not fully implemented yet - this is a test response'
    });
}