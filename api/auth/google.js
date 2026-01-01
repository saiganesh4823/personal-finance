// Simple Google OAuth redirect for testing
export default function handler(req, res) {
    // For now, just redirect to login page
    res.redirect('/login.html?error=oauth_not_implemented');
}