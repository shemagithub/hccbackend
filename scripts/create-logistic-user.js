import Staff from '../models/Staff.js';
import pool from '../config/db.js';
import { testConnection } from '../config/db.js';

async function createLogisticUser() {
  try {
    console.log('🔍 Connecting to database...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Cannot create logistic user: Database not connected.');
      process.exit(1);
    }

    console.log('🔍 Checking if logistic user exists...');
    
    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id, email FROM staff WHERE email = ?',
      ['robert.taylor@company.com']
    );

    if (existingUsers.length > 0) {
      console.log('✅ Logistic user already exists:', existingUsers[0].email);
      console.log('   User ID:', existingUsers[0].id);
      return;
    }

    // Ensure staff table exists
    await Staff.createTable();
    console.log('✅ Staff table verified');

    // Check if Operations department exists (departmentId: 6)
    const [deptRows] = await pool.execute(
      'SELECT id, name FROM departments WHERE id = 6 OR name = ?',
      ['Operations']
    );

    let departmentId = 6; // Default Operations department ID
    if (deptRows.length > 0) {
      departmentId = deptRows[0].id;
      console.log(`✅ Found department: ${deptRows[0].name} (ID: ${departmentId})`);
    } else {
      console.log('⚠️  Operations department not found, using default ID: 6');
    }

    // Create logistic user
    const logisticUser = {
      firstName: 'Robert',
      lastName: 'Taylor',
      email: 'robert.taylor@company.com',
      phone: '+1-555-0111',
      password: 'Password123!',
      departmentId: departmentId,
      position: 'Logistics Manager',
      role: 'Logistic',
      status: 'active',
      profileImage: null,
      notes: 'Manages logistics, transportation, and supply chain operations'
    };

    console.log('📝 Creating logistic user...');
    const createdStaff = await Staff.create(logisticUser);
    
    console.log('✅ Logistic user created successfully!');
    console.log('   Name:', `${createdStaff.firstName} ${createdStaff.lastName}`);
    console.log('   Email:', createdStaff.email);
    console.log('   Role:', createdStaff.role);
    console.log('   Status:', createdStaff.status);
    console.log('   ID:', createdStaff.id);
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('   Email: robert.taylor@company.com');
    console.log('   Password: Password123!');
    
  } catch (error) {
    console.error('❌ Error creating logistic user:', error);
    console.error('   Details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    // Don't close the pool as it's shared
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    try {
      await createLogisticUser();
      console.log('✅ Script completed successfully');
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      await pool.end();
      process.exit(1);
    }
  })();
}

export { createLogisticUser };

