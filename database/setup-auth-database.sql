-- Complete Database Setup with Authentication
-- This script sets up a fresh database with authentication support

-- Create database
CREATE DATABASE IF NOT EXISTS personal_finance_db;
USE personal_finance_db;

-- Users table for authentication
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    profile_picture VARCHAR(500),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_google_id (google_id),
    INDEX idx_is_active (is_active),
    INDEX idx_created_at (created_at)
);

-- User sessions table for JWT token management
CREATE TABLE user_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_active (is_active)
);

-- Categories table (with user support)
CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL,
    type ENUM('income', 'expense', 'both') NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_is_default (is_default),
    INDEX idx_user_type (user_id, type),
    INDEX idx_user_default (user_id, is_default)
);

-- Transactions table (with user support)
CREATE TABLE transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_category_id (category_id),
    INDEX idx_date (date),
    INDEX idx_created_at (created_at),
    INDEX idx_user_type (user_id, type),
    INDEX idx_user_date (user_id, date),
    INDEX idx_user_category (user_id, category_id)
);

-- Settings table (with user support)
CREATE TABLE settings (
    setting_key VARCHAR(50) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (setting_key, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- Function to create default categories for a user
DELIMITER //
CREATE PROCEDURE CreateDefaultCategories(IN p_user_id VARCHAR(36))
BEGIN
    -- Insert default expense categories
    INSERT INTO categories (id, user_id, name, color, type, is_default) VALUES
    (CONCAT('cat-food-', p_user_id), p_user_id, 'Food & Dining', '#FF6384', 'expense', TRUE),
    (CONCAT('cat-transport-', p_user_id), p_user_id, 'Transportation', '#36A2EB', 'expense', TRUE),
    (CONCAT('cat-shopping-', p_user_id), p_user_id, 'Shopping', '#FFCE56', 'expense', TRUE),
    (CONCAT('cat-entertainment-', p_user_id), p_user_id, 'Entertainment', '#4BC0C0', 'expense', TRUE),
    (CONCAT('cat-bills-', p_user_id), p_user_id, 'Bills & Utilities', '#9966FF', 'expense', TRUE),
    (CONCAT('cat-healthcare-', p_user_id), p_user_id, 'Healthcare', '#FF9F40', 'expense', TRUE),
    (CONCAT('cat-education-', p_user_id), p_user_id, 'Education', '#E74C3C', 'expense', TRUE),
    (CONCAT('cat-family-', p_user_id), p_user_id, 'Family', '#FF69B4', 'expense', TRUE),
    (CONCAT('cat-gym-', p_user_id), p_user_id, 'Gym & Fitness', '#32CD32', 'expense', TRUE),
    (CONCAT('cat-sip-', p_user_id), p_user_id, 'SIP & Investments', '#4169E1', 'expense', TRUE),
    (CONCAT('cat-savings-', p_user_id), p_user_id, 'Savings', '#FFD700', 'expense', TRUE),
    (CONCAT('cat-other-expense-', p_user_id), p_user_id, 'Other Expenses', '#C9CBCF', 'expense', TRUE),
    
    -- Insert default income categories
    (CONCAT('cat-salary-', p_user_id), p_user_id, 'Salary', '#27AE60', 'income', TRUE),
    (CONCAT('cat-freelance-', p_user_id), p_user_id, 'Freelance', '#2ECC71', 'income', TRUE),
    (CONCAT('cat-investment-', p_user_id), p_user_id, 'Investment', '#58D68D', 'income', TRUE),
    (CONCAT('cat-gift-', p_user_id), p_user_id, 'Gift', '#85C1E9', 'income', TRUE),
    (CONCAT('cat-other-income-', p_user_id), p_user_id, 'Other Income', '#AED6F1', 'income', TRUE);
END //
DELIMITER ;

-- Function to create default settings for a user
DELIMITER //
CREATE PROCEDURE CreateDefaultSettings(IN p_user_id VARCHAR(36))
BEGIN
    INSERT INTO settings (setting_key, user_id, setting_value) VALUES
    ('currency', p_user_id, '₹'),
    ('date_format', p_user_id, 'DD/MM/YYYY'),
    ('theme', p_user_id, 'light'),
    ('app_version', p_user_id, '1.0.0');
END //
DELIMITER ;

-- Show created tables
SHOW TABLES;

-- Show procedures
SHOW PROCEDURE STATUS WHERE Db = 'personal_finance_db';

SELECT 'Database setup complete with authentication support' as status;