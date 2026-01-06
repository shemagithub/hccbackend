-- =====================================================
-- SQL Script to Create SuperAdmin User
-- =====================================================
-- 
-- IMPORTANT: You need to generate a bcrypt hash for the password first.
-- The password_hash field requires a bcrypt hash, not a plain password.
--
-- To generate the bcrypt hash, you can:
-- 1. Use the Node.js script: node scripts/create-superadmin.js
-- 2. Or use an online bcrypt generator (for testing only)
-- 3. Or use this Node.js one-liner:
--    node -e "const bcrypt=require('bcrypt');bcrypt.hash('SuperAdmin123!',10).then(h=>console.log(h))"
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
  'Super',
  'Admin',
  'superadmin@hcc.com',
  '+1-555-0001',
  'PASSWORD_HASH_PLACEHOLDER', -- REPLACE THIS with actual bcrypt hash
  1, -- Department ID (set to NULL if no department)
  'System Administrator',
  'SuperAdmin', -- or 'Superadmin' or 'superadmin' depending on your system
  'active',
  NULL,
  'System Super Administrator with full access to all features',
  NOW(),
  NOW()
);

-- =====================================================
-- Option 2: Check if user exists first (recommended)
-- =====================================================

-- Check if SuperAdmin already exists
SELECT id, first_name, last_name, email, role, status 
FROM staff 
WHERE email = 'superadmin@hcc.com';

-- If the above query returns no rows, then run the INSERT statement above
-- If it returns a row, the SuperAdmin already exists

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
  'Super',
  'Admin',
  'superadmin@hcc.com',
  '+1-555-0001',
  'PASSWORD_HASH_PLACEHOLDER', -- REPLACE THIS with actual bcrypt hash
  1,
  'System Administrator',
  'SuperAdmin',
  'active',
  NULL,
  'System Super Administrator with full access to all features',
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
  'Super',
  'Admin',
  'superadmin@hcc.com',
  '+1-555-0001',
  'PASSWORD_HASH_PLACEHOLDER', -- REPLACE THIS with actual bcrypt hash
  1,
  'System Administrator',
  'SuperAdmin',
  'active',
  NULL,
  'System Super Administrator with full access to all features',
  NOW(),
  NOW()
);

-- =====================================================
-- Example: Complete SQL with a sample bcrypt hash
-- WARNING: This is a sample hash for 'SuperAdmin123!' 
-- You should generate your own hash for security!
-- =====================================================
-- 
-- To generate your own hash, run this in Node.js:
-- node -e "const bcrypt=require('bcrypt');bcrypt.hash('SuperAdmin123!',10).then(h=>console.log('Hash:',h))"
--
-- Example hash (for password 'SuperAdmin123!' with salt rounds 10):
-- $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
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
  'Super',
  'Admin',
  'superadmin@hcc.com',
  '+1-555-0001',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- Sample hash for 'SuperAdmin123!'
  1,
  'System Administrator',
  'SuperAdmin',
  'active',
  NULL,
  'System Super Administrator with full access to all features',
  NOW(),
  NOW()
);
*/

-- =====================================================
-- Verify the created user
-- =====================================================

SELECT 
  id,
  first_name,
  last_name,
  email,
  phone,
  position,
  role,
  status,
  created_at
FROM staff 
WHERE email = 'superadmin@hcc.com';

-- =====================================================
-- Default Credentials (after creating with the script):
-- Email: superadmin@hcc.com
-- Password: SuperAdmin123!
-- Role: SuperAdmin
-- Status: active
-- =====================================================

