/**
 * Authentication Guard
 * Handles route protection and authentication checks
 */

class AuthGuard {
    constructor() {
        this.publicRoutes = [
            '/login.html',
            '/register.html',
            '/index.html' // Will redirect to login if not authenticated
        ];
        
        this.protectedRoutes = [
            '/dashboard.html',
            '/transactions.html',
            '/analytics.html',
            '/profile.html'
        ];
        
        this.initialize();
    }
    
    /**
     * Initialize authentication guard
     */
    initialize() {
        // Check authentication on page load
        this.checkAuthOnLoad();
        
        // Listen for authentication events
        this.setupAuthEventListeners();
        
        // Set up periodic auth check
        this.setupPeriodicAuthCheck();
    }
    
    /**
     * Check authentication status on page load
     */
    checkAuthOnLoad() {
        // Check if this is an OAuth callback first
        const urlParams = new URLSearchParams(window.location.search);
        const hasOAuthToken = urlParams.get('token') && urlParams.get('login') === 'success';
        
        if (hasOAuthToken) {
            console.log('OAuth callback detected, waiting for token processing...');
            // Wait longer for OAuth token to be processed
            setTimeout(() => {
                this.performAuthCheckOnLoad();
            }, 2000); // Wait 2 seconds for OAuth processing
        } else {
            // Normal auth check with shorter delay
            setTimeout(() => {
                this.performAuthCheckOnLoad();
            }, 100);
        }
    }
    
    /**
     * Perform the actual authentication check
     */
    performAuthCheckOnLoad() {
        const currentPath = window.location.pathname;
        const isAuthenticated = window.AuthManager.isAuthenticated();
        
        console.log('Auth check - Path:', currentPath, 'Authenticated:', isAuthenticated);
        
        // If on main index.html, redirect based on auth status
        if (currentPath === '/' || currentPath === '/index.html') {
            if (isAuthenticated) {
                // User is authenticated, stay on dashboard
                console.log('User authenticated, staying on dashboard');
                return;
            } else {
                console.log('User not authenticated, redirecting to login');
                this.redirectToLogin();
            }
            return;
        }
        
        // Check if current route requires authentication
        if (this.requiresAuth(currentPath) && !isAuthenticated) {
            this.redirectToLogin();
            return;
        }
        
        // If authenticated user tries to access login/register, redirect to dashboard
        if (isAuthenticated && this.isAuthPage(currentPath)) {
            this.redirectToDashboard();
            return;
        }
    }
    
    /**
     * Set up authentication event listeners
     */
    setupAuthEventListeners() {
        // Listen for login events
        window.addEventListener('auth:login', (event) => {
            console.log('User logged in:', event.detail.user);
            this.onUserLogin(event.detail.user);
        });
        
        // Listen for logout events
        window.addEventListener('auth:logout', () => {
            console.log('User logged out');
            this.onUserLogout();
        });
        
        // Listen for authentication errors
        window.addEventListener('auth:error', (event) => {
            console.log('Auth error:', event.detail.error);
            this.onAuthError(event.detail.error, event.detail.context);
        });
        
        // Listen for token expiration
        window.addEventListener('auth:token-expired', () => {
            console.log('Token expired');
            this.onTokenExpired();
        });
    }
    
    /**
     * Set up periodic authentication check
     */
    setupPeriodicAuthCheck() {
        // Check authentication status every 5 minutes
        setInterval(() => {
            this.performAuthCheck();
        }, 5 * 60 * 1000);
    }
    
    /**
     * Perform authentication check
     */
    async performAuthCheck() {
        try {
            if (window.AuthManager.isAuthenticated()) {
                // Verify token is still valid by making a test request
                await window.AuthManager.getCurrentUser();
            } else {
                // If on index.html and not authenticated, redirect to login
                const currentPath = window.location.pathname;
                if (currentPath === '/' || currentPath === '/index.html') {
                    this.redirectToLogin();
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.handleAuthFailure();
        }
    }
    
    /**
     * Handle user login
     * @param {Object} user - User data
     */
    onUserLogin(user) {
        // Store login timestamp
        localStorage.setItem('lastLoginTime', Date.now().toString());
        
        // Redirect to intended page or dashboard
        const intendedUrl = sessionStorage.getItem('intendedUrl');
        if (intendedUrl) {
            sessionStorage.removeItem('intendedUrl');
            window.location.href = intendedUrl;
        } else {
            this.redirectToDashboard();
        }
    }
    
    /**
     * Handle user logout
     */
    onUserLogout() {
        // Clear any stored data
        localStorage.removeItem('lastLoginTime');
        sessionStorage.removeItem('intendedUrl');
        
        // Redirect to login page
        this.redirectToLogin();
    }
    
    /**
     * Handle authentication errors
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    onAuthError(error, context) {
        if (error.message.includes('Token') || error.message.includes('Authentication')) {
            this.handleAuthFailure();
        }
    }
    
    /**
     * Handle token expiration
     */
    onTokenExpired() {
        this.showTokenExpiredMessage();
        this.redirectToLogin();
    }
    
    /**
     * Handle authentication failure
     */
    handleAuthFailure() {
        // Clear authentication data
        window.AuthManager.clearAuthData();
        
        // Store current page as intended URL if it's a protected route
        const currentPath = window.location.pathname;
        if (this.requiresAuth(currentPath)) {
            sessionStorage.setItem('intendedUrl', window.location.href);
        }
        
        // Redirect to login
        this.redirectToLogin();
    }
    
    /**
     * Check if route requires authentication
     * @param {string} path - Route path
     * @returns {boolean} True if authentication required
     */
    requiresAuth(path) {
        // All routes require auth except public ones
        return !this.publicRoutes.some(route => path.endsWith(route));
    }
    
    /**
     * Check if route is an authentication page
     * @param {string} path - Route path
     * @returns {boolean} True if auth page
     */
    isAuthPage(path) {
        return path.endsWith('/login.html') || path.endsWith('/register.html');
    }
    
    /**
     * Redirect to login page
     */
    redirectToLogin() {
        if (!window.location.pathname.endsWith('/login.html')) {
            window.location.href = 'login.html';
        }
    }
    
    /**
     * Redirect to dashboard
     */
    redirectToDashboard() {
        if (!window.location.pathname.endsWith('/index.html')) {
            window.location.href = 'index.html';
        }
    }
    
    /**
     * Show token expired message
     */
    showTokenExpiredMessage() {
        // Create and show a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f8d7da;
            color: #721c24;
            padding: 15px 20px;
            border-radius: 8px;
            border: 1px solid #f5c6cb;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;
        notification.textContent = 'Your session has expired. Please log in again.';
        
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    /**
     * Protect a function with authentication check
     * @param {Function} fn - Function to protect
     * @returns {Function} Protected function
     */
    protect(fn) {
        return (...args) => {
            if (!window.AuthManager.isAuthenticated()) {
                this.redirectToLogin();
                return;
            }
            return fn.apply(this, args);
        };
    }
    
    /**
     * Check if user has been inactive for too long
     * @returns {boolean} True if session should be considered expired
     */
    checkInactivity() {
        const lastLoginTime = localStorage.getItem('lastLoginTime');
        if (!lastLoginTime) {
            return true;
        }
        
        const now = Date.now();
        const loginTime = parseInt(lastLoginTime);
        const maxInactivity = 24 * 60 * 60 * 1000; // 24 hours
        
        return (now - loginTime) > maxInactivity;
    }
    
    /**
     * Update last activity timestamp
     */
    updateActivity() {
        if (window.AuthManager.isAuthenticated()) {
            localStorage.setItem('lastLoginTime', Date.now().toString());
        }
    }
}

// Create global instance
window.AuthGuard = new AuthGuard();

// Update activity on user interactions
['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
    document.addEventListener(event, () => {
        window.AuthGuard.updateActivity();
    }, { passive: true, once: false });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}