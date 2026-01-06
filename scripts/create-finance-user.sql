-- =====================================================
-- SQL Script to Create Finance User
-- =====================================================
-- 
-- IMPORTANT: You need to generate a bcrypt hash for the password first.
-- The password_hash field requires a bcrypt hash, not a plain password.
--
-- To generate the bcrypt hash, you can:
-- 1. Use the Node.js script: node scripts/generate-finance-user-sql.js
-- 2. Or use an online bcrypt generator (for testing only)
-- 3. Or use this Node.js one-liner:
--    node -e "const bcrypt=require('bcrypt');bcrypt.hash('Finance123!',10).then(h=>console.log(h))"
--
-- =====================================================

-- Option 1: SQL with placeholder (you need to replace PASSWORD_HASH_PLACEHOLDER)
INSERT INTO staff (
  first_name, 
  last_name, 
  email, 
  phone, 
  password_hash, 
  department_id, 
  position, 
  role, 
  status, 
  profile_image, 
  notes, 
  created_at, 
  updated_at
) VALUES (
  'Finance',
  'Manager',
  'finance@hcc.com',
  '+1-555-0105',
  'PASSWORD_HASH_PLACEHOLDER', -- REPLACE THIS with actual bcrypt hash
  (SELECT id FROM departments WHERE department_code = 'FIN-001' LIMIT 1), -- Finance Department
  'Finance Manager',
  'Finance', -- Role must be 'Finance' for finance dashboard redirect
  'active',
  NULL,
  'Finance department manager with access to financial dashboard',
  NOW(),
  NOW()
);

-- =====================================================
-- Option 2: Check if user exists first (recommended)
-- =====================================================

-- Check if Finance user already exists
SELECT id, first_name, last_name, email, role, status 
FROM staff 
WHERE email = 'finance@hcc.com';

-- If the above query returns no rows, then run the INSERT statement above
-- If it returns a row, the Finance user already exists

-- =====================================================
-- Option 3: Using INSERT IGNORE (MySQL only)
-- =====================================================

INSERT IGNORE INTO staff (
  first_name, 
  last_name, 
  email, 
  phone, 
  password_hash, 
  department_id, 
  position, 
  role, 
  status, 
  profile_image, 
  notes, 
  created_at, 
  updated_at
) VALUES (
  'Finance',
  'Manager',
  'finance@hcc.com',
  '+1-555-0105',
  'PASSWORD_HASH_PLACEHOLDER', -- REPLACE THIS with actual bcrypt hash
  (SELECT id FROM departments WHERE department_code = 'FIN-001' LIMIT 1),
  'Finance Manager',
  'Finance',
  'active',
  NULL,
  'Finance department manager with access to financial dashboard',
  NOW(),
  NOW()
);

-- =====================================================
-- Option 4: Using REPLACE INTO (MySQL only - will update if exists)
-- =====================================================

REPLACE INTO staff (
  first_name, 
  last_name, 
  email, 
  phone, 
  password_hash, 
  department_id, 
  position, 
  role, 
  status, 
  profile_image, 
  notes, 
  created_at, 
  updated_at
) VALUES (
  'Finance',
  'Manager',
  'finance@hcc.com',
  '+1-555-0105',
  'PASSWORD_HASH_PLACEHOLDER', -- REPLACE THIS with actual bcrypt hash
  (SELECT id FROM departments WHERE department_code = 'FIN-001' LIMIT 1),
  'Finance Manager',
  'Finance',
  'active',
  NULL,
  'Finance department manager with access to financial dashboard',
  NOW(),
  NOW()
);

-- =====================================================
-- Alternative: Create Finance user with department ID directly
-- (Use this if you know the Finance department ID is 5)
-- =====================================================

INSERT INTO staff (
  first_name, 
  last_name, 
  email, 
  phone, 
  password_hash, 
  department_id, 
  position, 
  role, 
  status, 
  profile_image, 
  notes, 
  created_at, 
  updated_at
) VALUES (
  'Finance',
  'Manager',
  'finance@hcc.com',
  '+1-555-0105',
  'PASSWORD_HASH_PLACEHOLDER', -- REPLACE THIS with actual bcrypt hash
  5, -- Finance Department ID (verify this exists first)
  'Finance Manager',
  'Finance',
  'active',
  NULL,
  'Finance department manager with access to financial dashboard',
  NOW(),
  NOW()
);

-- =====================================================
-- Example: Complete SQL with a sample bcrypt hash
-- WARNING: This is a sample hash for 'Finance123!' 
-- You should generate your own hash for security!
-- =====================================================
-- 
-- To generate your own hash, run this in Node.js:
-- node -e "const bcrypt=require('bcrypt');bcrypt.hash('Finance123!',10).then(h=>console.log('Hash:',h))"
--
-- Example hash (for password 'Finance123!' with salt rounds 10):
-- $2b$10$XxYyZzAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYy
--
-- =====================================================

-- Example INSERT with a sample hash (REPLACE with your generated hash):
/*
INSERT INTO staff (
  first_name, 
  last_name, 
  email, 
  phone, 
  password_hash, 
  department_id, 
  position, 
  role, 
  status, 
  profile_image, 
  notes, 
  created_at, 
  updated_at
) VALUES (
  'Finance',
  'Manager',
  'finance@hcc.com',
  '+1-555-0105',
  '$2b$10$XxYyZzAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYy', -- Sample hash for 'Finance123!'
  (SELECT id FROM departments WHERE department_code = 'FIN-001' LIMIT 1),
  'Finance Manager',
  'Finance',
  'active',
  NULL,
  'Finance department manager with access to financial dashboard',
  NOW(),
  NOW()
);
*/

-- =====================================================
-- Verify the created user
-- =====================================================

SELECT 
  s.id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.position,
  s.role,
  s.status,
  d.name as department_name,
  d.department_code,
  s.created_at
FROM staff s
LEFT JOIN departments d ON s.department_id = d.id
WHERE s.email = 'finance@hcc.com';

-- =====================================================
-- Check Finance Department ID
-- =====================================================

SELECT id, name, department_code 
FROM departments 
WHERE department_code = 'FIN-001' OR name LIKE '%Finance%';

-- =====================================================
-- Default Credentials (after creating with the script):
-- Email: finance@hcc.com
-- Password: Finance123! (or whatever you set)
-- Role: Finance
-- Status: active
-- Department: Finance (FIN-001)
-- =====================================================

