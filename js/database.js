/**
 * Personal Finance Tracker - Database Service (MySQL API with Authentication)
 * Handles HTTP API calls to MySQL backend with JWT authentication
 */

class DatabaseService {
    constructor() {
        // Use current domain for API URL
        this.apiUrl = `${window.location.origin}/api`;
        this.dbName = 'MySQL Backend';
        this.version = 1;
    }

    /**
     * Initialize the database connection
     */
    async initializeDB() {
        try {
            // Test API connection
            const response = await fetch(`${this.apiUrl}/health`);
            if (!response.ok) {
                throw new Error(`API health check failed: ${response.status}`);
            }
            
            const health = await response.json();
            console.log('Database connected successfully:', health);
            
            return true;
        } catch (error) {
            console.error('Failed to connect to MySQL API:', error);
            throw new Error('Database connection failed: ' + error.message);
        }
    }

    /**
     * Make authenticated API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Response object
     */
    async authenticatedRequest(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;
        
        if (window.AuthManager && window.AuthManager.isAuthenticated()) {
            return await window.AuthManager.authenticatedFetch(url, options);
        } else {
            // For non-authenticated requests (like health check)
            return await fetch(url, options);
        }
    }

    /**
     * Add a record to a store
     * @param {string} store - Store name ('transactions' or 'categories')
     * @param {Object} data - Data to add
     */
    async addRecord(store, data) {
        try {
            const response = await this.authenticatedRequest(`/${store}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to add ${store} record`);
            }

            const result = await response.json();
            console.log(`Added record to ${store}:`, result.id);
            return result.id;
        } catch (error) {
            console.error(`Failed to add record to ${store}:`, error);
            throw error;
        }
    }

    /**
     * Get records from a store with optional filters
     * @param {string} store - Store name
     * @param {Object} filters - Filter criteria
     */
    async getRecords(store, filters = {}) {
        try {
            const params = new URLSearchParams();
            
            // Add filters as query parameters
            Object.keys(filters).forEach(key => {
                if (filters[key] !== undefined && filters[key] !== null) {
                    params.append(key, filters[key]);
                }
            });

            const endpoint = `/${store}${params.toString() ? '?' + params.toString() : ''}`;
            const response = await this.authenticatedRequest(endpoint);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to fetch ${store} records`);
            }

            const records = await response.json();
            console.log(`Retrieved ${records.length} records from ${store}`);
            return records;
        } catch (error) {
            console.error(`Failed to get records from ${store}:`, error);
            throw error;
        }
    }

    /**
     * Update a record in a store
     * @param {string} store - Store name
     * @param {string} id - Record ID
     * @param {Object} updates - Updates to apply
     */
    async updateRecord(store, id, updates) {
        try {
            const response = await this.authenticatedRequest(`/${store}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to update ${store} record`);
            }

            console.log(`Updated record in ${store}:`, id);
        } catch (error) {
            console.error(`Failed to update record in ${store}:`, error);
            throw error;
        }
    }

    /**
     * Delete a record from a store
     * @param {string} store - Store name
     * @param {string} id - Record ID
     */
    async deleteRecord(store, id) {
        try {
            const response = await this.authenticatedRequest(`/${store}/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to delete ${store} record`);
            }

            console.log(`Deleted record from ${store}:`, id);
        } catch (error) {
            console.error(`Failed to delete record from ${store}:`, error);
            throw error;
        }
    }

    /**
     * Get a single record by ID
     * @param {string} store - Store name
     * @param {string} id - Record ID
     */
    async getRecord(store, id) {
        try {
            console.log(`Making request to get ${store} record with ID:`, id);
            const response = await this.authenticatedRequest(`/${store}/${id}`);
            
            if (response.status === 404) {
                console.log(`Record not found: ${store}/${id}`);
                return null;
            }
            
            if (!response.ok) {
                const error = await response.json();
                console.error(`API error for ${store}/${id}:`, error);
                throw new Error(error.error || `Failed to fetch ${store} record`);
            }

            const result = await response.json();
            console.log(`Successfully retrieved ${store} record:`, result);
            return result;
        } catch (error) {
            console.error(`Failed to get record from ${store}:`, error);
            throw error;
        }
    }

    /**
     * Clear all records from a store (not implemented for safety)
     * @param {string} store - Store name
     */
    async clearStore(store) {
        console.warn(`clearStore not implemented for MySQL backend for safety`);
        throw new Error('Clear store operation not available in MySQL backend');
    }

    /**
     * Get transactions within date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     */
    async getTransactionsByDateRange(startDate, endDate) {
        try {
            // Handle both string and Date inputs
            const startDateStr = startDate instanceof Date ? 
                startDate.toISOString().split('T')[0] : 
                startDate;
            const endDateStr = endDate instanceof Date ? 
                endDate.toISOString().split('T')[0] : 
                endDate;
                
            const filters = {
                start_date: startDateStr,
                end_date: endDateStr
            };
            
            return await this.getRecords('transactions', filters);
        } catch (error) {
            console.error('Failed to get transactions by date range:', error);
            throw error;
        }
    }

    /**
     * Get transactions by category
     * @param {string} categoryId - Category ID
     */
    async getTransactionsByCategory(categoryId) {
        try {
            return await this.getRecords('transactions', { category_id: categoryId });
        } catch (error) {
            console.error('Failed to get transactions by category:', error);
            throw error;
        }
    }

    /**
     * Get transactions by type
     * @param {string} type - Transaction type ('income' or 'expense')
     */
    async getTransactionsByType(type) {
        try {
            return await this.getRecords('transactions', { type });
        } catch (error) {
            console.error('Failed to get transactions by type:', error);
            throw error;
        }
    }

    /**
     * Get transactions with optional filters
     * @param {Object} filters - Filter options (limit, type, category_id, etc.)
     * @returns {Promise<Array>} Array of transactions
     */
    async getTransactions(filters = {}) {
        try {
            return await this.getRecords('transactions', filters);
        } catch (error) {
            console.error('Failed to get transactions:', error);
            throw error;
        }
    }

    /**
     * Export all data
     */
    async exportAllData() {
        try {
            const response = await this.authenticatedRequest('/export');
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to export data');
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to export data:', error);
            throw error;
        }
    }

    /**
     * Import data (clear existing data first)
     * @param {Object} data - Data to import
     */
    async importData(data) {
        try {
            const response = await this.authenticatedRequest('/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to import data');
            }

            const result = await response.json();
            console.log('Data imported successfully:', result);
        } catch (error) {
            console.error('Failed to import data:', error);
            throw error;
        }
    }

    /**
     * Get database statistics
     */
    async getStats() {
        try {
            const response = await this.authenticatedRequest('/analytics/stats');
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get stats');
            }

            const stats = await response.json();
            return {
                transactions: stats.total_transactions || 0,
                categories: 0 // Will be calculated separately if needed
            };
        } catch (error) {
            console.error('Failed to get database stats:', error);
            throw error;
        }
    }

    /**
     * Get categories
     * @returns {Promise<Array>} Array of categories
     */
    async getCategories() {
        try {
            return await this.getRecords('categories');
        } catch (error) {
            console.error('Failed to get categories:', error);
            throw error;
        }
    }

    /**
     * Get analytics data
     * @param {Object} filters - Filter options
     */
    async getAnalytics(filters = {}) {
        try {
            const params = new URLSearchParams();
            
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            if (filters.type) params.append('type', filters.type);

            const [stats, categories] = await Promise.all([
                this.authenticatedRequest(`/analytics/stats?${params.toString()}`).then(r => r.json()),
                this.authenticatedRequest(`/analytics/categories?${params.toString()}`).then(r => r.json())
            ]);

            return { stats, categories };
        } catch (error) {
            console.error('Failed to get analytics:', error);
            throw error;
        }
    }
}

// Export for use in other modules
window.DatabaseService = DatabaseService;