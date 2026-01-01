-- Personal Finance Tracker Database Schema
-- Run this script to create the database and tables

-- Create database
CREATE DATABASE IF NOT EXISTS personal_finance_db;
USE personal_finance_db;

-- Categories table
CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL,
    type ENUM('income', 'expense', 'both') NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_is_default (is_default)
);

-- Transactions table
CREATE TABLE transactions (
    id VARCHAR(36) PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_type (type),
    INDEX idx_category_id (category_id),
    INDEX idx_date (date),
    INDEX idx_created_at (created_at)
);

-- Settings table
CREATE TABLE settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO categories (id, name, color, type, is_default) VALUES
-- Expense categories
('cat-food', 'Food & Dining', '#FF6384', 'expense', TRUE),
('cat-transport', 'Transportation', '#36A2EB', 'expense', TRUE),
('cat-shopping', 'Shopping', '#FFCE56', 'expense', TRUE),
('cat-entertainment', 'Entertainment', '#4BC0C0', 'expense', TRUE),
('cat-bills', 'Bills & Utilities', '#9966FF', 'expense', TRUE),
('cat-healthcare', 'Healthcare', '#FF9F40', 'expense', TRUE),
('cat-education', 'Education', '#E74C3C', 'expense', TRUE),
('cat-family', 'Family', '#FF69B4', 'expense', TRUE),
('cat-gym', 'Gym & Fitness', '#32CD32', 'expense', TRUE),
('cat-sip', 'SIP & Investments', '#4169E1', 'expense', TRUE),
('cat-savings', 'Savings', '#FFD700', 'expense', TRUE),
('cat-other-expense', 'Other Expenses', '#C9CBCF', 'expense', TRUE),

-- Income categories
('cat-salary', 'Salary', '#27AE60', 'income', TRUE),
('cat-freelance', 'Freelance', '#2ECC71', 'income', TRUE),
('cat-investment', 'Investment', '#58D68D', 'income', TRUE),
('cat-gift', 'Gift', '#85C1E9', 'income', TRUE),
('cat-other-income', 'Other Income', '#AED6F1', 'income', TRUE);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value) VALUES
('currency', '₹'),
('date_format', 'DD/MM/YYYY'),
('theme', 'light'),
('app_version', '1.0.0');

-- Show created tables
SHOW TABLES;

-- Show default categories
SELECT name, type, color FROM categories WHERE is_default = TRUE ORDER BY type, name;