/**
 * Authentication Manager
 * Handles frontend authentication, token management, and user sessions
 */

class AuthManager {
    constructor() {
        this.token = null;
        this.refreshToken = null;
        this.user = null;
        this.refreshTimer = null;
        // Use current domain for API URL
        this.apiUrl = window.location.origin;
        
        // Initialize from localStorage
        this.loadFromStorage();
        
        // Set up automatic token refresh
        this.scheduleTokenRefresh();
    }

    /**
     * Load authentication data from localStorage
     */
    loadFromStorage() {
        try {
            // Try both token keys for compatibility
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            const refreshToken = localStorage.getItem('refreshToken');
            const user = localStorage.getItem('user');
            
            if (token && user) {
                this.token = token;
                this.refreshToken = refreshToken;
                this.user = JSON.parse(user);
                console.log('AuthManager loaded token from storage:', !!this.token);
            }
        } catch (error) {
            console.error('Error loading auth data from storage:', error);
            this.clearStorage();
        }
    }

    /**
     * Save authentication data to localStorage
     */
    saveToStorage() {
        try {
            if (this.token && this.user) {
                localStorage.setItem('accessToken', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                if (this.refreshToken) {
                    localStorage.setItem('refreshToken', this.refreshToken);
                }
            }
        } catch (error) {
            console.error('Error saving auth data to storage:', error);
        }
    }

    /**
     * Clear authentication data from localStorage
     */
    clearStorage() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    }

    /**
     * Register a new user account
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Registration result
     */
    async register(userData) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            return data;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    /**
     * Login with username/email and password
     * @param {string} identifier - Username or email
     * @param {string} password - Password
     * @param {boolean} rememberMe - Whether to remember the session
     * @returns {Promise<Object>} Login result
     */
    async login(identifier, password, rememberMe = false) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies
                body: JSON.stringify({
                    identifier,
                    password,
                    rememberMe
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Store authentication data
            this.token = data.accessToken;
            this.user = data.user;
            this.sessionId = data.sessionId;
            
            // Save to localStorage
            this.saveToStorage();
            
            // Schedule token refresh
            this.scheduleTokenRefresh();
            
            // Dispatch login event
            this.dispatchAuthEvent('login', { user: this.user });

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Logout current user
     * @returns {Promise<void>}
     */
    async logout() {
        try {
            if (this.token) {
                await fetch(`${this.apiUrl}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        sessionId: this.sessionId
                    })
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local data regardless of API call success
            this.clearAuthData();
            
            // Dispatch logout event
            this.dispatchAuthEvent('logout');
        }
    }

    /**
     * Refresh access token
     * @returns {Promise<boolean>} Success status
     */
    async refreshAccessToken() {
        try {
            const response = await fetch(`${this.apiUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    refreshToken: this.refreshToken
                })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            
            // Update token
            this.token = data.accessToken;
            this.saveToStorage();
            
            // Schedule next refresh
            this.scheduleTokenRefresh();
            
            return true;
        } catch (error) {
            console.error('Token refresh error:', error);
            
            // If refresh fails, logout user
            await this.logout();
            return false;
        }
    }

    /**
     * Get current user information
     * @returns {Promise<Object>} User data
     */
    async getCurrentUser() {
        try {
            if (!this.token) {
                throw new Error('No authentication token');
            }

            const response = await fetch(`${this.apiUrl}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get user information');
            }

            const data = await response.json();
            this.user = data.user;
            this.saveToStorage();
            
            return data.user;
        } catch (error) {
            console.error('Get user error:', error);
            throw error;
        }
    }

    /**
     * Login with Google OAuth
     * @returns {Promise<void>}
     */
    async loginWithGoogle() {
        try {
            // Redirect to Google OAuth endpoint
            window.location.href = `${this.apiUrl}/auth/google`;
        } catch (error) {
            console.error('Google login error:', error);
            throw error;
        }
    }

    /**
     * Handle Google OAuth success callback
     * @param {string} token - Access token from URL
     * @param {string} userJson - User data from URL
     * @param {string} sessionId - Session ID from URL
     */
    handleGoogleCallback(token, userJson, sessionId) {
        try {
            // Parse user data
            const user = JSON.parse(decodeURIComponent(userJson));
            
            // Store authentication data
            this.token = token;
            this.user = user;
            this.sessionId = sessionId;
            
            // Save to localStorage
            this.saveToStorage();
            
            // Schedule token refresh
            this.scheduleTokenRefresh();
            
            // Dispatch login event
            this.dispatchAuthEvent('login', { user: this.user });
            
            return { user, token };
        } catch (error) {
            console.error('Google callback handling error:', error);
            throw error;
        }
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        return !!(this.token && this.user);
    }

    /**
     * Get current user data
     * @returns {Object|null} User data or null
     */
    getUser() {
        return this.user;
    }

    /**
     * Get authentication headers for API requests
     * @returns {Object} Headers object
     */
    getAuthHeaders() {
        if (!this.token) {
            return {};
        }

        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Make authenticated API request
     * @param {string} url - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async authenticatedFetch(url, options = {}) {
        const headers = {
            ...this.getAuthHeaders(),
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        // Handle token expiration
        if (response.status === 401) {
            const data = await response.json();
            
            if (data.code === 'TOKEN_EXPIRED') {
                // Try to refresh token
                const refreshSuccess = await this.refreshAccessToken();
                
                if (refreshSuccess) {
                    // Retry the original request with new token
                    const retryHeaders = {
                        ...this.getAuthHeaders(),
                        ...options.headers
                    };
                    
                    return fetch(url, {
                        ...options,
                        headers: retryHeaders
                    });
                }
            }
        }

        return response;
    }

    /**
     * Schedule automatic token refresh
     */
    scheduleTokenRefresh() {
        // Clear existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        if (!this.token) {
            return;
        }

        try {
            // Decode token to get expiration time
            const tokenPayload = JSON.parse(atob(this.token.split('.')[1]));
            const expirationTime = tokenPayload.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            const timeUntilExpiry = expirationTime - currentTime;
            
            // Refresh token 5 minutes before expiration
            const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 60000); // At least 1 minute
            
            if (refreshTime > 0) {
                this.refreshTimer = setTimeout(() => {
                    this.refreshAccessToken();
                }, refreshTime);
            }
        } catch (error) {
            console.error('Error scheduling token refresh:', error);
        }
    }

    /**
     * Clear all authentication data
     */
    clearAuthData() {
        this.token = null;
        this.refreshToken = null;
        this.user = null;
        this.sessionId = null;
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        this.clearStorage();
    }

    /**
     * Dispatch authentication events
     * @param {string} eventType - Event type (login, logout, etc.)
     * @param {Object} data - Event data
     */
    dispatchAuthEvent(eventType, data = {}) {
        const event = new CustomEvent(`auth:${eventType}`, {
            detail: data
        });
        window.dispatchEvent(event);
    }

    /**
     * Handle authentication errors
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    handleAuthError(error, context = '') {
        console.error(`Auth error ${context}:`, error);
        
        // If it's an authentication error, logout user
        if (error.message.includes('Authentication') || 
            error.message.includes('Token') ||
            error.message.includes('Unauthorized')) {
            this.logout();
        }
        
        // Dispatch error event
        this.dispatchAuthEvent('error', { error, context });
    }

    /**
     * Initialize authentication manager
     */
    async initialize() {
        try {
            // If we have a token, verify it's still valid
            if (this.token) {
                await this.getCurrentUser();
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.clearAuthData();
        }
    }
}

// Create global instance
window.AuthManager = new AuthManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}