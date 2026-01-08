/**
 * Personal Finance Tracker - Utility Functions
 * Provides common utility functions used throughout the application
 */

/**
 * Transaction Data Model (MySQL compatible)
 */
class Transaction {
    constructor(data = {}) {
        this.id = data.id || Utils.generateUUID();
        this.amount = parseFloat(data.amount) || 0;
        this.type = data.hasOwnProperty('type') ? data.type : 'expense'; // Preserve null/undefined for validation
        this.category_id = data.category_id || data.categoryId || ''; // MySQL uses category_id
        this.date = data.date ? new Date(data.date) : new Date();
        this.note = data.note || '';
        this.created_at = data.created_at ? new Date(data.created_at) : new Date();
        this.updated_at = data.updated_at ? new Date(data.updated_at) : new Date();
        
        // Handle null/undefined dates properly
        if (data.date === null || data.date === undefined || data.date === '') {
            this.date = null;
        }
        
        // Keep backward compatibility
        this.categoryId = this.category_id;
        this.createdAt = this.created_at;
        this.updatedAt = this.updated_at;
    }

    /**
     * Validate transaction data
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];

        if (!this.amount || this.amount <= 0) {
            errors.push('Amount must be greater than 0');
        }

        if (!this.type || !['income', 'expense'].includes(this.type)) {
            errors.push('Type must be either income or expense');
        }

        if (!this.category_id) {
            errors.push('Category is required');
        }

        if (!this.date || (this.date !== null && isNaN(this.date.getTime()))) {
            errors.push('Valid date is required');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Convert to plain object for storage (MySQL format)
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            id: this.id,
            amount: this.amount,
            type: this.type,
            category_id: this.category_id,
            date: this.date ? this.date.toISOString().split('T')[0] : null, // MySQL DATE format
            note: this.note,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * Create Transaction from plain object
     * @param {Object} data - Plain object data
     * @returns {Transaction} Transaction instance
     */
    static fromObject(data) {
        return new Transaction(data);
    }

    /**
     * Update transaction data
     * @param {Object} updates - Updates to apply
     */
    update(updates) {
        if (updates.amount !== undefined) this.amount = parseFloat(updates.amount);
        if (updates.type !== undefined) this.type = updates.type;
        if (updates.category_id !== undefined) {
            this.category_id = updates.category_id;
            this.categoryId = updates.category_id; // Backward compatibility
        }
        if (updates.categoryId !== undefined) {
            this.category_id = updates.categoryId;
            this.categoryId = updates.categoryId;
        }
        if (updates.date !== undefined) this.date = new Date(updates.date);
        if (updates.note !== undefined) this.note = updates.note;
        this.updated_at = new Date();
        this.updatedAt = this.updated_at;
    }
}

/**
 * Category Data Model (MySQL compatible)
 */
class Category {
    constructor(data = {}) {
        this.id = data.id || Utils.generateUUID();
        this.name = data.name || '';
        this.color = data.color || '#3498db';
        this.type = data.type || 'expense'; // 'income', 'expense', or 'both'
        this.is_default = data.is_default !== undefined ? data.is_default : (data.isDefault || false);
        this.created_at = data.created_at ? new Date(data.created_at) : new Date();
        this.updated_at = data.updated_at ? new Date(data.updated_at) : new Date();
        
        // Keep backward compatibility
        this.isDefault = this.is_default;
        this.createdAt = this.created_at;
        this.updatedAt = this.updated_at;
    }

    /**
     * Validate category data
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];

        if (!this.name || this.name.trim().length === 0) {
            errors.push('Category name is required');
        }

        if (this.name.trim().length > 50) {
            errors.push('Category name must be 50 characters or less');
        }

        if (!this.color || !/^#[0-9A-F]{6}$/i.test(this.color)) {
            errors.push('Valid color is required (hex format)');
        }

        if (!this.type || !['income', 'expense', 'both'].includes(this.type)) {
            errors.push('Type must be income, expense, or both');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Convert to plain object for storage (MySQL format)
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            id: this.id,
            name: this.name.trim(),
            color: this.color,
            type: this.type,
            is_default: this.is_default,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * Create Category from plain object
     * @param {Object} data - Plain object data
     * @returns {Category} Category instance
     */
    static fromObject(data) {
        return new Category(data);
    }

    /**
     * Update category data
     * @param {Object} updates - Updates to apply
     */
    update(updates) {
        if (updates.name !== undefined) this.name = updates.name;
        if (updates.color !== undefined) this.color = updates.color;
        if (updates.type !== undefined) this.type = updates.type;
        this.updated_at = new Date();
        this.updatedAt = this.updated_at;
    }

    /**
     * Check if category can be used for transaction type
     * @param {string} transactionType - 'income' or 'expense'
     * @returns {boolean} True if compatible
     */
    isCompatibleWith(transactionType) {
        return this.type === 'both' || this.type === transactionType;
    }
}

class Utils {
    /**
     * Generate a UUID v4
     * @returns {string} UUID string
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Format currency amount with proper symbol
     * @param {number} amount - The amount to format
     * @param {string} currency - Currency code (INR, USD, EUR, etc.)
     * @returns {string} Formatted currency string
     */
    static formatCurrency(amount, currency = 'INR') {
        if (typeof amount !== 'number' || isNaN(amount)) {
            return Utils.getCurrencySymbol(currency) + '0.00';
        }
        
        const symbol = Utils.getCurrencySymbol(currency);
        return `${symbol}${Math.abs(amount).toFixed(2)}`;
    }

    /**
     * Get currency symbol for currency code
     * @param {string} currency - Currency code
     * @returns {string} Currency symbol
     */
    static getCurrencySymbol(currency = 'INR') {
        const symbols = {
            'INR': '₹',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'CAD': 'C$',
            'AUD': 'A$',
            'CHF': 'CHF ',
            'CNY': '¥',
            'SGD': 'S$'
        };
        return symbols[currency] || currency + ' ';
    }

    /**
     * Get user's preferred currency from localStorage or default
     * @returns {string} Currency code
     */
    static getUserCurrency() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.currency || 'INR';
    }

    /**
     * Format date for display
     * @param {Date|string} date - Date to format
     * @param {string} format - Format type ('short', 'long', 'input')
     * @returns {string} Formatted date string
     */
    static formatDate(date, format = 'short') {
        if (!date) return '';
        
        let dateObj;
        if (date instanceof Date) {
            dateObj = date;
        } else if (typeof date === 'string') {
            // Handle YYYY-MM-DD format strings properly to avoid timezone issues
            // Parse as local date, not UTC
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                const [year, month, day] = date.split('-').map(Number);
                dateObj = new Date(year, month - 1, day); // month is 0-indexed
            } else {
                dateObj = new Date(date);
            }
        } else {
            dateObj = new Date(date);
        }
        
        if (isNaN(dateObj.getTime())) {
            return '';
        }

        switch (format) {
            case 'input':
                // Return YYYY-MM-DD in local timezone
                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const d = String(dateObj.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            case 'long':
                return dateObj.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            case 'short':
            default:
                return dateObj.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
        }
    }

    /**
     * Validate transaction data
     * @param {Object} transaction - Transaction object to validate
     * @returns {Object} Validation result with isValid and errors
     */
    static validateTransaction(transaction) {
        const errors = [];

        if (!transaction.amount || transaction.amount <= 0) {
            errors.push('Amount must be greater than 0');
        }

        if (!transaction.type || !['income', 'expense'].includes(transaction.type)) {
            errors.push('Type must be either income or expense');
        }

        if (!transaction.categoryId) {
            errors.push('Category is required');
        }

        if (!transaction.date) {
            errors.push('Date is required');
        } else {
            const date = new Date(transaction.date);
            if (isNaN(date.getTime())) {
                errors.push('Invalid date format');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate category data
     * @param {Object} category - Category object to validate
     * @returns {Object} Validation result with isValid and errors
     */
    static validateCategory(category) {
        const errors = [];

        if (!category.name || category.name.trim().length === 0) {
            errors.push('Category name is required');
        }

        if (!category.color || !/^#[0-9A-F]{6}$/i.test(category.color)) {
            errors.push('Valid color is required');
        }

        if (!category.type || !['income', 'expense', 'both'].includes(category.type)) {
            errors.push('Type must be income, expense, or both');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Deep clone an object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }

        if (obj instanceof Array) {
            return obj.map(item => Utils.deepClone(item));
        }

        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = Utils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    /**
     * Get date range for period
     * @param {string} period - Period type ('month', 'quarter', 'year')
     * @param {Date} referenceDate - Reference date (default: today)
     * @returns {Object} Object with startDate and endDate
     */
    static getDateRange(period, referenceDate = new Date()) {
        const date = new Date(referenceDate);
        let startDate, endDate;

        switch (period) {
            case 'month':
                startDate = new Date(date.getFullYear(), date.getMonth(), 1);
                endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                break;
            case 'quarter':
                const quarter = Math.floor(date.getMonth() / 3);
                startDate = new Date(date.getFullYear(), quarter * 3, 1);
                endDate = new Date(date.getFullYear(), quarter * 3 + 3, 0);
                break;
            case 'year':
                startDate = new Date(date.getFullYear(), 0, 1);
                endDate = new Date(date.getFullYear(), 11, 31);
                break;
            default:
                startDate = new Date(date.getFullYear(), date.getMonth(), 1);
                endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        }

        return { startDate, endDate };
    }

    /**
     * Filter transactions by criteria
     * @param {Array} transactions - Array of transactions
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered transactions
     */
    static filterTransactions(transactions, filters = {}) {
        return transactions.filter(transaction => {
            // Type filter
            if (filters.type && transaction.type !== filters.type) {
                return false;
            }

            // Category filter
            if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
                return false;
            }

            // Date range filter
            if (filters.startDate || filters.endDate) {
                const transactionDate = new Date(transaction.date);
                
                if (filters.startDate && transactionDate < new Date(filters.startDate)) {
                    return false;
                }
                
                if (filters.endDate && transactionDate > new Date(filters.endDate)) {
                    return false;
                }
            }

            // Search filter
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const note = (transaction.note || '').toLowerCase();
                if (!note.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Sort transactions
     * @param {Array} transactions - Array of transactions
     * @param {string} sortBy - Sort field ('date', 'amount')
     * @param {string} sortOrder - Sort order ('asc', 'desc')
     * @returns {Array} Sorted transactions
     */
    static sortTransactions(transactions, sortBy = 'date', sortOrder = 'desc') {
        return [...transactions].sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'amount':
                    aValue = a.amount;
                    bValue = b.amount;
                    break;
                case 'date':
                default:
                    aValue = new Date(a.date);
                    bValue = new Date(b.date);
                    break;
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }

    /**
     * Show loading overlay
     */
    static showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('show');
        }
    }

    /**
     * Hide loading overlay
     */
    static hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type ('success', 'error', 'warning', 'info')
     * @param {number} duration - Duration in milliseconds (default: 3000)
     */
    static showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <p>${message}</p>
            </div>
        `;

        container.appendChild(toast);

        // Auto remove toast
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);

        // Allow manual removal by clicking
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    /**
     * Show confirmation dialog with in-app modal
     * @param {string} message - Confirmation message
     * @param {Function} onConfirm - Callback for confirmation
     * @param {Function} onCancel - Callback for cancellation
     * @param {Object} options - Options for button text and styling
     */
    static showConfirmDialog(message, onConfirm, onCancel = null, options = {}) {
        const modal = document.getElementById('confirm-modal');
        const messageElement = document.getElementById('confirm-message');
        const yesButton = document.getElementById('confirm-yes');
        const noButton = document.getElementById('confirm-no');
        const closeButton = modal.querySelector('.modal-close');

        if (!modal || !messageElement || !yesButton || !noButton) {
            // Fallback to browser confirm if modal elements not found
            const confirmed = confirm(message);
            if (confirmed && onConfirm) {
                onConfirm();
            } else if (!confirmed && onCancel) {
                onCancel();
            }
            return;
        }

        // Set the message
        messageElement.textContent = message;

        // Set button text
        yesButton.textContent = options.confirmText || 'Yes, Delete';
        noButton.textContent = options.cancelText || 'Cancel';

        // Set button styling
        yesButton.className = `btn ${options.confirmClass || 'btn-danger'}`;
        noButton.className = `btn ${options.cancelClass || 'btn-secondary'}`;

        // Show the modal
        modal.classList.add('show');

        // Handle confirmation
        const handleConfirm = () => {
            modal.classList.remove('show');
            if (onConfirm) onConfirm();
            cleanup();
        };

        // Handle cancellation
        const handleCancel = () => {
            modal.classList.remove('show');
            if (onCancel) onCancel();
            cleanup();
        };

        // Clean up event listeners
        const cleanup = () => {
            yesButton.removeEventListener('click', handleConfirm);
            noButton.removeEventListener('click', handleCancel);
            closeButton.removeEventListener('click', handleCancel);
            modal.removeEventListener('click', handleModalClick);
        };

        // Handle clicking outside modal
        const handleModalClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };

        // Add event listeners
        yesButton.addEventListener('click', handleConfirm);
        noButton.addEventListener('click', handleCancel);
        closeButton.addEventListener('click', handleCancel);
        modal.addEventListener('click', handleModalClick);
    }

    /**
     * Export data as JSON file
     * @param {Object} data - Data to export
     * @param {string} filename - Filename for export
     */
    static exportToJSON(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Parse imported JSON file
     * @param {File} file - File to parse
     * @returns {Promise<Object>} Parsed data
     */
    static parseJSONFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(new Error('Invalid JSON file format'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Get current date in input format
     * @returns {string} Date in YYYY-MM-DD format
     */
    static getCurrentDateInput() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Calculate percentage
     * @param {number} value - Value
     * @param {number} total - Total
     * @returns {number} Percentage
     */
    static calculatePercentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    }
}

// Export for use in other modules
window.Utils = Utils;
window.Transaction = Transaction;
window.Category = Category;