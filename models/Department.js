import pool from '../config/db.js';

class Department {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    await pool.execute(query);
    console.log('Departments table created or already exists.');
  }

  static async create({ name, description, departmentCode, location, budget, phone, email, website, status = 'active', notes }) {
    const [result] = await pool.execute(
      'INSERT INTO departments (name, description, department_code, location, budget, phone, email, website, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, description, departmentCode, location, budget, phone, email, website, status, notes]
    );
    return { id: result.insertId, name, description, departmentCode, location, budget, phone, email, website, status, notes };
  }

  static async findAll(filters = {}) {
    let query = 'SELECT * FROM departments';
    
    const conditions = [];
    const params = [];

    if (filters.search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR department_code LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.location) {
      conditions.push('location LIKE ?');
      params.push(`%${filters.location}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

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
      departmentCode: row.department_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM departments WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      ...row,
      departmentCode: row.department_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async update(id, { name, description, departmentCode, location, budget, phone, email, website, status, notes }) {
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
    if (departmentCode !== undefined) {
      updateFields.push('department_code = ?');
      params.push(departmentCode);
    }
    if (location !== undefined) {
      updateFields.push('location = ?');
      params.push(location);
    }
    if (budget !== undefined) {
      updateFields.push('budget = ?');
      params.push(budget);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email);
    }
    if (website !== undefined) {
      updateFields.push('website = ?');
      params.push(website);
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
      `UPDATE departments SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(COALESCE(budget, 0)) as totalBudget
      FROM departments
    `);
    return rows[0];
  }

  static async codeExists(code, excludeId = null) {
    let query = 'SELECT id FROM departments WHERE department_code = ?';
    const params = [code];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    const [rows] = await pool.execute(query, params);
    return rows.length > 0;
  }
}

export default Department;