import pool, { testConnection } from '../config/db.js';

async function addAssignedToProjects() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Cannot migrate projects table: Database not connected.');
    process.exit(1);
  }

  try {
    console.log('Starting projects assigned_to column migration...');

    // Check if the assigned_to column already exists
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'projects' 
      AND COLUMN_NAME = 'assigned_to'
    `);

    if (columns.length > 0) {
      console.log('✅ assigned_to column already exists in projects table');
      return;
    }

    console.log('Adding assigned_to column to projects table...');
    
    // Add the assigned_to column
    await pool.execute(`
      ALTER TABLE projects 
      ADD COLUMN assigned_to VARCHAR(255) NULL 
      AFTER location
    `);
    
    console.log('✅ assigned_to column successfully added to projects table');

    // Verify the migration
    const [updatedColumns] = await pool.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'projects' 
      AND COLUMN_NAME = 'assigned_to'
    `);

    if (updatedColumns.length > 0) {
      console.log('✅ Migration verified successfully');
      console.log('Column details:', updatedColumns[0]);
    } else {
      console.log('❌ Migration verification failed - column not found');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if script is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || 
                     import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (import.meta.url.startsWith('file:') && process.argv[1] && isMainModule) {
  addAssignedToProjects()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default addAssignedToProjects;
