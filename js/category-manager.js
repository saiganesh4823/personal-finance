/**
 * Personal Finance Tracker - Category Manager
 * Handles category CRUD operations and default categories
 */

class CategoryManager {
    constructor(database) {
        this.database = database;
        this.storeName = 'categories';
    }

    /**
     * Get all categories
     * @returns {Promise<Array>} Array of categories
     */
    async getCategories() {
        try {
            const categoriesData = await this.database.getRecords(this.storeName);
            const categories = categoriesData.map(cat => Category.fromObject(cat));
            
            // Sort categories: default first, then by name
            categories.sort((a, b) => {
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                return a.name.localeCompare(b.name);
            });
            
            console.log(`Retrieved ${categories.length} categories`);
            return categories;
        } catch (error) {
            console.error('Failed to get categories:', error);
            throw error;
        }
    }

    /**
     * Get a single category by ID
     * @param {string} id - Category ID
     * @returns {Promise<Category|null>} Category or null if not found
     */
    async getCategory(id) {
        try {
            const categoryData = await this.database.getRecord(this.storeName, id);
            return categoryData ? Category.fromObject(categoryData) : null;
        } catch (error) {
            console.error('Failed to get category:', error);
            throw error;
        }
    }

    /**
     * Add a new category
     * @param {Object} categoryData - Category data
     * @returns {Promise<string>} Category ID
     */
    async addCategory(categoryData) {
        try {
            // Create category instance for validation
            const category = new Category(categoryData);
            
            // Validate category
            const validation = category.validate();
            if (!validation.isValid) {
                throw new Error('Validation failed: ' + validation.errors.join(', '));
            }

            // Check for duplicate names
            const existingCategories = await this.getCategories();
            const duplicateName = existingCategories.find(cat => 
                cat.name.toLowerCase() === category.name.toLowerCase().trim()
            );
            
            if (duplicateName) {
                throw new Error('A category with this name already exists');
            }

            // Save to database
            const id = await this.database.addRecord(this.storeName, category.toObject());
            console.log('Category added successfully:', id);
            
            return id;
        } catch (error) {
            console.error('Failed to add category:', error);
            throw error;
        }
    }

    /**
     * Update an existing category
     * @param {string} id - Category ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<void>}
     */
    async updateCategory(id, updates) {
        try {
            // Get existing category
            const existingCategory = await this.database.getRecord(this.storeName, id);
            if (!existingCategory) {
                throw new Error('Category not found');
            }

            // Prevent updating default categories' core properties
            if (existingCategory.isDefault && (updates.name || updates.type)) {
                throw new Error('Cannot modify name or type of default categories');
            }

            // Create updated category for validation
            const category = Category.fromObject(existingCategory);
            category.update(updates);

            // Validate updated category
            const validation = category.validate();
            if (!validation.isValid) {
                throw new Error('Validation failed: ' + validation.errors.join(', '));
            }

            // Check for duplicate names (excluding current category)
            if (updates.name) {
                const existingCategories = await this.getCategories();
                const duplicateName = existingCategories.find(cat => 
                    cat.id !== id && cat.name.toLowerCase() === category.name.toLowerCase().trim()
                );
                
                if (duplicateName) {
                    throw new Error('A category with this name already exists');
                }
            }

            // Update in database
            await this.database.updateRecord(this.storeName, id, category.toObject());
            console.log('Category updated successfully:', id);
        } catch (error) {
            console.error('Failed to update category:', error);
            throw error;
        }
    }

    /**
     * Delete a category
     * @param {string} id - Category ID
     * @returns {Promise<void>}
     */
    async deleteCategory(id) {
        try {
            // Get existing category
            const existingCategory = await this.database.getRecord(this.storeName, id);
            if (!existingCategory) {
                throw new Error('Category not found');
            }

            // Prevent deleting default categories
            if (existingCategory.isDefault) {
                throw new Error('Cannot delete default categories');
            }

            // Check if category is being used by transactions
            const transactions = await this.database.getTransactionsByCategory(id);
            if (transactions.length > 0) {
                // Get a default category to reassign transactions
                const defaultCategory = await this.getDefaultCategoryForType(existingCategory.type);
                if (defaultCategory) {
                    // Reassign all transactions to default category
                    const updatePromises = transactions.map(transaction => 
                        this.database.updateRecord('transactions', transaction.id, {
                            categoryId: defaultCategory.id
                        })
                    );
                    await Promise.all(updatePromises);
                    console.log(`Reassigned ${transactions.length} transactions to default category`);
                } else {
                    throw new Error('Cannot delete category: no default category available for reassignment');
                }
            }

            // Delete from database
            await this.database.deleteRecord(this.storeName, id);
            console.log('Category deleted successfully:', id);
        } catch (error) {
            console.error('Failed to delete category:', error);
            throw error;
        }
    }

    /**
     * Get categories by type
     * @param {string} type - Category type ('income', 'expense', or 'both')
     * @returns {Promise<Array>} Array of categories
     */
    async getCategoriesByType(type) {
        try {
            const allCategories = await this.getCategories();
            return allCategories.filter(category => 
                category.type === type || category.type === 'both'
            );
        } catch (error) {
            console.error('Failed to get categories by type:', error);
            throw error;
        }
    }

    /**
     * Get default category for a specific type
     * @param {string} type - Transaction type ('income' or 'expense')
     * @returns {Promise<Category|null>} Default category or null
     */
    async getDefaultCategoryForType(type) {
        try {
            const categories = await this.getCategories();
            return categories.find(cat => 
                cat.isDefault && (cat.type === type || cat.type === 'both')
            ) || null;
        } catch (error) {
            console.error('Failed to get default category:', error);
            throw error;
        }
    }

    /**
     * Create default categories if they don't exist
     * @returns {Promise<void>}
     */
    async createDefaultCategories() {
        try {
            const existingCategories = await this.getCategories();
            if (existingCategories.length > 0) {
                console.log('Default categories already exist');
                return;
            }

            const defaultCategories = this.getDefaultCategories();
            
            const createPromises = defaultCategories.map(categoryData => {
                const category = new Category({
                    ...categoryData,
                    isDefault: true
                });
                return this.database.addRecord(this.storeName, category.toObject());
            });

            await Promise.all(createPromises);
            console.log(`Created ${defaultCategories.length} default categories`);
        } catch (error) {
            console.error('Failed to create default categories:', error);
            throw error;
        }
    }

    /**
     * Get default categories definition
     * @returns {Array} Array of default category definitions
     */
    getDefaultCategories() {
        return [
            // Expense categories
            {
                name: 'Food & Dining',
                color: '#FF6384',
                type: 'expense'
            },
            {
                name: 'Transportation',
                color: '#36A2EB',
                type: 'expense'
            },
            {
                name: 'Shopping',
                color: '#FFCE56',
                type: 'expense'
            },
            {
                name: 'Entertainment',
                color: '#4BC0C0',
                type: 'expense'
            },
            {
                name: 'Bills & Utilities',
                color: '#9966FF',
                type: 'expense'
            },
            {
                name: 'Healthcare',
                color: '#FF9F40',
                type: 'expense'
            },
            {
                name: 'Education',
                color: '#E74C3C',
                type: 'expense'
            },
            {
                name: 'Family',
                color: '#FF69B4',
                type: 'expense'
            },
            {
                name: 'Gym & Fitness',
                color: '#32CD32',
                type: 'expense'
            },
            {
                name: 'SIP & Investments',
                color: '#4169E1',
                type: 'expense'
            },
            {
                name: 'Savings',
                color: '#FFD700',
                type: 'expense'
            },
            {
                name: 'Other Expenses',
                color: '#C9CBCF',
                type: 'expense'
            },
            // Income categories
            {
                name: 'Salary',
                color: '#27AE60',
                type: 'income'
            },
            {
                name: 'Freelance',
                color: '#2ECC71',
                type: 'income'
            },
            {
                name: 'Investment',
                color: '#58D68D',
                type: 'income'
            },
            {
                name: 'Gift',
                color: '#85C1E9',
                type: 'income'
            },
            {
                name: 'Other Income',
                color: '#AED6F1',
                type: 'income'
            }
        ];
    }

    /**
     * Get category statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getCategoryStats() {
        try {
            const categories = await this.getCategories();
            const defaultCount = categories.filter(cat => cat.isDefault).length;
            const customCount = categories.filter(cat => !cat.isDefault).length;
            const expenseCount = categories.filter(cat => cat.type === 'expense' || cat.type === 'both').length;
            const incomeCount = categories.filter(cat => cat.type === 'income' || cat.type === 'both').length;

            return {
                total: categories.length,
                default: defaultCount,
                custom: customCount,
                expense: expenseCount,
                income: incomeCount
            };
        } catch (error) {
            console.error('Failed to get category stats:', error);
            throw error;
        }
    }

    /**
     * Search categories by name
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} Array of matching categories
     */
    async searchCategories(searchTerm) {
        try {
            const categories = await this.getCategories();
            const term = searchTerm.toLowerCase();
            
            return categories.filter(category =>
                category.name.toLowerCase().includes(term)
            );
        } catch (error) {
            console.error('Failed to search categories:', error);
            throw error;
        }
    }

    /**
     * Get category usage statistics
     * @returns {Promise<Object>} Usage statistics by category
     */
    async getCategoryUsage() {
        try {
            const categories = await this.getCategories();
            const usage = {};

            for (const category of categories) {
                const transactions = await this.database.getTransactionsByCategory(category.id);
                const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
                
                usage[category.id] = {
                    category: category,
                    transactionCount: transactions.length,
                    totalAmount: totalAmount
                };
            }

            return usage;
        } catch (error) {
            console.error('Failed to get category usage:', error);
            throw error;
        }
    }

    /**
     * Clear all categories (use with caution)
     * @returns {Promise<void>}
     */
    async clearAllCategories() {
        try {
            await this.database.clearStore(this.storeName);
            console.log('All categories cleared');
        } catch (error) {
            console.error('Failed to clear all categories:', error);
            throw error;
        }
    }

    /**
     * Reset to default categories (clear all and recreate defaults)
     * @returns {Promise<void>}
     */
    async resetToDefaults() {
        try {
            await this.clearAllCategories();
            await this.createDefaultCategories();
            console.log('Categories reset to defaults');
        } catch (error) {
            console.error('Failed to reset categories:', error);
            throw error;
        }
    }
}

// Export for use in other modules
window.CategoryManager = CategoryManager;