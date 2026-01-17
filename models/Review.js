import pool from '../config/db.js';

class Review {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        review_id VARCHAR(50) NOT NULL UNIQUE,
        item_type ENUM('deliverable', 'expense', 'task', 'document', 'other') NOT NULL,
        item_id INT NOT NULL,
        item_reference VARCHAR(100) NULL,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        submitted_by INT NULL,
        submitted_by_name VARCHAR(255) NULL,
        submission_date DATE NOT NULL,
        status ENUM('pending_review', 'under_review', 'approved', 'rejected', 'revision_requested') DEFAULT 'pending_review',
        reviewed_by INT NULL,
        reviewed_by_name VARCHAR(255) NULL,
        review_date DATE NULL,
        review_comments TEXT NULL,
        revision_comments TEXT NULL,
        approval_date DATE NULL,
        rejection_reason TEXT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        version VARCHAR(20) DEFAULT '1.0',
        previous_review_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_item_type (item_type),
        INDEX idx_item_id (item_id),
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_submission_date (submission_date),
        INDEX idx_review_date (review_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (submitted_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (reviewed_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (previous_review_id) REFERENCES reviews(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Reviews table created or already exists.');
  }

  static async generateReviewId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM reviews WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `REV-${year}-${sequence}`;
  }

  static async create({
    reviewId,
    itemType,
    itemId,
    itemReference,
    projectId,
    title,
    description,
    submittedBy,
    submittedByName,
    submissionDate,
    status = 'pending_review',
    priority = 'medium',
    version = '1.0',
    previousReviewId = null
  }) {
    const revId = reviewId || await this.generateReviewId();

    const [result] = await pool.execute(
      `INSERT INTO reviews (
        review_id, item_type, item_id, item_reference, project_id, title, description,
        submitted_by, submitted_by_name, submission_date, status, priority, version, previous_review_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        revId, itemType, itemId, itemReference || null, projectId || null, title, description || null,
        submittedBy || null, submittedByName || null, submissionDate || new Date().toISOString().split('T')[0],
        status, priority, version, previousReviewId || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT r.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
             s2.first_name as reviewer_first_name, s2.last_name as reviewer_last_name
      FROM reviews r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN staff s1 ON r.submitted_by = s1.id
      LEFT JOIN staff s2 ON r.reviewed_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (r.title LIKE ? OR r.description LIKE ? OR r.item_reference LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.itemType) {
      query += ` AND r.item_type = ?`;
      params.push(filters.itemType);
    }

    if (filters.itemId) {
      query += ` AND r.item_id = ?`;
      params.push(filters.itemId);
    }

    if (filters.projectId) {
      query += ` AND r.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND r.status = ?`;
      params.push(filters.status);
    }

    if (filters.pendingOnly) {
      query += ` AND r.status IN ('pending_review', 'under_review')`;
    }

    if (filters.submittedBy) {
      query += ` AND r.submitted_by = ?`;
      params.push(filters.submittedBy);
    }

    query += ` ORDER BY r.submission_date DESC, r.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToReview(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT r.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
              s2.first_name as reviewer_first_name, s2.last_name as reviewer_last_name
       FROM reviews r
       LEFT JOIN projects p ON r.project_id = p.id
       LEFT JOIN staff s1 ON r.submitted_by = s1.id
       LEFT JOIN staff s2 ON r.reviewed_by = s2.id
       WHERE r.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToReview(rows[0]);
  }

  static async findByReviewId(reviewId) {
    const [rows] = await pool.execute(
      `SELECT r.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
              s2.first_name as reviewer_first_name, s2.last_name as reviewer_last_name
       FROM reviews r
       LEFT JOIN projects p ON r.project_id = p.id
       LEFT JOIN staff s1 ON r.submitted_by = s1.id
       LEFT JOIN staff s2 ON r.reviewed_by = s2.id
       WHERE r.review_id = ?`,
      [reviewId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToReview(rows[0]);
  }

  static async findByItem(itemType, itemId) {
    const [rows] = await pool.execute(
      `SELECT r.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
              s2.first_name as reviewer_first_name, s2.last_name as reviewer_last_name
       FROM reviews r
       LEFT JOIN projects p ON r.project_id = p.id
       LEFT JOIN staff s1 ON r.submitted_by = s1.id
       LEFT JOIN staff s2 ON r.reviewed_by = s2.id
       WHERE r.item_type = ? AND r.item_id = ?
       ORDER BY r.created_at DESC`,
      [itemType, itemId]
    );
    
    return rows.map(row => this.mapRowToReview(row));
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      status: 'status',
      reviewedBy: 'reviewed_by',
      reviewedByName: 'reviewed_by_name',
      reviewDate: 'review_date',
      reviewComments: 'review_comments',
      revisionComments: 'revision_comments',
      approvalDate: 'approval_date',
      rejectionReason: 'rejection_reason',
      priority: 'priority',
      version: 'version'
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
      `UPDATE reviews SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM reviews WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pendingReview,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as underReview,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'revision_requested' THEN 1 ELSE 0 END) as revisionRequested
      FROM reviews
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToReview(row) {
    return {
      id: row.review_id,
      dbId: row.id,
      itemType: row.item_type,
      itemId: row.item_id,
      itemReference: row.item_reference,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      description: row.description,
      submittedBy: row.submitted_by,
      submittedByName: row.submitted_by_name || (row.submitter_first_name && row.submitter_last_name
        ? `${row.submitter_first_name} ${row.submitter_last_name}` : null),
      submissionDate: row.submission_date ? row.submission_date.toISOString().split('T')[0] : null,
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedByName: row.reviewed_by_name || (row.reviewer_first_name && row.reviewer_last_name
        ? `${row.reviewer_first_name} ${row.reviewer_last_name}` : null),
      reviewDate: row.review_date ? row.review_date.toISOString().split('T')[0] : null,
      reviewComments: row.review_comments,
      revisionComments: row.revision_comments,
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      rejectionReason: row.rejection_reason,
      priority: row.priority,
      version: row.version,
      previousReviewId: row.previous_review_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Review;
