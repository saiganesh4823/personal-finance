const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import authentication components
const createAuthRoutes = require('./routes/auth');
const createUserRoutes = require('./routes/user');
const createAuthMiddleware = require('./middleware/auth');
const DatabaseManager = require('./services/DatabaseManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database Manager
const dbManager = new DatabaseManager();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Create authentication middleware
const { authenticateToken, optionalAuth } = createAuthMiddleware(dbManager);

// Test database connection
async function testConnection() {
    try {
        await dbManager.query('SELECT 1');
        console.log('✅ Connected to Supabase PostgreSQL successfully');
    } catch (error) {
        console.error('❌ Failed to connect to database:', error.message);
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    }
}

// Authentication Routes
app.use('/auth', createAuthRoutes(dbManager));
app.use('/user', createUserRoutes(dbManager));

// API Routes (Protected) - All users share the same database with user_id filtering

// Get transactions with filtering
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { type, category_id, start_date, end_date, limit } = req.query;
        
        let query = 'SELECT * FROM transactions WHERE user_id = $1';
        const params = [req.userId];
        let paramIndex = 2;
        
        if (type) {
            query += ` AND type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }
        
        if (category_id) {
            query += ` AND category_id = $${paramIndex}`;
            params.push(category_id);
            paramIndex++;
        }
        
        if (start_date) {
            query += ` AND date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }
        
        if (end_date) {
            query += ` AND date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }
        
        query += ' ORDER BY date DESC, created_at DESC';
        
        if (limit && !isNaN(parseInt(limit, 10))) {
            query += ` LIMIT $${paramIndex}`;
            params.push(parseInt(limit, 10));
        }
        
        const result = await dbManager.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Get single transaction
app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const result = await dbManager.query(
            'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// Create transaction
app.post('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { amount, type, category_id, date, note } = req.body;
        
        if (!amount || !type || !date) {
            return res.status(400).json({ error: 'Amount, type, and date are required' });
        }
        
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Type must be income or expense' });
        }
        
        // Verify category exists for this user if provided
        if (category_id) {
            const categoryCheck = await dbManager.query(
                'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
                [category_id, req.userId]
            );
            
            if (categoryCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Category not found' });
            }
        }
        
        const id = uuidv4();
        await dbManager.query(
            'INSERT INTO transactions (id, user_id, amount, type, category_id, date, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, req.userId, parseFloat(amount), type, category_id, date, note || '']
        );
        
        res.status(201).json({ 
            message: 'Transaction created successfully',
            id: id
        });
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});

// Update transaction
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const transactionId = req.params.id;
        const { amount, type, category_id, date, note } = req.body;
        
        // Check if transaction exists and belongs to user
        const existing = await dbManager.query(
            'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
            [transactionId, req.userId]
        );
        
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        // Verify category exists for this user if provided
        if (category_id !== undefined && category_id !== null) {
            const categoryCheck = await dbManager.query(
                'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
                [category_id, req.userId]
            );
            
            if (categoryCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Category not found' });
            }
        }
        
        // Build update query dynamically
        const updates = [];
        const params = [req.userId, transactionId];
        let paramIndex = 3;
        
        if (amount !== undefined) {
            updates.push(`amount = $${paramIndex}`);
            params.splice(paramIndex - 1, 0, parseFloat(amount));
            paramIndex++;
        }
        
        if (type !== undefined) {
            if (!['income', 'expense'].includes(type)) {
                return res.status(400).json({ error: 'Type must be income or expense' });
            }
            updates.push(`type = $${paramIndex}`);
            params.splice(paramIndex - 1, 0, type);
            paramIndex++;
        }
        
        if (category_id !== undefined) {
            updates.push(`category_id = $${paramIndex}`);
            params.splice(paramIndex - 1, 0, category_id);
            paramIndex++;
        }
        
        if (date !== undefined) {
            updates.push(`date = $${paramIndex}`);
            params.splice(paramIndex - 1, 0, date);
            paramIndex++;
        }
        
        if (note !== undefined) {
            updates.push(`note = $${paramIndex}`);
            params.splice(paramIndex - 1, 0, note);
            paramIndex++;
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        
        await dbManager.query(
            `UPDATE transactions SET ${updates.join(', ')} WHERE user_id = $1 AND id = $2`,
            params
        );
        
        res.json({ message: 'Transaction updated successfully' });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Delete transaction
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const result = await dbManager.query(
            'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// Get categories
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const { type } = req.query;
        
        let query = 'SELECT * FROM categories WHERE user_id = $1';
        const params = [req.userId];
        
        if (type) {
            query += ' AND type = $2';
            params.push(type);
        }
        
        query += ' ORDER BY is_default DESC, name ASC';
        
        const result = await dbManager.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get single category
app.get('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const result = await dbManager.query(
            'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

// Create category
app.post('/api/categories', authenticateToken, async (req, res) => {
    try {
        const { name, color, type } = req.body;
        
        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }
        
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Type must be income or expense' });
        }
        
        // Check for duplicate names within user's categories
        const existing = await dbManager.query(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND user_id = $2',
            [name.trim(), req.userId]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Category name already exists' });
        }
        
        const id = uuidv4();
        await dbManager.query(
            'INSERT INTO categories (id, user_id, name, color, type, is_default) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, req.userId, name.trim(), color || '#007bff', type, false]
        );
        
        res.status(201).json({ 
            message: 'Category created successfully',
            id: id
        });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update category
app.put('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, color, type } = req.body;
        
        // Check if category exists and belongs to user
        const existing = await dbManager.query(
            'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
            [categoryId, req.userId]
        );
        
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        // Check for duplicate names (excluding current category)
        if (name !== undefined) {
            const duplicates = await dbManager.query(
                'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2 AND user_id = $3',
                [name.trim(), categoryId, req.userId]
            );
            
            if (duplicates.rows.length > 0) {
                return res.status(400).json({ error: 'Category name already exists' });
            }
        }
        
        // Build update query dynamically
        const updates = [];
        const params = [req.userId, categoryId];
        let paramIndex = 3;
        
        if (name !== undefined) {
            updates.push(`name = $${paramIndex}`);
            params.splice(paramIndex - 1, 0, name.trim());
            paramIndex++;
        }
        
        if (color !== undefined) {
            updates.push(`color = $${paramIndex}`);
            params.splice(paramIndex - 1, 0, color);
            paramIndex++;
        }
        
        if (type !== undefined) {
            if (!['income', 'expense'].includes(type)) {
                return res.status(400).json({ error: 'Type must be income or expense' });
            }
            updates.push(`type = $${paramIndex}`);
            params.splice(paramIndex - 1, 0, type);
            paramIndex++;
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        
        await dbManager.query(
            `UPDATE categories SET ${updates.join(', ')} WHERE user_id = $1 AND id = $2`,
            params
        );
        
        res.json({ message: 'Category updated successfully' });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        // Check if category exists and is not default
        const existing = await dbManager.query(
            'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
            [categoryId, req.userId]
        );
        
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        if (existing.rows[0].is_default) {
            return res.status(400).json({ error: 'Cannot delete default category' });
        }
        
        // Check for transactions using this category
        const transactions = await dbManager.query(
            'SELECT id FROM transactions WHERE category_id = $1 AND user_id = $2',
            [categoryId, req.userId]
        );
        
        if (transactions.rows.length > 0) {
            // Find a default category to reassign transactions
            const defaultCategory = await dbManager.query(
                'SELECT id FROM categories WHERE is_default = true AND type = $1 AND user_id = $2 LIMIT 1',
                [existing.rows[0].type, req.userId]
            );
            
            if (defaultCategory.rows.length === 0) {
                return res.status(400).json({ error: 'Cannot delete category: no default category available for reassignment' });
            }
            
            // Reassign transactions to default category
            await dbManager.query(
                'UPDATE transactions SET category_id = $1 WHERE category_id = $2 AND user_id = $3',
                [defaultCategory.rows[0].id, categoryId, req.userId]
            );
        }
        
        // Delete the category
        await dbManager.query(
            'DELETE FROM categories WHERE id = $1 AND user_id = $2',
            [categoryId, req.userId]
        );
        
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Get analytics stats
app.get('/api/analytics/stats', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let query = `
            SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
            FROM transactions 
            WHERE user_id = $1
        `;
        
        const params = [req.userId];
        let paramIndex = 2;
        
        if (start_date) {
            query += ` AND date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }
        
        if (end_date) {
            query += ` AND date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }
        
        const result = await dbManager.query(query, params);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get analytics categories
app.get('/api/analytics/categories', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date, type } = req.query;
        
        let query = `
            SELECT 
                c.id, c.name, c.color, c.type,
                COALESCE(SUM(t.amount), 0) as total_amount,
                COUNT(t.id) as transaction_count
            FROM categories c
            LEFT JOIN transactions t ON c.id = t.category_id AND t.user_id = $1
        `;
        
        const params = [req.userId];
        let paramIndex = 2;
        
        if (start_date) {
            query += ` AND t.date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }
        
        if (end_date) {
            query += ` AND t.date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }
        
        if (type) {
            query += ` AND t.type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }
        
        query += ` WHERE c.user_id = $${paramIndex} GROUP BY c.id, c.name, c.color, c.type ORDER BY total_amount DESC`;
        params.push(req.userId);
        
        const result = await dbManager.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching category analytics:', error);
        res.status(500).json({ error: 'Failed to fetch category analytics' });
    }
});

// Export data
app.get('/api/export', authenticateToken, async (req, res) => {
    try {
        const transactions = await dbManager.query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
            [req.userId]
        );
        
        const categories = await dbManager.query(
            'SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC',
            [req.userId]
        );
        
        const exportData = {
            transactions: transactions.rows,
            categories: categories.rows,
            exported_at: new Date().toISOString(),
            version: '1.0'
        };
        
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Import data
app.post('/api/import', authenticateToken, async (req, res) => {
    try {
        const { transactions, categories } = req.body;
        
        if (!transactions || !categories) {
            return res.status(400).json({ error: 'Transactions and categories are required' });
        }
        
        // Clear existing user data (except default categories)
        await dbManager.query('DELETE FROM transactions WHERE user_id = $1', [req.userId]);
        await dbManager.query('DELETE FROM categories WHERE is_default = false AND user_id = $1', [req.userId]);
        
        // Import categories (non-default only)
        for (const category of categories) {
            if (!category.is_default) {
                await dbManager.query(
                    'INSERT INTO categories (id, user_id, name, color, type, is_default, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
                    [category.id, req.userId, category.name, category.color, category.type, false, category.created_at, category.updated_at]
                );
            }
        }
        
        // Import transactions
        for (const transaction of transactions) {
            await dbManager.query(
                'INSERT INTO transactions (id, user_id, amount, type, category_id, date, note, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING',
                [transaction.id, req.userId, transaction.amount, transaction.type, transaction.category_id, transaction.date, transaction.note, transaction.created_at, transaction.updated_at]
            );
        }
        
        res.json({ message: 'Data imported successfully' });
    } catch (error) {
        console.error('Error importing data:', error);
        res.status(500).json({ error: 'Failed to import data' });
    }
});

// Health check endpoint (Public)
app.get('/api/health', async (req, res) => {
    try {
        await dbManager.query('SELECT 1');
        res.json({ 
            status: 'healthy', 
            database: 'connected', 
            architecture: 'supabase-postgresql',
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
    await testConnection();
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
        console.log(`🔐 Authentication endpoints available at http://localhost:${PORT}/auth`);
        console.log(`👤 User management endpoints available at http://localhost:${PORT}/user`);
        console.log(`🌐 Frontend available at http://localhost:${PORT}`);
    });
}

// Export app for Vercel
module.exports = app;

// Start server only if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    startServer().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}