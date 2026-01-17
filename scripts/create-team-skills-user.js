import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import Staff from '../models/Staff.js';

/**
 * Script to create a Team Skills Control Panel admin user
 * This user will have full access to manage staff users and assign them to different control panels
 */

const TEAM_SKILLS_ADMIN = {
  firstName: 'Team',
  lastName: 'Skills Admin',
  email: 'teamskills@hcc.com',
  phone: '+250788123456',
  password: 'TeamSkills@2024', // Change this password after first login
  position: 'Team Skills Administrator',
  role: 'admin', // Admin role for full permissions
  controlPanel: 'team-skills',
  status: 'active',
  notes: 'Team Skills Control Panel Administrator - Full access to staff management and control panel assignments'
};

async function createTeamSkillsAdmin() {
  let connection;
  
  try {
    console.log('🚀 Starting Team Skills Admin user creation...');
    
    // Get database connection
    connection = await pool.getConnection();
    console.log('✅ Database connection established');

    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT id, email, role, control_panel FROM staff WHERE email = ?',
      [TEAM_SKILLS_ADMIN.email]
    );

    if (existing.length > 0) {
      const existingUser = existing[0];
      console.log(`⚠️  User with email ${TEAM_SKILLS_ADMIN.email} already exists:`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Control Panel: ${existingUser.control_panel}`);
      
      // Update existing user to ensure correct settings
      const passwordHash = await bcrypt.hash(TEAM_SKILLS_ADMIN.password, 12);
      await connection.execute(
        `UPDATE staff SET 
          first_name = ?, 
          last_name = ?, 
          phone = ?, 
          password_hash = ?, 
          position = ?, 
          role = ?, 
          control_panel = ?, 
          status = ?, 
          notes = ? 
        WHERE email = ?`,
        [
          TEAM_SKILLS_ADMIN.firstName,
          TEAM_SKILLS_ADMIN.lastName,
          TEAM_SKILLS_ADMIN.phone,
          passwordHash,
          TEAM_SKILLS_ADMIN.position,
          TEAM_SKILLS_ADMIN.role,
          TEAM_SKILLS_ADMIN.controlPanel,
          TEAM_SKILLS_ADMIN.status,
          TEAM_SKILLS_ADMIN.notes,
          TEAM_SKILLS_ADMIN.email
        ]
      );
      
      console.log('✅ Existing user updated with Team Skills admin settings');
      console.log('\n📋 Team Skills Admin Credentials:');
      console.log(`   Email: ${TEAM_SKILLS_ADMIN.email}`);
      console.log(`   Password: ${TEAM_SKILLS_ADMIN.password}`);
      console.log(`   Control Panel: ${TEAM_SKILLS_ADMIN.controlPanel}`);
      console.log(`   Role: ${TEAM_SKILLS_ADMIN.role}`);
      console.log('\n⚠️  Please change the password after first login!');
      return;
    }

    // Get or create a department (use Engineering as default, or create one)
    let departmentId = null;
    const [depts] = await connection.execute('SELECT id FROM departments WHERE name = ? LIMIT 1', ['Engineering']);
    if (depts.length > 0) {
      departmentId = depts[0].id;
    } else {
      // Create Engineering department if it doesn't exist
      const [deptResult] = await connection.execute(
        'INSERT INTO departments (name, department_code, description) VALUES (?, ?, ?)',
        ['Engineering', 'ENG', 'Engineering Department']
      );
      departmentId = deptResult.insertId;
      console.log('✅ Created Engineering department');
    }

    // Create the user using Staff model
    const result = await Staff.create({
      firstName: TEAM_SKILLS_ADMIN.firstName,
      lastName: TEAM_SKILLS_ADMIN.lastName,
      email: TEAM_SKILLS_ADMIN.email,
      phone: TEAM_SKILLS_ADMIN.phone,
      password: TEAM_SKILLS_ADMIN.password,
      departmentId: departmentId,
      position: TEAM_SKILLS_ADMIN.position,
      role: TEAM_SKILLS_ADMIN.role,
      controlPanel: TEAM_SKILLS_ADMIN.controlPanel,
      status: TEAM_SKILLS_ADMIN.status,
      notes: TEAM_SKILLS_ADMIN.notes
    });

    console.log('✅ Team Skills Admin user created successfully!');
    console.log(`   User ID: ${result.id}`);
    console.log('\n📋 Team Skills Admin Credentials:');
    console.log(`   Email: ${TEAM_SKILLS_ADMIN.email}`);
    console.log(`   Password: ${TEAM_SKILLS_ADMIN.password}`);
    console.log(`   Control Panel: ${TEAM_SKILLS_ADMIN.controlPanel}`);
    console.log(`   Role: ${TEAM_SKILLS_ADMIN.role}`);
    console.log(`   Status: ${TEAM_SKILLS_ADMIN.status}`);
    console.log('\n⚠️  IMPORTANT: Please change the password after first login!');
    console.log('\n✨ This user has full access to:');
    console.log('   - Create and manage staff users');
    console.log('   - Assign staff to different control panels');
    console.log('   - Manage departments and roles');
    console.log('   - Access all Team Skills features');

  } catch (error) {
    console.error('❌ Error creating Team Skills Admin user:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Run the script
createTeamSkillsAdmin()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
