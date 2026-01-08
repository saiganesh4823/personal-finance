-- ================================================================
-- COMPLETE DATA BACKUP: Export ALL Your Data Before Migration
-- Run each section ONE AT A TIME and save the results
-- ================================================================

-- STEP 1: Export all transactions with amounts
SELECT 
    id,
    user_id,
    type,
    amount,
    date,
    note,
    category_id,
    payment_method,
    is_recurring,
    recurring_transaction_id,
    created_at,
    updated_at
FROM transactions
ORDER BY date DESC;

-- STEP 2: Export all categories
SELECT 
    id,
    user_id,
    name,
    color,
    type,
    icon,
    is_default,
    is_active,
    sort_order,
    created_at,
    updated_at
FROM categories
ORDER BY type, sort_order;

-- STEP 3: Export all recurring transactions
SELECT 
    id,
    user_id,
    name,
    type,
    amount,
    category_id,
    frequency,
    start_date,
    end_date,
    day_of_month,
    day_of_week,
    is_active,
    note,
    last_processed_date,
    next_due_date,
    total_occurrences,
    created_at,
    updated_at
FROM recurring_transactions
ORDER BY created_at;

-- STEP 4: Export all investment portfolio
SELECT 
    id,
    user_id,
    investment_type,
    investment_name,
    symbol,
    category,
    total_invested,
    current_value,
    units_quantity,
    average_price,
    current_price,
    last_updated_date,
    notes,
    broker,
    is_active,
    created_at,
    updated_at
FROM investment_portfolio
ORDER BY investment_type, investment_name;

-- STEP 5: Export all investment transactions
SELECT 
    id,
    user_id,
    portfolio_id,
    transaction_type,
    amount,
    units,
    price_per_unit,
    fees,
    taxes,
    transaction_date,
    notes,
    created_at
FROM investment_transactions
ORDER BY transaction_date DESC;

-- STEP 6: Export users (without sensitive data)
SELECT 
    id,
    username,
    email,
    first_name,
    last_name,
    database_name,
    email_notifications,
    currency,
    is_active,
    last_login_at,
    created_at,
    updated_at
FROM users
ORDER BY created_at;