-- Incremental Update for Email Reports and New Categories
-- Run this script to add email notifications and new financial categories

-- 1. Add email_notifications column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'email_notifications') THEN
        ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 2. Update the default categories function with new categories
CREATE OR REPLACE FUNCTION create_default_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Check if user already has categories to avoid duplicates
    IF EXISTS (SELECT 1 FROM categories WHERE user_id = p_user_id) THEN
        RETURN;
    END IF;
    
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
    
    -- Financial categories (NEW)
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

-- 3. Add new categories to existing users who don't have them
DO $$
DECLARE
    user_record RECORD;
    category_exists BOOLEAN;
BEGIN
    -- Loop through all existing users
    FOR user_record IN SELECT id FROM users LOOP
        -- Check if user has the new financial categories
        SELECT EXISTS (
            SELECT 1 FROM categories 
            WHERE user_id = user_record.id 
            AND name IN ('Loan EMI', 'SIP & Mutual Funds', 'Savings', 'Insurance Premium')
        ) INTO category_exists;
        
        -- If user doesn't have new categories, add them
        IF NOT category_exists THEN
            -- Add new financial expense categories
            INSERT INTO categories (user_id, name, color, type, is_default) VALUES
            (user_record.id, 'Loan EMI', '#dc3545', 'expense', TRUE),
            (user_record.id, 'Credit Card Payment', '#fd7e14', 'expense', TRUE),
            (user_record.id, 'SIP & Mutual Funds', '#4169e1', 'expense', TRUE),
            (user_record.id, 'Savings', '#ffd700', 'expense', TRUE),
            (user_record.id, 'Insurance Premium', '#6f42c1', 'expense', TRUE),
            (user_record.id, 'Tax Payment', '#20c997', 'expense', TRUE),
            (user_record.id, 'Fixed Deposit', '#17a2b8', 'expense', TRUE),
            (user_record.id, 'Stock Investment', '#28a745', 'expense', TRUE),
            (user_record.id, 'Rent', '#6c757d', 'expense', TRUE),
            (user_record.id, 'Home Maintenance', '#e83e8c', 'expense', TRUE),
            (user_record.id, 'Charity & Donation', '#fd7e14', 'expense', TRUE)
            ON CONFLICT (user_id, name, type) DO NOTHING;
            
            -- Add new income categories
            INSERT INTO categories (user_id, name, color, type, is_default) VALUES
            (user_record.id, 'Investment Returns', '#2980b9', 'income', TRUE),
            (user_record.id, 'Dividend', '#8e44ad', 'income', TRUE),
            (user_record.id, 'Interest Income', '#d35400', 'income', TRUE),
            (user_record.id, 'Bonus', '#c0392b', 'income', TRUE),
            (user_record.id, 'Gift Received', '#85c1e9', 'income', TRUE),
            (user_record.id, 'Rental Income', '#58d68d', 'income', TRUE),
            (user_record.id, 'Business Income', '#f4d03f', 'income', TRUE)
            ON CONFLICT (user_id, name, type) DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- 4. Enable email notifications for all existing users (if column was just added)
UPDATE users SET email_notifications = TRUE WHERE email_notifications IS NULL;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database update completed successfully!';
    RAISE NOTICE 'Added email_notifications column and new financial categories.';
    RAISE NOTICE 'All existing users now have email notifications enabled and new categories available.';
END $$;