import Staff from '../models/Staff.js';
import pool from '../config/db.js';
import { testConnection } from '../config/db.js';

async function createDepartmentDirectorUser() {
  try {
    console.log('🔍 Connecting to database...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Cannot create department director user: Database not connected.');
      process.exit(1);
    }

    console.log('🔍 Checking if department director user exists...');

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id, email FROM staff WHERE email = ?',
      ['director.water@hcc.com']
    );

    if (existingUsers.length > 0) {
      console.log('✅ Department Director user already exists:', existingUsers[0].email);
      console.log('   User ID:', existingUsers[0].id);
      return;
    }

    // Ensure staff table exists
    await Staff.createTable();
    console.log('✅ Staff table verified');

    // Check if Water Resources department exists (or use departmentId: 1 as default)
    const [deptRows] = await pool.execute(
      'SELECT id, name FROM departments WHERE id = 1 OR name LIKE ?',
      ['%Water%']
    );

    let departmentId = 1; // Default to first department
    if (deptRows.length > 0) {
      departmentId = deptRows[0].id;
      console.log(`✅ Found department: ${deptRows[0].name} (ID: ${departmentId})`);
    } else {
      console.log('⚠️  Department not found, using default ID: 1');
    }

    // Create department director user
    const directorUser = {
      firstName: 'James',
      lastName: 'Mitchell',
      email: 'director.water@hcc.com',
      phone: '+250-788-123-456',
      password: 'Password123!',
      departmentId: departmentId,
      position: 'Department Director - Water Resources',
      role: 'Department Director',
      status: 'active',
      profileImage: null,
      notes: 'Department Director for Water Resources. Oversees technical delivery, project quality, timelines, and coordination for water-related consulting and engineering projects.'
    };

    console.log('📝 Creating department director user...');
    const createdStaff = await Staff.create(directorUser);

    console.log('✅ Department Director user created successfully!');
    console.log('   Name:', `${createdStaff.firstName} ${createdStaff.lastName}`);
    console.log('   Email:', createdStaff.email);
    console.log('   Role:', createdStaff.role);
    console.log('   Department ID:', createdStaff.departmentId);
    console.log('   Status:', createdStaff.status);
    console.log('   ID:', createdStaff.id);
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('   Email: director.water@hcc.com');
    console.log('   Password: Password123!');

  } catch (error) {
    console.error('❌ Error creating department director user:', error);
    console.error('   Details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  createDepartmentDirectorUser()
    .then(() => {
      console.log('✅ Script completed successfully');
      setTimeout(() => process.exit(0), 100);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      setTimeout(() => process.exit(1), 100);
    });
}

export { createDepartmentDirectorUser };

