import pool from '../config/db.js';
import bcrypt from 'bcrypt';

class Staff {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20) NULL,
        password_hash VARCHAR(255) NOT NULL,
        department_id INT NULL,
        position VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        control_panel VARCHAR(100) NULL,
        status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
        profile_image TEXT NULL,
        notes TEXT NULL,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      )
    `;
    await pool.execute(query);
    console.log('Staff table created or already exists.');
  }

  static async create({ firstName, lastName, email, phone, password, departmentId, position, role, controlPanel, status = 'pending', profileImage, notes }) {
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);


    const [result] = await pool.execute(
      'INSERT INTO staff (first_name, last_name, email, phone, password_hash, department_id, position, role, control_panel, status, profile_image, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [firstName, lastName, email, phone || null, passwordHash, departmentId || null, position, role, controlPanel || null, status, profileImage || null, notes || null]
    );
    return { id: result.insertId, firstName, lastName, email, phone, departmentId, position, role, controlPanel, status, profileImage, notes };
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT s.*, d.name as department_name, d.department_code
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
    `;
    
    const conditions = [];
    const params = [];

    if (filters.search) {
      conditions.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR s.position LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.role) {
      conditions.push('s.role = ?');
      params.push(filters.role);
    }

    if (filters.status) {
      conditions.push('s.status = ?');
      params.push(filters.status);
    }

    if (filters.departmentId) {
      conditions.push('s.department_id = ?');
      params.push(filters.departmentId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      department: row.department_name || '',
      departmentId: row.department_id,
      departmentName: row.department_name,
      departmentCode: row.department_code,
      position: row.position,
      role: row.role,
      controlPanel: row.control_panel,
      status: row.status,
      profileImage: row.profile_image,
      avatar: row.profile_image, // For backward compatibility
      notes: row.notes,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  static async findById(id) {
    const [rows] = await pool.execute(`
      SELECT s.*, d.name as department_name, d.department_code
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `, [id]);
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      department: row.department_name || '',
      departmentId: row.department_id,
      departmentName: row.department_name,
      departmentCode: row.department_code,
      position: row.position,
      role: row.role,
      controlPanel: row.control_panel,
      status: row.status,
      profileImage: row.profile_image,
      avatar: row.profile_image, // For backward compatibility
      notes: row.notes,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Password information
      hasPassword: !!row.password_hash,
      passwordLastChanged: row.password_hash ? row.created_at : null, // Approximate based on creation date
      passwordStrength: row.password_hash ? 'Strong' : 'Not Set'
    };
  }

  static async findByEmail(email) {
    const [rows] = await pool.execute(`
      SELECT s.*, d.name as department_name, d.department_code
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.email = ?
    `, [email]);
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      department: row.department_name || '',
      departmentId: row.department_id,
      departmentName: row.department_name,
      departmentCode: row.department_code,
      position: row.position,
      role: row.role,
      controlPanel: row.control_panel,
      status: row.status,
      profileImage: row.profile_image,
      avatar: row.profile_image, // For backward compatibility
      notes: row.notes,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      passwordHash: row.password_hash // Include for authentication
    };
  }

  static async update(id, { firstName, lastName, email, phone, password, departmentId, position, role, controlPanel, status, profileImage, notes }) {
    const updateFields = [];
    const params = [];

    if (firstName !== undefined) {
      updateFields.push('first_name = ?');
      params.push(firstName);
    }
    if (lastName !== undefined) {
      updateFields.push('last_name = ?');
      params.push(lastName);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    if (password !== undefined) {
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      updateFields.push('password_hash = ?');
      params.push(passwordHash);
    }
    if (departmentId !== undefined) {
      updateFields.push('department_id = ?');
      params.push(departmentId);
    }
    if (position !== undefined) {
      updateFields.push('position = ?');
      params.push(position);
    }
    if (role !== undefined) {
      updateFields.push('role = ?');
      params.push(role);
    }
    if (controlPanel !== undefined) {
      updateFields.push('control_panel = ?');
      // Convert empty string to null for database consistency
      params.push(controlPanel === '' || controlPanel === null ? null : controlPanel);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    if (profileImage !== undefined) {
      updateFields.push('profile_image = ?');
      params.push(profileImage);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE staff SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM staff WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        COUNT(DISTINCT role) as uniqueRoles,
        COUNT(DISTINCT department_id) as uniqueDepartments
      FROM staff
    `);
    return rows[0];
  }

  static async getStatsByRole() {
    const [rows] = await pool.execute(`
      SELECT role, COUNT(*) as count
      FROM staff
      GROUP BY role
    `);
    return rows.reduce((acc, row) => {
      acc[row.role] = row.count;
      return acc;
    }, {});
  }

  static async getStatsByDepartment() {
    const [rows] = await pool.execute(`
      SELECT d.name as department, COUNT(s.id) as count
      FROM departments d
      LEFT JOIN staff s ON d.id = s.department_id
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `);
    return rows.reduce((acc, row) => {
      acc[row.department || 'No Department'] = row.count;
      return acc;
    }, {});
  }

  static async emailExists(email, excludeId = null) {
    let query = 'SELECT id FROM staff WHERE email = ?';
    const params = [email];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    const [rows] = await pool.execute(query, params);
    return rows.length > 0;
  }

  static async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  static async updateLastLogin(id) {
    await pool.execute('UPDATE staff SET last_login = NOW() WHERE id = ?', [id]);
  }

  static async resetPassword(id, newPassword) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    await pool.execute(
      'UPDATE staff SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [passwordHash, id]
    );
    
    return { success: true, message: 'Password reset successfully' };
  }
}

export default Staff;
