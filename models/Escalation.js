import pool from '../config/db.js';

class Escalation {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS escalations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        escalation_id VARCHAR(50) NOT NULL UNIQUE,
        risk_id INT NULL,
        issue_id INT NULL,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        escalation_type ENUM('risk', 'issue', 'general') NOT NULL,
        escalation_level ENUM('project_manager', 'department_director', 'executive', 'board') DEFAULT 'department_director',
        current_level ENUM('project_manager', 'department_director', 'executive', 'board') DEFAULT 'project_manager',
        status ENUM('pending', 'acknowledged', 'in_review', 'resolved', 'closed', 'rejected') DEFAULT 'pending',
        escalated_by INT NULL,
        escalated_by_name VARCHAR(255) NULL,
        escalation_date DATE NOT NULL,
        escalated_to INT NULL,
        escalated_to_name VARCHAR(255) NULL,
        acknowledged_by INT NULL,
        acknowledged_by_name VARCHAR(255) NULL,
        acknowledged_date DATE NULL,
        resolution TEXT NULL,
        resolved_by INT NULL,
        resolved_by_name VARCHAR(255) NULL,
        resolution_date DATE NULL,
        closure_date DATE NULL,
        closure_comments TEXT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'high',
        urgency_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_risk (risk_id),
        INDEX idx_issue (issue_id),
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_escalation_level (escalation_level),
        INDEX idx_escalation_date (escalation_date),
        FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE SET NULL,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (escalated_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (escalated_to) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (acknowledged_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (resolved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Escalations table created or already exists.');
  }

  static async generateEscalationId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM escalations WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `ESC-${year}-${sequence}`;
  }

  static async create({
    escalationId,
    riskId,
    issueId,
    projectId,
    title,
    description,
    escalationType,
    escalationLevel = 'department_director',
    currentLevel = 'project_manager',
    status = 'pending',
    escalatedBy,
    escalatedByName,
    escalationDate,
    escalatedTo,
    escalatedToName,
    priority = 'high',
    urgencyReason
  }) {
    const escId = escalationId || await this.generateEscalationId();

    const [result] = await pool.execute(
      `INSERT INTO escalations (
        escalation_id, risk_id, issue_id, project_id, title, description, escalation_type,
        escalation_level, current_level, status, escalated_by, escalated_by_name, escalation_date,
        escalated_to, escalated_to_name, priority, urgency_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        escId, riskId || null, issueId || null, projectId || null, title, description, escalationType,
        escalationLevel, currentLevel, status, escalatedBy || null, escalatedByName || null,
        escalationDate || new Date().toISOString().split('T')[0], escalatedTo || null,
        escalatedToName || null, priority, urgencyReason || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT e.*, r.risk_id as risk_reference, r.title as risk_title,
             i.issue_id as issue_reference, i.title as issue_title,
             p.name as project_name, p.project_id as project_code,
             s1.first_name as escalator_first_name, s1.last_name as escalator_last_name,
             s2.first_name as escalatee_first_name, s2.last_name as escalatee_last_name,
             s3.first_name as acknowledger_first_name, s3.last_name as acknowledger_last_name,
             s4.first_name as resolver_first_name, s4.last_name as resolver_last_name
      FROM escalations e
      LEFT JOIN risks r ON e.risk_id = r.id
      LEFT JOIN issues i ON e.issue_id = i.id
      LEFT JOIN projects p ON e.project_id = p.id
      LEFT JOIN staff s1 ON e.escalated_by = s1.id
      LEFT JOIN staff s2 ON e.escalated_to = s2.id
      LEFT JOIN staff s3 ON e.acknowledged_by = s3.id
      LEFT JOIN staff s4 ON e.resolved_by = s4.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (e.title LIKE ? OR e.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.riskId) {
      query += ` AND e.risk_id = ?`;
      params.push(filters.riskId);
    }

    if (filters.issueId) {
      query += ` AND e.issue_id = ?`;
      params.push(filters.issueId);
    }

    if (filters.projectId) {
      query += ` AND e.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.escalationType) {
      query += ` AND e.escalation_type = ?`;
      params.push(filters.escalationType);
    }

    if (filters.escalationLevel) {
      query += ` AND e.escalation_level = ?`;
      params.push(filters.escalationLevel);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND e.status = ?`;
      params.push(filters.status);
    }

    if (filters.pendingOnly) {
      query += ` AND e.status IN ('pending', 'acknowledged', 'in_review')`;
    }

    query += ` ORDER BY e.escalation_date DESC, e.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToEscalation(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT e.*, r.risk_id as risk_reference, r.title as risk_title,
              i.issue_id as issue_reference, i.title as issue_title,
              p.name as project_name, p.project_id as project_code,
              s1.first_name as escalator_first_name, s1.last_name as escalator_last_name,
              s2.first_name as escalatee_first_name, s2.last_name as escalatee_last_name,
              s3.first_name as acknowledger_first_name, s3.last_name as acknowledger_last_name,
              s4.first_name as resolver_first_name, s4.last_name as resolver_last_name
       FROM escalations e
       LEFT JOIN risks r ON e.risk_id = r.id
       LEFT JOIN issues i ON e.issue_id = i.id
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN staff s1 ON e.escalated_by = s1.id
       LEFT JOIN staff s2 ON e.escalated_to = s2.id
       LEFT JOIN staff s3 ON e.acknowledged_by = s3.id
       LEFT JOIN staff s4 ON e.resolved_by = s4.id
       WHERE e.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToEscalation(rows[0]);
  }

  static async findByEscalationId(escalationId) {
    const [rows] = await pool.execute(
      `SELECT e.*, r.risk_id as risk_reference, r.title as risk_title,
              i.issue_id as issue_reference, i.title as issue_title,
              p.name as project_name, p.project_id as project_code,
              s1.first_name as escalator_first_name, s1.last_name as escalator_last_name,
              s2.first_name as escalatee_first_name, s2.last_name as escalatee_last_name,
              s3.first_name as acknowledger_first_name, s3.last_name as acknowledger_last_name,
              s4.first_name as resolver_first_name, s4.last_name as resolver_last_name
       FROM escalations e
       LEFT JOIN risks r ON e.risk_id = r.id
       LEFT JOIN issues i ON e.issue_id = i.id
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN staff s1 ON e.escalated_by = s1.id
       LEFT JOIN staff s2 ON e.escalated_to = s2.id
       LEFT JOIN staff s3 ON e.acknowledged_by = s3.id
       LEFT JOIN staff s4 ON e.resolved_by = s4.id
       WHERE e.escalation_id = ?`,
      [escalationId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToEscalation(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      riskId: 'risk_id',
      issueId: 'issue_id',
      projectId: 'project_id',
      title: 'title',
      description: 'description',
      escalationLevel: 'escalation_level',
      currentLevel: 'current_level',
      status: 'status',
      escalatedTo: 'escalated_to',
      escalatedToName: 'escalated_to_name',
      acknowledgedBy: 'acknowledged_by',
      acknowledgedByName: 'acknowledged_by_name',
      acknowledgedDate: 'acknowledged_date',
      resolution: 'resolution',
      resolvedBy: 'resolved_by',
      resolvedByName: 'resolved_by_name',
      resolutionDate: 'resolution_date',
      closureDate: 'closure_date',
      closureComments: 'closure_comments',
      priority: 'priority',
      urgencyReason: 'urgency_reason'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    // Auto-set acknowledged date if status is acknowledged
    if (updateData.status === 'acknowledged' && !updateData.acknowledgedDate) {
      updateFields.push(`acknowledged_date = ?`);
      params.splice(params.length - 1, 0, new Date().toISOString().split('T')[0]);
    }

    // Auto-set resolution date if status is resolved
    if (updateData.status === 'resolved' && !updateData.resolutionDate) {
      updateFields.push(`resolution_date = ?`);
      params.splice(params.length - 1, 0, new Date().toISOString().split('T')[0]);
    }

    // Auto-set closure date if status is closed
    if (updateData.status === 'closed' && !updateData.closureDate) {
      updateFields.push(`closure_date = ?`);
      params.splice(params.length - 1, 0, new Date().toISOString().split('T')[0]);
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE escalations SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM escalations WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged,
        SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) as inReview,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN escalation_level = 'department_director' THEN 1 ELSE 0 END) as departmentDirector,
        SUM(CASE WHEN escalation_level = 'executive' THEN 1 ELSE 0 END) as executive,
        SUM(CASE WHEN escalation_level = 'board' THEN 1 ELSE 0 END) as board
      FROM escalations
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToEscalation(row) {
    return {
      id: row.escalation_id,
      dbId: row.id,
      riskId: row.risk_id,
      riskReference: row.risk_reference,
      riskTitle: row.risk_title,
      issueId: row.issue_id,
      issueReference: row.issue_reference,
      issueTitle: row.issue_title,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      description: row.description,
      escalationType: row.escalation_type,
      escalationLevel: row.escalation_level,
      currentLevel: row.current_level,
      status: row.status,
      escalatedBy: row.escalated_by,
      escalatedByName: row.escalated_by_name || (row.escalator_first_name && row.escalator_last_name
        ? `${row.escalator_first_name} ${row.escalator_last_name}` : null),
      escalationDate: row.escalation_date ? row.escalation_date.toISOString().split('T')[0] : null,
      escalatedTo: row.escalated_to,
      escalatedToName: row.escalated_to_name || (row.escalatee_first_name && row.escalatee_last_name
        ? `${row.escalatee_first_name} ${row.escalatee_last_name}` : null),
      acknowledgedBy: row.acknowledged_by,
      acknowledgedByName: row.acknowledged_by_name || (row.acknowledger_first_name && row.acknowledger_last_name
        ? `${row.acknowledger_first_name} ${row.acknowledger_last_name}` : null),
      acknowledgedDate: row.acknowledged_date ? row.acknowledged_date.toISOString().split('T')[0] : null,
      resolution: row.resolution,
      resolvedBy: row.resolved_by,
      resolvedByName: row.resolved_by_name || (row.resolver_first_name && row.resolver_last_name
        ? `${row.resolver_first_name} ${row.resolver_last_name}` : null),
      resolutionDate: row.resolution_date ? row.resolution_date.toISOString().split('T')[0] : null,
      closureDate: row.closure_date ? row.closure_date.toISOString().split('T')[0] : null,
      closureComments: row.closure_comments,
      priority: row.priority,
      urgencyReason: row.urgency_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Escalation;
