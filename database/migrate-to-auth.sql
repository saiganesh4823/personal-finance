-- Migration Script: Convert Single-User to Multi-User System
-- This script safely migrates existing data to the new authentication system

USE personal_finance_db;

-- Step 1: Create a default user for existing data
SET @default_user_id = UUID();
SET @default_username = 'default_user';
SET @default_email = 'user@localhost';

-- Insert default user (password will be set during first login)
INSERT INTO users (
    id, 
    username, 
    email, 
    password_hash, 
    first_name, 
    is_active, 
    email_verified,
    created_at
) VALUES (
    @default_user_id,
    @default_username,
    @default_email,
    NULL, -- Password will be set when user first logs in
    'Default User',
    TRUE,
    FALSE, -- Will need to set password on first login
    NOW()
);

-- Step 2: Update existing categories to belong to default user
UPDATE categories 
SET user_id = @default_user_id 
WHERE user_id IS NULL;

-- Step 3: Update existing transactions to belong to default user
UPDATE transactions 
SET user_id = @default_user_id 
WHERE user_id IS NULL;

-- Step 4: Update existing settings to belong to default user
UPDATE settings 
SET user_id = @default_user_id 
WHERE user_id IS NULL;

-- Step 5: Make user_id columns NOT NULL after migration
ALTER TABLE categories MODIFY COLUMN user_id VARCHAR(36) NOT NULL;
ALTER TABLE transactions MODIFY COLUMN user_id VARCHAR(36) NOT NULL;
ALTER TABLE settings MODIFY COLUMN user_id VARCHAR(36) NOT NULL;

-- Step 6: Verify migration
SELECT 
    'Migration Summary' as info,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM categories WHERE user_id = @default_user_id) as migrated_categories,
    (SELECT COUNT(*) FROM transactions WHERE user_id = @default_user_id) as migrated_transactions,
    (SELECT COUNT(*) FROM settings WHERE user_id = @default_user_id) as migrated_settings;

-- Step 7: Display default user info for setup
SELECT 
    'Default User Created' as status,
    id as user_id,
    username,
    email,
    'Password not set - will be prompted on first login' as password_status
FROM users 
WHERE id = @default_user_id;

-- Step 8: Create indexes for better performance with user-specific queries
-- (These were already added in auth-schema.sql, but ensuring they exist)
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);

COMMIT;