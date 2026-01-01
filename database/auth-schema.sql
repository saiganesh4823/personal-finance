-- Authentication System Database Schema Updates
-- Run this script to add authentication support to the existing database

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

-- Add user_id column to existing tables
ALTER TABLE categories ADD COLUMN user_id VARCHAR(36) AFTER id;
ALTER TABLE transactions ADD COLUMN user_id VARCHAR(36) AFTER id;
ALTER TABLE settings ADD COLUMN user_id VARCHAR(36) AFTER setting_key;

-- Add foreign key constraints
ALTER TABLE categories ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE settings ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add indexes for user_id columns
ALTER TABLE categories ADD INDEX idx_user_id (user_id);
ALTER TABLE transactions ADD INDEX idx_user_id (user_id);
ALTER TABLE settings ADD INDEX idx_user_id (user_id);

-- Update existing queries to be user-aware by modifying existing indexes
ALTER TABLE categories ADD INDEX idx_user_type (user_id, type);
ALTER TABLE categories ADD INDEX idx_user_default (user_id, is_default);
ALTER TABLE transactions ADD INDEX idx_user_type (user_id, type);
ALTER TABLE transactions ADD INDEX idx_user_date (user_id, date);
ALTER TABLE transactions ADD INDEX idx_user_category (user_id, category_id);

-- Create a default system user for existing data (optional migration step)
-- This will be handled by the migration script
-- INSERT INTO users (id, username, email, password_hash, first_name, is_active, email_verified) 
-- VALUES ('system-user-id', 'system', 'system@localhost', NULL, 'System', TRUE, TRUE);

-- Show updated table structures
DESCRIBE users;
DESCRIBE user_sessions;
DESCRIBE categories;
DESCRIBE transactions;
DESCRIBE settings;