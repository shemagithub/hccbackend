import pool from '../config/db.js';

async function addMultipleAssigneesColumns() {
  try {
    console.log('Adding assignee_ids and assignee_names columns to tasks table...');
    
    // Check if columns already exist
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tasks' 
      AND COLUMN_NAME IN ('assignee_ids', 'assignee_names')
    `);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    
    if (!existingColumns.includes('assignee_ids')) {
      await pool.execute(`
        ALTER TABLE tasks 
        ADD COLUMN assignee_ids TEXT NULL
      `);
      console.log('✓ Added assignee_ids column');
    } else {
      console.log('✓ assignee_ids column already exists');
    }
    
    if (!existingColumns.includes('assignee_names')) {
      await pool.execute(`
        ALTER TABLE tasks 
        ADD COLUMN assignee_names TEXT NULL
      `);
      console.log('✓ Added assignee_names column');
    } else {
      console.log('✓ assignee_names column already exists');
    }
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

addMultipleAssigneesColumns();

