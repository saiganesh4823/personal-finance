-- ================================================================
-- ADD CATEGORIES FOR EXISTING USERS
-- Run this AFTER schema.sql in Supabase SQL Editor
-- ================================================================

-- First check users
SELECT id, email FROM users;

-- Clear existing categories
DELETE FROM categories;

-- Add categories for all users
DO '
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM users LOOP
        -- Expense categories
        INSERT INTO categories (user_id, name, color, type, is_default, sort_order) VALUES
        (user_record.id, ''Food & Dining'', ''#e74c3c'', ''expense'', TRUE, 1),
        (user_record.id, ''Bills & Utilities'', ''#34495e'', ''expense'', TRUE, 2),
        (user_record.id, ''Shopping'', ''#9b59b6'', ''expense'', TRUE, 3),
        (user_record.id, ''Transportation'', ''#f39c12'', ''expense'', TRUE, 4),
        (user_record.id, ''Entertainment'', ''#e67e22'', ''expense'', TRUE, 5),
        (user_record.id, ''Healthcare'', ''#1abc9c'', ''expense'', TRUE, 6),
        (user_record.id, ''Education'', ''#3498db'', ''expense'', TRUE, 7),
        (user_record.id, ''Travel'', ''#2ecc71'', ''expense'', TRUE, 8),
        (user_record.id, ''Personal Care'', ''#f1c40f'', ''expense'', TRUE, 9),
        (user_record.id, ''Family'', ''#ff69b4'', ''expense'', TRUE, 10),
        (user_record.id, ''Fuel'', ''#ff6b35'', ''expense'', TRUE, 11),
        (user_record.id, ''Gym & Fitness'', ''#32cd32'', ''expense'', TRUE, 12),
        (user_record.id, ''Loan EMI'', ''#dc3545'', ''expense'', TRUE, 13),
        (user_record.id, ''Credit Card Payment'', ''#fd7e14'', ''expense'', TRUE, 14),
        (user_record.id, ''SIP & Mutual Funds'', ''#4169e1'', ''expense'', TRUE, 15),
        (user_record.id, ''Savings'', ''#ffd700'', ''expense'', TRUE, 16),
        (user_record.id, ''Insurance Premium'', ''#6f42c1'', ''expense'', TRUE, 17),
        (user_record.id, ''Tax Payment'', ''#20c997'', ''expense'', TRUE, 18),
        (user_record.id, ''Fixed Deposit'', ''#17a2b8'', ''expense'', TRUE, 19),
        (user_record.id, ''Stock Investment'', ''#28a745'', ''expense'', TRUE, 20),
        (user_record.id, ''Rent'', ''#6c757d'', ''expense'', TRUE, 21),
        (user_record.id, ''Home Maintenance'', ''#e83e8c'', ''expense'', TRUE, 22),
        (user_record.id, ''Charity & Donation'', ''#fd7e14'', ''expense'', TRUE, 23),
        (user_record.id, ''Other Expenses'', ''#95a5a6'', ''expense'', TRUE, 24);
        
        -- Income categories
        INSERT INTO categories (user_id, name, color, type, is_default, sort_order) VALUES
        (user_record.id, ''Salary'', ''#27ae60'', ''income'', TRUE, 1),
        (user_record.id, ''Freelance'', ''#16a085'', ''income'', TRUE, 2),
        (user_record.id, ''Investment Returns'', ''#2980b9'', ''income'', TRUE, 3),
        (user_record.id, ''Dividend'', ''#8e44ad'', ''income'', TRUE, 4),
        (user_record.id, ''Interest Income'', ''#d35400'', ''income'', TRUE, 5),
        (user_record.id, ''Bonus'', ''#c0392b'', ''income'', TRUE, 6),
        (user_record.id, ''Gift Received'', ''#85c1e9'', ''income'', TRUE, 7),
        (user_record.id, ''Rental Income'', ''#58d68d'', ''income'', TRUE, 8),
        (user_record.id, ''Business Income'', ''#f4d03f'', ''income'', TRUE, 9),
        (user_record.id, ''Other Income'', ''#aed6f1'', ''income'', TRUE, 10);
        
        RAISE NOTICE ''Added 34 categories for user: %'', user_record.id;
    END LOOP;
END;
';

-- Verify
SELECT 'Categories per user:' as info;
SELECT u.email, COUNT(c.id) as category_count 
FROM users u 
LEFT JOIN categories c ON u.id = c.user_id 
GROUP BY u.id, u.email;

SELECT 'DONE! Refresh your app.' as result;