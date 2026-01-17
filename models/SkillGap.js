import pool from '../config/db.js';

class SkillGap {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS skill_gaps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        gap_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        department_id INT NULL,
        skill_name VARCHAR(255) NOT NULL,
        skill_category VARCHAR(100) NULL,
        required_level INT NOT NULL,
        current_level INT NULL,
        gap_severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        gap_type ENUM('project', 'department', 'individual') DEFAULT 'project',
        recommended_action TEXT NULL,
        status ENUM('identified', 'in_progress', 'resolved', 'closed') DEFAULT 'identified',
        assigned_to INT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_department (department_id),
        INDEX idx_skill (skill_name),
        INDEX idx_severity (gap_severity),
        INDEX idx_status (status),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Skill gaps table created or already exists.');
  }

  static async generateGapId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM skill_gaps WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `GAP-${year}-${sequence}`;
  }

  static async create({
    gapId, projectId, departmentId, skillName, skillCategory, requiredLevel,
    currentLevel, gapSeverity = 'medium', gapType = 'project', recommendedAction,
    status = 'identified', assignedTo, notes
  }) {
    const gId = gapId || await this.generateGapId();

    const [result] = await pool.execute(
      `INSERT INTO skill_gaps (
        gap_id, project_id, department_id, skill_name, skill_category, required_level,
        current_level, gap_severity, gap_type, recommended_action, status, assigned_to, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gId, projectId || null, departmentId || null, skillName, skillCategory || null,
        requiredLevel, currentLevel || null, gapSeverity, gapType,
        recommendedAction || null, status, assignedTo || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT sg.*, p.name as project_name, p.project_id as project_code,
             d.name as department_name,
             s.first_name as assigned_first_name, s.last_name as assigned_last_name
      FROM skill_gaps sg
      LEFT JOIN projects p ON sg.project_id = p.id
      LEFT JOIN departments d ON sg.department_id = d.id
      LEFT JOIN staff s ON sg.assigned_to = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.projectId) {
      query += ` AND sg.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.departmentId) {
      query += ` AND sg.department_id = ?`;
      params.push(filters.departmentId);
    }

    if (filters.gapType && filters.gapType !== 'all') {
      query += ` AND sg.gap_type = ?`;
      params.push(filters.gapType);
    }

    if (filters.gapSeverity && filters.gapSeverity !== 'all') {
      query += ` AND sg.gap_severity = ?`;
      params.push(filters.gapSeverity);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND sg.status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (sg.skill_name LIKE ? OR p.name LIKE ? OR d.name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY sg.gap_severity DESC, sg.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToGap(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT sg.*, p.name as project_name, p.project_id as project_code,
              d.name as department_name,
              s.first_name as assigned_first_name, s.last_name as assigned_last_name
       FROM skill_gaps sg
       LEFT JOIN projects p ON sg.project_id = p.id
       LEFT JOIN departments d ON sg.department_id = d.id
       LEFT JOIN staff s ON sg.assigned_to = s.id
       WHERE sg.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToGap(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      currentLevel: 'current_level',
      gapSeverity: 'gap_severity',
      recommendedAction: 'recommended_action',
      status: 'status',
      assignedTo: 'assigned_to',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE skill_gaps SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM skill_gaps WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToGap(row) {
    return {
      id: row.gap_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      departmentId: row.department_id,
      departmentName: row.department_name,
      skillName: row.skill_name,
      skillCategory: row.skill_category,
      requiredLevel: row.required_level,
      currentLevel: row.current_level,
      gapSeverity: row.gap_severity,
      gapType: row.gap_type,
      recommendedAction: row.recommended_action,
      status: row.status,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_first_name && row.assigned_last_name
        ? `${row.assigned_first_name} ${row.assigned_last_name}` : null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default SkillGap;
