import pool from '../config/db.js';

class ActionItem {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS action_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action_item_id VARCHAR(50) NOT NULL UNIQUE,
        meeting_id INT NULL,
        minutes_id INT NULL,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        assigned_to INT NULL,
        assigned_to_name VARCHAR(255) NULL,
        assigned_date DATE NULL,
        due_date DATE NULL,
        completed_date DATE NULL,
        status ENUM('open', 'in_progress', 'completed', 'cancelled', 'on_hold') DEFAULT 'open',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        completion_percentage INT DEFAULT 0,
        notes TEXT NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_meeting (meeting_id),
        INDEX idx_minutes (minutes_id),
        INDEX idx_project (project_id),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date),
        INDEX idx_priority (priority),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL,
        FOREIGN KEY (minutes_id) REFERENCES meeting_minutes(id) ON DELETE SET NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Action items table created or already exists.');
  }

  static async generateActionItemId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM action_items WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `ACT-${year}-${sequence}`;
  }

  static async create({
    actionItemId,
    meetingId,
    minutesId,
    projectId,
    title,
    description,
    assignedTo,
    assignedToName,
    assignedDate,
    dueDate,
    status = 'open',
    priority = 'medium',
    completionPercentage = 0,
    notes,
    createdBy,
    createdByName
  }) {
    const aId = actionItemId || await this.generateActionItemId();

    const [result] = await pool.execute(
      `INSERT INTO action_items (
        action_item_id, meeting_id, minutes_id, project_id, title, description,
        assigned_to, assigned_to_name, assigned_date, due_date, status, priority,
        completion_percentage, notes, created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        aId, meetingId || null, minutesId || null, projectId || null, title, description || null,
        assignedTo || null, assignedToName || null, assignedDate || null, dueDate || null,
        status, priority, completionPercentage, notes || null, createdBy || null, createdByName || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT ai.*, m.title as meeting_title, m.meeting_id as meeting_reference,
             mm.title as minutes_title, mm.minutes_id as minutes_reference,
             p.name as project_name, p.project_id as project_code,
             s1.first_name as assignee_first_name, s1.last_name as assignee_last_name,
             s2.first_name as creator_first_name, s2.last_name as creator_last_name
      FROM action_items ai
      LEFT JOIN meetings m ON ai.meeting_id = m.id
      LEFT JOIN meeting_minutes mm ON ai.minutes_id = mm.id
      LEFT JOIN projects p ON ai.project_id = p.id
      LEFT JOIN staff s1 ON ai.assigned_to = s1.id
      LEFT JOIN staff s2 ON ai.created_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (ai.title LIKE ? OR ai.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.meetingId) {
      query += ` AND ai.meeting_id = ?`;
      params.push(filters.meetingId);
    }

    if (filters.minutesId) {
      query += ` AND ai.minutes_id = ?`;
      params.push(filters.minutesId);
    }

    if (filters.projectId) {
      query += ` AND ai.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.assignedTo) {
      query += ` AND ai.assigned_to = ?`;
      params.push(filters.assignedTo);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND ai.status = ?`;
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ` AND ai.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.overdue) {
      query += ` AND ai.due_date < CURDATE() AND ai.status NOT IN ('completed', 'cancelled')`;
    }

    query += ` ORDER BY ai.due_date ASC, ai.priority DESC, ai.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToActionItem(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ai.*, m.title as meeting_title, m.meeting_id as meeting_reference,
              mm.title as minutes_title, mm.minutes_id as minutes_reference,
              p.name as project_name, p.project_id as project_code,
              s1.first_name as assignee_first_name, s1.last_name as assignee_last_name,
              s2.first_name as creator_first_name, s2.last_name as creator_last_name
       FROM action_items ai
       LEFT JOIN meetings m ON ai.meeting_id = m.id
       LEFT JOIN meeting_minutes mm ON ai.minutes_id = mm.id
       LEFT JOIN projects p ON ai.project_id = p.id
       LEFT JOIN staff s1 ON ai.assigned_to = s1.id
       LEFT JOIN staff s2 ON ai.created_by = s2.id
       WHERE ai.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToActionItem(rows[0]);
  }

  static async findByActionItemId(actionItemId) {
    const [rows] = await pool.execute(
      `SELECT ai.*, m.title as meeting_title, m.meeting_id as meeting_reference,
              mm.title as minutes_title, mm.minutes_id as minutes_reference,
              p.name as project_name, p.project_id as project_code,
              s1.first_name as assignee_first_name, s1.last_name as assignee_last_name,
              s2.first_name as creator_first_name, s2.last_name as creator_last_name
       FROM action_items ai
       LEFT JOIN meetings m ON ai.meeting_id = m.id
       LEFT JOIN meeting_minutes mm ON ai.minutes_id = mm.id
       LEFT JOIN projects p ON ai.project_id = p.id
       LEFT JOIN staff s1 ON ai.assigned_to = s1.id
       LEFT JOIN staff s2 ON ai.created_by = s2.id
       WHERE ai.action_item_id = ?`,
      [actionItemId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToActionItem(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      meetingId: 'meeting_id',
      minutesId: 'minutes_id',
      projectId: 'project_id',
      title: 'title',
      description: 'description',
      assignedTo: 'assigned_to',
      assignedToName: 'assigned_to_name',
      assignedDate: 'assigned_date',
      dueDate: 'due_date',
      completedDate: 'completed_date',
      status: 'status',
      priority: 'priority',
      completionPercentage: 'completion_percentage',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    // Auto-set completed date if status is completed
    if (updateData.status === 'completed' && !updateData.completedDate) {
      updateFields.push(`completed_date = ?`);
      params.splice(params.length - 1, 0, new Date().toISOString().split('T')[0]);
      if (!updateData.completionPercentage) {
        updateFields.push(`completion_percentage = ?`);
        params.splice(params.length - 1, 0, 100);
      }
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE action_items SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM action_items WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) as onHold,
        SUM(CASE WHEN due_date < CURDATE() AND status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high,
        AVG(completion_percentage) as avgCompletion
      FROM action_items
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToActionItem(row) {
    return {
      id: row.action_item_id,
      dbId: row.id,
      meetingId: row.meeting_id,
      meetingTitle: row.meeting_title,
      meetingReference: row.meeting_reference,
      minutesId: row.minutes_id,
      minutesTitle: row.minutes_title,
      minutesReference: row.minutes_reference,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      description: row.description,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name || (row.assignee_first_name && row.assignee_last_name
        ? `${row.assignee_first_name} ${row.assignee_last_name}` : null),
      assignedDate: row.assigned_date ? row.assigned_date.toISOString().split('T')[0] : null,
      dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      completedDate: row.completed_date ? row.completed_date.toISOString().split('T')[0] : null,
      status: row.status,
      priority: row.priority,
      completionPercentage: parseInt(row.completion_percentage) || 0,
      notes: row.notes,
      createdBy: row.created_by,
      createdByName: row.created_by_name || (row.creator_first_name && row.creator_last_name
        ? `${row.creator_first_name} ${row.creator_last_name}` : null),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default ActionItem;
