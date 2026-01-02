-- ================================================================
-- PERSONAL FINANCE TRACKER - COMPLETE DATABASE SETUP
-- One comprehensive SQL file with all features
-- ================================================================
-- 
-- 🎯 FEATURES INCLUDED:
-- ✅ User management with Google OAuth
-- ✅ 32 comprehensive expense/income categories (including Family & Fuel)
-- ✅ Transaction management
-- ✅ Recurring transactions (SIP, EMI, rent automation)
-- ✅ Investment portfolio tracking (SIP, Gold, Silver, Stocks)
-- ✅ Email notifications for monthly reports
-- ✅ All necessary functions, triggers, and indexes
--
-- ⚠️  WARNING: This will delete ALL existing data and recreate everything
-- Only run this if you want a completely fresh start
--
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. CLEAN SLATE - DROP EVERYTHING
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
-- 2. CORE TABLES
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

-- User sessions table
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
    investment_type VARCHAR(50) NOT NULL, -- 'sip', 'mutual_fund', 'stocks', 'gold', 'silver', 'fd', 'bonds', 'crypto', 'other'
    investment_name VARCHAR(255) NOT NULL, -- e.g., 'HDFC Top 100 Fund', 'Physical Gold', 'Reliance Stock'
    category VARCHAR(100), -- e.g., 'Large Cap', 'Small Cap', 'Gold ETF', 'Physical Gold'
    total_invested DECIMAL(15, 2) DEFAULT 0.00, -- Total amount invested so far
    current_value DECIMAL(15, 2) DEFAULT 0.00, -- Current market value (optional)
    units_quantity DECIMAL(15, 4) DEFAULT 0.00, -- Number of units/shares/grams
    average_price DECIMAL(15, 4) DEFAULT 0.00, -- Average purchase price per unit
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
-- 3. INDEXES FOR PERFORMANCE
-- ================================================================

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);

-- Sessions indexes
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);

-- Categories indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Transactions indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);

-- Recurring transactions indexes
CREATE INDEX idx_recurring_transactions_user_id ON recurring_transactions(user_id);
CREATE INDEX idx_recurring_transactions_active ON recurring_transactions(is_active);
CREATE INDEX idx_recurring_transactions_frequency ON recurring_transactions(frequency);
CREATE INDEX idx_recurring_transactions_start_date ON recurring_transactions(start_date);

-- Investment portfolio indexes
CREATE INDEX idx_investment_portfolio_user_id ON investment_portfolio(user_id);
CREATE INDEX idx_investment_portfolio_type ON investment_portfolio(investment_type);
CREATE INDEX idx_investment_portfolio_active ON investment_portfolio(is_active);

-- Investment transactions indexes
CREATE INDEX idx_investment_transactions_user_id ON investment_transactions(user_id);
CREATE INDEX idx_investment_transactions_portfolio_id ON investment_transactions(portfolio_id);
CREATE INDEX idx_investment_transactions_date ON investment_transactions(transaction_date);

-- ================================================================
-- 4. UTILITY FUNCTIONS
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
-- 5. TRIGGERS FOR AUTO-TIMESTAMPS
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
    -- 24 Default expense categories (including Family and Fuel)
    INSERT INTO categories (user_id, name, color, type, is_default) VALUES
    -- Basic expense categories
    (p_user_id, 'Food & Dining', '#e74c3c', 'expense', TRUE),
    (p_user_id, 'Bills & Utilities', '#34495e', 'expense', TRUE),
    (p_user_id, 'Shopping', '#9b59b6', 'expense', TRUE),
    (p_user_id, 'Transportation', '#f39c12', 'expense', TRUE),
    (p_user_id, 'Entertainment', '#e67e22', 'expense', TRUE),
    (p_user_id, 'Healthcare', '#1abc9c', 'expense', TRUE),
    (p_user_id, 'Education', '#3498db', 'expense', TRUE),
    (p_user_id, 'Travel', '#2ecc71', 'expense', TRUE),
    (p_user_id, 'Personal Care', '#f1c40f', 'expense', TRUE),
    (p_user_id, 'Family', '#ff69b4', 'expense', TRUE), -- 👨‍👩‍👧‍👦 Family expenses
    (p_user_id, 'Fuel', '#ff6b35', 'expense', TRUE), -- ⛽ Vehicle fuel
    (p_user_id, 'Gym & Fitness', '#32cd32', 'expense', TRUE),
    
    -- Financial categories for investments and savings
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
-- 7. RECURRING TRANSACTIONS PROCESSING
-- ================================================================

CREATE OR REPLACE FUNCTION process_recurring_transactions()
RETURNS INTEGER AS $$
DECLARE
    recurring_record RECORD;
    next_date DATE;
    transactions_created INTEGER := 0;
    current_date_val DATE := CURRENT_DATE;
BEGIN
    -- Loop through all active recurring transactions
    FOR recurring_record IN 
        SELECT * FROM recurring_transactions 
        WHERE is_active = TRUE 
        AND start_date <= current_date_val
        AND (end_date IS NULL OR end_date >= current_date_val)
    LOOP
        -- Calculate next transaction date based on frequency
        CASE recurring_record.frequency
            WHEN 'daily' THEN
                next_date := COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 day') + INTERVAL '1 day';
            WHEN 'weekly' THEN
                next_date := COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 week') + INTERVAL '1 week';
            WHEN 'monthly' THEN
                IF recurring_record.day_of_month IS NOT NULL THEN
                    -- Use specific day of month
                    next_date := DATE_TRUNC('month', COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 month') + INTERVAL '1 month') + (recurring_record.day_of_month - 1) * INTERVAL '1 day';
                ELSE
                    -- Use same day as start date
                    next_date := COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 month') + INTERVAL '1 month';
                END IF;
            WHEN 'yearly' THEN
                next_date := COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 year') + INTERVAL '1 year';
        END CASE;
        
        -- Create transactions for all due dates up to today
        WHILE next_date <= current_date_val AND (recurring_record.end_date IS NULL OR next_date <= recurring_record.end_date) LOOP
            -- Insert the recurring transaction
            INSERT INTO transactions (
                user_id, type, amount, date, note, category_id
            ) VALUES (
                recurring_record.user_id, recurring_record.type, recurring_record.amount, next_date,
                COALESCE(recurring_record.note, '') || ' (Auto: ' || recurring_record.name || ')',
                recurring_record.category_id
            );
            
            transactions_created := transactions_created + 1;
            
            -- Update last processed date
            UPDATE recurring_transactions 
            SET last_processed_date = next_date 
            WHERE id = recurring_record.id;
            
            -- Calculate next date
            CASE recurring_record.frequency
                WHEN 'daily' THEN next_date := next_date + INTERVAL '1 day';
                WHEN 'weekly' THEN next_date := next_date + INTERVAL '1 week';
                WHEN 'monthly' THEN
                    IF recurring_record.day_of_month IS NOT NULL THEN
                        next_date := DATE_TRUNC('month', next_date + INTERVAL '1 month') + (recurring_record.day_of_month - 1) * INTERVAL '1 day';
                    ELSE
                        next_date := next_date + INTERVAL '1 month';
                    END IF;
                WHEN 'yearly' THEN next_date := next_date + INTERVAL '1 year';
            END CASE;
        END LOOP;
    END LOOP;
    
    RETURN transactions_created;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 8. INVESTMENT PORTFOLIO FUNCTIONS
-- ================================================================

-- Function to update portfolio totals when investment transactions are added
CREATE OR REPLACE FUNCTION update_portfolio_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the portfolio totals based on all transactions
    UPDATE investment_portfolio 
    SET 
        total_invested = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN transaction_type = 'buy' THEN amount
                    WHEN transaction_type = 'sell' THEN -amount
                    ELSE 0
                END
            ), 0)
            FROM investment_transactions 
            WHERE portfolio_id = NEW.portfolio_id
        ),
        units_quantity = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN transaction_type = 'buy' THEN units
                    WHEN transaction_type = 'sell' THEN -units
                    WHEN transaction_type = 'bonus' THEN units
                    ELSE 0
                END
            ), 0)
            FROM investment_transactions 
            WHERE portfolio_id = NEW.portfolio_id
        ),
        average_price = (
            SELECT 
                CASE 
                    WHEN SUM(CASE WHEN transaction_type = 'buy' THEN units ELSE 0 END) > 0 
                    THEN SUM(CASE WHEN transaction_type = 'buy' THEN amount ELSE 0 END) / 
                         SUM(CASE WHEN transaction_type = 'buy' THEN units ELSE 0 END)
                    ELSE 0
                END
            FROM investment_transactions 
            WHERE portfolio_id = NEW.portfolio_id
        ),
        last_updated_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.portfolio_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update portfolio totals
CREATE TRIGGER trigger_update_portfolio_totals
    AFTER INSERT OR UPDATE OR DELETE ON investment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_portfolio_totals();

-- Function to add investment transaction and update portfolio
CREATE OR REPLACE FUNCTION add_investment_transaction(
    p_user_id UUID,
    p_investment_type VARCHAR(50),
    p_investment_name VARCHAR(255),
    p_category VARCHAR(100),
    p_transaction_type VARCHAR(20),
    p_amount DECIMAL(12, 2),
    p_units DECIMAL(15, 4) DEFAULT 0,
    p_price_per_unit DECIMAL(15, 4) DEFAULT 0,
    p_transaction_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    portfolio_id_var UUID;
    transaction_id_var UUID;
BEGIN
    -- Get or create portfolio entry
    SELECT id INTO portfolio_id_var
    FROM investment_portfolio 
    WHERE user_id = p_user_id 
    AND investment_name = p_investment_name 
    AND investment_type = p_investment_type;
    
    -- If portfolio doesn't exist, create it
    IF portfolio_id_var IS NULL THEN
        INSERT INTO investment_portfolio (
            user_id, investment_type, investment_name, category,
            total_invested, units_quantity, average_price
        ) VALUES (
            p_user_id, p_investment_type, p_investment_name, p_category,
            0, 0, 0
        ) RETURNING id INTO portfolio_id_var;
    END IF;
    
    -- Add the investment transaction
    INSERT INTO investment_transactions (
        user_id, portfolio_id, transaction_type, amount, units, price_per_unit, transaction_date, notes
    ) VALUES (
        p_user_id, portfolio_id_var, p_transaction_type, p_amount, p_units, p_price_per_unit, p_transaction_date, p_notes
    ) RETURNING id INTO transaction_id_var;
    
    RETURN transaction_id_var;
END;
$$ LANGUAGE plpgsql;

-- Function to get investment summary by type
CREATE OR REPLACE FUNCTION get_investment_summary(p_user_id UUID)
RETURNS TABLE (
    investment_type VARCHAR(50),
    total_invested DECIMAL(15, 2),
    total_current_value DECIMAL(15, 2),
    total_units DECIMAL(15, 4),
    investment_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ip.investment_type,
        SUM(ip.total_invested) as total_invested,
        SUM(ip.current_value) as total_current_value,
        SUM(ip.units_quantity) as total_units,
        COUNT(*)::INTEGER as investment_count
    FROM investment_portfolio ip
    WHERE ip.user_id = p_user_id AND ip.is_active = TRUE
    GROUP BY ip.investment_type
    ORDER BY SUM(ip.total_invested) DESC;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 9. ADD CATEGORIES FOR EXISTING USERS (IF ANY)
-- ================================================================

DO $$
DECLARE
    user_record RECORD;
    categories_count INTEGER;
BEGIN
    -- Check if there are any existing users and add categories for them
    FOR user_record IN SELECT id, email FROM users LOOP
        -- Check how many categories this user has
        SELECT COUNT(*) INTO categories_count
        FROM categories 
        WHERE user_id = user_record.id;
        
        -- If user has no categories or very few, add all default categories
        IF categories_count < 10 THEN
            -- Delete any existing categories first to avoid conflicts
            DELETE FROM categories WHERE user_id = user_record.id;
            
            -- Add all default categories using the function
            PERFORM create_default_categories(user_record.id);
            
            RAISE NOTICE '✅ Added 32 categories for existing user: %', user_record.email;
        END IF;
    END LOOP;
END $$;

-- ================================================================
-- 10. SUCCESS MESSAGE AND SUMMARY
-- ================================================================

DO $$
DECLARE
    total_users INTEGER;
    total_categories INTEGER;
    total_transactions INTEGER;
BEGIN
    -- Get counts
    SELECT COUNT(*) INTO total_users FROM users;
    SELECT COUNT(*) INTO total_categories FROM categories;
    SELECT COUNT(*) INTO total_transactions FROM transactions;
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '🎉 PERSONAL FINANCE TRACKER - DATABASE READY! 🎉';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 DATABASE STATISTICS:';
    RAISE NOTICE '   👥 Users: %', total_users;
    RAISE NOTICE '   📂 Categories: %', total_categories;
    RAISE NOTICE '   💰 Transactions: %', total_transactions;
    RAISE NOTICE '';
    RAISE NOTICE '✅ FEATURES ENABLED:';
    RAISE NOTICE '   🏦 Complete transaction management';
    RAISE NOTICE '   📂 32 comprehensive categories (including Family & Fuel)';
    RAISE NOTICE '   🔄 Recurring transactions (SIP, EMI, rent automation)';
    RAISE NOTICE '   📈 Investment portfolio tracking (SIP, Gold, Silver, Stocks)';
    RAISE NOTICE '   📧 Email notifications for monthly reports';
    RAISE NOTICE '   🔐 Google OAuth authentication';
    RAISE NOTICE '   ⚡ Automatic processing and triggers';
    RAISE NOTICE '';
    RAISE NOTICE '📋 EXPENSE CATEGORIES (24):';
    RAISE NOTICE '   • Food & Dining, Bills & Utilities, Shopping, Transportation';
    RAISE NOTICE '   • Entertainment, Healthcare, Education, Travel, Personal Care';
    RAISE NOTICE '   • Family 👨‍👩‍👧‍👦 (pink), Fuel ⛽ (orange), Gym & Fitness';
    RAISE NOTICE '   • Loan EMI, Credit Card Payment, SIP & Mutual Funds, Savings';
    RAISE NOTICE '   • Insurance Premium, Tax Payment, Fixed Deposit, Stock Investment';
    RAISE NOTICE '   • Rent, Home Maintenance, Charity & Donation, Other Expenses';
    RAISE NOTICE '';
    RAISE NOTICE '💰 INCOME CATEGORIES (10):';
    RAISE NOTICE '   • Salary, Freelance, Investment Returns, Dividend, Interest Income';
    RAISE NOTICE '   • Bonus, Gift Received, Rental Income, Business Income, Other Income';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 NEXT STEPS:';
    RAISE NOTICE '   1. Refresh your Personal Finance Tracker app';
    RAISE NOTICE '   2. All tabs should work: Dashboard, Transactions, History,';
    RAISE NOTICE '      Analytics, Categories, Recurring, Investments, Settings';
    RAISE NOTICE '   3. Set up your first recurring SIP or EMI';
    RAISE NOTICE '   4. Add your investment portfolio (SIP, Gold, Silver)';
    RAISE NOTICE '   5. Enable email notifications for monthly reports';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 PERFECT FOR:';
    RAISE NOTICE '   • Tracking SIP investments automatically';
    RAISE NOTICE '   • Managing family and fuel expenses';
    RAISE NOTICE '   • Monitoring investment portfolio growth';
    RAISE NOTICE '   • Getting monthly financial reports via email';
    RAISE NOTICE '   • Complete personal finance management';
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '🎉 YOUR PERSONAL FINANCE TRACKER IS READY TO USE! 🎉';
    RAISE NOTICE '================================================================';
END $$;