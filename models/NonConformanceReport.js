import pool from '../config/db.js';

class NonConformanceReport {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS non_conformance_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ncr_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        issue_type ENUM('Design', 'Documentation', 'Safety', 'Environmental', 'Quality', 'Process', 'Other') DEFAULT 'Quality',
        severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        status ENUM('open', 'in_progress', 'under_review', 'resolved', 'closed', 'cancelled') DEFAULT 'open',
        reported_by INT NULL,
        reported_by_name VARCHAR(255) NULL,
        report_date DATE NOT NULL,
        assigned_to INT NULL,
        assigned_to_name VARCHAR(255) NULL,
        root_cause TEXT NULL,
        corrective_action TEXT NULL,
        preventive_action TEXT NULL,
        action_taken TEXT NULL,
        verification_date DATE NULL,
        verified_by INT NULL,
        verified_by_name VARCHAR(255) NULL,
        closure_date DATE NULL,
        closure_comments TEXT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        due_date DATE NULL,
        related_item_type VARCHAR(100) NULL,
        related_item_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_severity (severity),
        INDEX idx_status (status),
        INDEX idx_issue_type (issue_type),
        INDEX idx_report_date (report_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (reported_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (verified_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Non-conformance reports table created or already exists.');
  }

  static async generateNCRId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM non_conformance_reports WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `NCR-${year}-${sequence}`;
  }

  static async create({
    ncrId,
    projectId,
    title,
    description,
    issueType = 'Quality',
    severity = 'medium',
    status = 'open',
    reportedBy,
    reportedByName,
    reportDate,
    assignedTo,
    assignedToName,
    rootCause,
    correctiveAction,
    preventiveAction,
    priority = 'medium',
    dueDate,
    relatedItemType,
    relatedItemId
  }) {
    const ncr = ncrId || await this.generateNCRId();

    const [result] = await pool.execute(
      `INSERT INTO non_conformance_reports (
        ncr_id, project_id, title, description, issue_type, severity, status,
        reported_by, reported_by_name, report_date, assigned_to, assigned_to_name,
        root_cause, corrective_action, preventive_action, priority, due_date,
        related_item_type, related_item_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ncr, projectId || null, title, description, issueType, severity, status,
        reportedBy || null, reportedByName || null, reportDate || new Date().toISOString().split('T')[0],
        assignedTo || null, assignedToName || null, rootCause || null, correctiveAction || null,
        preventiveAction || null, priority, dueDate || null, relatedItemType || null, relatedItemId || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT ncr.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as reporter_first_name, s1.last_name as reporter_last_name,
             s2.first_name as assignee_first_name, s2.last_name as assignee_last_name,
             s3.first_name as verifier_first_name, s3.last_name as verifier_last_name
      FROM non_conformance_reports ncr
      LEFT JOIN projects p ON ncr.project_id = p.id
      LEFT JOIN staff s1 ON ncr.reported_by = s1.id
      LEFT JOIN staff s2 ON ncr.assigned_to = s2.id
      LEFT JOIN staff s3 ON ncr.verified_by = s3.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (ncr.title LIKE ? OR ncr.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND ncr.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.issueType) {
      query += ` AND ncr.issue_type = ?`;
      params.push(filters.issueType);
    }

    if (filters.severity) {
      query += ` AND ncr.severity = ?`;
      params.push(filters.severity);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND ncr.status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY ncr.report_date DESC, ncr.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToNCR(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ncr.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as reporter_first_name, s1.last_name as reporter_last_name,
              s2.first_name as assignee_first_name, s2.last_name as assignee_last_name,
              s3.first_name as verifier_first_name, s3.last_name as verifier_last_name
       FROM non_conformance_reports ncr
       LEFT JOIN projects p ON ncr.project_id = p.id
       LEFT JOIN staff s1 ON ncr.reported_by = s1.id
       LEFT JOIN staff s2 ON ncr.assigned_to = s2.id
       LEFT JOIN staff s3 ON ncr.verified_by = s3.id
       WHERE ncr.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToNCR(rows[0]);
  }

  static async findByNCRId(ncrId) {
    const [rows] = await pool.execute(
      `SELECT ncr.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as reporter_first_name, s1.last_name as reporter_last_name,
              s2.first_name as assignee_first_name, s2.last_name as assignee_last_name,
              s3.first_name as verifier_first_name, s3.last_name as verifier_last_name
       FROM non_conformance_reports ncr
       LEFT JOIN projects p ON ncr.project_id = p.id
       LEFT JOIN staff s1 ON ncr.reported_by = s1.id
       LEFT JOIN staff s2 ON ncr.assigned_to = s2.id
       LEFT JOIN staff s3 ON ncr.verified_by = s3.id
       WHERE ncr.ncr_id = ?`,
      [ncrId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToNCR(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      title: 'title',
      description: 'description',
      issueType: 'issue_type',
      severity: 'severity',
      status: 'status',
      assignedTo: 'assigned_to',
      assignedToName: 'assigned_to_name',
      rootCause: 'root_cause',
      correctiveAction: 'corrective_action',
      preventiveAction: 'preventive_action',
      actionTaken: 'action_taken',
      verificationDate: 'verification_date',
      verifiedBy: 'verified_by',
      verifiedByName: 'verified_by_name',
      closureDate: 'closure_date',
      closureComments: 'closure_comments',
      priority: 'priority',
      dueDate: 'due_date'
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
      `UPDATE non_conformance_reports SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM non_conformance_reports WHERE id = ?', [id]);
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
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high
      FROM non_conformance_reports
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToNCR(row) {
    return {
      id: row.ncr_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      description: row.description,
      issueType: row.issue_type,
      severity: row.severity,
      status: row.status,
      reportedBy: row.reported_by,
      reportedByName: row.reported_by_name || (row.reporter_first_name && row.reporter_last_name
        ? `${row.reporter_first_name} ${row.reporter_last_name}` : null),
      reportDate: row.report_date ? row.report_date.toISOString().split('T')[0] : null,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name || (row.assignee_first_name && row.assignee_last_name
        ? `${row.assignee_first_name} ${row.assignee_last_name}` : null),
      rootCause: row.root_cause,
      correctiveAction: row.corrective_action,
      preventiveAction: row.preventive_action,
      actionTaken: row.action_taken,
      verificationDate: row.verification_date ? row.verification_date.toISOString().split('T')[0] : null,
      verifiedBy: row.verified_by,
      verifiedByName: row.verified_by_name || (row.verifier_first_name && row.verifier_last_name
        ? `${row.verifier_first_name} ${row.verifier_last_name}` : null),
      closureDate: row.closure_date ? row.closure_date.toISOString().split('T')[0] : null,
      closureComments: row.closure_comments,
      priority: row.priority,
      dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      relatedItemType: row.related_item_type,
      relatedItemId: row.related_item_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default NonConformanceReport;
