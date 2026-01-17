import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import Staff from '../models/Staff.js';

/**
 * Script to create an Employee Control Panel admin user
 * This user will have full access to manage staff users and assign them to different control panels
 */

const EMPLOYEE_ADMIN = {
  firstName: 'Employee',
  lastName: 'Admin',
  email: 'employee@hcc.com',
  phone: '+250788123456',
  password: 'Employee@2024', // Change this password after first login
  position: 'Employee Administrator',
  role: 'admin', // Admin role for full permissions
  controlPanel: 'employee',
  status: 'active',
  notes: 'Employee Control Panel Administrator - Full access to staff management and control panel assignments'
};

async function createEmployeeAdmin() {
  let connection;
  
  try {
    console.log('🚀 Starting Employee Admin user creation...');
    
    connection = await pool.getConnection();
    console.log('✅ Database connection established');

    const [existing] = await connection.execute(
      'SELECT id, email, role, control_panel FROM staff WHERE email = ?',
      [EMPLOYEE_ADMIN.email]
    );

    if (existing.length > 0) {
      const existingUser = existing[0];
      console.log(`⚠️  User with email ${EMPLOYEE_ADMIN.email} already exists:`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Control Panel: ${existingUser.control_panel}`);
      
      const passwordHash = await bcrypt.hash(EMPLOYEE_ADMIN.password, 12);
      await connection.execute(
        `UPDATE staff SET 
          first_name = ?, 
          last_name = ?, 
          phone = ?, 
          password_hash = ?, 
          position = ?, 
          role = ?, 
          control_panel = ?, 
          status = ?, 
          notes = ? 
        WHERE email = ?`,
        [
          EMPLOYEE_ADMIN.firstName,
          EMPLOYEE_ADMIN.lastName,
          EMPLOYEE_ADMIN.phone,
          passwordHash,
          EMPLOYEE_ADMIN.position,
          EMPLOYEE_ADMIN.role,
          EMPLOYEE_ADMIN.controlPanel,
          EMPLOYEE_ADMIN.status,
          EMPLOYEE_ADMIN.notes,
          EMPLOYEE_ADMIN.email
        ]
      );
      
      console.log('✅ Existing user updated with Employee admin settings');
      console.log('\n📋 Employee Admin Credentials:');
      console.log(`   Email: ${EMPLOYEE_ADMIN.email}`);
      console.log(`   Password: ${EMPLOYEE_ADMIN.password}`);
      console.log(`   Control Panel: ${EMPLOYEE_ADMIN.controlPanel}`);
      console.log(`   Role: ${EMPLOYEE_ADMIN.role}`);
      console.log('\n⚠️  Please change the password after first login!');
      return;
    }

    let departmentId = null;
    const [depts] = await connection.execute('SELECT id FROM departments WHERE name = ? LIMIT 1', ['Engineering']);
    if (depts.length > 0) {
      departmentId = depts[0].id;
    } else {
      const [deptResult] = await connection.execute(
        'INSERT INTO departments (name, department_code, description) VALUES (?, ?, ?)',
        ['Engineering', 'ENG', 'Engineering Department']
      );
      departmentId = deptResult.insertId;
      console.log('✅ Created Engineering department');
    }

    const result = await Staff.create({
      firstName: EMPLOYEE_ADMIN.firstName,
      lastName: EMPLOYEE_ADMIN.lastName,
      email: EMPLOYEE_ADMIN.email,
      phone: EMPLOYEE_ADMIN.phone,
      password: EMPLOYEE_ADMIN.password,
      departmentId: departmentId,
      position: EMPLOYEE_ADMIN.position,
      role: EMPLOYEE_ADMIN.role,
      controlPanel: EMPLOYEE_ADMIN.controlPanel,
      status: EMPLOYEE_ADMIN.status,
      notes: EMPLOYEE_ADMIN.notes
    });

    console.log('✅ Employee Admin user created successfully!');
    console.log(`   User ID: ${result.id}`);
    console.log('\n📋 Employee Admin Credentials:');
    console.log(`   Email: ${EMPLOYEE_ADMIN.email}`);
    console.log(`   Password: ${EMPLOYEE_ADMIN.password}`);
    console.log(`   Control Panel: ${EMPLOYEE_ADMIN.controlPanel}`);
    console.log(`   Role: ${EMPLOYEE_ADMIN.role}`);
    console.log(`   Status: ${EMPLOYEE_ADMIN.status}`);
    console.log('\n⚠️  IMPORTANT: Please change the password after first login!');
    console.log('\n✨ This user has full access to:');
    console.log('   - Create and manage staff users');
    console.log('   - Assign staff to different control panels');
    console.log('   - Manage departments and roles');
    console.log('   - Access all Employee features');

  } catch (error) {
    console.error('❌ Error creating Employee Admin user:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

createEmployeeAdmin()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
