import pool from '../config/db.js';

async function addDepartmentToProjects() {
  let connection;
  try {
    console.log('Adding department column to projects table...');
    
    // Get a connection from the pool
    connection = await pool.getConnection();
    
    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'projects' 
      AND COLUMN_NAME = 'department'
    `);

    if (columns.length > 0) {
      console.log('✅ Department column already exists in projects table');
      return;
    }

    // Add department column
    await connection.execute(`
      ALTER TABLE projects 
      ADD COLUMN department VARCHAR(255) NULL AFTER client,
      ADD INDEX idx_department (department)
    `);

    console.log('✅ Successfully added department column to projects table');
  } catch (error) {
    console.error('❌ Error adding department column to projects table:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

addDepartmentToProjects().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

