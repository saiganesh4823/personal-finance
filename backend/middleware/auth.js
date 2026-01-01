/**
 * Authentication Middleware
 * Handles JWT token verification and user context
 */

const AuthService = require('../services/AuthService');

/**
 * Create authentication middleware
 * @param {Object} dbManager - Database Manager instance
 * @returns {Function} Express middleware function
 */
function createAuthMiddleware(dbManager) {
    const authService = new AuthService();

    /**
     * Middleware to verify JWT token and set user context
     */
    const authenticateToken = async (req, res, next) => {
        try {
            // Get token from Authorization header
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

            if (!token) {
                return res.status(401).json({
                    error: 'Access token required',
                    code: 'TOKEN_REQUIRED'
                });
            }

            // Verify token
            const decoded = authService.verifyToken(token);
            
            // Get user details from master database
            const masterConnection = await dbManager.getMasterConnection();
            const [users] = await masterConnection.execute(
                'SELECT id, username, email, first_name, last_name, database_name FROM users WHERE id = ? AND is_active = TRUE',
                [decoded.userId]
            );
            
            if (users.length === 0) {
                return res.status(401).json({
                    error: 'User not found or inactive',
                    code: 'USER_NOT_FOUND'
                });
            }
            
            const user = users[0];
            
            // Set user context in request
            req.user = user;
            req.userId = user.id;
            req.userDatabase = user.database_name;
            
            next();
            
        } catch (error) {
            console.error('Authentication error:', error.message);
            
            if (error.message.includes('expired')) {
                return res.status(401).json({
                    error: 'Token has expired',
                    code: 'TOKEN_EXPIRED'
                });
            } else if (error.message.includes('Invalid')) {
                return res.status(401).json({
                    error: 'Invalid token',
                    code: 'TOKEN_INVALID'
                });
            } else {
                return res.status(500).json({
                    error: 'Authentication failed',
                    code: 'AUTH_ERROR'
                });
            }
        }
    };

    /**
     * Optional authentication middleware - doesn't fail if no token
     */
    const optionalAuth = async (req, res, next) => {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (token) {
                const decoded = authService.verifyToken(token);
                
                // Get user details from master database
                const masterConnection = await dbManager.getMasterConnection();
                const [users] = await masterConnection.execute(
                    'SELECT id, username, email, first_name, last_name, database_name FROM users WHERE id = ? AND is_active = TRUE',
                    [decoded.userId]
                );
                
                if (users.length > 0) {
                    const user = users[0];
                    req.user = user;
                    req.userId = user.id;
                    req.userDatabase = user.database_name;
                }
            }
            
            next();
            
        } catch (error) {
            // Continue without authentication for optional auth
            next();
        }
    };

    /**
     * Middleware to extract user ID from token for user-specific operations
     */
    const requireAuth = (req, res, next) => {
        if (!req.userId) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        next();
    };

    return {
        authenticateToken,
        optionalAuth,
        requireAuth
    };
}

module.exports = createAuthMiddleware;