-- ================================================================
-- PERSONAL FINANCE TRACKER - COMPLETE DATABASE SETUP WITH RECURRING PROCESSING
-- Run this in Supabase SQL Editor to create all tables and functions
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

-- Recurring transactions table (enhanced with partial debit support)
CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    debit_amount DECIMAL(15, 2), -- Amount to actually debit from account (can be less than amount)
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
CREATE INDEX idx_recurring_next_due ON recurring_transactions(next_due_date) WHERE is_active = TRUE;

CREATE INDEX idx_portfolio_user_id ON investment_portfolio(user_id);
CREATE INDEX idx_portfolio_type ON investment_portfolio(investment_type);

CREATE INDEX idx_inv_trans_user_id ON investment_transactions(user_id);
CREATE INDEX idx_inv_trans_portfolio ON investment_transactions(portfolio_id);
CREATE INDEX idx_inv_trans_date ON investment_transactions(transaction_date);

-- ================================================================
-- 4. CREATE FUNCTIONS
-- ================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Function to calculate next due date
CREATE OR REPLACE FUNCTION calculate_next_due_date(
    p_frequency VARCHAR(20),
    p_current_date DATE,
    p_day_of_month INTEGER DEFAULT NULL,
    p_day_of_week INTEGER DEFAULT NULL
) RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
    next_date DATE;
BEGIN
    CASE p_frequency
        WHEN 'daily' THEN
            next_date := p_current_date + INTERVAL '1 day';
            
        WHEN 'weekly' THEN
            next_date := p_current_date + INTERVAL '1 week';
            
        WHEN 'monthly' THEN
            IF p_day_of_month IS NOT NULL THEN
                -- Set to specific day of next month
                next_date := (DATE_TRUNC('month', p_current_date) + INTERVAL '1 month' + (p_day_of_month - 1) * INTERVAL '1 day')::DATE;
                -- Handle month-end cases (e.g., Jan 31 -> Feb 28)
                IF EXTRACT(DAY FROM next_date) != p_day_of_month THEN
                    next_date := (DATE_TRUNC('month', next_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
                END IF;
            ELSE
                next_date := p_current_date + INTERVAL '1 month';
            END IF;
            
        WHEN 'yearly' THEN
            next_date := p_current_date + INTERVAL '1 year';
            
        ELSE
            next_date := p_current_date + INTERVAL '1 month'; -- Default to monthly
    END CASE;
    
    RETURN next_date;
END;
$$;

-- Function to process recurring transactions
CREATE OR REPLACE FUNCTION process_recurring_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    recurring_rec RECORD;
    transaction_count INTEGER := 0;
    actual_debit_amount DECIMAL(15, 2);
BEGIN
    -- Process all active recurring transactions that are due
    FOR recurring_rec IN 
        SELECT * FROM recurring_transactions 
        WHERE is_active = TRUE 
        AND (next_due_date IS NULL OR next_due_date <= CURRENT_DATE)
        AND (end_date IS NULL OR CURRENT_DATE <= end_date)
    LOOP
        -- Determine the amount to actually debit
        actual_debit_amount := COALESCE(recurring_rec.debit_amount, recurring_rec.amount);
        
        -- Create the transaction with the debit amount (not the full amount)
        INSERT INTO transactions (
            user_id,
            type,
            amount,
            date,
            note,
            category_id,
            is_recurring,
            recurring_transaction_id
        ) VALUES (
            recurring_rec.user_id,
            recurring_rec.type,
            actual_debit_amount, -- Use debit_amount if specified, otherwise full amount
            CURRENT_DATE,
            COALESCE(recurring_rec.note, '') || 
            CASE 
                WHEN recurring_rec.debit_amount IS NOT NULL AND recurring_rec.debit_amount != recurring_rec.amount 
                THEN ' (Partial: ₹' || recurring_rec.debit_amount || ' of ₹' || recurring_rec.amount || ')'
                ELSE ''
            END,
            recurring_rec.category_id,
            TRUE,
            recurring_rec.id
        );
        
        -- Update the recurring transaction
        UPDATE recurring_transactions 
        SET 
            last_processed_date = CURRENT_DATE,
            next_due_date = calculate_next_due_date(
                frequency, 
                CURRENT_DATE, 
                day_of_month, 
                day_of_week
            ),
            total_occurrences = total_occurrences + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = recurring_rec.id;
        
        transaction_count := transaction_count + 1;
    END LOOP;
    
    RETURN transaction_count;
END;
$$;

-- Trigger to set initial next_due_date when creating recurring transaction
CREATE OR REPLACE FUNCTION set_initial_next_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.next_due_date IS NULL THEN
        NEW.next_due_date := calculate_next_due_date(
            NEW.frequency,
            COALESCE(NEW.start_date, CURRENT_DATE),
            NEW.day_of_month,
            NEW.day_of_week
        );
    END IF;
    RETURN NEW;
END;
$$;

-- ================================================================
-- 5. CREATE TRIGGERS
-- ================================================================

-- Update timestamp triggers
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

-- Set initial next_due_date for new recurring transactions
CREATE TRIGGER set_recurring_next_due_date 
    BEFORE INSERT ON recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION set_initial_next_due_date();

-- ================================================================
-- 6. SUCCESS MESSAGE
-- ================================================================
SELECT 'DATABASE SETUP COMPLETE!' as status;
SELECT 'All 7 tables and recurring processing functions created successfully' as info;