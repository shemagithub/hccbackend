import Staff from '../models/Staff.js';
import pool from '../config/db.js';
import { testConnection } from '../config/db.js';

async function createProjectManagerUser() {
  try {
    console.log('🔍 Connecting to database...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Cannot create project manager user: Database not connected.');
      process.exit(1);
    }

    console.log('🔍 Checking if project manager user exists...');

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id, email FROM staff WHERE email = ?',
      ['pm.water@hcc.com']
    );

    if (existingUsers.length > 0) {
      console.log('✅ Project Manager user already exists:', existingUsers[0].email);
      console.log('   User ID:', existingUsers[0].id);
      return;
    }

    // Ensure staff table exists
    await Staff.createTable();
    console.log('✅ Staff table verified');

    // Check if department exists (use departmentId: 1 as default)
    const [deptRows] = await pool.execute(
      'SELECT id, name FROM departments WHERE id = 1'
    );

    let departmentId = 1; // Default to first department
    if (deptRows.length > 0) {
      departmentId = deptRows[0].id;
      console.log(`✅ Found department: ${deptRows[0].name} (ID: ${departmentId})`);
    } else {
      console.log('⚠️  Department not found, using default ID: 1');
    }

    // Create project manager user
    const pmUser = {
      firstName: 'Alexandra',
      lastName: 'Martinez',
      email: 'pm.water@hcc.com',
      phone: '+250-788-789-012',
      password: 'Password123!',
      departmentId: departmentId,
      position: 'Project Manager - Water Resources',
      role: 'Project Manager',
      status: 'active',
      profileImage: null,
      notes: 'Project Manager for Water Resources projects. Manages day-to-day project execution, task oversight, deliverables, reviews & approvals, quality compliance, and team coordination.'
    };

    console.log('📝 Creating project manager user...');
    const createdStaff = await Staff.create(pmUser);

    console.log('✅ Project Manager user created successfully!');
    console.log('   Name:', `${createdStaff.firstName} ${createdStaff.lastName}`);
    console.log('   Email:', createdStaff.email);
    console.log('   Role:', createdStaff.role);
    console.log('   Department ID:', createdStaff.departmentId);
    console.log('   Status:', createdStaff.status);
    console.log('   ID:', createdStaff.id);
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('   Email: pm.water@hcc.com');
    console.log('   Password: Password123!');

  } catch (error) {
    console.error('❌ Error creating project manager user:', error);
    console.error('   Details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  createProjectManagerUser()
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

export { createProjectManagerUser };

