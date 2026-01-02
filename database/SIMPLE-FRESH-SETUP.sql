-- ================================================================
-- PERSONAL FINANCE TRACKER - SIMPLE FRESH DATABASE SETUP
-- ⚠️  WARNING: This DELETES ALL DATA and creates everything fresh
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. DELETE EVERYTHING (NUCLEAR OPTION)
-- ================================================================

-- Drop all tables in correct order (foreign keys first)
DROP TABLE IF EXISTS investment_transactions CASCADE;
DROP TABLE IF EXISTS investment_portfolio CASCADE;
DROP TABLE IF EXISTS recurring_transactions CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS process_recurring_transactions() CASCADE;
DROP FUNCTION IF EXISTS create_default_categories(UUID) CASCADE;
DROP FUNCTION IF EXISTS trigger_create_default_categories() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS add_investment_transaction(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, DECIMAL, DECIMAL, DECIMAL, DATE, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_investment_summary(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_portfolio_totals() CASCADE;

-- ================================================================
-- 2. CREATE FRESH TABLES
-- ================================================================

-- Users table with Google OAuth support and email notifications
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    database_name VARCHAR(100) UNIQUE NOT NULL,
    google_id VARCHAR(100) UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table for authentication
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table (per user) with comprehensive default categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name, type)
);

-- Transactions table (per user)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    note TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recurring transactions table for SIP, EMI, rent automation
CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE,
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    is_active BOOLEAN DEFAULT TRUE,
    note TEXT,
    last_processed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Investment portfolio table for tracking SIP, Gold, Silver, Stocks
CREATE TABLE investment_portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    investment_type VARCHAR(50) NOT NULL,
    investment_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    total_invested DECIMAL(15, 2) DEFAULT 0.00,
    current_value DECIMAL(15, 2) DEFAULT 0.00,
    units_quantity DECIMAL(15, 4) DEFAULT 0.00,
    average_price DECIMAL(15, 4) DEFAULT 0.00,
    last_updated_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, investment_name, investment_type)
);

-- Investment transactions table for tracking individual buy/sell transactions
CREATE TABLE investment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id UUID NOT NULL REFERENCES investment_portfolio(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'dividend', 'bonus')),
    amount DECIMAL(12, 2) NOT NULL,
    units DECIMAL(15, 4) DEFAULT 0.00,
    price_per_unit DECIMAL(15, 4) DEFAULT 0.00,
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(type);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_recurring_transactions_user_id ON recurring_transactions(user_id);
CREATE INDEX idx_recurring_transactions_active ON recurring_transactions(is_active);
CREATE INDEX idx_investment_portfolio_user_id ON investment_portfolio(user_id);
CREATE INDEX idx_investment_transactions_user_id ON investment_transactions(user_id);

-- ================================================================
-- 4. CREATE UTILITY FUNCTIONS
-- ================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 5. CREATE TRIGGERS FOR AUTO-TIMESTAMPS
-- ================================================================

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_transactions_updated_at BEFORE UPDATE ON recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investment_portfolio_updated_at BEFORE UPDATE ON investment_portfolio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 6. DEFAULT CATEGORIES FUNCTION (32 COMPREHENSIVE CATEGORIES)
-- ================================================================

CREATE OR REPLACE FUNCTION create_default_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Delete any existing categories for this user first
    DELETE FROM categories WHERE user_id = p_user_id;
    
    -- Insert all 32 default categories
    INSERT INTO categories (user_id, name, color, type, is_default) VALUES
    -- 24 Default expense categories (including Family and Fuel)
    (p_user_id, 'Food & Dining', '#e74c3c', 'expense', TRUE),
    (p_user_id, 'Bills & Utilities', '#34495e', 'expense', TRUE),
    (p_user_id, 'Shopping', '#9b59b6', 'expense', TRUE),
    (p_user_id, 'Transportation', '#f39c12', 'expense', TRUE),
    (p_user_id, 'Entertainment', '#e67e22', 'expense', TRUE),
    (p_user_id, 'Healthcare', '#1abc9c', 'expense', TRUE),
    (p_user_id, 'Education', '#3498db', 'expense', TRUE),
    (p_user_id, 'Travel', '#2ecc71', 'expense', TRUE),
    (p_user_id, 'Personal Care', '#f1c40f', 'expense', TRUE),
    (p_user_id, 'Family', '#ff69b4', 'expense', TRUE),
    (p_user_id, 'Fuel', '#ff6b35', 'expense', TRUE),
    (p_user_id, 'Gym & Fitness', '#32cd32', 'expense', TRUE),
    (p_user_id, 'Loan EMI', '#dc3545', 'expense', TRUE),
    (p_user_id, 'Credit Card Payment', '#fd7e14', 'expense', TRUE),
    (p_user_id, 'SIP & Mutual Funds', '#4169e1', 'expense', TRUE),
    (p_user_id, 'Savings', '#ffd700', 'expense', TRUE),
    (p_user_id, 'Insurance Premium', '#6f42c1', 'expense', TRUE),
    (p_user_id, 'Tax Payment', '#20c997', 'expense', TRUE),
    (p_user_id, 'Fixed Deposit', '#17a2b8', 'expense', TRUE),
    (p_user_id, 'Stock Investment', '#28a745', 'expense', TRUE),
    (p_user_id, 'Rent', '#6c757d', 'expense', TRUE),
    (p_user_id, 'Home Maintenance', '#e83e8c', 'expense', TRUE),
    (p_user_id, 'Charity & Donation', '#fd7e14', 'expense', TRUE),
    (p_user_id, 'Other Expenses', '#95a5a6', 'expense', TRUE),
    
    -- 10 Default income categories
    (p_user_id, 'Salary', '#27ae60', 'income', TRUE),
    (p_user_id, 'Freelance', '#16a085', 'income', TRUE),
    (p_user_id, 'Investment Returns', '#2980b9', 'income', TRUE),
    (p_user_id, 'Dividend', '#8e44ad', 'income', TRUE),
    (p_user_id, 'Interest Income', '#d35400', 'income', TRUE),
    (p_user_id, 'Bonus', '#c0392b', 'income', TRUE),
    (p_user_id, 'Gift Received', '#85c1e9', 'income', TRUE),
    (p_user_id, 'Rental Income', '#58d68d', 'income', TRUE),
    (p_user_id, 'Business Income', '#f4d03f', 'income', TRUE),
    (p_user_id, 'Other Income', '#aed6f1', 'income', TRUE);
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default categories for new users
CREATE OR REPLACE FUNCTION trigger_create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_categories(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_user_insert
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_default_categories();

-- ================================================================
-- 7. SUCCESS MESSAGE
-- ================================================================

-- Simple success notification
SELECT 'SUCCESS: Fresh database created with all tables, functions, and triggers!' as status;
SELECT 'NEXT STEP: Register a new user and categories will be automatically created!' as instruction;