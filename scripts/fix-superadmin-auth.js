import pool from '../config/db.js';
import bcrypt from 'bcrypt';

/**
 * Fix SuperAdmin user authentication issues
 * This script will:
 * 1. Check if SuperAdmin exists
 * 2. Create or update the user with correct password hash
 * 3. Ensure status is 'active'
 * 4. Ensure role is 'SuperAdmin'
 * Run: node scripts/fix-superadmin-auth.js
 */

const SUPERADMIN_EMAIL = 'superadmin@hcc.com';
const SUPERADMIN_PASSWORD = 'SuperAdmin123!';

async function fixSuperAdminAuth() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('🔗 Connected to database');
    
    // Check if SuperAdmin exists
    const [existing] = await connection.execute(
      'SELECT id, email, role, status, password_hash FROM staff WHERE email = ?',
      [SUPERADMIN_EMAIL]
    );
    
    if (existing.length > 0) {
      const user = existing[0];
      console.log('✅ SuperAdmin user found:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Has Password: ${user.password_hash ? 'Yes' : 'No'}`);
      
      // Check if password hash exists and is valid
      let needsPasswordUpdate = false;
      if (!user.password_hash || user.password_hash.length < 50) {
        console.log('⚠️  Password hash is missing or invalid');
        needsPasswordUpdate = true;
      } else {
        // Test if current password works
        const testPassword = await bcrypt.compare(SUPERADMIN_PASSWORD, user.password_hash);
        if (!testPassword) {
          console.log('⚠️  Current password hash does not match expected password');
          needsPasswordUpdate = true;
        } else {
          console.log('✅ Password hash is valid');
        }
      }
      
      // Update user if needed
      const updates = [];
      const updateValues = [];
      
      if (needsPasswordUpdate) {
        console.log('🔄 Generating new password hash...');
        const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
        updates.push('password_hash = ?');
        updateValues.push(hashedPassword);
        console.log('✅ New password hash generated');
      }
      
      if (user.status !== 'active') {
        console.log(`🔄 Updating status from '${user.status}' to 'active'`);
        updates.push('status = ?');
        updateValues.push('active');
      }
      
      if (user.role !== 'SuperAdmin' && user.role !== 'Superadmin' && user.role !== 'superadmin') {
        console.log(`🔄 Updating role from '${user.role}' to 'SuperAdmin'`);
        updates.push('role = ?');
        updateValues.push('SuperAdmin');
      }
      
      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        updateValues.push(user.id);
        
        await connection.execute(
          `UPDATE staff SET ${updates.join(', ')} WHERE id = ?`,
          updateValues
        );
        
        console.log('✅ SuperAdmin user updated successfully');
      } else {
        console.log('✅ SuperAdmin user is already correctly configured');
      }
      
    } else {
      console.log('❌ SuperAdmin user not found');
      console.log('🔄 Creating SuperAdmin user...');
      
      // Generate password hash
      const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
      
      // Create SuperAdmin user
      const [result] = await connection.execute(
        `INSERT INTO staff (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          'Super',
          'Admin',
          SUPERADMIN_EMAIL,
          '+1-555-0001',
          hashedPassword,
          null, // No department
          'System Administrator',
          'SuperAdmin',
          'active',
          null,
          'System Super Administrator with full access to all features',
        ]
      );
      
      console.log('✅ SuperAdmin user created successfully');
      console.log(`   ID: ${result.insertId}`);
    }
    
    // Verify the user
    console.log('\n📋 Verifying SuperAdmin user...');
    const [verify] = await connection.execute(
      'SELECT id, first_name, last_name, email, role, status, password_hash FROM staff WHERE email = ?',
      [SUPERADMIN_EMAIL]
    );
    
    if (verify.length > 0) {
      const user = verify[0];
      console.log('✅ Verification successful:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Password Hash: ${user.password_hash ? '✅ Set' : '❌ Missing'}`);
      
      // Test password verification
      if (user.password_hash) {
        const testPassword = await bcrypt.compare(SUPERADMIN_PASSWORD, user.password_hash);
        console.log(`   Password Verification: ${testPassword ? '✅ Valid' : '❌ Invalid'}`);
      }
      
      console.log('\n📝 Login Credentials:');
      console.log(`   Email: ${SUPERADMIN_EMAIL}`);
      console.log(`   Password: ${SUPERADMIN_PASSWORD}`);
      console.log('\n✅ SuperAdmin authentication is ready!');
    }
    
  } catch (error) {
    console.error('❌ Error fixing SuperAdmin authentication:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

fixSuperAdminAuth();


