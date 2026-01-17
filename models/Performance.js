import pool from '../config/db.js';

class Performance {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS performance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        performance_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        project_id INT NULL,
        review_period_start DATE NOT NULL,
        review_period_end DATE NOT NULL,
        overall_rating DECIMAL(3,2) NULL,
        performance_score INT NULL,
        feedback TEXT NULL,
        strengths TEXT NULL,
        areas_for_improvement TEXT NULL,
        lessons_learned TEXT NULL,
        reviewed_by INT NULL,
        reviewed_by_name VARCHAR(255) NULL,
        review_date DATE NULL,
        status ENUM('draft', 'submitted', 'reviewed', 'approved') DEFAULT 'draft',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_project (project_id),
        INDEX idx_review_period (review_period_start, review_period_end),
        INDEX idx_status (status),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (reviewed_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Performance table created or already exists.');
  }

  static async generatePerformanceId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM performance WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `PERF-${year}-${sequence}`;
  }

  static async create({
    performanceId, staffId, projectId, reviewPeriodStart, reviewPeriodEnd,
    overallRating, performanceScore, feedback, strengths, areasForImprovement,
    lessonsLearned, reviewedBy, reviewedByName, reviewDate, status = 'draft', notes
  }) {
    const pId = performanceId || await this.generatePerformanceId();

    const [result] = await pool.execute(
      `INSERT INTO performance (
        performance_id, staff_id, project_id, review_period_start, review_period_end,
        overall_rating, performance_score, feedback, strengths, areas_for_improvement,
        lessons_learned, reviewed_by, reviewed_by_name, review_date, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pId, staffId, projectId || null, reviewPeriodStart, reviewPeriodEnd,
        overallRating || null, performanceScore || null, feedback || null,
        strengths || null, areasForImprovement || null, lessonsLearned || null,
        reviewedBy || null, reviewedByName || null, reviewDate || null, status, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT p.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
             pr.name as project_name, pr.project_id as project_code,
             d.name as department_name,
             r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
      FROM performance p
      LEFT JOIN staff s ON p.staff_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN staff r ON p.reviewed_by = r.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND p.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.projectId) {
      query += ` AND p.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND p.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND p.review_period_start >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND p.review_period_end <= ?`;
      params.push(filters.endDate);
    }

    if (filters.search) {
      query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR pr.name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY p.review_period_end DESC, p.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToPerformance(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT p.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              pr.name as project_name, pr.project_id as project_code,
              d.name as department_name,
              r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
       FROM performance p
       LEFT JOIN staff s ON p.staff_id = s.id
       LEFT JOIN projects pr ON p.project_id = pr.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff r ON p.reviewed_by = r.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToPerformance(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      overallRating: 'overall_rating',
      performanceScore: 'performance_score',
      feedback: 'feedback',
      strengths: 'strengths',
      areasForImprovement: 'areas_for_improvement',
      lessonsLearned: 'lessons_learned',
      reviewedBy: 'reviewed_by',
      reviewedByName: 'reviewed_by_name',
      reviewDate: 'review_date',
      status: 'status',
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
      `UPDATE performance SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM performance WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToPerformance(row) {
    return {
      id: row.performance_id,
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
      reviewPeriodStart: row.review_period_start ? row.review_period_start.toISOString().split('T')[0] : null,
      reviewPeriodEnd: row.review_period_end ? row.review_period_end.toISOString().split('T')[0] : null,
      overallRating: row.overall_rating ? parseFloat(row.overall_rating) : null,
      performanceScore: row.performance_score,
      feedback: row.feedback,
      strengths: row.strengths,
      areasForImprovement: row.areas_for_improvement,
      lessonsLearned: row.lessons_learned,
      reviewedBy: row.reviewed_by,
      reviewedByName: row.reviewed_by_name || (row.reviewer_first_name && row.reviewer_last_name
        ? `${row.reviewer_first_name} ${row.reviewer_last_name}` : null),
      reviewDate: row.review_date ? row.review_date.toISOString().split('T')[0] : null,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Performance;
