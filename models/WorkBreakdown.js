import pool from '../config/db.js';

class WorkBreakdown {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS work_breakdown (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wbs_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NOT NULL,
        parent_id INT NULL,
        level INT NOT NULL DEFAULT 1,
        task VARCHAR(500) NOT NULL,
        assignee_id INT NULL,
        assignee_name VARCHAR(255) NULL,
        duration_days INT NULL,
        duration_display VARCHAR(50) NULL,
        status ENUM('Pending', 'In Progress', 'Completed', 'On Hold') DEFAULT 'Pending',
        progress INT DEFAULT 0,
        description TEXT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_parent (parent_id),
        INDEX idx_level (level),
        INDEX idx_status (status),
        INDEX idx_assignee (assignee_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES work_breakdown(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Work breakdown table created or already exists.');
  }

  static async generateWBSId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM work_breakdown WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `WBS-${year}-${sequence}`;
  }

  static async create({
    wbsId, projectId, parentId, level, task, assigneeId, assigneeName,
    durationDays, durationDisplay, status = 'Pending', progress = 0,
    description, startDate, endDate, createdBy, createdByName, notes
  }) {
    const wId = wbsId || await this.generateWBSId();

    const [result] = await pool.execute(
      `INSERT INTO work_breakdown (
        wbs_id, project_id, parent_id, level, task, assignee_id, assignee_name,
        duration_days, duration_display, status, progress, description,
        start_date, end_date, created_by, created_by_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wId, projectId, parentId || null, level || 1, task,
        assigneeId || null, assigneeName || null,
        durationDays || null, durationDisplay || null, status, progress || 0,
        description || null, startDate || null, endDate || null,
        createdBy || null, createdByName || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT wb.*, p.name as project_name, p.project_id as project_code,
             s.first_name as assignee_first_name, s.last_name as assignee_last_name,
             c.first_name as creator_first_name, c.last_name as creator_last_name
      FROM work_breakdown wb
      LEFT JOIN projects p ON wb.project_id = p.id
      LEFT JOIN staff s ON wb.assignee_id = s.id
      LEFT JOIN staff c ON wb.created_by = c.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.projectId) {
      query += ` AND wb.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        query += ` AND wb.parent_id IS NULL`;
      } else {
        query += ` AND wb.parent_id = ?`;
        params.push(filters.parentId);
      }
    }

    if (filters.level) {
      query += ` AND wb.level = ?`;
      params.push(filters.level);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND wb.status = ?`;
      params.push(filters.status);
    }

    if (filters.assigneeId) {
      query += ` AND wb.assignee_id = ?`;
      params.push(filters.assigneeId);
    }

    if (filters.search) {
      query += ` AND (wb.task LIKE ? OR wb.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY wb.level ASC, wb.created_at ASC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToWBS(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT wb.*, p.name as project_name, p.project_id as project_code,
              s.first_name as assignee_first_name, s.last_name as assignee_last_name,
              c.first_name as creator_first_name, c.last_name as creator_last_name
       FROM work_breakdown wb
       LEFT JOIN projects p ON wb.project_id = p.id
       LEFT JOIN staff s ON wb.assignee_id = s.id
       LEFT JOIN staff c ON wb.created_by = c.id
       WHERE wb.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToWBS(rows[0]);
  }

  static async findByWBSId(wbsId) {
    const [rows] = await pool.execute(
      `SELECT wb.*, p.name as project_name, p.project_id as project_code,
              s.first_name as assignee_first_name, s.last_name as assignee_last_name,
              c.first_name as creator_first_name, c.last_name as creator_last_name
       FROM work_breakdown wb
       LEFT JOIN projects p ON wb.project_id = p.id
       LEFT JOIN staff s ON wb.assignee_id = s.id
       LEFT JOIN staff c ON wb.created_by = c.id
       WHERE wb.wbs_id = ?`,
      [wbsId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToWBS(rows[0]);
  }

  static async update(id, updateData) {
    const allowedFields = [
      'parent_id', 'level', 'task', 'assignee_id', 'assignee_name',
      'duration_days', 'duration_display', 'status', 'progress',
      'description', 'start_date', 'end_date', 'notes'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        const dbField = field;
        updates.push(`${dbField} = ?`);
        values.push(updateData[field]);
      }
    }

    if (updates.length === 0) return false;

    values.push(id);

    const [result] = await pool.execute(
      `UPDATE work_breakdown SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    // Check if this item has children
    const [children] = await pool.execute(
      'SELECT COUNT(*) as count FROM work_breakdown WHERE parent_id = ?',
      [id]
    );
    
    if (children[0].count > 0) {
      throw new Error('Cannot delete work breakdown item with child items. Please delete children first.');
    }

    const [result] = await pool.execute('DELETE FROM work_breakdown WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToWBS(row) {
    return {
      id: row.wbs_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      parentId: row.parent_id,
      level: row.level,
      task: row.task,
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_name || (row.assignee_first_name && row.assignee_last_name
        ? `${row.assignee_first_name} ${row.assignee_last_name}` : null),
      durationDays: row.duration_days,
      durationDisplay: row.duration_display,
      status: row.status,
      progress: row.progress,
      description: row.description,
      startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : null,
      endDate: row.end_date ? row.end_date.toISOString().split('T')[0] : null,
      createdBy: row.created_by,
      createdByName: row.created_by_name || (row.creator_first_name && row.creator_last_name
        ? `${row.creator_first_name} ${row.creator_last_name}` : null),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default WorkBreakdown;
