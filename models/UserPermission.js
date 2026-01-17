import pool from '../config/db.js';

class UserPermission {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id INT NOT NULL,
        permission_key VARCHAR(255) NOT NULL,
        permission_value ENUM('allow', 'deny', 'inherit') DEFAULT 'inherit',
        granted_by INT NULL,
        granted_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_staff_permission (staff_id, permission_key),
        INDEX idx_staff (staff_id),
        INDEX idx_permission (permission_key),
        INDEX idx_value (permission_value),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('User permissions table created or already exists.');
  }

  static async setPermission({ staffId, permissionKey, permissionValue = 'allow', grantedBy = null, expiresAt = null, notes = null }) {
    // Check if permission already exists
    const [existing] = await pool.execute(
      'SELECT id FROM user_permissions WHERE staff_id = ? AND permission_key = ?',
      [staffId, permissionKey]
    );

    if (existing.length > 0) {
      // Update existing permission
      const [result] = await pool.execute(
        `UPDATE user_permissions 
         SET permission_value = ?, granted_by = ?, expires_at = ?, notes = ?, granted_at = NOW()
         WHERE staff_id = ? AND permission_key = ?`,
        [permissionValue, grantedBy, expiresAt, notes, staffId, permissionKey]
      );
      return result.affectedRows > 0;
    } else {
      // Create new permission
      const [result] = await pool.execute(
        `INSERT INTO user_permissions (staff_id, permission_key, permission_value, granted_by, expires_at, notes, granted_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [staffId, permissionKey, permissionValue, grantedBy, expiresAt, notes]
      );
      return result.insertId;
    }
  }

  static async setMultiplePermissions({ staffId, permissions, grantedBy = null }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const perm of permissions) {
        const { permissionKey, permissionValue = 'allow', expiresAt = null, notes = null } = perm;
        
        const [existing] = await connection.execute(
          'SELECT id FROM user_permissions WHERE staff_id = ? AND permission_key = ?',
          [staffId, permissionKey]
        );

        if (existing.length > 0) {
          await connection.execute(
            `UPDATE user_permissions 
             SET permission_value = ?, granted_by = ?, expires_at = ?, notes = ?, granted_at = NOW()
             WHERE staff_id = ? AND permission_key = ?`,
            [permissionValue, grantedBy, expiresAt, notes, staffId, permissionKey]
          );
        } else {
          await connection.execute(
            `INSERT INTO user_permissions (staff_id, permission_key, permission_value, granted_by, expires_at, notes, granted_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [staffId, permissionKey, permissionValue, grantedBy, expiresAt, notes]
          );
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getPermissionsByStaffId(staffId, includeExpired = false) {
    let query = `
      SELECT up.*, 
             s.first_name as grantor_first_name, s.last_name as grantor_last_name
      FROM user_permissions up
      LEFT JOIN staff s ON up.granted_by = s.id
      WHERE up.staff_id = ?
    `;
    const params = [staffId];

    if (!includeExpired) {
      query += ` AND (up.expires_at IS NULL OR up.expires_at > NOW())`;
    }

    query += ` ORDER BY up.permission_key`;

    const [rows] = await pool.execute(query, params);
    return rows.map(row => ({
      id: row.id,
      staffId: row.staff_id,
      permissionKey: row.permission_key,
      permissionValue: row.permission_value,
      grantedBy: row.granted_by,
      grantorName: row.grantor_first_name && row.grantor_last_name 
        ? `${row.grantor_first_name} ${row.grantor_last_name}` 
        : null,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  static async getPermissionByKey(staffId, permissionKey) {
    const [rows] = await pool.execute(
      `SELECT * FROM user_permissions 
       WHERE staff_id = ? AND permission_key = ? 
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [staffId, permissionKey]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      staffId: row.staff_id,
      permissionKey: row.permission_key,
      permissionValue: row.permission_value,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async checkPermission(staffId, permissionKey) {
    // First check user-specific permission
    const userPerm = await this.getPermissionByKey(staffId, permissionKey);
    
    if (userPerm) {
      return userPerm.permissionValue === 'allow';
    }

    // If no user-specific permission, check role-based permission
    // This would require joining with staff and roles tables
    // For now, return null to indicate inherit from role
    return null;
  }

  static async deletePermission(staffId, permissionKey) {
    const [result] = await pool.execute(
      'DELETE FROM user_permissions WHERE staff_id = ? AND permission_key = ?',
      [staffId, permissionKey]
    );
    return result.affectedRows > 0;
  }

  static async deleteAllPermissionsForStaff(staffId) {
    const [result] = await pool.execute(
      'DELETE FROM user_permissions WHERE staff_id = ?',
      [staffId]
    );
    return result.affectedRows;
  }

  static async getAllPermissions(filters = {}) {
    let query = `
      SELECT up.*, 
             st.first_name as staff_first_name, st.last_name as staff_last_name, st.email as staff_email,
             s.first_name as grantor_first_name, s.last_name as grantor_last_name
      FROM user_permissions up
      LEFT JOIN staff st ON up.staff_id = st.id
      LEFT JOIN staff s ON up.granted_by = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND up.staff_id = ?`;
      params.push(parseInt(filters.staffId));
    }

    if (filters.permissionKey) {
      query += ` AND up.permission_key LIKE ?`;
      params.push(`%${filters.permissionKey}%`);
    }

    if (filters.permissionValue) {
      query += ` AND up.permission_value = ?`;
      params.push(filters.permissionValue);
    }

    if (filters.includeExpired !== true) {
      query += ` AND (up.expires_at IS NULL OR up.expires_at > NOW())`;
    }

    query += ` ORDER BY st.last_name, st.first_name, up.permission_key`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => ({
      id: row.id,
      staffId: row.staff_id,
      staffName: row.staff_first_name && row.staff_last_name 
        ? `${row.staff_first_name} ${row.staff_last_name}` 
        : null,
      staffEmail: row.staff_email,
      permissionKey: row.permission_key,
      permissionValue: row.permission_value,
      grantedBy: row.granted_by,
      grantorName: row.grantor_first_name && row.grantor_last_name 
        ? `${row.grantor_first_name} ${row.grantor_last_name}` 
        : null,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT staff_id) as users_with_permissions,
        SUM(CASE WHEN permission_value = 'allow' THEN 1 ELSE 0 END) as allowed,
        SUM(CASE WHEN permission_value = 'deny' THEN 1 ELSE 0 END) as denied,
        SUM(CASE WHEN permission_value = 'inherit' THEN 1 ELSE 0 END) as inherited
      FROM user_permissions
      WHERE expires_at IS NULL OR expires_at > NOW()
    `);
    return rows[0];
  }
}

export default UserPermission;
