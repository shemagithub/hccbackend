import pool from '../config/db.js';

class Role {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        permissions JSON DEFAULT NULL,
        department_id INT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        notes TEXT NULL,
        user_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      )
    `;
    await pool.execute(query);
    console.log('Roles table created or already exists.');
  }

  static async create({ name, description, permissions = [], status = 'active', notes }) {
    const [result] = await pool.execute(
      'INSERT INTO roles (name, description, permissions, status, notes) VALUES (?, ?, ?, ?, ?)',
      [name, description, JSON.stringify(permissions), status, notes]
    );
    return { id: result.insertId, name, description, permissions, status, notes };
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT r.*
      FROM roles r
    `;
    
    const conditions = [];
    const params = [];

    if (filters.search) {
      conditions.push('(r.name LIKE ? OR r.description LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.status) {
      conditions.push('r.status = ?');
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY r.created_at DESC';

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
      ...row,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT r.* FROM roles r WHERE r.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      ...row,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async update(id, { name, description, permissions, status, notes }) {
    const updateFields = [];
    const params = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      params.push(description);
    }
    if (permissions !== undefined) {
      updateFields.push('permissions = ?');
      params.push(JSON.stringify(permissions));
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE roles SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM roles WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
      FROM roles
    `);
    return rows[0];
  }

  static async nameExists(name, excludeId = null) {
    let query = 'SELECT id FROM roles WHERE name = ?';
    const params = [name];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    const [rows] = await pool.execute(query, params);
    return rows.length > 0;
  }

  static async updateUserCount(roleId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE role_id = ?',
      [roleId]
    );
    const userCount = rows[0].count;
    
    await pool.execute(
      'UPDATE roles SET user_count = ? WHERE id = ?',
      [userCount, roleId]
    );
    
    return userCount;
  }
}

export default Role;
