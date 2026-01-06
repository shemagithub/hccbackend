import pool from '../config/db.js';

class FieldTask {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS field_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        field_task_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NOT NULL,
        task VARCHAR(500) NOT NULL,
        description TEXT NULL,
        requested_by INT NULL,
        requested_by_name VARCHAR(255) NULL,
        assigned_to INT NULL,
        assigned_to_name VARCHAR(255) NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
        required_date DATE NOT NULL,
        completed_date DATE NULL,
        location VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_required_date (required_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (requested_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Field tasks table created or already exists.');
  }

  static async generateFieldTaskId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM field_tasks WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `FTASK-${year}-${sequence}`;
  }

  static async create({
    fieldTaskId,
    projectId,
    task,
    description,
    requestedBy,
    requestedByName,
    assignedTo,
    assignedToName,
    priority = 'medium',
    status = 'pending',
    requiredDate,
    completedDate,
    location,
    notes
  }) {
    const ftId = fieldTaskId || await this.generateFieldTaskId();

    const [result] = await pool.execute(
      `INSERT INTO field_tasks (
        field_task_id, project_id, task, description, requested_by, requested_by_name,
        assigned_to, assigned_to_name, priority, status, required_date, completed_date, location, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ftId, projectId, task, description || null, requestedBy || null, requestedByName || null,
        assignedTo || null, assignedToName || null, priority, status, requiredDate,
        completedDate || null, location || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT f.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as requester_first_name, s1.last_name as requester_last_name,
             s2.first_name as assignee_first_name, s2.last_name as assignee_last_name
      FROM field_tasks f
      LEFT JOIN projects p ON f.project_id = p.id
      LEFT JOIN staff s1 ON f.requested_by = s1.id
      LEFT JOIN staff s2 ON f.assigned_to = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (f.task LIKE ? OR f.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND f.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND f.status = ?`;
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ` AND f.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.overdue) {
      query += ` AND f.required_date < CURDATE() AND f.status NOT IN ('completed', 'cancelled')`;
    }

    query += ` ORDER BY f.required_date ASC, f.priority DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToFieldTask(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT f.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as requester_first_name, s1.last_name as requester_last_name,
              s2.first_name as assignee_first_name, s2.last_name as assignee_last_name
       FROM field_tasks f
       LEFT JOIN projects p ON f.project_id = p.id
       LEFT JOIN staff s1 ON f.requested_by = s1.id
       LEFT JOIN staff s2 ON f.assigned_to = s2.id
       WHERE f.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToFieldTask(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      task: 'task',
      description: 'description',
      assignedTo: 'assigned_to',
      assignedToName: 'assigned_to_name',
      priority: 'priority',
      status: 'status',
      requiredDate: 'required_date',
      completedDate: 'completed_date',
      location: 'location',
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
      `UPDATE field_tasks SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM field_tasks WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN required_date < CURDATE() AND status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as overdue
      FROM field_tasks
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToFieldTask(row) {
    return {
      id: row.field_task_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      task: row.task,
      description: row.description,
      requestedBy: row.requested_by,
      requestedByName: row.requested_by_name || (row.requester_first_name && row.requester_last_name
        ? `${row.requester_first_name} ${row.requester_last_name}` : null),
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name || (row.assignee_first_name && row.assignee_last_name
        ? `${row.assignee_first_name} ${row.assignee_last_name}` : null),
      priority: row.priority,
      status: row.status,
      requiredDate: row.required_date ? row.required_date.toISOString().split('T')[0] : null,
      completedDate: row.completed_date ? row.completed_date.toISOString().split('T')[0] : null,
      location: row.location,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default FieldTask;

