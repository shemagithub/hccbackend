import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import Staff from '../models/Staff.js';

const RECEPTIONIST_USER = {
  firstName: 'Front',
  lastName: 'Desk',
  email: 'receptionist@hcc.com',
  phone: '+250788654321',
  password: 'Reception@2024',
  position: 'Receptionist',
  role: 'Receptionist',
  controlPanel: 'receptionist',
  status: 'active',
  notes: 'Receptionist Control Panel — visitors, appointments, call log',
};

async function createReceptionistUser() {
  let connection;

  try {
    console.log('🚀 Creating Receptionist user...');
    connection = await pool.getConnection();

    const [existing] = await connection.execute(
      'SELECT id, email, role, control_panel FROM staff WHERE email = ?',
      [RECEPTIONIST_USER.email]
    );

    if (existing.length > 0) {
      const passwordHash = await bcrypt.hash(RECEPTIONIST_USER.password, 12);
      await connection.execute(
        `UPDATE staff SET
          first_name = ?, last_name = ?, phone = ?, password_hash = ?,
          position = ?, role = ?, control_panel = ?, status = ?, notes = ?
        WHERE email = ?`,
        [
          RECEPTIONIST_USER.firstName,
          RECEPTIONIST_USER.lastName,
          RECEPTIONIST_USER.phone,
          passwordHash,
          RECEPTIONIST_USER.position,
          RECEPTIONIST_USER.role,
          RECEPTIONIST_USER.controlPanel,
          RECEPTIONIST_USER.status,
          RECEPTIONIST_USER.notes,
          RECEPTIONIST_USER.email,
        ]
      );
      console.log('✅ Updated existing receptionist user');
    } else {
      let departmentId = null;
      const [depts] = await connection.execute(
        'SELECT id FROM departments WHERE name = ? LIMIT 1',
        ['Administration']
      );
      if (depts.length > 0) {
        departmentId = depts[0].id;
      } else {
        const [deptResult] = await connection.execute(
          'INSERT INTO departments (name, department_code, description) VALUES (?, ?, ?)',
          ['Administration', 'ADM', 'Administration & Front Office']
        );
        departmentId = deptResult.insertId;
      }

      await Staff.create({
        firstName: RECEPTIONIST_USER.firstName,
        lastName: RECEPTIONIST_USER.lastName,
        email: RECEPTIONIST_USER.email,
        phone: RECEPTIONIST_USER.phone,
        password: RECEPTIONIST_USER.password,
        departmentId,
        position: RECEPTIONIST_USER.position,
        role: RECEPTIONIST_USER.role,
        controlPanel: RECEPTIONIST_USER.controlPanel,
        status: RECEPTIONIST_USER.status,
        notes: RECEPTIONIST_USER.notes,
      });
      console.log('✅ Receptionist user created');
    }

    console.log('\n📋 Receptionist login:');
    console.log(`   Email: ${RECEPTIONIST_USER.email}`);
    console.log(`   Password: ${RECEPTIONIST_USER.password}`);
    console.log(`   Control Panel: ${RECEPTIONIST_USER.controlPanel}`);
    console.log(`   Portal URL: /receptionist/dashboard`);
  } finally {
    if (connection) connection.release();
  }
}

createReceptionistUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
