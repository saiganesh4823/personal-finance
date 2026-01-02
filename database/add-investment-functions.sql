-- ================================================================
-- ADD INVESTMENT FUNCTIONS
-- Run this in Supabase SQL Editor after schema.sql
-- ================================================================

-- Function to add investment transaction and update portfolio
CREATE OR REPLACE FUNCTION add_investment_transaction(
    p_user_id UUID,
    p_investment_type VARCHAR,
    p_investment_name VARCHAR,
    p_transaction_type VARCHAR,
    p_amount DECIMAL,
    p_category VARCHAR DEFAULT NULL,
    p_units DECIMAL DEFAULT 0,
    p_price_per_unit DECIMAL DEFAULT 0,
    p_transaction_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS '
DECLARE
    v_portfolio_id UUID;
    v_transaction_id UUID;
    v_new_total_invested DECIMAL;
    v_new_units DECIMAL;
    v_new_avg_price DECIMAL;
BEGIN
    -- Find or create portfolio entry
    SELECT id INTO v_portfolio_id
    FROM investment_portfolio
    WHERE user_id = p_user_id 
    AND investment_name = p_investment_name 
    AND investment_type = p_investment_type;
    
    IF v_portfolio_id IS NULL THEN
        INSERT INTO investment_portfolio (user_id, investment_type, investment_name, category, total_invested, units_quantity, average_price, is_active)
        VALUES (p_user_id, p_investment_type, p_investment_name, p_category, 0, 0, 0, TRUE)
        RETURNING id INTO v_portfolio_id;
    END IF;
    
    -- Create investment transaction
    INSERT INTO investment_transactions (user_id, portfolio_id, transaction_type, amount, units, price_per_unit, transaction_date, notes)
    VALUES (p_user_id, v_portfolio_id, p_transaction_type, p_amount, p_units, p_price_per_unit, p_transaction_date, p_notes)
    RETURNING id INTO v_transaction_id;
    
    -- Update portfolio based on transaction type
    IF p_transaction_type = ''buy'' THEN
        SELECT total_invested + p_amount, units_quantity + p_units
        INTO v_new_total_invested, v_new_units
        FROM investment_portfolio WHERE id = v_portfolio_id;
        
        IF v_new_units > 0 THEN
            v_new_avg_price := v_new_total_invested / v_new_units;
        ELSE
            v_new_avg_price := 0;
        END IF;
        
        UPDATE investment_portfolio
        SET total_invested = v_new_total_invested, 
            units_quantity = v_new_units, 
            average_price = v_new_avg_price,
            last_updated_date = p_transaction_date, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_portfolio_id;
        
    ELSIF p_transaction_type = ''sell'' THEN
        SELECT GREATEST(0, total_invested - (p_units * average_price)), 
               GREATEST(0, units_quantity - p_units)
        INTO v_new_total_invested, v_new_units
        FROM investment_portfolio WHERE id = v_portfolio_id;
        
        UPDATE investment_portfolio
        SET total_invested = v_new_total_invested, 
            units_quantity = v_new_units,
            last_updated_date = p_transaction_date, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_portfolio_id;
    END IF;
    
    RETURN v_transaction_id;
END;
';

-- Function to get investment summary
CREATE OR REPLACE FUNCTION get_investment_summary(p_user_id UUID)
RETURNS TABLE (
    investment_type VARCHAR,
    total_invested DECIMAL,
    current_value DECIMAL,
    total_gain_loss DECIMAL,
    percentage_return DECIMAL,
    investment_count BIGINT
)
LANGUAGE plpgsql
AS '
BEGIN
    RETURN QUERY
    SELECT 
        ip.investment_type,
        COALESCE(SUM(ip.total_invested), 0::DECIMAL) as total_invested,
        COALESCE(SUM(ip.current_value), 0::DECIMAL) as current_value,
        COALESCE(SUM(ip.current_value - ip.total_invested), 0::DECIMAL) as total_gain_loss,
        CASE 
            WHEN SUM(ip.total_invested) > 0 THEN 
                ROUND(((SUM(ip.current_value) - SUM(ip.total_invested)) / SUM(ip.total_invested) * 100)::DECIMAL, 2)
            ELSE 0::DECIMAL
        END as percentage_return,
        COUNT(*) as investment_count
    FROM investment_portfolio ip
    WHERE ip.user_id = p_user_id AND ip.is_active = TRUE
    GROUP BY ip.investment_type
    ORDER BY SUM(ip.total_invested) DESC;
END;
';

-- Function to process recurring transactions
CREATE OR REPLACE FUNCTION process_recurring_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
AS '
DECLARE
    rec RECORD;
    next_date DATE;
    transactions_created INTEGER := 0;
BEGIN
    FOR rec IN 
        SELECT * FROM recurring_transactions 
        WHERE is_active = TRUE 
        AND (next_due_date IS NULL OR next_due_date <= CURRENT_DATE)
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    LOOP
        CASE rec.frequency
            WHEN ''daily'' THEN
                next_date := COALESCE(rec.next_due_date, rec.start_date) + INTERVAL ''1 day'';
            WHEN ''weekly'' THEN
                next_date := COALESCE(rec.next_due_date, rec.start_date) + INTERVAL ''1 week'';
            WHEN ''monthly'' THEN
                next_date := COALESCE(rec.next_due_date, rec.start_date) + INTERVAL ''1 month'';
            WHEN ''yearly'' THEN
                next_date := COALESCE(rec.next_due_date, rec.start_date) + INTERVAL ''1 year'';
        END CASE;
        
        INSERT INTO transactions (user_id, type, amount, date, note, category_id, is_recurring, recurring_transaction_id)
        VALUES (rec.user_id, rec.type, rec.amount, COALESCE(rec.next_due_date, rec.start_date), 
                COALESCE(rec.note, ''Recurring: '' || rec.name), rec.category_id, TRUE, rec.id);
        
        UPDATE recurring_transactions 
        SET last_processed_date = COALESCE(rec.next_due_date, rec.start_date),
            next_due_date = next_date,
            total_occurrences = total_occurrences + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = rec.id;
        
        transactions_created := transactions_created + 1;
    END LOOP;
    
    RETURN transactions_created;
END;
';

SELECT 'Investment functions created successfully!' as status;