import pool from '../config/db.js';
import { testConnection } from '../config/db.js';

async function verifyDepartmentDirectorUser() {
  try {
    console.log('🔍 Connecting to database...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Cannot verify department director user: Database not connected.');
      process.exit(1);
    }

    console.log('🔍 Checking for department director user...');

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name, email, role, status, department_id, position FROM staff WHERE email = ? OR role = ?',
      ['director.water@hcc.com', 'Department Director']
    );

    if (users.length > 0) {
      console.log('✅ Found department director user(s):');
      users.forEach(user => {
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.first_name} ${user.last_name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Position: ${user.position}`);
        console.log(`   Department ID: ${user.department_id}`);
        console.log(`   Status: ${user.status}`);
        console.log('');
      });
    } else {
      console.log('❌ Department Director user not found in database.');
      console.log('   Please run: npm run create-department-director-user');
    }

  } catch (error) {
    console.error('❌ Error verifying department director user:', error);
    console.error('   Details:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDepartmentDirectorUser();
}

export { verifyDepartmentDirectorUser };

