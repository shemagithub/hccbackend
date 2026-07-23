import { testConnection, ensureDatabase } from '../config/db.js';
import { ensureSchemaFromSql, importSqlSchema } from './import-sql-schema.js';

async function initializeAllTables({ force = false } = {}) {
  try {
    console.log('🔍 Ensuring database exists...');
    await ensureDatabase();

    console.log('🔍 Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ Cannot initialize tables: Database not connected.');
      process.exit(1);
    }

    if (force) {
      await importSqlSchema({ force: true });
    } else {
      await ensureSchemaFromSql();
    }
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
      const force = process.argv.includes('--force');
      await initializeAllTables({ force });
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  })();
}

export { initializeAllTables };

