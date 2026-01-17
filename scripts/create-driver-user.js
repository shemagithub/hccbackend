import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import Staff from '../models/Staff.js';

/**
 * Script to create a Driver Control Panel admin user
 * This user will have full access to manage staff users and assign them to different control panels
 */

const DRIVER_ADMIN = {
  firstName: 'Driver',
  lastName: 'Admin',
  email: 'driver@hcc.com',
  phone: '+250788123456',
  password: 'Driver@2024', // Change this password after first login
  position: 'Driver Administrator',
  role: 'admin', // Admin role for full permissions
  controlPanel: 'driver',
  status: 'active',
  notes: 'Driver Control Panel Administrator - Full access to staff management and control panel assignments'
};

async function createDriverAdmin() {
  let connection;
  
  try {
    console.log('🚀 Starting Driver Admin user creation...');
    
    connection = await pool.getConnection();
    console.log('✅ Database connection established');

    const [existing] = await connection.execute(
      'SELECT id, email, role, control_panel FROM staff WHERE email = ?',
      [DRIVER_ADMIN.email]
    );

    if (existing.length > 0) {
      const existingUser = existing[0];
      console.log(`⚠️  User with email ${DRIVER_ADMIN.email} already exists:`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Control Panel: ${existingUser.control_panel}`);
      
      const passwordHash = await bcrypt.hash(DRIVER_ADMIN.password, 12);
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
          DRIVER_ADMIN.firstName,
          DRIVER_ADMIN.lastName,
          DRIVER_ADMIN.phone,
          passwordHash,
          DRIVER_ADMIN.position,
          DRIVER_ADMIN.role,
          DRIVER_ADMIN.controlPanel,
          DRIVER_ADMIN.status,
          DRIVER_ADMIN.notes,
          DRIVER_ADMIN.email
        ]
      );
      
      console.log('✅ Existing user updated with Driver admin settings');
      console.log('\n📋 Driver Admin Credentials:');
      console.log(`   Email: ${DRIVER_ADMIN.email}`);
      console.log(`   Password: ${DRIVER_ADMIN.password}`);
      console.log(`   Control Panel: ${DRIVER_ADMIN.controlPanel}`);
      console.log(`   Role: ${DRIVER_ADMIN.role}`);
      console.log('\n⚠️  Please change the password after first login!');
      return;
    }

    let departmentId = null;
    const [depts] = await connection.execute('SELECT id FROM departments WHERE name = ? LIMIT 1', ['Logistics']);
    if (depts.length > 0) {
      departmentId = depts[0].id;
    } else {
      const [deptResult] = await connection.execute(
        'INSERT INTO departments (name, department_code, description) VALUES (?, ?, ?)',
        ['Logistics', 'LOG', 'Logistics Department']
      );
      departmentId = deptResult.insertId;
      console.log('✅ Created Logistics department');
    }

    const result = await Staff.create({
      firstName: DRIVER_ADMIN.firstName,
      lastName: DRIVER_ADMIN.lastName,
      email: DRIVER_ADMIN.email,
      phone: DRIVER_ADMIN.phone,
      password: DRIVER_ADMIN.password,
      departmentId: departmentId,
      position: DRIVER_ADMIN.position,
      role: DRIVER_ADMIN.role,
      controlPanel: DRIVER_ADMIN.controlPanel,
      status: DRIVER_ADMIN.status,
      notes: DRIVER_ADMIN.notes
    });

    console.log('✅ Driver Admin user created successfully!');
    console.log(`   User ID: ${result.id}`);
    console.log('\n📋 Driver Admin Credentials:');
    console.log(`   Email: ${DRIVER_ADMIN.email}`);
    console.log(`   Password: ${DRIVER_ADMIN.password}`);
    console.log(`   Control Panel: ${DRIVER_ADMIN.controlPanel}`);
    console.log(`   Role: ${DRIVER_ADMIN.role}`);
    console.log(`   Status: ${DRIVER_ADMIN.status}`);
    console.log('\n⚠️  IMPORTANT: Please change the password after first login!');
    console.log('\n✨ This user has full access to:');
    console.log('   - Create and manage staff users');
    console.log('   - Assign staff to different control panels');
    console.log('   - Manage departments and roles');
    console.log('   - Access all Driver features');

  } catch (error) {
    console.error('❌ Error creating Driver Admin user:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

createDriverAdmin()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
