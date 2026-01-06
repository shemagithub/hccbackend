import pool from '../config/db.js';
import bcrypt from 'bcrypt';

/**
 * Create Finance user directly in the database
 * Run: node scripts/create-finance-user.js
 */

const FINANCE_USER_CONFIG = {
  firstName: 'Finance',
  lastName: 'Manager',
  email: 'finance@hcc.com',
  phone: '+1-555-0105',
  password: 'Finance123!',
  departmentCode: 'FIN-001',
  position: 'Finance Manager',
  role: 'Finance',
  status: 'active',
  notes: 'Finance department manager with access to financial dashboard'
};

async function createFinanceUser() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('🔗 Connected to database');
    
    // Check if Finance user already exists
    const [existing] = await connection.execute(
      'SELECT id, email, role, status FROM staff WHERE email = ?',
      [FINANCE_USER_CONFIG.email]
    );
    
    if (existing.length > 0) {
      console.log('⚠️  Finance user already exists:');
      console.log(`   ID: ${existing[0].id}`);
      console.log(`   Email: ${existing[0].email}`);
      console.log(`   Role: ${existing[0].role}`);
      console.log(`   Status: ${existing[0].status}`);
      console.log('\n💡 To update the user, delete it first or use UPDATE statement.');
      return;
    }
    
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
      console.log('⚠️  Finance department not found. Creating user without department assignment.');
    }
    
    // Hash the password
    console.log('🔐 Generating password hash...');
    const hashedPassword = await bcrypt.hash(FINANCE_USER_CONFIG.password, 10);
    console.log('✅ Password hash generated');
    
    // Create Finance user
    console.log('🔄 Creating Finance user...');
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
        FINANCE_USER_CONFIG.firstName,
        FINANCE_USER_CONFIG.lastName,
        FINANCE_USER_CONFIG.email,
        FINANCE_USER_CONFIG.phone,
        hashedPassword,
        departmentId,
        FINANCE_USER_CONFIG.position,
        FINANCE_USER_CONFIG.role,
        FINANCE_USER_CONFIG.status,
        null,
        FINANCE_USER_CONFIG.notes,
      ]
    );
    
    console.log('✅ Finance user created successfully!');
    console.log(`   ID: ${result.insertId}`);
    console.log(`   Email: ${FINANCE_USER_CONFIG.email}`);
    console.log(`   Role: ${FINANCE_USER_CONFIG.role}`);
    console.log(`   Status: ${FINANCE_USER_CONFIG.status}`);
    console.log(`   Department: ${departmentId ? `Finance (ID: ${departmentId})` : 'Not assigned'}`);
    
    // Verify the user
    console.log('\n📋 Verifying Finance user...');
    const [verify] = await connection.execute(
      `SELECT s.*, d.name as department_name, d.department_code
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.email = ?`,
      [FINANCE_USER_CONFIG.email]
    );
    
    if (verify.length > 0) {
      const user = verify[0];
      console.log('✅ Verification successful:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Department: ${user.department_name || 'None'} (${user.department_code || 'N/A'})`);
      
      // Test password verification
      const testPassword = await bcrypt.compare(FINANCE_USER_CONFIG.password, user.password_hash);
      console.log(`   Password Verification: ${testPassword ? '✅ Valid' : '❌ Invalid'}`);
      
      console.log('\n📝 Login Credentials:');
      console.log(`   Email: ${FINANCE_USER_CONFIG.email}`);
      console.log(`   Password: ${FINANCE_USER_CONFIG.password}`);
      console.log('\n✅ Finance user is ready!');
      console.log('📊 This user will be redirected to the Finance Dashboard after login.');
    }
    
  } catch (error) {
    console.error('❌ Error creating Finance user:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

createFinanceUser();

