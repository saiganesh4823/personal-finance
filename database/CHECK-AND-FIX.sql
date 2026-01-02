-- ================================================================
-- CHECK AND FIX - Verify categories and add if missing
-- ================================================================

-- Check current state
SELECT 'Current database state:' as info;

-- Show users
SELECT 'Users in database:' as info;
SELECT id, email, username, created_at FROM users ORDER BY created_at;

-- Show categories count
SELECT 'Categories count:' as info;
SELECT 
    u.email,
    COUNT(c.id) as category_count
FROM users u
LEFT JOIN categories c ON u.id = c.user_id
GROUP BY u.id, u.email
ORDER BY u.email;

-- If no categories exist, add them for all users
INSERT INTO categories (user_id, name, color, type, is_default) 
SELECT 
    u.id as user_id,
    category_name,
    category_color,
    category_type,
    TRUE as is_default
FROM users u
CROSS JOIN (
    VALUES 
    ('Food & Dining', '#e74c3c', 'expense'),
    ('Bills & Utilities', '#34495e', 'expense'),
    ('Shopping', '#9b59b6', 'expense'),
    ('Transportation', '#f39c12', 'expense'),
    ('Entertainment', '#e67e22', 'expense'),
    ('Healthcare', '#1abc9c', 'expense'),
    ('Education', '#3498db', 'expense'),
    ('Travel', '#2ecc71', 'expense'),
    ('Personal Care', '#f1c40f', 'expense'),
    ('Family', '#ff69b4', 'expense'),
    ('Fuel', '#ff6b35', 'expense'),
    ('Gym & Fitness', '#32cd32', 'expense'),
    ('Loan EMI', '#dc3545', 'expense'),
    ('Credit Card Payment', '#fd7e14', 'expense'),
    ('SIP & Mutual Funds', '#4169e1', 'expense'),
    ('Savings', '#ffd700', 'expense'),
    ('Insurance Premium', '#6f42c1', 'expense'),
    ('Tax Payment', '#20c997', 'expense'),
    ('Fixed Deposit', '#17a2b8', 'expense'),
    ('Stock Investment', '#28a745', 'expense'),
    ('Rent', '#6c757d', 'expense'),
    ('Home Maintenance', '#e83e8c', 'expense'),
    ('Charity & Donation', '#fd7e14', 'expense'),
    ('Other Expenses', '#95a5a6', 'expense'),
    ('Salary', '#27ae60', 'income'),
    ('Freelance', '#16a085', 'income'),
    ('Investment Returns', '#2980b9', 'income'),
    ('Dividend', '#8e44ad', 'income'),
    ('Interest Income', '#d35400', 'income'),
    ('Bonus', '#c0392b', 'income'),
    ('Gift Received', '#85c1e9', 'income'),
    ('Rental Income', '#58d68d', 'income'),
    ('Business Income', '#f4d03f', 'income'),
    ('Other Income', '#aed6f1', 'income')
) AS category_data(category_name, category_color, category_type)
ON CONFLICT (user_id, name, type) DO NOTHING;

-- Final verification
SELECT 'Final results:' as info;
SELECT 
    u.email,
    COUNT(c.id) as total_categories,
    COUNT(CASE WHEN c.type = 'expense' THEN 1 END) as expense_categories,
    COUNT(CASE WHEN c.type = 'income' THEN 1 END) as income_categories
FROM users u
LEFT JOIN categories c ON u.id = c.user_id
GROUP BY u.id, u.email
ORDER BY u.email;

-- Show sample categories
SELECT 'Sample categories:' as info;
SELECT name, color, type FROM categories LIMIT 10;

SELECT '✅ Categories should now be in database!' as result;