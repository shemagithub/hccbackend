import pool from '../config/db.js';
import bcrypt from 'bcrypt';

async function createSuperAdmin() {
  try {
    console.log('Creating SuperAdmin user...');

    // Check if SuperAdmin already exists
    const [existingAdmin] = await pool.execute(
      'SELECT id FROM staff WHERE email = ?',
      ['superadmin@hcc.com']
    );

    if (existingAdmin.length > 0) {
      console.log('SuperAdmin user already exists');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);

    // Create SuperAdmin user
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

  } catch (error) {
    console.error('❌ Error creating SuperAdmin user:', error);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();
