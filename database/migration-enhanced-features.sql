-- ================================================================
-- ENHANCED MIGRATION: Add Currency Support + Monthly Balance Tracking
-- This adds partial debit + currency selection + monthly balance system
-- ================================================================

-- 1. Add debit_amount column to recurring_transactions table
ALTER TABLE recurring_transactions 
ADD COLUMN IF NOT EXISTS debit_amount DECIMAL(15, 2);

-- 2. Update users table for currency selection
ALTER TABLE users 
ALTER COLUMN currency SET DEFAULT 'INR';

-- Add more currency options (currency column already exists)
-- Valid currencies: INR, USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, etc.

-- 3. Create monthly_balances table for balance tracking
CREATE TABLE IF NOT EXISTS monthly_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    opening_balance DECIMAL(15, 2) DEFAULT 0.00, -- Balance from previous month
    monthly_income DECIMAL(15, 2) DEFAULT 0.00,  -- Income for this month
    monthly_expenses DECIMAL(15, 2) DEFAULT 0.00, -- Expenses for this month
    closing_balance DECIMAL(15, 2) DEFAULT 0.00,  -- Final balance (opening + income - expenses)
    old_balance_used DECIMAL(15, 2) DEFAULT 0.00, -- Amount used from old balance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, year, month)
);

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_next_due 
ON recurring_transactions(next_due_date) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_monthly_balances_user_date 
ON monthly_balances(user_id, year, month);

-- 5. Add balance tracking columns to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS balance_source VARCHAR(20) DEFAULT 'current', -- 'current' or 'old_balance'
ADD COLUMN IF NOT EXISTS old_balance_amount DECIMAL(15, 2) DEFAULT 0.00; -- Amount taken from old balance

-- 6. Create function to get/create monthly balance record
CREATE OR REPLACE FUNCTION get_or_create_monthly_balance(
    p_user_id UUID,
    p_year INTEGER,
    p_month INTEGER
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    balance_id UUID;
    prev_month_balance DECIMAL(15, 2) := 0.00;
    prev_year INTEGER;
    prev_month INTEGER;
BEGIN
    -- Try to get existing record
    SELECT id INTO balance_id 
    FROM monthly_balances 
    WHERE user_id = p_user_id AND year = p_year AND month = p_month;
    
    IF balance_id IS NOT NULL THEN
        RETURN balance_id;
    END IF;
    
    -- Calculate previous month
    IF p_month = 1 THEN
        prev_year := p_year - 1;
        prev_month := 12;
    ELSE
        prev_year := p_year;
        prev_month := p_month - 1;
    END IF;
    
    -- Get previous month's closing balance
    SELECT COALESCE(closing_balance, 0.00) INTO prev_month_balance
    FROM monthly_balances 
    WHERE user_id = p_user_id AND year = prev_year AND month = prev_month;
    
    -- Create new record
    INSERT INTO monthly_balances (
        user_id, year, month, opening_balance, 
        monthly_income, monthly_expenses, closing_balance
    ) VALUES (
        p_user_id, p_year, p_month, prev_month_balance,
        0.00, 0.00, prev_month_balance
    ) RETURNING id INTO balance_id;
    
    RETURN balance_id;
END;
$$;

-- 7. Create function to update monthly balance when transaction is added
CREATE OR REPLACE FUNCTION update_monthly_balance_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    balance_id UUID;
    current_balance DECIMAL(15, 2);
    old_balance_available DECIMAL(15, 2);
    amount_from_old DECIMAL(15, 2) := 0.00;
    trans_year INTEGER;
    trans_month INTEGER;
BEGIN
    -- Extract year and month from transaction date
    trans_year := EXTRACT(YEAR FROM NEW.date);
    trans_month := EXTRACT(MONTH FROM NEW.date);
    
    -- Get or create monthly balance record
    balance_id := get_or_create_monthly_balance(NEW.user_id, trans_year, trans_month);
    
    -- Get current monthly balance info
    SELECT opening_balance + monthly_income - monthly_expenses, opening_balance
    INTO current_balance, old_balance_available
    FROM monthly_balances 
    WHERE id = balance_id;
    
    IF NEW.type = 'income' THEN
        -- Add to monthly income
        UPDATE monthly_balances 
        SET 
            monthly_income = monthly_income + NEW.amount,
            closing_balance = opening_balance + monthly_income + NEW.amount - monthly_expenses,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = balance_id;
        
        -- Set balance source as current
        NEW.balance_source := 'current';
        NEW.old_balance_amount := 0.00;
        
    ELSE -- expense
        -- Check if we need to use old balance
        IF (current_balance - old_balance_available) >= NEW.amount THEN
            -- Sufficient current month balance
            NEW.balance_source := 'current';
            NEW.old_balance_amount := 0.00;
        ELSE
            -- Need to use old balance
            amount_from_old := NEW.amount - (current_balance - old_balance_available);
            NEW.balance_source := 'old_balance';
            NEW.old_balance_amount := amount_from_old;
            
            -- Update old balance used
            UPDATE monthly_balances 
            SET old_balance_used = old_balance_used + amount_from_old
            WHERE id = balance_id;
        END IF;
        
        -- Add to monthly expenses
        UPDATE monthly_balances 
        SET 
            monthly_expenses = monthly_expenses + NEW.amount,
            closing_balance = opening_balance + monthly_income - monthly_expenses,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = balance_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 8. Create trigger for automatic balance tracking
DROP TRIGGER IF EXISTS update_balance_on_transaction ON transactions;
CREATE TRIGGER update_balance_on_transaction
    BEFORE INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_monthly_balance_on_transaction();

-- 9. Create function to calculate next due date
CREATE OR REPLACE FUNCTION calculate_next_due_date(
    p_frequency VARCHAR(20),
    p_current_date DATE,
    p_day_of_month INTEGER DEFAULT NULL,
    p_day_of_week INTEGER DEFAULT NULL
) RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
    next_date DATE;
BEGIN
    CASE p_frequency
        WHEN 'daily' THEN
            next_date := p_current_date + INTERVAL '1 day';
            
        WHEN 'weekly' THEN
            next_date := p_current_date + INTERVAL '1 week';
            
        WHEN 'monthly' THEN
            IF p_day_of_month IS NOT NULL THEN
                -- Set to specific day of next month
                next_date := (DATE_TRUNC('month', p_current_date) + INTERVAL '1 month' + (p_day_of_month - 1) * INTERVAL '1 day')::DATE;
                -- Handle month-end cases (e.g., Jan 31 -> Feb 28)
                IF EXTRACT(DAY FROM next_date) != p_day_of_month THEN
                    next_date := (DATE_TRUNC('month', next_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
                END IF;
            ELSE
                next_date := p_current_date + INTERVAL '1 month';
            END IF;
            
        WHEN 'yearly' THEN
            next_date := p_current_date + INTERVAL '1 year';
            
        ELSE
            next_date := p_current_date + INTERVAL '1 month'; -- Default to monthly
    END CASE;
    
    RETURN next_date;
END;
$$;

-- 10. Create function to process recurring transactions
CREATE OR REPLACE FUNCTION process_recurring_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    recurring_rec RECORD;
    transaction_count INTEGER := 0;
    actual_debit_amount DECIMAL(15, 2);
BEGIN
    -- Process all active recurring transactions that are due
    FOR recurring_rec IN 
        SELECT * FROM recurring_transactions 
        WHERE is_active = TRUE 
        AND (next_due_date IS NULL OR next_due_date <= CURRENT_DATE)
        AND (end_date IS NULL OR CURRENT_DATE <= end_date)
    LOOP
        -- Determine the amount to actually debit
        actual_debit_amount := COALESCE(recurring_rec.debit_amount, recurring_rec.amount);
        
        -- Create the transaction with the debit amount (not the full amount)
        INSERT INTO transactions (
            user_id,
            type,
            amount,
            date,
            note,
            category_id,
            is_recurring,
            recurring_transaction_id
        ) VALUES (
            recurring_rec.user_id,
            recurring_rec.type,
            actual_debit_amount, -- Use debit_amount if specified, otherwise full amount
            CURRENT_DATE,
            COALESCE(recurring_rec.note, '') || 
            CASE 
                WHEN recurring_rec.debit_amount IS NOT NULL AND recurring_rec.debit_amount != recurring_rec.amount 
                THEN ' (Partial: ' || actual_debit_amount || ' of ' || recurring_rec.amount || ')'
                ELSE ''
            END,
            recurring_rec.category_id,
            TRUE,
            recurring_rec.id
        );
        
        -- Update the recurring transaction
        UPDATE recurring_transactions 
        SET 
            last_processed_date = CURRENT_DATE,
            next_due_date = calculate_next_due_date(
                frequency, 
                CURRENT_DATE, 
                day_of_month, 
                day_of_week
            ),
            total_occurrences = total_occurrences + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = recurring_rec.id;
        
        transaction_count := transaction_count + 1;
    END LOOP;
    
    RETURN transaction_count;
END;
$$;

-- 11. Create trigger function to set initial next_due_date
CREATE OR REPLACE FUNCTION set_initial_next_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.next_due_date IS NULL THEN
        NEW.next_due_date := calculate_next_due_date(
            NEW.frequency,
            COALESCE(NEW.start_date, CURRENT_DATE),
            NEW.day_of_month,
            NEW.day_of_week
        );
    END IF;
    RETURN NEW;
END;
$$;

-- 12. Create triggers
DROP TRIGGER IF EXISTS set_recurring_next_due_date ON recurring_transactions;
CREATE TRIGGER set_recurring_next_due_date 
    BEFORE INSERT ON recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION set_initial_next_due_date();

DROP TRIGGER IF EXISTS update_monthly_balances_updated_at ON monthly_balances;
CREATE TRIGGER update_monthly_balances_updated_at 
    BEFORE UPDATE ON monthly_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. Update existing recurring transactions to set next_due_date if null
UPDATE recurring_transactions 
SET next_due_date = calculate_next_due_date(
    frequency,
    COALESCE(start_date, CURRENT_DATE),
    day_of_month,
    day_of_week
)
WHERE next_due_date IS NULL AND is_active = TRUE;

-- 14. Initialize monthly balances for existing users (current month)
INSERT INTO monthly_balances (user_id, year, month, opening_balance, monthly_income, monthly_expenses, closing_balance)
SELECT 
    u.id,
    EXTRACT(YEAR FROM CURRENT_DATE),
    EXTRACT(MONTH FROM CURRENT_DATE),
    0.00, -- Starting with 0 opening balance
    COALESCE(income.total, 0.00),
    COALESCE(expenses.total, 0.00),
    COALESCE(income.total, 0.00) - COALESCE(expenses.total, 0.00)
FROM users u
LEFT JOIN (
    SELECT user_id, SUM(amount) as total 
    FROM transactions 
    WHERE type = 'income' 
    AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
    GROUP BY user_id
) income ON u.id = income.user_id
LEFT JOIN (
    SELECT user_id, SUM(amount) as total 
    FROM transactions 
    WHERE type = 'expense' 
    AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
    GROUP BY user_id
) expenses ON u.id = expenses.user_id
ON CONFLICT (user_id, year, month) DO NOTHING;

-- ================================================================
-- ENHANCED MIGRATION COMPLETE
-- ================================================================
SELECT 'ENHANCED MIGRATION COMPLETE!' as status;
SELECT 'Added: Partial debit + Multi-currency + Monthly balance tracking' as features;
SELECT 'Your existing data is safe!' as data_status;