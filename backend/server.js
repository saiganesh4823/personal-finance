const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const passport = require('passport');
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
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

app.use(express.static(path.join(__dirname, '../'))); // Serve frontend files

// Create authentication middleware
const { authenticateToken, optionalAuth } = createAuthMiddleware(dbManager);

// Test database connection
async function testConnection() {
    try {
        const masterConnection = await dbManager.getMasterConnection();
        await masterConnection.execute('SELECT 1');
        console.log('✅ Connected to master database successfully');
    } catch (error) {
        console.error('❌ Failed to connect to master database:', error.message);
        process.exit(1);
    }
}

// Authentication Routes
app.use('/auth', createAuthRoutes(dbManager));
app.use('/user', createUserRoutes(dbManager));

// API Routes (Protected) - Each user has their own database

// ==================== TRANSACTIONS ====================

// Get all transactions with optional filters (Protected)
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { type, category_id, start_date, end_date, limit } = req.query;
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        let query = 'SELECT * FROM transactions WHERE 1=1';
        const params = [];
        
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        
        if (category_id) {
            query += ' AND category_id = ?';
            params.push(category_id);
        }
        
        if (start_date) {
            query += ' AND date >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND date <= ?';
            params.push(end_date);
        }
        
        query += ' ORDER BY date DESC, created_at DESC';
        
        if (limit && !isNaN(parseInt(limit, 10))) {
            query += ` LIMIT ${parseInt(limit, 10)}`;
        }
        
        const [rows] = await userConnection.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Get single transaction (Protected)
app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const userConnection = await dbManager.getUserConnection(req.userId);
        const [rows] = await userConnection.execute(
            'SELECT * FROM transactions WHERE id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// Add new transaction (Protected)
app.post('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const { amount, type, category_id, date, note } = req.body;
        const id = uuidv4();
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        // Validate required fields
        if (!amount || !type || !category_id || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Validate amount
        if (isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }
        
        // Validate type
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Type must be income or expense' });
        }
        
        // Verify category exists in user's database
        const [categoryCheck] = await userConnection.execute(
            'SELECT id FROM categories WHERE id = ?',
            [category_id]
        );
        
        if (categoryCheck.length === 0) {
            return res.status(400).json({ error: 'Invalid category ID' });
        }
        
        await userConnection.execute(
            'INSERT INTO transactions (id, amount, type, category_id, date, note) VALUES (?, ?, ?, ?, ?, ?)',
            [id, parseFloat(amount), type, category_id, date, note || '']
        );
        
        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ error: 'Failed to add transaction' });
    }
});

// Update transaction (Protected)
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const { amount, type, category_id, date, note } = req.body;
        const transactionId = req.params.id;
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        // Check if transaction exists in user's database
        const [existing] = await userConnection.execute(
            'SELECT id FROM transactions WHERE id = ?',
            [transactionId]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        // Validate fields if provided
        if (amount !== undefined && (isNaN(amount) || parseFloat(amount) <= 0)) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }
        
        if (type !== undefined && !['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Type must be income or expense' });
        }
        
        // Verify category exists in user's database if provided
        if (category_id !== undefined) {
            const [categoryCheck] = await userConnection.execute(
                'SELECT id FROM categories WHERE id = ?',
                [category_id]
            );
            
            if (categoryCheck.length === 0) {
                return res.status(400).json({ error: 'Invalid category ID' });
            }
        }
        
        // Build dynamic update query
        const updates = [];
        const params = [];
        
        if (amount !== undefined) {
            updates.push('amount = ?');
            params.push(parseFloat(amount));
        }
        if (type !== undefined) {
            updates.push('type = ?');
            params.push(type);
        }
        if (category_id !== undefined) {
            updates.push('category_id = ?');
            params.push(category_id);
        }
        if (date !== undefined) {
            updates.push('date = ?');
            params.push(date);
        }
        if (note !== undefined) {
            updates.push('note = ?');
            params.push(note);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(transactionId);
        
        await userConnection.execute(
            `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Delete transaction (Protected)
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const userConnection = await dbManager.getUserConnection(req.userId);
        const [result] = await userConnection.execute(
            'DELETE FROM transactions WHERE id = ?',
            [req.params.id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// ==================== CATEGORIES ====================

// Get all categories (Protected)
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const { type } = req.query;
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        let query = 'SELECT * FROM categories WHERE 1=1';
        const params = [];
        
        if (type && type !== 'both') {
            query += ' AND (type = ? OR type = "both")';
            params.push(type);
        }
        
        query += ' ORDER BY is_default DESC, name ASC';
        
        const [rows] = await userConnection.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get single category (Protected)
app.get('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const userConnection = await dbManager.getUserConnection(req.userId);
        const [rows] = await userConnection.execute(
            'SELECT * FROM categories WHERE id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

// Add new category (Protected)
app.post('/api/categories', authenticateToken, async (req, res) => {
    try {
        const { name, color, type } = req.body;
        const id = uuidv4();
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        // Validate required fields
        if (!name || !color || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Validate type
        if (!['income', 'expense', 'both'].includes(type)) {
            return res.status(400).json({ error: 'Type must be income, expense, or both' });
        }
        
        // Check for duplicate names within user's categories
        const [existing] = await userConnection.execute(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
            [name.trim()]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'A category with this name already exists' });
        }
        
        await userConnection.execute(
            'INSERT INTO categories (id, name, color, type, is_default) VALUES (?, ?, ?, ?, ?)',
            [id, name.trim(), color, type, false]
        );
        
        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ error: 'Failed to add category' });
    }
});

// Update category (Protected)
app.put('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const { name, color, type } = req.body;
        const categoryId = req.params.id;
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        // Check if category exists in user's database
        const [existing] = await userConnection.execute(
            'SELECT * FROM categories WHERE id = ?',
            [categoryId]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        const category = existing[0];
        
        // Prevent updating default categories' core properties
        if (category.is_default && (name || type)) {
            return res.status(400).json({ error: 'Cannot modify name or type of default categories' });
        }
        
        // Build dynamic update query
        const updates = [];
        const params = [];
        
        if (name !== undefined) {
            // Check for duplicate names (excluding current category)
            const [duplicates] = await userConnection.execute(
                'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?',
                [name.trim(), categoryId]
            );
            
            if (duplicates.length > 0) {
                return res.status(400).json({ error: 'A category with this name already exists' });
            }
            
            updates.push('name = ?');
            params.push(name.trim());
        }
        
        if (color !== undefined) {
            updates.push('color = ?');
            params.push(color);
        }
        
        if (type !== undefined && !['income', 'expense', 'both'].includes(type)) {
            return res.status(400).json({ error: 'Type must be income, expense, or both' });
        }
        
        if (type !== undefined) {
            updates.push('type = ?');
            params.push(type);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(categoryId);
        
        await userConnection.execute(
            `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category (Protected)
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const categoryId = req.params.id;
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        // Check if category exists and is not default
        const [existing] = await userConnection.execute(
            'SELECT * FROM categories WHERE id = ?',
            [categoryId]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        if (existing[0].is_default) {
            return res.status(400).json({ error: 'Cannot delete default categories' });
        }
        
        // Check for transactions using this category
        const [transactions] = await userConnection.execute(
            'SELECT id FROM transactions WHERE category_id = ?',
            [categoryId]
        );
        
        if (transactions.length > 0) {
            // Find a default category to reassign transactions
            const [defaultCategory] = await userConnection.execute(
                'SELECT id FROM categories WHERE is_default = 1 AND (type = ? OR type = "both") LIMIT 1',
                [existing[0].type]
            );
            
            if (defaultCategory.length === 0) {
                return res.status(400).json({ error: 'Cannot delete category: no default category available for reassignment' });
            }
            
            // Reassign transactions to default category
            await userConnection.execute(
                'UPDATE transactions SET category_id = ? WHERE category_id = ?',
                [defaultCategory[0].id, categoryId]
            );
        }
        
        // Delete the category
        await userConnection.execute(
            'DELETE FROM categories WHERE id = ?',
            [categoryId]
        );
        
        res.json({ success: true, reassignedTransactions: transactions.length });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// ==================== ANALYTICS ====================

// Get transaction statistics (Protected)
app.get('/api/analytics/stats', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        let dateFilter = 'WHERE 1=1';
        const params = [];
        
        if (start_date && end_date) {
            dateFilter += ' AND date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        
        const [stats] = await userConnection.execute(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
                (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
                 SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) as balance
            FROM transactions ${dateFilter}
        `, params);
        
        res.json(stats[0]);
    } catch (error) {
        console.error('Error fetching analytics stats:', error);
        res.status(500).json({ error: 'Failed to fetch analytics stats' });
    }
});

// Get category breakdown (Protected)
app.get('/api/analytics/categories', authenticateToken, async (req, res) => {
    try {
        const { type, start_date, end_date } = req.query;
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        let query = `
            SELECT 
                c.id as category_id,
                c.name as category_name,
                c.color as category_color,
                c.type as category_type,
                COUNT(t.id) as transaction_count,
                SUM(t.amount) as total_amount
            FROM categories c
            LEFT JOIN transactions t ON c.id = t.category_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (type) {
            query += ' AND t.type = ?';
            params.push(type);
        }
        
        if (start_date && end_date) {
            query += ' AND t.date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        
        query += ' GROUP BY c.id, c.name, c.color, c.type ORDER BY total_amount DESC';
        
        const [rows] = await userConnection.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching category breakdown:', error);
        res.status(500).json({ error: 'Failed to fetch category breakdown' });
    }
});

// ==================== DATA MANAGEMENT ====================

// Export all data (Protected)
app.get('/api/export', authenticateToken, async (req, res) => {
    try {
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        const [transactions] = await userConnection.execute(
            'SELECT * FROM transactions ORDER BY date DESC'
        );
        const [categories] = await userConnection.execute(
            'SELECT * FROM categories ORDER BY name ASC'
        );
        
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            database: 'mysql-separate-per-user',
            userId: req.userId,
            transactions,
            categories
        };
        
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Import data (Protected)
app.post('/api/import', authenticateToken, async (req, res) => {
    try {
        const { transactions, categories } = req.body;
        const userConnection = await dbManager.getUserConnection(req.userId);
        
        if (!transactions || !categories) {
            return res.status(400).json({ error: 'Invalid import data format' });
        }
        
        // Start transaction
        await userConnection.beginTransaction();
        
        try {
            // Clear existing user data (except default categories)
            await userConnection.execute('DELETE FROM transactions');
            await userConnection.execute('DELETE FROM categories WHERE is_default = 0');
            
            // Import categories (non-default only)
            for (const category of categories) {
                if (!category.is_default) {
                    await userConnection.execute(
                        'INSERT INTO categories (id, name, color, type, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [category.id, category.name, category.color, category.type, false, category.created_at, category.updated_at]
                    );
                }
            }
            
            // Import transactions
            for (const transaction of transactions) {
                await userConnection.execute(
                    'INSERT INTO transactions (id, amount, type, category_id, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [transaction.id, transaction.amount, transaction.type, transaction.category_id, transaction.date, transaction.note, transaction.created_at, transaction.updated_at]
                );
            }
            
            await userConnection.commit();
            res.json({ success: true, imported: { transactions: transactions.length, categories: categories.filter(c => !c.is_default).length } });
        } catch (error) {
            await userConnection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error importing data:', error);
        res.status(500).json({ error: 'Failed to import data' });
    }
});

// Health check endpoint (Public)
app.get('/api/health', async (req, res) => {
    try {
        const masterConnection = await dbManager.getMasterConnection();
        await masterConnection.execute('SELECT 1');
        res.json({ 
            status: 'healthy', 
            database: 'connected', 
            architecture: 'separate-database-per-user',
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
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