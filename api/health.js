// Simple health check for Vercel
export default function handler(req, res) {
    res.status(200).json({
        status: 'healthy',
        message: 'Personal Finance Tracker API is running',
        timestamp: new Date().toISOString()
    });
}