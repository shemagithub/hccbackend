import pool from '../config/db.js';

class WorkReport {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS work_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        project_id INT NULL,
        report_type ENUM('daily', 'weekly', 'milestone', 'monthly') DEFAULT 'daily',
        report_date DATE NOT NULL,
        period_start DATE NULL,
        period_end DATE NULL,
        progress_summary TEXT NOT NULL,
        tasks_completed TEXT NULL,
        tasks_in_progress TEXT NULL,
        challenges TEXT NULL,
        recommendations TEXT NULL,
        next_steps TEXT NULL,
        attachments TEXT NULL,
        status ENUM('draft', 'submitted', 'reviewed', 'approved') DEFAULT 'draft',
        reviewed_by INT NULL,
        reviewed_by_name VARCHAR(255) NULL,
        review_date DATE NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_project (project_id),
        INDEX idx_report_type (report_type),
        INDEX idx_report_date (report_date),
        INDEX idx_status (status),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (reviewed_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Work reports table created or already exists.');
  }

  static async generateReportId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM work_reports WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `WR-${year}-${sequence}`;
  }

  static async create({
    reportId, staffId, projectId, reportType, reportDate, periodStart, periodEnd,
    progressSummary, tasksCompleted, tasksInProgress, challenges, recommendations,
    nextSteps, attachments, status = 'draft', reviewedBy, reviewedByName, reviewDate, notes
  }) {
    const rId = reportId || await this.generateReportId();

    const [result] = await pool.execute(
      `INSERT INTO work_reports (
        report_id, staff_id, project_id, report_type, report_date, period_start, period_end,
        progress_summary, tasks_completed, tasks_in_progress, challenges, recommendations,
        next_steps, attachments, status, reviewed_by, reviewed_by_name, review_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rId, staffId, projectId || null, reportType, reportDate || new Date().toISOString().split('T')[0],
        periodStart || null, periodEnd || null, progressSummary,
        tasksCompleted ? JSON.stringify(tasksCompleted) : null,
        tasksInProgress ? JSON.stringify(tasksInProgress) : null,
        challenges || null, recommendations || null, nextSteps || null,
        attachments ? JSON.stringify(attachments) : null, status,
        reviewedBy || null, reviewedByName || null, reviewDate || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT wr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
             p.name as project_name, p.project_id as project_code,
             d.name as department_name,
             r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
      FROM work_reports wr
      LEFT JOIN staff s ON wr.staff_id = s.id
      LEFT JOIN projects p ON wr.project_id = p.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN staff r ON wr.reviewed_by = r.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND wr.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.projectId) {
      query += ` AND wr.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.reportType && filters.reportType !== 'all') {
      query += ` AND wr.report_type = ?`;
      params.push(filters.reportType);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND wr.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND wr.report_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND wr.report_date <= ?`;
      params.push(filters.endDate);
    }

    if (filters.search) {
      query += ` AND (wr.progress_summary LIKE ? OR p.name LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY wr.report_date DESC, wr.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToReport(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT wr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              p.name as project_name, p.project_id as project_code,
              d.name as department_name,
              r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
       FROM work_reports wr
       LEFT JOIN staff s ON wr.staff_id = s.id
       LEFT JOIN projects p ON wr.project_id = p.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff r ON wr.reviewed_by = r.id
       WHERE wr.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToReport(rows[0]);
  }

  static async findByReportId(reportId) {
    const [rows] = await pool.execute(
      `SELECT wr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              p.name as project_name, p.project_id as project_code,
              d.name as department_name,
              r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
       FROM work_reports wr
       LEFT JOIN staff s ON wr.staff_id = s.id
       LEFT JOIN projects p ON wr.project_id = p.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff r ON wr.reviewed_by = r.id
       WHERE wr.report_id = ?`,
      [reportId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToReport(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      reportType: 'report_type',
      reportDate: 'report_date',
      periodStart: 'period_start',
      periodEnd: 'period_end',
      progressSummary: 'progress_summary',
      tasksCompleted: 'tasks_completed',
      tasksInProgress: 'tasks_in_progress',
      challenges: 'challenges',
      recommendations: 'recommendations',
      nextSteps: 'next_steps',
      attachments: 'attachments',
      status: 'status',
      reviewedBy: 'reviewed_by',
      reviewedByName: 'reviewed_by_name',
      reviewDate: 'review_date',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'tasksCompleted' || key === 'tasksInProgress' || key === 'attachments') {
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
      `UPDATE work_reports SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM work_reports WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToReport(row) {
    return {
      id: row.report_id,
      reportId: row.report_id,
      dbId: row.id,
      staffId: row.staff_id,
      staffName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      staffEmail: row.email,
      staffPosition: row.position,
      departmentId: row.department_id,
      departmentName: row.department_name,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      reportType: row.report_type,
      reportDate: row.report_date ? row.report_date.toISOString().split('T')[0] : null,
      periodStart: row.period_start ? row.period_start.toISOString().split('T')[0] : null,
      periodEnd: row.period_end ? row.period_end.toISOString().split('T')[0] : null,
      progressSummary: row.progress_summary,
      tasksCompleted: row.tasks_completed ? JSON.parse(row.tasks_completed) : [],
      tasksInProgress: row.tasks_in_progress ? JSON.parse(row.tasks_in_progress) : [],
      challenges: row.challenges,
      recommendations: row.recommendations,
      nextSteps: row.next_steps,
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedByName: row.reviewed_by_name || (row.reviewer_first_name && row.reviewer_last_name
        ? `${row.reviewer_first_name} ${row.reviewer_last_name}` : null),
      reviewDate: row.review_date ? row.review_date.toISOString().split('T')[0] : null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default WorkReport;
