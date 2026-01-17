import pool from '../config/db.js';

class Issue {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS issues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        category ENUM('Technical', 'Financial', 'Schedule', 'Resource', 'Stakeholder', 'Quality', 'Communication', 'Other') DEFAULT 'Technical',
        severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        status ENUM('open', 'in_progress', 'resolved', 'closed', 'escalated') DEFAULT 'open',
        reported_by INT NULL,
        reported_by_name VARCHAR(255) NULL,
        report_date DATE NOT NULL,
        assigned_to INT NULL,
        assigned_to_name VARCHAR(255) NULL,
        resolution TEXT NULL,
        resolved_by INT NULL,
        resolved_by_name VARCHAR(255) NULL,
        resolution_date DATE NULL,
        closure_date DATE NULL,
        closure_comments TEXT NULL,
        related_risk_id INT NULL,
        related_item_type VARCHAR(100) NULL,
        related_item_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_category (category),
        INDEX idx_severity (severity),
        INDEX idx_status (status),
        INDEX idx_report_date (report_date),
        INDEX idx_related_risk (related_risk_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (reported_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (resolved_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (related_risk_id) REFERENCES risks(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Issues table created or already exists.');
  }

  static async generateIssueId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM issues WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `ISS-${year}-${sequence}`;
  }

  static async create({
    issueId,
    projectId,
    title,
    description,
    category = 'Technical',
    severity = 'medium',
    priority = 'medium',
    status = 'open',
    reportedBy,
    reportedByName,
    reportDate,
    assignedTo,
    assignedToName,
    resolution,
    relatedRiskId,
    relatedItemType,
    relatedItemId
  }) {
    const issId = issueId || await this.generateIssueId();

    const [result] = await pool.execute(
      `INSERT INTO issues (
        issue_id, project_id, title, description, category, severity, priority, status,
        reported_by, reported_by_name, report_date, assigned_to, assigned_to_name,
        resolution, related_risk_id, related_item_type, related_item_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issId, projectId || null, title, description, category, severity, priority, status,
        reportedBy || null, reportedByName || null, reportDate || new Date().toISOString().split('T')[0],
        assignedTo || null, assignedToName || null, resolution || null, relatedRiskId || null,
        relatedItemType || null, relatedItemId || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT i.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as reporter_first_name, s1.last_name as reporter_last_name,
             s2.first_name as assignee_first_name, s2.last_name as assignee_last_name,
             s3.first_name as resolver_first_name, s3.last_name as resolver_last_name,
             r.risk_id as related_risk_reference
      FROM issues i
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN staff s1 ON i.reported_by = s1.id
      LEFT JOIN staff s2 ON i.assigned_to = s2.id
      LEFT JOIN staff s3 ON i.resolved_by = s3.id
      LEFT JOIN risks r ON i.related_risk_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (i.title LIKE ? OR i.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND i.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.category) {
      query += ` AND i.category = ?`;
      params.push(filters.category);
    }

    if (filters.severity) {
      query += ` AND i.severity = ?`;
      params.push(filters.severity);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND i.status = ?`;
      params.push(filters.status);
    }

    if (filters.openOnly) {
      query += ` AND i.status IN ('open', 'in_progress')`;
    }

    query += ` ORDER BY i.report_date DESC, i.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToIssue(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT i.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as reporter_first_name, s1.last_name as reporter_last_name,
              s2.first_name as assignee_first_name, s2.last_name as assignee_last_name,
              s3.first_name as resolver_first_name, s3.last_name as resolver_last_name,
              r.risk_id as related_risk_reference
       FROM issues i
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN staff s1 ON i.reported_by = s1.id
       LEFT JOIN staff s2 ON i.assigned_to = s2.id
       LEFT JOIN staff s3 ON i.resolved_by = s3.id
       LEFT JOIN risks r ON i.related_risk_id = r.id
       WHERE i.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToIssue(rows[0]);
  }

  static async findByIssueId(issueId) {
    const [rows] = await pool.execute(
      `SELECT i.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as reporter_first_name, s1.last_name as reporter_last_name,
              s2.first_name as assignee_first_name, s2.last_name as assignee_last_name,
              s3.first_name as resolver_first_name, s3.last_name as resolver_last_name,
              r.risk_id as related_risk_reference
       FROM issues i
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN staff s1 ON i.reported_by = s1.id
       LEFT JOIN staff s2 ON i.assigned_to = s2.id
       LEFT JOIN staff s3 ON i.resolved_by = s3.id
       LEFT JOIN risks r ON i.related_risk_id = r.id
       WHERE i.issue_id = ?`,
      [issueId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToIssue(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      title: 'title',
      description: 'description',
      category: 'category',
      severity: 'severity',
      priority: 'priority',
      status: 'status',
      assignedTo: 'assigned_to',
      assignedToName: 'assigned_to_name',
      resolution: 'resolution',
      resolvedBy: 'resolved_by',
      resolvedByName: 'resolved_by_name',
      resolutionDate: 'resolution_date',
      closureDate: 'closure_date',
      closureComments: 'closure_comments',
      relatedRiskId: 'related_risk_id'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

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
      `UPDATE issues SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM issues WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high
      FROM issues
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToIssue(row) {
    return {
      id: row.issue_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      description: row.description,
      category: row.category,
      severity: row.severity,
      priority: row.priority,
      status: row.status,
      reportedBy: row.reported_by,
      reportedByName: row.reported_by_name || (row.reporter_first_name && row.reporter_last_name
        ? `${row.reporter_first_name} ${row.reporter_last_name}` : null),
      reportDate: row.report_date ? row.report_date.toISOString().split('T')[0] : null,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name || (row.assignee_first_name && row.assignee_last_name
        ? `${row.assignee_first_name} ${row.assignee_last_name}` : null),
      resolution: row.resolution,
      resolvedBy: row.resolved_by,
      resolvedByName: row.resolved_by_name || (row.resolver_first_name && row.resolver_last_name
        ? `${row.resolver_first_name} ${row.resolver_last_name}` : null),
      resolutionDate: row.resolution_date ? row.resolution_date.toISOString().split('T')[0] : null,
      closureDate: row.closure_date ? row.closure_date.toISOString().split('T')[0] : null,
      closureComments: row.closure_comments,
      relatedRiskId: row.related_risk_id,
      relatedRiskReference: row.related_risk_reference,
      relatedItemType: row.related_item_type,
      relatedItemId: row.related_item_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Issue;
