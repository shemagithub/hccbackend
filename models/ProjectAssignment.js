import pool from '../config/db.js';

class ProjectAssignment {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS project_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assignment_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NOT NULL,
        staff_id INT NOT NULL,
        role VARCHAR(255) NULL,
        allocation_percentage DECIMAL(5,2) DEFAULT 100.00,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        status ENUM('active', 'completed', 'cancelled', 'pending') DEFAULT 'active',
        skills_required TEXT NULL,
        skills_assigned TEXT NULL,
        notes TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_staff (staff_id),
        INDEX idx_status (status),
        INDEX idx_start_date (start_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Project assignments table created or already exists.');
  }

  static async generateAssignmentId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM project_assignments WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `PA-${year}-${sequence}`;
  }

  static async create({
    assignmentId, projectId, staffId, role, allocationPercentage = 100.00,
    startDate, endDate, status = 'active', skillsRequired, skillsAssigned, notes, createdBy
  }) {
    const aId = assignmentId || await this.generateAssignmentId();

    const [result] = await pool.execute(
      `INSERT INTO project_assignments (
        assignment_id, project_id, staff_id, role, allocation_percentage,
        start_date, end_date, status, skills_required, skills_assigned, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        aId, projectId, staffId, role || null, allocationPercentage,
        startDate, endDate || null, status,
        skillsRequired ? JSON.stringify(skillsRequired) : null,
        skillsAssigned ? JSON.stringify(skillsAssigned) : null,
        notes || null, createdBy || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT pa.*, p.name as project_name, p.project_id as project_code, p.status as project_status,
             s.first_name, s.last_name, s.email, s.position, s.department_id,
             d.name as department_name
      FROM project_assignments pa
      LEFT JOIN projects p ON pa.project_id = p.id
      LEFT JOIN staff s ON pa.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND pa.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.projectId) {
      query += ` AND pa.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND pa.status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (p.name LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY pa.start_date DESC, p.name`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToAssignment(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT pa.*, p.name as project_name, p.project_id as project_code, p.status as project_status,
              s.first_name, s.last_name, s.email, s.position, s.department_id,
              d.name as department_name
       FROM project_assignments pa
       LEFT JOIN projects p ON pa.project_id = p.id
       LEFT JOIN staff s ON pa.staff_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE pa.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToAssignment(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      role: 'role',
      allocationPercentage: 'allocation_percentage',
      startDate: 'start_date',
      endDate: 'end_date',
      status: 'status',
      skillsRequired: 'skills_required',
      skillsAssigned: 'skills_assigned',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'skillsRequired' || key === 'skillsAssigned') {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key] ? JSON.stringify(updateData[key]) : null);
        } else {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE project_assignments SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM project_assignments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToAssignment(row) {
    return {
      id: row.assignment_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      projectStatus: row.project_status,
      staffId: row.staff_id,
      staffName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      staffEmail: row.email,
      staffPosition: row.position,
      departmentId: row.department_id,
      departmentName: row.department_name,
      role: row.role,
      allocationPercentage: row.allocation_percentage ? parseFloat(row.allocation_percentage) : 100,
      startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : null,
      endDate: row.end_date ? row.end_date.toISOString().split('T')[0] : null,
      status: row.status,
      skillsRequired: row.skills_required ? JSON.parse(row.skills_required) : [],
      skillsAssigned: row.skills_assigned ? JSON.parse(row.skills_assigned) : [],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default ProjectAssignment;
