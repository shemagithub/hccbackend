import pool from '../config/db.js';

class Milestone {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS milestones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        milestone_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        name VARCHAR(500) NOT NULL,
        description TEXT NULL,
        phase VARCHAR(255) NULL,
        target_date DATE NOT NULL,
        actual_date DATE NULL,
        status ENUM('pending', 'in_progress', 'completed', 'delayed', 'cancelled') DEFAULT 'pending',
        progress INT DEFAULT 0,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_target_date (target_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Milestones table created or already exists.');
  }

  static async generateMilestoneId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM milestones WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(3, '0');
    return `MIL-${year}-${sequence}`;
  }

  static async create({
    milestoneId,
    projectId,
    name,
    description,
    phase,
    targetDate,
    actualDate,
    status = 'pending',
    progress = 0,
    createdBy,
    createdByName,
    notes
  }) {
    const mId = milestoneId || await this.generateMilestoneId();

    const [result] = await pool.execute(
      `INSERT INTO milestones (
        milestone_id, project_id, name, description, phase, target_date, actual_date,
        status, progress, created_by, created_by_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mId, projectId || null, name, description || null, phase || null,
        targetDate, actualDate || null, status, progress,
        createdBy || null, createdByName || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `SELECT m.*, p.name as project_name, p.project_id as project_code
                 FROM milestones m
                 LEFT JOIN projects p ON m.project_id = p.id
                 WHERE 1=1`;
    const params = [];

    if (filters.projectId) {
      query += ` AND m.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND m.status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (m.name LIKE ? OR m.description LIKE ? OR p.name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY m.target_date ASC, m.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToMilestone(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT m.*, p.name as project_name, p.project_id as project_code
       FROM milestones m
       LEFT JOIN projects p ON m.project_id = p.id
       WHERE m.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRowToMilestone(rows[0]);
  }

  static async findByMilestoneId(milestoneId) {
    const [rows] = await pool.execute(
      `SELECT m.*, p.name as project_name, p.project_id as project_code
       FROM milestones m
       LEFT JOIN projects p ON m.project_id = p.id
       WHERE m.milestone_id = ?`,
      [milestoneId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToMilestone(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      name: 'name',
      description: 'description',
      phase: 'phase',
      targetDate: 'target_date',
      actualDate: 'actual_date',
      status: 'status',
      progress: 'progress',
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
      `UPDATE milestones SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM milestones WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToMilestone(row) {
    return {
      id: row.id,
      milestoneId: row.milestone_id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      name: row.name,
      description: row.description,
      phase: row.phase,
      targetDate: row.target_date,
      actualDate: row.actual_date,
      status: row.status,
      progress: row.progress,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async getStats(filters = {}) {
    let query = `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed
    FROM milestones WHERE 1=1`;
    const params = [];

    if (filters.projectId) {
      query += ` AND project_id = ?`;
      params.push(filters.projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }
}

export default Milestone;
