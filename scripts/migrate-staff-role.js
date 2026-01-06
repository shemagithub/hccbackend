import pool, { testConnection } from '../config/db.js';

async function migrateStaffRole() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Cannot migrate staff role: Database not connected.');
    process.exit(1);
  }

  try {
    console.log('Starting staff role migration...');

    // Check if the role column is already VARCHAR
    const [columns] = await pool.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'hcc' 
      AND TABLE_NAME = 'staff' 
      AND COLUMN_NAME = 'role'
    `);

    if (columns.length > 0) {
      const columnType = columns[0].COLUMN_TYPE;
      console.log('Current role column type:', columnType);
      
      if (columnType.includes('enum')) {
        console.log('Converting role column from ENUM to VARCHAR...');
        
        // First, update any existing enum values to match the new role names
        await pool.execute(`
          UPDATE staff 
          SET role = CASE 
            WHEN role = 'admin' THEN 'Administrator'
            WHEN role = 'manager' THEN 'Manager'
            WHEN role = 'employee' THEN 'Employee'
            WHEN role = 'viewer' THEN 'Viewer'
            WHEN role = 'project_manager' THEN 'Project Manager'
            WHEN role = 'team_lead' THEN 'Team Lead'
            ELSE role
          END
        `);
        
        // Then alter the column type
        await pool.execute(`
          ALTER TABLE staff 
          MODIFY COLUMN role VARCHAR(255) NOT NULL
        `);
        
        console.log('✅ Role column successfully converted to VARCHAR');
      } else {
        console.log('✅ Role column is already VARCHAR, no migration needed');
      }
    } else {
      console.log('❌ Role column not found in staff table');
    }

    // Verify the migration
    const [updatedColumns] = await pool.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'hcc' 
      AND TABLE_NAME = 'staff' 
      AND COLUMN_NAME = 'role'
    `);
    
    if (updatedColumns.length > 0) {
      console.log('✅ Migration completed. New role column type:', updatedColumns[0].COLUMN_TYPE);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateStaffRole();
