-- ================================================================
-- MANUAL CATEGORY ADDITION - Bypass API Issues
-- This script manually adds categories for existing users
-- ================================================================

-- First, let's see what users exist
SELECT 'Current users in database:' as info;
SELECT id, email, username, created_at FROM users ORDER BY created_at;

-- Check current categories
SELECT 'Current categories count:' as info;
SELECT COUNT(*) as total_categories FROM categories;

-- Add categories for ALL existing users
DO $$
DECLARE
    user_record RECORD;
    category_count INTEGER;
BEGIN
    -- Loop through all users
    FOR user_record IN SELECT id, email, username FROM users LOOP
        -- Check if user already has categories
        SELECT COUNT(*) INTO category_count FROM categories WHERE user_id = user_record.id;
        
        RAISE NOTICE 'User: % (%) has % categories', 
            COALESCE(user_record.email, 'no-email'), 
            COALESCE(user_record.username, 'no-username'), 
            category_count;
        
        -- If user has fewer than 30 categories, add all default ones
        IF category_count < 30 THEN
            -- Delete existing categories first to avoid duplicates
            DELETE FROM categories WHERE user_id = user_record.id;
            
            -- Add all 32 default categories
            INSERT INTO categories (user_id, name, color, type, is_default) VALUES
            -- 24 Default expense categories
            (user_record.id, 'Food & Dining', '#e74c3c', 'expense', TRUE),
            (user_record.id, 'Bills & Utilities', '#34495e', 'expense', TRUE),
            (user_record.id, 'Shopping', '#9b59b6', 'expense', TRUE),
            (user_record.id, 'Transportation', '#f39c12', 'expense', TRUE),
            (user_record.id, 'Entertainment', '#e67e22', 'expense', TRUE),
            (user_record.id, 'Healthcare', '#1abc9c', 'expense', TRUE),
            (user_record.id, 'Education', '#3498db', 'expense', TRUE),
            (user_record.id, 'Travel', '#2ecc71', 'expense', TRUE),
            (user_record.id, 'Personal Care', '#f1c40f', 'expense', TRUE),
            (user_record.id, 'Family', '#ff69b4', 'expense', TRUE),
            (user_record.id, 'Fuel', '#ff6b35', 'expense', TRUE),
            (user_record.id, 'Gym & Fitness', '#32cd32', 'expense', TRUE),
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
            (user_record.id, 'Charity & Donation', '#fd7e14', 'expense', TRUE),
            (user_record.id, 'Other Expenses', '#95a5a6', 'expense', TRUE),
            
            -- 10 Default income categories
            (user_record.id, 'Salary', '#27ae60', 'income', TRUE),
            (user_record.id, 'Freelance', '#16a085', 'income', TRUE),
            (user_record.id, 'Investment Returns', '#2980b9', 'income', TRUE),
            (user_record.id, 'Dividend', '#8e44ad', 'income', TRUE),
            (user_record.id, 'Interest Income', '#d35400', 'income', TRUE),
            (user_record.id, 'Bonus', '#c0392b', 'income', TRUE),
            (user_record.id, 'Gift Received', '#85c1e9', 'income', TRUE),
            (user_record.id, 'Rental Income', '#58d68d', 'income', TRUE),
            (user_record.id, 'Business Income', '#f4d03f', 'income', TRUE),
            (user_record.id, 'Other Income', '#aed6f1', 'income', TRUE);
            
            RAISE NOTICE '✅ Added 32 categories for user: %', COALESCE(user_record.email, user_record.username);
        ELSE
            RAISE NOTICE '✅ User already has sufficient categories, skipping';
        END IF;
    END LOOP;
END $$;

-- Final verification
SELECT 'Final results:' as info;
SELECT 
    u.email,
    u.username,
    COUNT(c.id) as total_categories,
    COUNT(CASE WHEN c.type = 'expense' THEN 1 END) as expense_categories,
    COUNT(CASE WHEN c.type = 'income' THEN 1 END) as income_categories
FROM users u
LEFT JOIN categories c ON u.id = c.user_id
GROUP BY u.id, u.email, u.username
ORDER BY u.email;

-- Show total counts
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM categories) as total_categories,
    (SELECT COUNT(*) FROM transactions) as total_transactions;

-- Success message
SELECT '🎉 Categories have been manually added! Refresh your app to see them.' as success_message;