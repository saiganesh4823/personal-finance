-- Complete Database Setup for Personal Finance Tracker with Google OAuth
-- Run this ENTIRE script in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (main authentication) with Google OAuth support
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table (per user)
CREATE TABLE IF NOT EXISTS categories (
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
CREATE TABLE IF NOT EXISTS transactions (
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- Insert default categories function
CREATE OR REPLACE FUNCTION create_default_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Default expense categories
    INSERT INTO categories (user_id, name, color, type, is_default) VALUES
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
    (p_user_id, 'Gym & Fitness', '#32cd32', 'expense', TRUE),
    
    -- Financial categories
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
    
    -- Default income categories
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

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();