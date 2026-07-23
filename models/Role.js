import pool from '../config/db.js';

class Role {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        permissions JSON DEFAULT NULL,
        control_panel VARCHAR(100) NULL,
        is_system TINYINT(1) DEFAULT 0,
        department_id INT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        notes TEXT NULL,
        user_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_roles_department_id (department_id),
        INDEX idx_roles_control_panel (control_panel),
        CONSTRAINT fk_roles_department
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    await this.ensureSchemaColumns();
    console.log('Roles table created or already exists.');
  }

  static async ensureSchemaColumns() {
    const columns = [
      { name: 'control_panel', definition: 'VARCHAR(100) NULL' },
      { name: 'is_system', definition: 'TINYINT(1) DEFAULT 0' },
    ];

    for (const column of columns) {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) as count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'roles'
           AND COLUMN_NAME = ?`,
        [column.name]
      );

      if (rows[0].count === 0) {
        await pool.execute(`ALTER TABLE roles ADD COLUMN ${column.name} ${column.definition}`);
      }
    }

    await pool.execute(`
      UPDATE roles
      SET is_system = 1
      WHERE LOWER(name) IN (
        'administrator', 'admin', 'superadmin', 'project manager', 'department director',
        'employee', 'finance', 'finance analyst', 'financeproject', 'logistic', 'logisticproject', 'driver'
      )
      AND (is_system IS NULL OR is_system = 0)
    `);
  }

  static async create({ name, description, permissions = [], controlPanel = null, isSystem = false, status = 'active', notes }) {
    const [result] = await pool.execute(
      'INSERT INTO roles (name, description, permissions, control_panel, is_system, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, JSON.stringify(permissions), controlPanel || null, isSystem ? 1 : 0, status, notes]
    );
    return { id: result.insertId, name, description, permissions, controlPanel, isSystem, status, notes };
  }

  static async findAll(filters = {}) {
    let connection = await pool.getConnection();
    let connectionReleased = false;
    try {
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

      // MariaDB rejects prepared LIMIT/OFFSET placeholders — interpolate safe integers.
      const limit = Number.parseInt(filters.limit, 10);
      const offset = Number.parseInt(filters.offset, 10);
      if (Number.isFinite(limit) && limit > 0) {
        query += ` LIMIT ${limit}`;
      }
      if (Number.isFinite(offset) && offset > 0) {
        query += ` OFFSET ${offset}`;
      }

      const [rows] = await connection.execute(query, params);
      connection.release();
      connectionReleased = true;
      
      return rows.map(row => ({
        ...row,
        permissions: row.permissions ? JSON.parse(row.permissions) : [],
        controlPanel: row.control_panel || null,
        isSystem: Boolean(row.is_system),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      // If connection error, try once more with a new connection
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'PROTOCOL_ENQUEUE_AFTER_QUIT' || error.code === 'ECONNREFUSED') {
        try {
          if (!connectionReleased) {
            connection.release();
            connectionReleased = true;
          }
          connection = await pool.getConnection();
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

          // MariaDB rejects prepared LIMIT/OFFSET placeholders — interpolate safe integers.
          const limit = Number.parseInt(filters.limit, 10);
          const offset = Number.parseInt(filters.offset, 10);
          if (Number.isFinite(limit) && limit > 0) {
            query += ` LIMIT ${limit}`;
          }
          if (Number.isFinite(offset) && offset > 0) {
            query += ` OFFSET ${offset}`;
          }

          const [rows] = await connection.execute(query, params);
          connection.release();
          connectionReleased = true;
          
          return rows.map(row => ({
            ...row,
            permissions: row.permissions ? JSON.parse(row.permissions) : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
        } catch (retryError) {
          if (!connectionReleased) {
            connection.release();
          }
          throw retryError;
        }
      }
      if (!connectionReleased) {
        connection.release();
      }
      throw error;
    }
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
      controlPanel: row.control_panel || null,
      isSystem: Boolean(row.is_system),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async findByName(name) {
    if (!name) return null;
    const [rows] = await pool.execute(
      `SELECT r.* FROM roles r WHERE LOWER(TRIM(r.name)) = LOWER(TRIM(?)) LIMIT 1`,
      [name]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      ...row,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      controlPanel: row.control_panel || null,
      isSystem: Boolean(row.is_system),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async countStaffByRoleName(roleName) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM staff WHERE LOWER(TRIM(role)) = LOWER(TRIM(?))',
      [roleName]
    );
    return rows[0]?.count || 0;
  }

  static async update(id, { name, description, permissions, controlPanel, isSystem, status, notes }) {
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
    if (controlPanel !== undefined) {
      updateFields.push('control_panel = ?');
      params.push(controlPanel || null);
    }
    if (isSystem !== undefined) {
      updateFields.push('is_system = ?');
      params.push(isSystem ? 1 : 0);
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
    let connection = await pool.getConnection();
    let connectionReleased = false;
    try {
      const [rows] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
        FROM roles
      `);
      connection.release();
      connectionReleased = true;
      return rows[0];
    } catch (error) {
      // If connection error, try once more with a new connection
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'PROTOCOL_ENQUEUE_AFTER_QUIT' || error.code === 'ECONNREFUSED') {
        try {
          if (!connectionReleased) {
            connection.release();
            connectionReleased = true;
          }
          connection = await pool.getConnection();
          const [rows] = await connection.execute(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
              SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
            FROM roles
          `);
          connection.release();
          connectionReleased = true;
          return rows[0];
        } catch (retryError) {
          if (!connectionReleased) {
            connection.release();
          }
          throw retryError;
        }
      }
      if (!connectionReleased) {
        connection.release();
      }
      throw error;
    }
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
