-- =====================================================
-- Troubleshooting SQL Queries for SuperAdmin User
-- =====================================================

-- 1. Check if SuperAdmin user exists
SELECT 
  id,
  first_name,
  last_name,
  email,
  role,
  status,
  created_at
FROM staff 
WHERE email = 'superadmin@hcc.com';

-- 2. Check the exact role value (case-sensitive)
SELECT 
  email,
  role,
  LENGTH(role) as role_length,
  HEX(role) as role_hex
FROM staff 
WHERE email = 'superadmin@hcc.com';

-- 3. Check if user status is 'active'
SELECT 
  email,
  status,
  CASE 
    WHEN status = 'active' THEN '✅ Active'
    WHEN status = 'pending' THEN '⚠️ Pending - User cannot login'
    WHEN status = 'inactive' THEN '❌ Inactive - User cannot login'
    ELSE '❓ Unknown status'
  END as status_message
FROM staff 
WHERE email = 'superadmin@hcc.com';

-- 4. Verify password hash exists (should not be NULL or empty)
SELECT 
  email,
  CASE 
    WHEN password_hash IS NULL THEN '❌ Password hash is NULL'
    WHEN password_hash = '' THEN '❌ Password hash is empty'
    WHEN LENGTH(password_hash) < 50 THEN '⚠️ Password hash seems too short'
    ELSE '✅ Password hash exists'
  END as password_status,
  LENGTH(password_hash) as hash_length
FROM staff 
WHERE email = 'superadmin@hcc.com';

-- 5. Check all staff with SuperAdmin role (case variations)
SELECT 
  id,
  first_name,
  last_name,
  email,
  role,
  status
FROM staff 
WHERE LOWER(role) LIKE '%superadmin%' 
   OR role LIKE '%SuperAdmin%'
   OR role LIKE '%Superadmin%';

-- 6. Update user status to 'active' if it's not
UPDATE staff 
SET status = 'active',
    updated_at = NOW()
WHERE email = 'superadmin@hcc.com' 
  AND status != 'active';

-- 7. Update role to match exactly what login form expects
-- (Login form checks for: 'Superadmin', 'SuperAdmin', or 'superadmin')
UPDATE staff 
SET role = 'SuperAdmin',
    updated_at = NOW()
WHERE email = 'superadmin@hcc.com';

-- 8. Complete user information check
SELECT 
  id,
  first_name,
  last_name,
  email,
  phone,
  position,
  role,
  status,
  department_id,
  CASE 
    WHEN password_hash IS NOT NULL AND LENGTH(password_hash) > 0 THEN '✅ Has password'
    ELSE '❌ No password'
  END as has_password,
  created_at,
  updated_at,
  last_login
FROM staff 
WHERE email = 'superadmin@hcc.com';

-- =====================================================
-- Common Issues and Solutions:
-- =====================================================
-- 
-- Issue 1: "Invalid credentials"
-- Solution: Make sure password_hash is set correctly
--   - Run: node scripts/create-superadmin.js
--   - Or use the SQL with proper bcrypt hash
--
-- Issue 2: "Account is not active"
-- Solution: Run query #6 above to set status to 'active'
--
-- Issue 3: Role doesn't match
-- Solution: Run query #7 above to set role to 'SuperAdmin'
--
-- Issue 4: User doesn't exist
-- Solution: Run: node scripts/create-superadmin.js
--
-- =====================================================

