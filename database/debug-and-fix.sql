-- ================================================================
-- DEBUG AND FIX CATEGORIES
-- Run each section separately in Supabase SQL Editor
-- ================================================================

-- STEP 1: Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'categories', 'transactions');

-- STEP 2: Check users
SELECT id, email, username FROM users;

-- STEP 3: Check categories count
SELECT COUNT(*) as category_count FROM categories;

-- STEP 4: If you have users but no categories, run this:
-- (Copy your user ID from STEP 2 and replace below)

-- REPLACE 'YOUR-USER-ID-HERE' with your actual user ID from STEP 2
-- Example: '2f41850d-7113-4f28-9d7f-3e1a46eebe5f'

/*
INSERT INTO categories (user_id, name, color, type, is_default, sort_order) VALUES
('YOUR-USER-ID-HERE', 'Food & Dining', '#e74c3c', 'expense', TRUE, 1),
('YOUR-USER-ID-HERE', 'Bills & Utilities', '#34495e', 'expense', TRUE, 2),
('YOUR-USER-ID-HERE', 'Shopping', '#9b59b6', 'expense', TRUE, 3),
('YOUR-USER-ID-HERE', 'Transportation', '#f39c12', 'expense', TRUE, 4),
('YOUR-USER-ID-HERE', 'Entertainment', '#e67e22', 'expense', TRUE, 5),
('YOUR-USER-ID-HERE', 'Healthcare', '#1abc9c', 'expense', TRUE, 6),
('YOUR-USER-ID-HERE', 'Education', '#3498db', 'expense', TRUE, 7),
('YOUR-USER-ID-HERE', 'Travel', '#2ecc71', 'expense', TRUE, 8),
('YOUR-USER-ID-HERE', 'Personal Care', '#f1c40f', 'expense', TRUE, 9),
('YOUR-USER-ID-HERE', 'Family', '#ff69b4', 'expense', TRUE, 10),
('YOUR-USER-ID-HERE', 'Fuel', '#ff6b35', 'expense', TRUE, 11),
('YOUR-USER-ID-HERE', 'Gym & Fitness', '#32cd32', 'expense', TRUE, 12),
('YOUR-USER-ID-HERE', 'Loan EMI', '#dc3545', 'expense', TRUE, 13),
('YOUR-USER-ID-HERE', 'Credit Card Payment', '#fd7e14', 'expense', TRUE, 14),
('YOUR-USER-ID-HERE', 'SIP & Mutual Funds', '#4169e1', 'expense', TRUE, 15),
('YOUR-USER-ID-HERE', 'Savings', '#ffd700', 'expense', TRUE, 16),
('YOUR-USER-ID-HERE', 'Insurance Premium', '#6f42c1', 'expense', TRUE, 17),
('YOUR-USER-ID-HERE', 'Tax Payment', '#20c997', 'expense', TRUE, 18),
('YOUR-USER-ID-HERE', 'Fixed Deposit', '#17a2b8', 'expense', TRUE, 19),
('YOUR-USER-ID-HERE', 'Stock Investment', '#28a745', 'expense', TRUE, 20),
('YOUR-USER-ID-HERE', 'Rent', '#6c757d', 'expense', TRUE, 21),
('YOUR-USER-ID-HERE', 'Home Maintenance', '#e83e8c', 'expense', TRUE, 22),
('YOUR-USER-ID-HERE', 'Charity & Donation', '#fd7e14', 'expense', TRUE, 23),
('YOUR-USER-ID-HERE', 'Other Expenses', '#95a5a6', 'expense', TRUE, 24),
('YOUR-USER-ID-HERE', 'Salary', '#27ae60', 'income', TRUE, 1),
('YOUR-USER-ID-HERE', 'Freelance', '#16a085', 'income', TRUE, 2),
('YOUR-USER-ID-HERE', 'Investment Returns', '#2980b9', 'income', TRUE, 3),
('YOUR-USER-ID-HERE', 'Dividend', '#8e44ad', 'income', TRUE, 4),
('YOUR-USER-ID-HERE', 'Interest Income', '#d35400', 'income', TRUE, 5),
('YOUR-USER-ID-HERE', 'Bonus', '#c0392b', 'income', TRUE, 6),
('YOUR-USER-ID-HERE', 'Gift Received', '#85c1e9', 'income', TRUE, 7),
('YOUR-USER-ID-HERE', 'Rental Income', '#58d68d', 'income', TRUE, 8),
('YOUR-USER-ID-HERE', 'Business Income', '#f4d03f', 'income', TRUE, 9),
('YOUR-USER-ID-HERE', 'Other Income', '#aed6f1', 'income', TRUE, 10);
*/

-- STEP 5: Verify categories were added
SELECT COUNT(*) as total_categories FROM categories;
SELECT name, type, color FROM categories ORDER BY type, sort_order LIMIT 10;