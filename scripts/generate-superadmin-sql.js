import bcrypt from 'bcrypt';

/**
 * Generates SQL INSERT statement for SuperAdmin user with bcrypt password hash
 * Run: node scripts/generate-superadmin-sql.js
 */

const SUPERADMIN_CONFIG = {
  firstName: 'Super',
  lastName: 'Admin',
  email: 'superadmin@hcc.com',
  phone: '+1-555-0001',
  password: 'SuperAdmin123!',
  departmentId: 1, // Set to null if no department
  position: 'System Administrator',
  role: 'SuperAdmin', // or 'Superadmin' or 'superadmin'
  status: 'active',
  notes: 'System Super Administrator with full access to all features'
};

async function generateSuperAdminSQL() {
  try {
    console.log('🔐 Generating bcrypt hash for password...');
    const passwordHash = await bcrypt.hash(SUPERADMIN_CONFIG.password, 10);
    
    console.log('\n✅ Password hash generated successfully!\n');
    console.log('='.repeat(70));
    console.log('📋 READY-TO-USE SQL STATEMENT:');
    console.log('='.repeat(70));
    console.log('\n');
    
    const departmentIdValue = SUPERADMIN_CONFIG.departmentId 
      ? SUPERADMIN_CONFIG.departmentId 
      : 'NULL';
    
    const sql = `INSERT INTO staff (
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
  '${SUPERADMIN_CONFIG.firstName}',
  '${SUPERADMIN_CONFIG.lastName}',
  '${SUPERADMIN_CONFIG.email}',
  '${SUPERADMIN_CONFIG.phone}',
  '${passwordHash}',
  ${departmentIdValue},
  '${SUPERADMIN_CONFIG.position}',
  '${SUPERADMIN_CONFIG.role}',
  '${SUPERADMIN_CONFIG.status}',
  NULL,
  '${SUPERADMIN_CONFIG.notes}',
  NOW(),
  NOW()
);`;
    
    console.log(sql);
    console.log('\n');
    console.log('='.repeat(70));
    console.log('📝 USER CREDENTIALS:');
    console.log('='.repeat(70));
    console.log(`Email: ${SUPERADMIN_CONFIG.email}`);
    console.log(`Password: ${SUPERADMIN_CONFIG.password}`);
    console.log(`Role: ${SUPERADMIN_CONFIG.role}`);
    console.log(`Status: ${SUPERADMIN_CONFIG.status}`);
    console.log('='.repeat(70));
    console.log('\n');
    console.log('💡 Copy the SQL statement above and run it in your MySQL client.');
    console.log('⚠️  Make sure to save the credentials in a secure location!\n');
    
  } catch (error) {
    console.error('❌ Error generating SQL:', error);
    process.exit(1);
  }
}

generateSuperAdminSQL();

