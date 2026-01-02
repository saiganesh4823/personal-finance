-- Add Investment Portfolio Feature
-- Run this script to add investment portfolio tracking functionality

-- 1. Create investment_portfolio table
CREATE TABLE IF NOT EXISTS investment_portfolio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    investment_type VARCHAR(50) NOT NULL, -- 'sip', 'mutual_fund', 'stocks', 'gold', 'silver', 'fd', 'bonds', 'crypto', 'other'
    investment_name VARCHAR(255) NOT NULL, -- e.g., 'HDFC Top 100 Fund', 'Physical Gold', 'Reliance Stock'
    category VARCHAR(100), -- e.g., 'Large Cap', 'Small Cap', 'Gold ETF', 'Physical Gold'
    total_invested DECIMAL(15, 2) DEFAULT 0.00, -- Total amount invested so far
    current_value DECIMAL(15, 2) DEFAULT 0.00, -- Current market value (optional)
    units_quantity DECIMAL(15, 4) DEFAULT 0.00, -- Number of units/shares/grams
    average_price DECIMAL(15, 4) DEFAULT 0.00, -- Average purchase price per unit
    last_updated_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, investment_name, investment_type)
);

-- 2. Create investment_transactions table (to track individual investments)
CREATE TABLE IF NOT EXISTS investment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id UUID NOT NULL REFERENCES investment_portfolio(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'dividend', 'bonus')),
    amount DECIMAL(12, 2) NOT NULL,
    units DECIMAL(15, 4) DEFAULT 0.00,
    price_per_unit DECIMAL(15, 4) DEFAULT 0.00,
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_investment_portfolio_user_id ON investment_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_portfolio_type ON investment_portfolio(investment_type);
CREATE INDEX IF NOT EXISTS idx_investment_portfolio_active ON investment_portfolio(is_active);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_id ON investment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_portfolio_id ON investment_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_date ON investment_transactions(transaction_date);

-- 4. Add update timestamp triggers
CREATE TRIGGER update_investment_portfolio_updated_at 
    BEFORE UPDATE ON investment_portfolio
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Function to update portfolio totals when investment transactions are added
CREATE OR REPLACE FUNCTION update_portfolio_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the portfolio totals based on all transactions
    UPDATE investment_portfolio 
    SET 
        total_invested = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN transaction_type = 'buy' THEN amount
                    WHEN transaction_type = 'sell' THEN -amount
                    ELSE 0
                END
            ), 0)
            FROM investment_transactions 
            WHERE portfolio_id = NEW.portfolio_id
        ),
        units_quantity = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN transaction_type = 'buy' THEN units
                    WHEN transaction_type = 'sell' THEN -units
                    WHEN transaction_type = 'bonus' THEN units
                    ELSE 0
                END
            ), 0)
            FROM investment_transactions 
            WHERE portfolio_id = NEW.portfolio_id
        ),
        average_price = (
            SELECT 
                CASE 
                    WHEN SUM(CASE WHEN transaction_type = 'buy' THEN units ELSE 0 END) > 0 
                    THEN SUM(CASE WHEN transaction_type = 'buy' THEN amount ELSE 0 END) / 
                         SUM(CASE WHEN transaction_type = 'buy' THEN units ELSE 0 END)
                    ELSE 0
                END
            FROM investment_transactions 
            WHERE portfolio_id = NEW.portfolio_id
        ),
        last_updated_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.portfolio_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to automatically update portfolio totals
CREATE TRIGGER trigger_update_portfolio_totals
    AFTER INSERT OR UPDATE OR DELETE ON investment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_portfolio_totals();

-- 7. Function to add investment transaction and update portfolio
CREATE OR REPLACE FUNCTION add_investment_transaction(
    p_user_id UUID,
    p_investment_type VARCHAR(50),
    p_investment_name VARCHAR(255),
    p_category VARCHAR(100),
    p_transaction_type VARCHAR(20),
    p_amount DECIMAL(12, 2),
    p_units DECIMAL(15, 4) DEFAULT 0,
    p_price_per_unit DECIMAL(15, 4) DEFAULT 0,
    p_transaction_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    portfolio_id_var UUID;
    transaction_id_var UUID;
BEGIN
    -- Get or create portfolio entry
    SELECT id INTO portfolio_id_var
    FROM investment_portfolio 
    WHERE user_id = p_user_id 
    AND investment_name = p_investment_name 
    AND investment_type = p_investment_type;
    
    -- If portfolio doesn't exist, create it
    IF portfolio_id_var IS NULL THEN
        INSERT INTO investment_portfolio (
            user_id, 
            investment_type, 
            investment_name, 
            category,
            total_invested,
            units_quantity,
            average_price
        ) VALUES (
            p_user_id, 
            p_investment_type, 
            p_investment_name, 
            p_category,
            0,
            0,
            0
        ) RETURNING id INTO portfolio_id_var;
    END IF;
    
    -- Add the investment transaction
    INSERT INTO investment_transactions (
        user_id,
        portfolio_id,
        transaction_type,
        amount,
        units,
        price_per_unit,
        transaction_date,
        notes
    ) VALUES (
        p_user_id,
        portfolio_id_var,
        p_transaction_type,
        p_amount,
        p_units,
        p_price_per_unit,
        p_transaction_date,
        p_notes
    ) RETURNING id INTO transaction_id_var;
    
    RETURN transaction_id_var;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to get investment summary by type
CREATE OR REPLACE FUNCTION get_investment_summary(p_user_id UUID)
RETURNS TABLE (
    investment_type VARCHAR(50),
    total_invested DECIMAL(15, 2),
    total_current_value DECIMAL(15, 2),
    total_units DECIMAL(15, 4),
    investment_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ip.investment_type,
        SUM(ip.total_invested) as total_invested,
        SUM(ip.current_value) as total_current_value,
        SUM(ip.units_quantity) as total_units,
        COUNT(*)::INTEGER as investment_count
    FROM investment_portfolio ip
    WHERE ip.user_id = p_user_id AND ip.is_active = TRUE
    GROUP BY ip.investment_type
    ORDER BY SUM(ip.total_invested) DESC;
END;
$$ LANGUAGE plpgsql;

-- 9. Insert some example investment types for reference
DO $$
BEGIN
    -- This is just for documentation - the actual data will be user-specific
    RAISE NOTICE 'Investment Portfolio feature added successfully!';
    RAISE NOTICE 'Supported investment types:';
    RAISE NOTICE '- sip: Systematic Investment Plans';
    RAISE NOTICE '- mutual_fund: Mutual Fund investments';
    RAISE NOTICE '- stocks: Individual stock investments';
    RAISE NOTICE '- gold: Gold investments (physical, ETF, digital)';
    RAISE NOTICE '- silver: Silver investments';
    RAISE NOTICE '- fd: Fixed Deposits';
    RAISE NOTICE '- bonds: Government/Corporate bonds';
    RAISE NOTICE '- crypto: Cryptocurrency investments';
    RAISE NOTICE '- other: Other investment types';
    RAISE NOTICE '';
    RAISE NOTICE 'Use add_investment_transaction() function to add investments.';
    RAISE NOTICE 'Use get_investment_summary() function to get portfolio overview.';
END $$;