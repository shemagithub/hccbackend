import bcrypt from 'bcrypt';
import pool from '../config/db.js';

/**
 * Generates SQL INSERT statement for Finance user with bcrypt password hash
 * Run: node scripts/generate-finance-user-sql.js
 */

const FINANCE_USER_CONFIG = {
  firstName: 'Finance',
  lastName: 'Manager',
  email: 'finance@hcc.com',
  phone: '+1-555-0105',
  password: 'Finance123!',
  departmentCode: 'FIN-001', // Finance Department
  position: 'Finance Manager',
  role: 'Finance', // Must be 'Finance' for finance dashboard redirect
  status: 'active',
  notes: 'Finance department manager with access to financial dashboard'
};

async function generateFinanceUserSQL() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('🔗 Connected to database');
    
    // Get Finance department ID
    const [deptRows] = await connection.execute(
      'SELECT id, name, department_code FROM departments WHERE department_code = ? OR name LIKE ?',
      [FINANCE_USER_CONFIG.departmentCode, '%Finance%']
    );
    
    let departmentId = null;
    if (deptRows.length > 0) {
      departmentId = deptRows[0].id;
      console.log(`✅ Found Finance department: ${deptRows[0].name} (ID: ${departmentId})`);
    } else {
      console.log('⚠️  Finance department not found. Will use NULL for department_id.');
      console.log('   You may need to create the Finance department first.');
    }
    
    console.log('\n🔐 Generating bcrypt hash for password...');
    const passwordHash = await bcrypt.hash(FINANCE_USER_CONFIG.password, 10);
    
    console.log('✅ Password hash generated successfully!\n');
    console.log('='.repeat(70));
    console.log('📋 READY-TO-USE SQL STATEMENT:');
    console.log('='.repeat(70));
    console.log('\n');
    
    const departmentIdValue = departmentId 
      ? departmentId 
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
  '${FINANCE_USER_CONFIG.firstName}',
  '${FINANCE_USER_CONFIG.lastName}',
  '${FINANCE_USER_CONFIG.email}',
  '${FINANCE_USER_CONFIG.phone}',
  '${passwordHash}',
  ${departmentIdValue},
  '${FINANCE_USER_CONFIG.position}',
  '${FINANCE_USER_CONFIG.role}',
  '${FINANCE_USER_CONFIG.status}',
  NULL,
  '${FINANCE_USER_CONFIG.notes}',
  NOW(),
  NOW()
);`;
    
    console.log(sql);
    console.log('\n');
    console.log('='.repeat(70));
    console.log('📝 USER CREDENTIALS:');
    console.log('='.repeat(70));
    console.log(`Email: ${FINANCE_USER_CONFIG.email}`);
    console.log(`Password: ${FINANCE_USER_CONFIG.password}`);
    console.log(`Role: ${FINANCE_USER_CONFIG.role}`);
    console.log(`Status: ${FINANCE_USER_CONFIG.status}`);
    console.log(`Department: ${departmentId ? `Finance (ID: ${departmentId})` : 'Not assigned'}`);
    console.log('='.repeat(70));
    console.log('\n');
    console.log('💡 Copy the SQL statement above and run it in your MySQL client.');
    console.log('⚠️  Make sure to save the credentials in a secure location!');
    console.log('📊 This user will be redirected to the Finance Dashboard after login.\n');
    
  } catch (error) {
    console.error('❌ Error generating SQL:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

generateFinanceUserSQL();

