import pool, { testConnection } from '../config/db.js';

async function addControlPanelToStaff() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Cannot add control_panel column: Database not connected.');
    process.exit(1);
  }

  try {
    console.log('Starting control_panel column migration...');

    // Check if the control_panel column already exists
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'staff' 
      AND COLUMN_NAME = 'control_panel'
    `);

    if (columns.length > 0) {
      console.log('✅ control_panel column already exists, skipping migration');
    } else {
      console.log('Adding control_panel column to staff table...');
      
      // Add the control_panel column
      await pool.execute(`
        ALTER TABLE staff 
        ADD COLUMN control_panel VARCHAR(100) NULL 
        AFTER role
      `);
      
      console.log('✅ control_panel column successfully added to staff table');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addControlPanelToStaff();
