-- ================================================================
-- PERSONAL FINANCE TRACKER - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor to create all tables
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. DROP EXISTING OBJECTS
-- ================================================================
DROP TABLE IF EXISTS investment_transactions CASCADE;
DROP TABLE IF EXISTS investment_portfolio CASCADE;
DROP TABLE IF EXISTS recurring_transactions CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS process_recurring_transactions() CASCADE;
DROP FUNCTION IF EXISTS add_investment_transaction CASCADE;
DROP FUNCTION IF EXISTS get_investment_summary CASCADE;
DROP FUNCTION IF EXISTS create_default_categories CASCADE;
DROP FUNCTION IF EXISTS trigger_create_default_categories() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ================================================================
-- 2. CREATE TABLES
-- ================================================================

-- Users table
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
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    icon VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name, type)
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    note TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    payment_method VARCHAR(50),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_transaction_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recurring transactions table
CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE,
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    is_active BOOLEAN DEFAULT TRUE,
    note TEXT,
    last_processed_date DATE,
    next_due_date DATE,
    total_occurrences INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Investment portfolio table
CREATE TABLE investment_portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    investment_type VARCHAR(50) NOT NULL,
    investment_name VARCHAR(255) NOT NULL,
    symbol VARCHAR(20),
    category VARCHAR(100),
    total_invested DECIMAL(15, 2) DEFAULT 0.00,
    current_value DECIMAL(15, 2) DEFAULT 0.00,
    units_quantity DECIMAL(15, 6) DEFAULT 0.00,
    average_price DECIMAL(15, 6) DEFAULT 0.00,
    current_price DECIMAL(15, 6) DEFAULT 0.00,
    last_updated_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    broker VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, investment_name, investment_type)
);

-- Investment transactions table
CREATE TABLE investment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id UUID NOT NULL REFERENCES investment_portfolio(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'dividend', 'bonus', 'split', 'merger')),
    amount DECIMAL(15, 2) NOT NULL,
    units DECIMAL(15, 6) DEFAULT 0.00,
    price_per_unit DECIMAL(15, 6) DEFAULT 0.00,
    fees DECIMAL(15, 2) DEFAULT 0.00,
    taxes DECIMAL(15, 2) DEFAULT 0.00,
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- 3. CREATE INDEXES
-- ================================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(type);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);

CREATE INDEX idx_recurring_user_id ON recurring_transactions(user_id);
CREATE INDEX idx_recurring_active ON recurring_transactions(is_active);

CREATE INDEX idx_portfolio_user_id ON investment_portfolio(user_id);
CREATE INDEX idx_portfolio_type ON investment_portfolio(investment_type);

CREATE INDEX idx_inv_trans_user_id ON investment_transactions(user_id);
CREATE INDEX idx_inv_trans_portfolio ON investment_transactions(portfolio_id);
CREATE INDEX idx_inv_trans_date ON investment_transactions(transaction_date);

-- ================================================================
-- 4. CREATE FUNCTIONS
-- ================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create default categories for new users
CREATE OR REPLACE FUNCTION create_default_categories(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    -- Insert expense categories
    INSERT INTO categories (user_id, name, color, type, is_default, sort_order) VALUES
    (p_user_id, 'Food & Dining', '#e74c3c', 'expense', TRUE, 1),
    (p_user_id, 'Bills & Utilities', '#34495e', 'expense', TRUE, 2),
    (p_user_id, 'Shopping', '#9b59b6', 'expense', TRUE, 3),
    (p_user_id, 'Transportation', '#f39c12', 'expense', TRUE, 4),
    (p_user_id, 'Entertainment', '#e67e22', 'expense', TRUE, 5),
    (p_user_id, 'Healthcare', '#1abc9c', 'expense', TRUE, 6),
    (p_user_id, 'Education', '#3498db', 'expense', TRUE, 7),
    (p_user_id, 'Travel', '#2ecc71', 'expense', TRUE, 8),
    (p_user_id, 'Personal Care', '#f1c40f', 'expense', TRUE, 9),
    (p_user_id, 'Family', '#ff69b4', 'expense', TRUE, 10),
    (p_user_id, 'Fuel', '#ff6b35', 'expense', TRUE, 11),
    (p_user_id, 'Gym & Fitness', '#32cd32', 'expense', TRUE, 12),
    (p_user_id, 'Loan EMI', '#dc3545', 'expense', TRUE, 13),
    (p_user_id, 'Credit Card Payment', '#fd7e14', 'expense', TRUE, 14),
    (p_user_id, 'SIP & Mutual Funds', '#4169e1', 'expense', TRUE, 15),
    (p_user_id, 'Savings', '#ffd700', 'expense', TRUE, 16),
    (p_user_id, 'Insurance Premium', '#6f42c1', 'expense', TRUE, 17),
    (p_user_id, 'Tax Payment', '#20c997', 'expense', TRUE, 18),
    (p_user_id, 'Fixed Deposit', '#17a2b8', 'expense', TRUE, 19),
    (p_user_id, 'Stock Investment', '#28a745', 'expense', TRUE, 20),
    (p_user_id, 'Rent', '#6c757d', 'expense', TRUE, 21),
    (p_user_id, 'Home Maintenance', '#e83e8c', 'expense', TRUE, 22),
    (p_user_id, 'Charity & Donation', '#fd7e14', 'expense', TRUE, 23),
    (p_user_id, 'Other Expenses', '#95a5a6', 'expense', TRUE, 24);
    
    -- Insert income categories
    INSERT INTO categories (user_id, name, color, type, is_default, sort_order) VALUES
    (p_user_id, 'Salary', '#27ae60', 'income', TRUE, 1),
    (p_user_id, 'Freelance', '#16a085', 'income', TRUE, 2),
    (p_user_id, 'Investment Returns', '#2980b9', 'income', TRUE, 3),
    (p_user_id, 'Dividend', '#8e44ad', 'income', TRUE, 4),
    (p_user_id, 'Interest Income', '#d35400', 'income', TRUE, 5),
    (p_user_id, 'Bonus', '#c0392b', 'income', TRUE, 6),
    (p_user_id, 'Gift Received', '#85c1e9', 'income', TRUE, 7),
    (p_user_id, 'Rental Income', '#58d68d', 'income', TRUE, 8),
    (p_user_id, 'Business Income', '#f4d03f', 'income', TRUE, 9),
    (p_user_id, 'Other Income', '#aed6f1', 'income', TRUE, 10);
    
    RETURN 34;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for auto-creating categories
CREATE OR REPLACE FUNCTION trigger_create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_categories(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Process recurring transactions function
CREATE OR REPLACE FUNCTION process_recurring_transactions()
RETURNS INTEGER AS $$
DECLARE
    rec RECORD;
    next_date DATE;
    transactions_created INTEGER := 0;
BEGIN
    FOR rec IN 
        SELECT * FROM recurring_transactions 
        WHERE is_active = TRUE 
        AND (next_due_date IS NULL OR next_due_date <= CURRENT_DATE)
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    LOOP
        CASE rec.frequency
            WHEN 'daily' THEN
                next_date := COALESCE(rec.next_due_date, rec.start_date) + INTERVAL '1 day';
            WHEN 'weekly' THEN
                next_date := COALESCE(rec.next_due_date, rec.start_date) + INTERVAL '1 week';
            WHEN 'monthly' THEN
                next_date := COALESCE(rec.next_due_date, rec.start_date) + INTERVAL '1 month';
            WHEN 'yearly' THEN
                next_date := COALESCE(rec.next_due_date, rec.start_date) + INTERVAL '1 year';
        END CASE;
        
        INSERT INTO transactions (user_id, type, amount, date, note, category_id, is_recurring, recurring_transaction_id)
        VALUES (rec.user_id, rec.type, rec.amount, COALESCE(rec.next_due_date, rec.start_date), 
                COALESCE(rec.note, 'Recurring: ' || rec.name), rec.category_id, TRUE, rec.id);
        
        UPDATE recurring_transactions 
        SET last_processed_date = COALESCE(rec.next_due_date, rec.start_date),
            next_due_date = next_date,
            total_occurrences = total_occurrences + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = rec.id;
        
        transactions_created := transactions_created + 1;
    END LOOP;
    
    RETURN transactions_created;
END;
$$ LANGUAGE plpgsql;

-- Add investment transaction function (all required params first, then defaults)
CREATE OR REPLACE FUNCTION add_investment_transaction(
    p_user_id UUID,
    p_investment_type VARCHAR,
    p_investment_name VARCHAR,
    p_transaction_type VARCHAR,
    p_amount DECIMAL,
    p_category VARCHAR DEFAULT NULL,
    p_units DECIMAL DEFAULT 0,
    p_price_per_unit DECIMAL DEFAULT 0,
    p_transaction_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_portfolio_id UUID;
    v_transaction_id UUID;
    v_new_total_invested DECIMAL;
    v_new_units DECIMAL;
    v_new_avg_price DECIMAL;
BEGIN
    SELECT id INTO v_portfolio_id
    FROM investment_portfolio
    WHERE user_id = p_user_id 
    AND investment_name = p_investment_name 
    AND investment_type = p_investment_type;
    
    IF v_portfolio_id IS NULL THEN
        INSERT INTO investment_portfolio (user_id, investment_type, investment_name, category, total_invested, units_quantity, average_price, is_active)
        VALUES (p_user_id, p_investment_type, p_investment_name, p_category, 0, 0, 0, TRUE)
        RETURNING id INTO v_portfolio_id;
    END IF;
    
    INSERT INTO investment_transactions (user_id, portfolio_id, transaction_type, amount, units, price_per_unit, transaction_date, notes)
    VALUES (p_user_id, v_portfolio_id, p_transaction_type, p_amount, p_units, p_price_per_unit, p_transaction_date, p_notes)
    RETURNING id INTO v_transaction_id;
    
    IF p_transaction_type = 'buy' THEN
        SELECT total_invested + p_amount, units_quantity + p_units
        INTO v_new_total_invested, v_new_units
        FROM investment_portfolio WHERE id = v_portfolio_id;
        
        IF v_new_units > 0 THEN
            v_new_avg_price := v_new_total_invested / v_new_units;
        ELSE
            v_new_avg_price := 0;
        END IF;
        
        UPDATE investment_portfolio
        SET total_invested = v_new_total_invested, units_quantity = v_new_units, average_price = v_new_avg_price,
            last_updated_date = p_transaction_date, updated_at = CURRENT_TIMESTAMP
        WHERE id = v_portfolio_id;
        
    ELSIF p_transaction_type = 'sell' THEN
        SELECT GREATEST(0, total_invested - (p_units * average_price)), GREATEST(0, units_quantity - p_units)
        INTO v_new_total_invested, v_new_units
        FROM investment_portfolio WHERE id = v_portfolio_id;
        
        UPDATE investment_portfolio
        SET total_invested = v_new_total_invested, units_quantity = v_new_units,
            last_updated_date = p_transaction_date, updated_at = CURRENT_TIMESTAMP
        WHERE id = v_portfolio_id;
    END IF;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Get investment summary function
CREATE OR REPLACE FUNCTION get_investment_summary(p_user_id UUID)
RETURNS TABLE (
    investment_type VARCHAR,
    total_invested DECIMAL,
    current_value DECIMAL,
    total_gain_loss DECIMAL,
    percentage_return DECIMAL,
    investment_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ip.investment_type,
        COALESCE(SUM(ip.total_invested), 0::DECIMAL) as total_invested,
        COALESCE(SUM(ip.current_value), 0::DECIMAL) as current_value,
        COALESCE(SUM(ip.current_value - ip.total_invested), 0::DECIMAL) as total_gain_loss,
        CASE 
            WHEN SUM(ip.total_invested) > 0 THEN 
                ROUND(((SUM(ip.current_value) - SUM(ip.total_invested)) / SUM(ip.total_invested) * 100)::DECIMAL, 2)
            ELSE 0::DECIMAL
        END as percentage_return,
        COUNT(*) as investment_count
    FROM investment_portfolio ip
    WHERE ip.user_id = p_user_id AND ip.is_active = TRUE
    GROUP BY ip.investment_type
    ORDER BY SUM(ip.total_invested) DESC;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 5. CREATE TRIGGERS
-- ================================================================
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_updated_at BEFORE UPDATE ON recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_updated_at BEFORE UPDATE ON investment_portfolio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create categories for new users
CREATE TRIGGER trigger_user_default_categories
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_create_default_categories();

-- ================================================================
-- 6. CREATE VIEWS
-- ================================================================
CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT 
    user_id,
    DATE_TRUNC('month', date) as month,
    type,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM transactions
GROUP BY user_id, DATE_TRUNC('month', date), type;

CREATE OR REPLACE VIEW v_category_summary AS
SELECT 
    t.user_id,
    c.name as category_name,
    c.color as category_color,
    t.type,
    COUNT(*) as transaction_count,
    SUM(t.amount) as total_amount
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
GROUP BY t.user_id, c.id, c.name, c.color, t.type;

-- ================================================================
-- 7. SUCCESS MESSAGE
-- ================================================================
SELECT 'DATABASE SETUP COMPLETE!' as status;
SELECT 'Tables: users, user_sessions, categories, transactions, recurring_transactions, investment_portfolio, investment_transactions' as tables_created;
SELECT 'Functions: update_updated_at_column, create_default_categories, process_recurring_transactions, add_investment_transaction, get_investment_summary' as functions_created;
SELECT 'New users will automatically get 34 default categories (24 expense + 10 income)' as auto_categories;