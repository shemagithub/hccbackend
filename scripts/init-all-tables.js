import { testConnection, ensureDatabase } from '../config/db.js';
import { initializeDatabaseSchema } from './init-database-schema.js';
async function initializeAllTables() {
  try {
    console.log('🔍 Ensuring database exists...');
    await ensureDatabase();

    console.log('🔍 Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ Cannot initialize tables: Database not connected.');
      process.exit(1);
    }

    await initializeDatabaseSchema();

  } catch (error) {
    console.error('❌ Error initializing tables:', error);
    console.error('   Details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    try {
      await initializeAllTables();
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  })();
}

export { initializeAllTables };

