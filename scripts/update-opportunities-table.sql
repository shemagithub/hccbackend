-- Update opportunities table structure
-- This script ensures the opportunities table has all required fields and indexes

USE hcc;

-- Add indexes if they don't exist (MySQL 5.7+ supports IF NOT EXISTS for indexes)
-- Note: MySQL doesn't support IF NOT EXISTS for indexes directly, so we'll use a stored procedure approach
-- or just run the CREATE INDEX statements (they'll fail gracefully if indexes exist)

-- Check if table exists and has required columns, add missing ones
-- Note: ALTER TABLE IF EXISTS is not supported in MySQL, so we'll handle errors gracefully

-- Add index on assigned_to if it doesn't exist (for filtering by assigned users)
-- We'll use a stored procedure to safely add indexes

DELIMITER $$

DROP PROCEDURE IF EXISTS update_opportunities_table$$

CREATE PROCEDURE update_opportunities_table()
BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
    
    -- Add index on assigned_to column for better query performance
    SET @index_exists = (
        SELECT COUNT(*)
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        AND table_name = 'opportunities'
        AND index_name = 'idx_assigned_to'
    );
    
    IF @index_exists = 0 THEN
        ALTER TABLE opportunities ADD INDEX idx_assigned_to (assigned_to(255));
    END IF;
    
    -- Add index on decision column if it doesn't exist
    SET @decision_index_exists = (
        SELECT COUNT(*)
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        AND table_name = 'opportunities'
        AND index_name = 'idx_decision'
    );
    
    IF @decision_index_exists = 0 THEN
        ALTER TABLE opportunities ADD INDEX idx_decision (decision);
    END IF;
    
    -- Add index on value column if it doesn't exist (for sorting/filtering by value)
    SET @value_index_exists = (
        SELECT COUNT(*)
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        AND table_name = 'opportunities'
        AND index_name = 'idx_value'
    );
    
    IF @value_index_exists = 0 THEN
        ALTER TABLE opportunities ADD INDEX idx_value (value);
    END IF;
    
    -- Add index on expected_close_date if it doesn't exist
    SET @date_index_exists = (
        SELECT COUNT(*)
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        AND table_name = 'opportunities'
        AND index_name = 'idx_expected_close_date'
    );
    
    IF @date_index_exists = 0 THEN
        ALTER TABLE opportunities ADD INDEX idx_expected_close_date (expected_close_date);
    END IF;
    
    SELECT 'Opportunities table updated successfully' AS result;
END$$

DELIMITER ;

-- Execute the procedure
CALL update_opportunities_table();

-- Drop the procedure after use
DROP PROCEDURE IF EXISTS update_opportunities_table;

-- Verify table structure
DESCRIBE opportunities;

-- Show indexes
SHOW INDEXES FROM opportunities;

