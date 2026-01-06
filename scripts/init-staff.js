import Staff from '../models/Staff.js';
import pool from '../config/db.js';

export async function initializeStaffTable() {
  try {
    console.log('Initializing staff table...');
    
    // Create the staff table
    await Staff.createTable();
    
    // Check if staff table is empty
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM staff');
    const staffCount = rows[0].count;
    
    if (staffCount === 0) {
      console.log('Staff table is empty, inserting sample data...');
      
      // Sample staff data
      const sampleStaff = [
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@company.com',
          phone: '+1-555-0101',
          password: 'Password123!',
          departmentId: 1, // Engineering
          position: 'Senior Software Engineer',
          role: 'employee',
          status: 'active',
          profileImage: null,
          notes: 'Lead developer for the main product'
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@company.com',
          phone: '+1-555-0102',
          password: 'Password123!',
          departmentId: 1, // Engineering
          position: 'Engineering Manager',
          role: 'manager',
          status: 'active',
          profileImage: null,
          notes: 'Manages the engineering team'
        },
        {
          firstName: 'Mike',
          lastName: 'Johnson',
          email: 'mike.johnson@company.com',
          phone: '+1-555-0103',
          password: 'Password123!',
          departmentId: 2, // Marketing
          position: 'Marketing Director',
          role: 'manager',
          status: 'active',
          profileImage: null,
          notes: 'Oversees all marketing activities'
        },
        {
          firstName: 'Sarah',
          lastName: 'Wilson',
          email: 'sarah.wilson@company.com',
          phone: '+1-555-0104',
          password: 'Password123!',
          departmentId: 3, // Sales
          position: 'Sales Representative',
          role: 'employee',
          status: 'active',
          profileImage: null,
          notes: 'Handles client relationships'
        },
        {
          firstName: 'David',
          lastName: 'Brown',
          email: 'david.brown@company.com',
          phone: '+1-555-0105',
          password: 'Password123!',
          departmentId: 4, // HR
          position: 'HR Manager',
          role: 'manager',
          status: 'active',
          profileImage: null,
          notes: 'Manages human resources'
        },
        {
          firstName: 'Lisa',
          lastName: 'Davis',
          email: 'lisa.davis@company.com',
          phone: '+1-555-0106',
          password: 'Password123!',
          departmentId: 5, // Finance
          position: 'Financial Analyst',
          role: 'employee',
          status: 'active',
          profileImage: null,
          notes: 'Handles financial reporting'
        },
        {
          firstName: 'Tom',
          lastName: 'Miller',
          email: 'tom.miller@company.com',
          phone: '+1-555-0107',
          password: 'Password123!',
          departmentId: 6, // Operations
          position: 'Operations Manager',
          role: 'manager',
          status: 'active',
          profileImage: null,
          notes: 'Oversees daily operations'
        },
        {
          firstName: 'Amy',
          lastName: 'Garcia',
          email: 'amy.garcia@company.com',
          phone: '+1-555-0108',
          password: 'Password123!',
          departmentId: 7, // Customer Service
          position: 'Customer Service Representative',
          role: 'employee',
          status: 'active',
          profileImage: null,
          notes: 'Provides customer support'
        },
        {
          firstName: 'Chris',
          lastName: 'Martinez',
          email: 'chris.martinez@company.com',
          phone: '+1-555-0109',
          password: 'Password123!',
          departmentId: 8, // IT
          position: 'IT Administrator',
          role: 'admin',
          status: 'active',
          profileImage: null,
          notes: 'Manages IT infrastructure'
        },
        {
          firstName: 'Emma',
          lastName: 'Anderson',
          email: 'emma.anderson@company.com',
          phone: '+1-555-0110',
          password: 'Password123!',
          departmentId: 1, // Engineering
          position: 'Project Manager',
          role: 'project_manager',
          status: 'active',
          profileImage: null,
          notes: 'Manages software projects'
        },
        {
          firstName: 'Robert',
          lastName: 'Taylor',
          email: 'robert.taylor@company.com',
          phone: '+1-555-0111',
          password: 'Password123!',
          departmentId: 6, // Operations
          position: 'Logistics Manager',
          role: 'Logistic',
          status: 'active',
          profileImage: null,
          notes: 'Manages logistics, transportation, and supply chain operations'
        }
      ];
      
      // Insert sample staff
      for (const staff of sampleStaff) {
        await Staff.create(staff);
      }
      
      console.log(`✅ Inserted ${sampleStaff.length} sample staff members`);
    } else {
      console.log(`Staff table already has ${staffCount} records, skipping sample data insertion`);
      
      // Check if logistic user exists, if not create it
      const [logisticUser] = await pool.execute(
        'SELECT id FROM staff WHERE email = ?',
        ['robert.taylor@company.com']
      );
      
      if (logisticUser.length === 0) {
        console.log('📝 Logistic user not found, creating...');
        const logisticUserData = {
          firstName: 'Robert',
          lastName: 'Taylor',
          email: 'robert.taylor@company.com',
          phone: '+1-555-0111',
          password: 'Password123!',
          departmentId: 6, // Operations
          position: 'Logistics Manager',
          role: 'Logistic',
          status: 'active',
          profileImage: null,
          notes: 'Manages logistics, transportation, and supply chain operations'
        };
        
        await Staff.create(logisticUserData);
        console.log('✅ Logistic user created successfully');
      } else {
        console.log('✅ Logistic user already exists');
      }

      // Check if department director user exists, if not create it
      const { createDepartmentDirectorUser } = await import('./create-department-director-user.js');
      await createDepartmentDirectorUser();
    }
    
    console.log('Staff table initialization completed successfully');
  } catch (error) {
    console.error('Error initializing staff table:', error);
    throw error;
  }
}

export async function initializeStaff() {
  return initializeStaffTable();
}
