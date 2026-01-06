import pool from '../config/db.js';

async function checkSuperAdmin() {
  try {
    console.log('Checking SuperAdmin user in database...');

    // Check if SuperAdmin exists
    const [rows] = await pool.execute(
      'SELECT id, first_name, last_name, email, role, status FROM staff WHERE email = ?',
      ['superadmin@hcc.com']
    );

    if (rows.length > 0) {
      const admin = rows[0];
      console.log('✅ SuperAdmin user found:');
      console.log(`   ID: ${admin.id}`);
      console.log(`   Name: ${admin.first_name} ${admin.last_name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Status: ${admin.status}`);
    } else {
      console.log('❌ SuperAdmin user not found');
      console.log('Creating SuperAdmin user...');
      
      // Create SuperAdmin user
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
      
      const [result] = await pool.execute(
        `INSERT INTO staff (
          first_name, 
          last_name, 
          email, 
          phone, 
          password_hash, 
          department_id, 
          position, 
          role, 
          status, 
          profile_image, 
          notes, 
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          'Super',
          'Admin',
          'superadmin@hcc.com',
          '+1-555-0001',
          hashedPassword,
          1, // Assuming department ID 1 exists
          'System Administrator',
          'SuperAdmin',
          'active',
          null,
          'System Super Administrator with full access to all features',
        ]
      );

      console.log('✅ SuperAdmin user created successfully');
      console.log('Email: superadmin@hcc.com');
      console.log('Password: SuperAdmin123!');
      console.log('Role: SuperAdmin');
    }

    // Also check all staff users
    const [allStaff] = await pool.execute(
      'SELECT id, first_name, last_name, email, role, status FROM staff ORDER BY id'
    );
    
    console.log('\n📋 All staff users:');
    allStaff.forEach(staff => {
      console.log(`   ${staff.id}: ${staff.first_name} ${staff.last_name} (${staff.email}) - Role: ${staff.role}, Status: ${staff.status}`);
    });

  } catch (error) {
    console.error('❌ Error checking SuperAdmin:', error);
  } finally {
    await pool.end();
  }
}

checkSuperAdmin();
