import { pool } from '../config/db.js';
import { ensurePrimaryKey } from './ensure-primary-key.js';

const createDepartmentsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        department_code VARCHAR(50) NOT NULL UNIQUE,
        location VARCHAR(255) NOT NULL,
        budget DECIMAL(15,2) NULL,
        phone VARCHAR(20) NULL,
        email VARCHAR(255) NULL,
        website VARCHAR(500) NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_department_code (department_code),
        INDEX idx_status (status),
        INDEX idx_location (location),
        INDEX idx_name (name),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.execute(query);
    console.log('✅ Departments table created successfully');
  } catch (error) {
    console.error('❌ Failed to create departments table:', error.message);
    throw error;
  }
};

/**
 * Add department-specific indexes after the shared primary-key repair.
 */
const ensureDepartmentsSchema = async () => {
  try {
    await ensurePrimaryKey('departments');

    const [primaryKey] = await pool.execute(
      "SHOW INDEX FROM departments WHERE Key_name = 'PRIMARY'"
    );
    if (primaryKey.length === 0) {
      return;
    }

    await pool.execute(`
      DELETE t1 FROM departments t1
      INNER JOIN departments t2
      ON t1.department_code = t2.department_code AND t1.id > t2.id
    `);

    const indexDefinitions = [
      { name: 'idx_department_code', sql: 'ADD UNIQUE INDEX idx_department_code (department_code)' },
      { name: 'idx_status', sql: 'ADD INDEX idx_status (status)' },
      { name: 'idx_location', sql: 'ADD INDEX idx_location (location)' },
      { name: 'idx_name', sql: 'ADD INDEX idx_name (name)' },
      { name: 'idx_created_at', sql: 'ADD INDEX idx_created_at (created_at)' },
    ];

    for (const { name, sql } of indexDefinitions) {
      const [existing] = await pool.execute(
        'SHOW INDEX FROM departments WHERE Key_name = ?',
        [name]
      );
      if (existing.length === 0) {
        await pool.execute(`ALTER TABLE departments ${sql}`);
      }
    }

    console.log('✅ Departments indexes ready');
  } catch (error) {
    console.error('❌ Failed to repair departments table schema:', error.message);
    throw error;
  }
};

const insertSampleData = async () => {
  try {
    // Check if data already exists
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM departments');
    if (rows[0].count > 0) {
      console.log('📊 Sample data already exists, skipping insertion');
      return;
    }

    const sampleDepartments = [
      {
        name: 'Engineering',
        description: 'Software development and technical operations',
        department_code: 'ENG-001',
        location: 'Headquarters - Floor 2',
        budget: 500000.00,
        phone: '+1-555-0101',
        email: 'engineering@company.com',
        website: 'https://engineering.company.com',
        status: 'active',
        notes: 'Focus on agile development practices and continuous integration'
      },
      {
        name: 'Marketing',
        description: 'Brand promotion and customer acquisition',
        department_code: 'MKT-001',
        location: 'Headquarters - Floor 1',
        budget: 300000.00,
        phone: '+1-555-0102',
        email: 'marketing@company.com',
        website: 'https://marketing.company.com',
        status: 'active',
        notes: 'Digital marketing and brand management'
      },
      {
        name: 'Sales',
        description: 'Client relations and revenue generation',
        department_code: 'SAL-001',
        location: 'Headquarters - Floor 1',
        budget: 400000.00,
        phone: '+1-555-0103',
        email: 'sales@company.com',
        website: 'https://sales.company.com',
        status: 'active',
        notes: 'Customer relationship management and sales operations'
      },
      {
        name: 'Human Resources',
        description: 'Employee management and organizational development',
        department_code: 'HR-001',
        location: 'Headquarters - Floor 3',
        budget: 200000.00,
        phone: '+1-555-0104',
        email: 'hr@company.com',
        website: 'https://hr.company.com',
        status: 'active',
        notes: 'Employee relations and talent management'
      },
      {
        name: 'Finance',
        description: 'Financial planning and accounting',
        department_code: 'FIN-001',
        location: 'Headquarters - Floor 3',
        budget: 150000.00,
        phone: '+1-555-0105',
        email: 'finance@company.com',
        website: 'https://finance.company.com',
        status: 'active',
        notes: 'Financial reporting and budget management'
      },
      {
        name: 'Operations',
        description: 'Business operations and logistics',
        department_code: 'OPS-001',
        location: 'Branch Office - Downtown',
        budget: 350000.00,
        phone: '+1-555-0106',
        email: 'operations@company.com',
        website: 'https://operations.company.com',
        status: 'active',
        notes: 'Supply chain and operational efficiency'
      },
      {
        name: 'Customer Service',
        description: 'Client support and satisfaction',
        department_code: 'CS-001',
        location: 'Branch Office - Suburbs',
        budget: 180000.00,
        phone: '+1-555-0107',
        email: 'support@company.com',
        website: 'https://support.company.com',
        status: 'active',
        notes: 'Customer support and satisfaction management'
      },
      {
        name: 'Information Technology',
        description: 'Technical infrastructure and support',
        department_code: 'IT-001',
        location: 'Headquarters - Floor 2',
        budget: 250000.00,
        phone: '+1-555-0108',
        email: 'it@company.com',
        website: 'https://it.company.com',
        status: 'inactive',
        notes: 'IT infrastructure and technical support'
      }
    ];

    const insertQuery = `
      INSERT INTO departments (
        name, description, department_code, location, budget, 
        phone, email, website, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const dept of sampleDepartments) {
      await pool.execute(insertQuery, [
        dept.name,
        dept.description,
        dept.department_code,
        dept.location,
        dept.budget,
        dept.phone,
        dept.email,
        dept.website,
        dept.status,
        dept.notes
      ]);
    }

    console.log('✅ Sample department data inserted successfully');
  } catch (error) {
    console.error('❌ Failed to insert sample data:', error.message);
    throw error;
  }
};

const initializeDepartments = async () => {
  try {
    await createDepartmentsTable();
    await ensureDepartmentsSchema();
    await insertSampleData();
    console.log('🎉 Departments module initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize departments module:', error.message);
    throw error;
  }
};

export { initializeDepartments };
export default initializeDepartments;
