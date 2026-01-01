-- Rollback Script: Remove Authentication System
-- WARNING: This will remove all user accounts and authentication data
-- Use only if you need to revert to single-user system

USE personal_finance_db;

-- Step 1: Backup user data before rollback (optional)
-- CREATE TABLE users_backup AS SELECT * FROM users;
-- CREATE TABLE user_sessions_backup AS SELECT * FROM user_sessions;

-- Step 2: Remove foreign key constraints
ALTER TABLE categories DROP FOREIGN KEY categories_ibfk_2;
ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_2;
ALTER TABLE settings DROP FOREIGN KEY settings_ibfk_2;

-- Step 3: Remove user_id columns from existing tables
ALTER TABLE categories DROP COLUMN user_id;
ALTER TABLE transactions DROP COLUMN user_id;
ALTER TABLE settings DROP COLUMN user_id;

-- Step 4: Remove user-specific indexes
ALTER TABLE categories DROP INDEX IF EXISTS idx_user_id;
ALTER TABLE categories DROP INDEX IF EXISTS idx_user_type;
ALTER TABLE categories DROP INDEX IF EXISTS idx_user_default;

ALTER TABLE transactions DROP INDEX IF EXISTS idx_user_id;
ALTER TABLE transactions DROP INDEX IF EXISTS idx_user_type;
ALTER TABLE transactions DROP INDEX IF EXISTS idx_user_date;
ALTER TABLE transactions DROP INDEX IF EXISTS idx_user_category;

ALTER TABLE settings DROP INDEX IF EXISTS idx_user_id;

-- Step 5: Drop authentication tables
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;

-- Step 6: Verify rollback
SELECT 
    'Rollback Complete' as status,
    'Authentication system removed' as message;

-- Show remaining tables
SHOW TABLES;

COMMIT;