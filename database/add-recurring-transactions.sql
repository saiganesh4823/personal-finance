-- Add Recurring Transactions Feature
-- Run this script to add recurring transaction functionality

-- 1. Create recurring_transactions table
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE,
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
    is_active BOOLEAN DEFAULT TRUE,
    note TEXT,
    last_processed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_id ON recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_active ON recurring_transactions(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_frequency ON recurring_transactions(frequency);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_start_date ON recurring_transactions(start_date);

-- 3. Add update timestamp trigger
CREATE TRIGGER update_recurring_transactions_updated_at 
    BEFORE UPDATE ON recurring_transactions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Function to process recurring transactions
CREATE OR REPLACE FUNCTION process_recurring_transactions()
RETURNS INTEGER AS $$
DECLARE
    recurring_record RECORD;
    next_date DATE;
    transactions_created INTEGER := 0;
    current_date_val DATE := CURRENT_DATE;
BEGIN
    -- Loop through all active recurring transactions
    FOR recurring_record IN 
        SELECT * FROM recurring_transactions 
        WHERE is_active = TRUE 
        AND start_date <= current_date_val
        AND (end_date IS NULL OR end_date >= current_date_val)
    LOOP
        -- Calculate next transaction date based on frequency
        CASE recurring_record.frequency
            WHEN 'daily' THEN
                next_date := COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 day') + INTERVAL '1 day';
            WHEN 'weekly' THEN
                next_date := COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 week') + INTERVAL '1 week';
            WHEN 'monthly' THEN
                IF recurring_record.day_of_month IS NOT NULL THEN
                    -- Use specific day of month
                    next_date := DATE_TRUNC('month', COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 month') + INTERVAL '1 month') + (recurring_record.day_of_month - 1) * INTERVAL '1 day';
                ELSE
                    -- Use same day as start date
                    next_date := COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 month') + INTERVAL '1 month';
                END IF;
            WHEN 'yearly' THEN
                next_date := COALESCE(recurring_record.last_processed_date, recurring_record.start_date - INTERVAL '1 year') + INTERVAL '1 year';
        END CASE;
        
        -- Create transactions for all due dates up to today
        WHILE next_date <= current_date_val AND (recurring_record.end_date IS NULL OR next_date <= recurring_record.end_date) LOOP
            -- Insert the recurring transaction
            INSERT INTO transactions (
                user_id,
                type,
                amount,
                date,
                note,
                category_id
            ) VALUES (
                recurring_record.user_id,
                recurring_record.type,
                recurring_record.amount,
                next_date,
                COALESCE(recurring_record.note, '') || ' (Auto: ' || recurring_record.name || ')',
                recurring_record.category_id
            );
            
            transactions_created := transactions_created + 1;
            
            -- Update last processed date
            UPDATE recurring_transactions 
            SET last_processed_date = next_date 
            WHERE id = recurring_record.id;
            
            -- Calculate next date
            CASE recurring_record.frequency
                WHEN 'daily' THEN
                    next_date := next_date + INTERVAL '1 day';
                WHEN 'weekly' THEN
                    next_date := next_date + INTERVAL '1 week';
                WHEN 'monthly' THEN
                    IF recurring_record.day_of_month IS NOT NULL THEN
                        next_date := DATE_TRUNC('month', next_date + INTERVAL '1 month') + (recurring_record.day_of_month - 1) * INTERVAL '1 day';
                    ELSE
                        next_date := next_date + INTERVAL '1 month';
                    END IF;
                WHEN 'yearly' THEN
                    next_date := next_date + INTERVAL '1 year';
            END CASE;
        END LOOP;
    END LOOP;
    
    RETURN transactions_created;
END;
$$ LANGUAGE plpgsql;

-- 5. Success message
DO $$
BEGIN
    RAISE NOTICE 'Recurring transactions feature added successfully!';
    RAISE NOTICE 'You can now create recurring transactions for SIP, EMI, rent, etc.';
    RAISE NOTICE 'Use the process_recurring_transactions() function to generate due transactions.';
END $$;