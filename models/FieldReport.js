import pool from '../config/db.js';

class FieldReport {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS field_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        project_id INT NOT NULL,
        site_location VARCHAR(255) NOT NULL,
        report_date DATE NOT NULL,
        report_time TIME NULL,
        weather_conditions VARCHAR(255) NULL,
        site_conditions TEXT NULL,
        work_performed TEXT NOT NULL,
        observations TEXT NULL,
        issues_encountered TEXT NULL,
        photos TEXT NULL,
        gps_coordinates VARCHAR(255) NULL,
        attendance_list TEXT NULL,
        equipment_used TEXT NULL,
        safety_incidents TEXT NULL,
        recommendations TEXT NULL,
        status ENUM('draft', 'submitted', 'reviewed', 'approved') DEFAULT 'draft',
        reviewed_by INT NULL,
        reviewed_by_name VARCHAR(255) NULL,
        review_date DATE NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_project (project_id),
        INDEX idx_report_date (report_date),
        INDEX idx_status (status),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Field reports table created or already exists.');
  }

  static async generateReportId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM field_reports WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `FR-${year}-${sequence}`;
  }

  static async create({
    reportId, staffId, projectId, siteLocation, reportDate, reportTime,
    weatherConditions, siteConditions, workPerformed, observations,
    issuesEncountered, photos, gpsCoordinates, attendanceList, equipmentUsed,
    safetyIncidents, recommendations, status = 'draft', reviewedBy, reviewedByName,
    reviewDate, notes
  }) {
    const rId = reportId || await this.generateReportId();

    const [result] = await pool.execute(
      `INSERT INTO field_reports (
        report_id, staff_id, project_id, site_location, report_date, report_time,
        weather_conditions, site_conditions, work_performed, observations,
        issues_encountered, photos, gps_coordinates, attendance_list, equipment_used,
        safety_incidents, recommendations, status, reviewed_by, reviewed_by_name,
        review_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rId, staffId, projectId, siteLocation, reportDate || new Date().toISOString().split('T')[0],
        reportTime || null, weatherConditions || null, siteConditions || null, workPerformed,
        observations || null, issuesEncountered || null,
        photos ? JSON.stringify(photos) : null, gpsCoordinates || null,
        attendanceList ? JSON.stringify(attendanceList) : null,
        equipmentUsed ? JSON.stringify(equipmentUsed) : null,
        safetyIncidents || null, recommendations || null, status,
        reviewedBy || null, reviewedByName || null, reviewDate || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT fr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
             p.name as project_name, p.project_id as project_code,
             d.name as department_name,
             r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
      FROM field_reports fr
      LEFT JOIN staff s ON fr.staff_id = s.id
      LEFT JOIN projects p ON fr.project_id = p.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN staff r ON fr.reviewed_by = r.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND fr.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.projectId) {
      query += ` AND fr.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND fr.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND fr.report_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND fr.report_date <= ?`;
      params.push(filters.endDate);
    }

    if (filters.search) {
      query += ` AND (fr.site_location LIKE ? OR fr.work_performed LIKE ? OR p.name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY fr.report_date DESC, fr.report_time DESC`;

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
      `SELECT fr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              p.name as project_name, p.project_id as project_code,
              d.name as department_name,
              r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
       FROM field_reports fr
       LEFT JOIN staff s ON fr.staff_id = s.id
       LEFT JOIN projects p ON fr.project_id = p.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff r ON fr.reviewed_by = r.id
       WHERE fr.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToReport(rows[0]);
  }

  static async findByReportId(reportId) {
    const [rows] = await pool.execute(
      `SELECT fr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              p.name as project_name, p.project_id as project_code,
              d.name as department_name,
              r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
       FROM field_reports fr
       LEFT JOIN staff s ON fr.staff_id = s.id
       LEFT JOIN projects p ON fr.project_id = p.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff r ON fr.reviewed_by = r.id
       WHERE fr.report_id = ?`,
      [reportId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToReport(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      siteLocation: 'site_location',
      reportDate: 'report_date',
      reportTime: 'report_time',
      weatherConditions: 'weather_conditions',
      siteConditions: 'site_conditions',
      workPerformed: 'work_performed',
      observations: 'observations',
      issuesEncountered: 'issues_encountered',
      photos: 'photos',
      gpsCoordinates: 'gps_coordinates',
      attendanceList: 'attendance_list',
      equipmentUsed: 'equipment_used',
      safetyIncidents: 'safety_incidents',
      recommendations: 'recommendations',
      status: 'status',
      reviewedBy: 'reviewed_by',
      reviewedByName: 'reviewed_by_name',
      reviewDate: 'review_date',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'photos' || key === 'attendanceList' || key === 'equipmentUsed') {
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
      `UPDATE field_reports SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM field_reports WHERE id = ?', [id]);
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
      siteLocation: row.site_location,
      reportDate: row.report_date ? row.report_date.toISOString().split('T')[0] : null,
      reportTime: row.report_time ? row.report_time.toString() : null,
      weatherConditions: row.weather_conditions,
      siteConditions: row.site_conditions,
      workPerformed: row.work_performed,
      observations: row.observations,
      issuesEncountered: row.issues_encountered,
      photos: row.photos ? JSON.parse(row.photos) : [],
      gpsCoordinates: row.gps_coordinates,
      attendanceList: row.attendance_list ? JSON.parse(row.attendance_list) : [],
      equipmentUsed: row.equipment_used ? JSON.parse(row.equipment_used) : [],
      safetyIncidents: row.safety_incidents,
      recommendations: row.recommendations,
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

export default FieldReport;
