-- Simple SQL script to update opportunities table
-- This script adds indexes to improve query performance

USE hcc;

-- Add index on assigned_to column for better query performance
-- Note: MySQL will show an error if the index already exists, which is safe to ignore
ALTER TABLE opportunities ADD INDEX idx_assigned_to (assigned_to(255));

-- Add index on decision column
ALTER TABLE opportunities ADD INDEX idx_decision (decision);

-- Add index on value column (for sorting/filtering by value)
ALTER TABLE opportunities ADD INDEX idx_value (value);

-- Add index on expected_close_date
ALTER TABLE opportunities ADD INDEX idx_expected_close_date (expected_close_date);

-- Verify indexes
SHOW INDEXES FROM opportunities;

