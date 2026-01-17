import pool from '../config/db.js';

class MitigationAction {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS mitigation_actions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mitigation_action_id VARCHAR(50) NOT NULL UNIQUE,
        risk_id INT NOT NULL,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        action_type ENUM('preventive', 'corrective', 'contingency', 'monitoring') DEFAULT 'preventive',
        status ENUM('planned', 'in_progress', 'completed', 'cancelled', 'on_hold') DEFAULT 'planned',
        assigned_to INT NULL,
        assigned_to_name VARCHAR(255) NULL,
        assigned_date DATE NULL,
        due_date DATE NULL,
        completed_date DATE NULL,
        completion_percentage INT DEFAULT 0,
        effectiveness_rating INT NULL,
        notes TEXT NULL,
        cost_estimate DECIMAL(15,2) NULL,
        actual_cost DECIMAL(15,2) NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_risk (risk_id),
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_due_date (due_date),
        FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Mitigation actions table created or already exists.');
  }

  static async generateMitigationActionId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM mitigation_actions WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `MIT-${year}-${sequence}`;
  }

  static async create({
    mitigationActionId,
    riskId,
    projectId,
    title,
    description,
    actionType = 'preventive',
    status = 'planned',
    assignedTo,
    assignedToName,
    assignedDate,
    dueDate,
    completionPercentage = 0,
    effectivenessRating,
    notes,
    costEstimate,
    actualCost,
    priority = 'medium'
  }) {
    const maId = mitigationActionId || await this.generateMitigationActionId();

    const [result] = await pool.execute(
      `INSERT INTO mitigation_actions (
        mitigation_action_id, risk_id, project_id, title, description, action_type, status,
        assigned_to, assigned_to_name, assigned_date, due_date, completion_percentage,
        effectiveness_rating, notes, cost_estimate, actual_cost, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        maId, riskId, projectId || null, title, description || null, actionType, status,
        assignedTo || null, assignedToName || null, assignedDate || null, dueDate || null,
        completionPercentage, effectivenessRating || null, notes || null,
        costEstimate || null, actualCost || null, priority
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT ma.*, r.risk_id as risk_reference, r.title as risk_title,
             p.name as project_name, p.project_id as project_code,
             s.first_name as assignee_first_name, s.last_name as assignee_last_name
      FROM mitigation_actions ma
      LEFT JOIN risks r ON ma.risk_id = r.id
      LEFT JOIN projects p ON ma.project_id = p.id
      LEFT JOIN staff s ON ma.assigned_to = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (ma.title LIKE ? OR ma.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.riskId) {
      query += ` AND ma.risk_id = ?`;
      params.push(filters.riskId);
    }

    if (filters.projectId) {
      query += ` AND ma.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND ma.status = ?`;
      params.push(filters.status);
    }

    if (filters.actionType) {
      query += ` AND ma.action_type = ?`;
      params.push(filters.actionType);
    }

    query += ` ORDER BY ma.due_date ASC, ma.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToMitigationAction(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ma.*, r.risk_id as risk_reference, r.title as risk_title,
              p.name as project_name, p.project_id as project_code,
              s.first_name as assignee_first_name, s.last_name as assignee_last_name
       FROM mitigation_actions ma
       LEFT JOIN risks r ON ma.risk_id = r.id
       LEFT JOIN projects p ON ma.project_id = p.id
       LEFT JOIN staff s ON ma.assigned_to = s.id
       WHERE ma.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToMitigationAction(rows[0]);
  }

  static async findByMitigationActionId(mitigationActionId) {
    const [rows] = await pool.execute(
      `SELECT ma.*, r.risk_id as risk_reference, r.title as risk_title,
              p.name as project_name, p.project_id as project_code,
              s.first_name as assignee_first_name, s.last_name as assignee_last_name
       FROM mitigation_actions ma
       LEFT JOIN risks r ON ma.risk_id = r.id
       LEFT JOIN projects p ON ma.project_id = p.id
       LEFT JOIN staff s ON ma.assigned_to = s.id
       WHERE ma.mitigation_action_id = ?`,
      [mitigationActionId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToMitigationAction(rows[0]);
  }

  static async findByRiskId(riskId) {
    const [rows] = await pool.execute(
      `SELECT ma.*, r.risk_id as risk_reference, r.title as risk_title,
              p.name as project_name, p.project_id as project_code,
              s.first_name as assignee_first_name, s.last_name as assignee_last_name
       FROM mitigation_actions ma
       LEFT JOIN risks r ON ma.risk_id = r.id
       LEFT JOIN projects p ON ma.project_id = p.id
       LEFT JOIN staff s ON ma.assigned_to = s.id
       WHERE ma.risk_id = ?
       ORDER BY ma.due_date ASC`,
      [riskId]
    );
    
    return rows.map(row => this.mapRowToMitigationAction(row));
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      riskId: 'risk_id',
      projectId: 'project_id',
      title: 'title',
      description: 'description',
      actionType: 'action_type',
      status: 'status',
      assignedTo: 'assigned_to',
      assignedToName: 'assigned_to_name',
      assignedDate: 'assigned_date',
      dueDate: 'due_date',
      completedDate: 'completed_date',
      completionPercentage: 'completion_percentage',
      effectivenessRating: 'effectiveness_rating',
      notes: 'notes',
      costEstimate: 'cost_estimate',
      actualCost: 'actual_cost',
      priority: 'priority'
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
      `UPDATE mitigation_actions SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM mitigation_actions WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) as onHold,
        AVG(completion_percentage) as avgCompletionPercentage,
        AVG(effectiveness_rating) as avgEffectivenessRating
      FROM mitigation_actions
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToMitigationAction(row) {
    return {
      id: row.mitigation_action_id,
      dbId: row.id,
      riskId: row.risk_id,
      riskReference: row.risk_reference,
      riskTitle: row.risk_title,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      description: row.description,
      actionType: row.action_type,
      status: row.status,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name || (row.assignee_first_name && row.assignee_last_name
        ? `${row.assignee_first_name} ${row.assignee_last_name}` : null),
      assignedDate: row.assigned_date ? row.assigned_date.toISOString().split('T')[0] : null,
      dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      completedDate: row.completed_date ? row.completed_date.toISOString().split('T')[0] : null,
      completionPercentage: parseInt(row.completion_percentage) || 0,
      effectivenessRating: row.effectiveness_rating ? parseInt(row.effectiveness_rating) : null,
      notes: row.notes,
      costEstimate: row.cost_estimate ? parseFloat(row.cost_estimate) : null,
      actualCost: row.actual_cost ? parseFloat(row.actual_cost) : null,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default MitigationAction;
