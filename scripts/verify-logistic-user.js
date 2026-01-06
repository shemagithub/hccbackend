import pool from '../config/db.js';
import { testConnection } from '../config/db.js';

async function verifyLogisticUser() {
  try {
    console.log('🔍 Connecting to database...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    console.log('🔍 Checking for logistic user...');
    
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name, email, role, status FROM staff WHERE email = ? OR role = ?',
      ['robert.taylor@company.com', 'Logistic']
    );

    if (users.length === 0) {
      console.log('❌ Logistic user not found in database');
      console.log('💡 Run: npm run create-logistic-user');
    } else {
      console.log('✅ Found logistic user(s):');
      users.forEach(user => {
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.first_name} ${user.last_name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyLogisticUser();

