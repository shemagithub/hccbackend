import { testConnection } from './config/db.js';

console.log('🧪 Testing database connection...');

testConnection()
  .then((connected) => {
    if (connected) {
      console.log('✅ Database connection test passed!');
      process.exit(0);
    } else {
      console.log('❌ Database connection test failed!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  });

