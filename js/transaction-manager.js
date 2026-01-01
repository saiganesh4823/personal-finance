/**
 * Personal Finance Tracker - Transaction Manager
 * Handles transaction CRUD operations and validation
 */

class TransactionManager {
    constructor(database) {
        this.database = database;
        this.storeName = 'transactions';
    }

    /**
     * Add a new transaction
     * @param {Object} transactionData - Transaction data
     * @returns {Promise<string>} Transaction ID
     */
    async addTransaction(transactionData) {
        try {
            // Create transaction instance for validation
            const transaction = new Transaction(transactionData);
            
            // Validate transaction
            const validation = transaction.validate();
            if (!validation.isValid) {
                throw new Error('Validation failed: ' + validation.errors.join(', '));
            }

            // Save to database
            const id = await this.database.addRecord(this.storeName, transaction.toObject());
            console.log('Transaction added successfully:', id);
            
            return id;
        } catch (error) {
            console.error('Failed to add transaction:', error);
            throw error;
        }
    }

    /**
     * Update an existing transaction
     * @param {string} id - Transaction ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<void>}
     */
    async updateTransaction(id, updates) {
        try {
            // Get existing transaction
            const existingTransaction = await this.database.getRecord(this.storeName, id);
            if (!existingTransaction) {
                throw new Error('Transaction not found');
            }

            // Create updated transaction for validation
            const transaction = Transaction.fromObject(existingTransaction);
            transaction.update(updates);

            // Validate updated transaction
            const validation = transaction.validate();
            if (!validation.isValid) {
                throw new Error('Validation failed: ' + validation.errors.join(', '));
            }

            // Update in database
            await this.database.updateRecord(this.storeName, id, transaction.toObject());
            console.log('Transaction updated successfully:', id);
        } catch (error) {
            console.error('Failed to update transaction:', error);
            throw error;
        }
    }

    /**
     * Delete a transaction
     * @param {string} id - Transaction ID
     * @returns {Promise<void>}
     */
    async deleteTransaction(id) {
        try {
            // Check if transaction exists
            const existingTransaction = await this.database.getRecord(this.storeName, id);
            if (!existingTransaction) {
                throw new Error('Transaction not found');
            }

            // Delete from database
            await this.database.deleteRecord(this.storeName, id);
            console.log('Transaction deleted successfully:', id);
        } catch (error) {
            console.error('Failed to delete transaction:', error);
            throw error;
        }
    }

    /**
     * Get transactions with optional filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Array>} Array of transactions
     */
    async getTransactions(filters = {}) {
        try {
            let transactions = [];

            if (filters.type) {
                // Filter by type
                transactions = await this.database.getTransactionsByType(filters.type);
            } else if (filters.categoryId) {
                // Filter by category
                transactions = await this.database.getTransactionsByCategory(filters.categoryId);
            } else if (filters.dateRange) {
                // Filter by date range
                const { startDate, endDate } = filters.dateRange;
                transactions = await this.database.getTransactionsByDateRange(startDate, endDate);
            } else {
                // Get all transactions
                transactions = await this.database.getRecords(this.storeName);
            }

            // Apply additional filters using Utils
            if (filters.search || filters.startDate || filters.endDate) {
                transactions = Utils.filterTransactions(transactions, filters);
            }

            // Sort transactions
            const sortBy = filters.sortBy || 'date';
            const sortOrder = filters.sortOrder || 'desc';
            transactions = Utils.sortTransactions(transactions, sortBy, sortOrder);

            console.log(`Retrieved ${transactions.length} transactions`);
            return transactions.map(t => Transaction.fromObject(t));
        } catch (error) {
            console.error('Failed to get transactions:', error);
            throw error;
        }
    }

    /**
     * Get a single transaction by ID
     * @param {string} id - Transaction ID
     * @returns {Promise<Transaction|null>} Transaction or null if not found
     */
    async getTransaction(id) {
        try {
            const transactionData = await this.database.getRecord(this.storeName, id);
            return transactionData ? Transaction.fromObject(transactionData) : null;
        } catch (error) {
            console.error('Failed to get transaction:', error);
            throw error;
        }
    }

    /**
     * Get transactions for current month
     * @returns {Promise<Array>} Array of transactions
     */
    async getCurrentMonthTransactions() {
        try {
            const { startDate, endDate } = Utils.getDateRange('month');
            return await this.getTransactions({
                dateRange: { startDate, endDate }
            });
        } catch (error) {
            console.error('Failed to get current month transactions:', error);
            throw error;
        }
    }

    /**
     * Get recent transactions (last N transactions)
     * @param {number} limit - Number of transactions to retrieve
     * @returns {Promise<Array>} Array of recent transactions
     */
    async getRecentTransactions(limit = 10) {
        try {
            const transactions = await this.getTransactions({
                sortBy: 'date',
                sortOrder: 'desc'
            });
            
            return transactions.slice(0, limit);
        } catch (error) {
            console.error('Failed to get recent transactions:', error);
            throw error;
        }
    }

    /**
     * Get transactions by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Array of transactions
     */
    async getTransactionsByDateRange(startDate, endDate) {
        try {
            return await this.getTransactions({
                dateRange: { startDate, endDate }
            });
        } catch (error) {
            console.error('Failed to get transactions by date range:', error);
            throw error;
        }
    }

    /**
     * Get transactions by category
     * @param {string} categoryId - Category ID
     * @returns {Promise<Array>} Array of transactions
     */
    async getTransactionsByCategory(categoryId) {
        try {
            return await this.getTransactions({ categoryId });
        } catch (error) {
            console.error('Failed to get transactions by category:', error);
            throw error;
        }
    }

    /**
     * Get transactions by type
     * @param {string} type - Transaction type ('income' or 'expense')
     * @returns {Promise<Array>} Array of transactions
     */
    async getTransactionsByType(type) {
        try {
            return await this.getTransactions({ type });
        } catch (error) {
            console.error('Failed to get transactions by type:', error);
            throw error;
        }
    }

    /**
     * Search transactions by note
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} Array of matching transactions
     */
    async searchTransactions(searchTerm) {
        try {
            return await this.getTransactions({ search: searchTerm });
        } catch (error) {
            console.error('Failed to search transactions:', error);
            throw error;
        }
    }

    /**
     * Validate transaction data
     * @param {Object} transaction - Transaction to validate
     * @returns {Object} Validation result
     */
    validateTransaction(transaction) {
        const transactionInstance = new Transaction(transaction);
        return transactionInstance.validate();
    }

    /**
     * Get transaction statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getTransactionStats() {
        try {
            const transactions = await this.getTransactions();
            const currentMonthTransactions = await this.getCurrentMonthTransactions();

            const totalIncome = transactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            const totalExpenses = transactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            const currentMonthIncome = currentMonthTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            const currentMonthExpenses = currentMonthTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            return {
                total: {
                    transactions: transactions.length,
                    income: totalIncome,
                    expenses: totalExpenses,
                    balance: totalIncome - totalExpenses
                },
                currentMonth: {
                    transactions: currentMonthTransactions.length,
                    income: currentMonthIncome,
                    expenses: currentMonthExpenses,
                    balance: currentMonthIncome - currentMonthExpenses
                }
            };
        } catch (error) {
            console.error('Failed to get transaction stats:', error);
            throw error;
        }
    }

    /**
     * Bulk delete transactions
     * @param {Array<string>} ids - Array of transaction IDs
     * @returns {Promise<void>}
     */
    async bulkDeleteTransactions(ids) {
        try {
            const deletePromises = ids.map(id => this.deleteTransaction(id));
            await Promise.all(deletePromises);
            console.log(`Bulk deleted ${ids.length} transactions`);
        } catch (error) {
            console.error('Failed to bulk delete transactions:', error);
            throw error;
        }
    }

    /**
     * Clear all transactions (use with caution)
     * @returns {Promise<void>}
     */
    async clearAllTransactions() {
        try {
            await this.database.clearStore(this.storeName);
            console.log('All transactions cleared');
        } catch (error) {
            console.error('Failed to clear all transactions:', error);
            throw error;
        }
    }
}

// Export for use in other modules
window.TransactionManager = TransactionManager;