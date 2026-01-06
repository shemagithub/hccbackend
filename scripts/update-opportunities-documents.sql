-- Update opportunities table to use LONGTEXT for document fields
-- This allows storing large base64-encoded files

ALTER TABLE opportunities 
MODIFY COLUMN win_probability_document LONGTEXT NULL,
MODIFY COLUMN supporting_document LONGTEXT NULL;

