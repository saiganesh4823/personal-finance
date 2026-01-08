-- ================================================================
-- SAFE MIGRATION: Add Partial Debit Support to Existing Database
-- This script only ADDS new features without dropping existing data
-- ================================================================

-- 1. Add debit_amount column to recurring_transactions table
ALTER TABLE recurring_transactions 
ADD COLUMN IF NOT EXISTS debit_amount DECIMAL(15, 2);

-- 2. Add index for better performance on next_due_date queries
CREATE INDEX IF NOT EXISTS idx_recurring_next_due 
ON recurring_transactions(next_due_date) 
WHERE is_active = TRUE;

-- 3. Create function to calculate next due date
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

-- 4. Create function to process recurring transactions
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
                THEN ' (Partial: ₹' || recurring_rec.debit_amount || ' of ₹' || recurring_rec.amount || ')'
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

-- 5. Create trigger function to set initial next_due_date
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

-- 6. Create trigger for new recurring transactions (only if it doesn't exist)
DROP TRIGGER IF EXISTS set_recurring_next_due_date ON recurring_transactions;
CREATE TRIGGER set_recurring_next_due_date 
    BEFORE INSERT ON recurring_transactions
    FOR EACH ROW EXECUTE FUNCTION set_initial_next_due_date();

-- 7. Update existing recurring transactions to set next_due_date if null
UPDATE recurring_transactions 
SET next_due_date = calculate_next_due_date(
    frequency,
    COALESCE(start_date, CURRENT_DATE),
    day_of_month,
    day_of_week
)
WHERE next_due_date IS NULL AND is_active = TRUE;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
SELECT 'MIGRATION COMPLETE!' as status;
SELECT 'Added partial debit support and recurring processing functions' as info;
SELECT 'Your existing data is safe!' as data_status;