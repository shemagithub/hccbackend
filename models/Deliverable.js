import pool from '../config/db.js';

class Deliverable {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS deliverables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        deliverable_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        type VARCHAR(255) NOT NULL,
        category ENUM('Report', 'Drawing', 'Document', 'Specification', 'Other') DEFAULT 'Document',
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        submitted_by INT NULL,
        submitted_by_name VARCHAR(255) NULL,
        submission_date DATE NOT NULL,
        status ENUM('draft', 'pending_review', 'under_review', 'approved', 'rejected', 'revision_requested') DEFAULT 'draft',
        file_path VARCHAR(500) NULL,
        file_data LONGTEXT NULL,
        file_name VARCHAR(255) NULL,
        file_type VARCHAR(100) NULL,
        file_size VARCHAR(50) NULL,
        version VARCHAR(20) DEFAULT '1.0',
        reviewed_by INT NULL,
        reviewed_by_name VARCHAR(255) NULL,
        review_date DATE NULL,
        review_comments TEXT NULL,
        approval_date DATE NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_category (category),
        INDEX idx_submission_date (submission_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (submitted_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (reviewed_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    
    // Add new file fields if they don't exist (migration)
    try {
      await pool.execute(`
        ALTER TABLE deliverables 
        ADD COLUMN IF NOT EXISTS file_data LONGTEXT NULL,
        ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS file_type VARCHAR(100) NULL
      `);
    } catch (error) {
      // Columns might already exist, ignore error
      console.log('Note: file_data, file_name, and file_type columns may already exist');
    }
    
    console.log('Deliverables table created or already exists.');
  }

  static async generateDeliverableId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM deliverables WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `DEL-${year}-${sequence}`;
  }

  static async create({
    deliverableId,
    projectId,
    type,
    category = 'Document',
    title,
    description,
    submittedBy,
    submittedByName,
    submissionDate,
    status = 'draft',
    filePath,
    fileData,
    fileName,
    fileType,
    fileSize,
    version = '1.0',
    priority = 'medium'
  }) {
    const delId = deliverableId || await this.generateDeliverableId();

    const [result] = await pool.execute(
      `INSERT INTO deliverables (
        deliverable_id, project_id, type, category, title, description, submitted_by, submitted_by_name,
        submission_date, status, file_path, file_data, file_name, file_type, file_size, version, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        delId, projectId || null, type, category, title, description || null,
        submittedBy || null, submittedByName || null, submissionDate || new Date().toISOString().split('T')[0],
        status, filePath || null, fileData || null, fileName || null, fileType || null, fileSize || null, version, priority
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT d.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
             s2.first_name as reviewer_first_name, s2.last_name as reviewer_last_name
      FROM deliverables d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN staff s1 ON d.submitted_by = s1.id
      LEFT JOIN staff s2 ON d.reviewed_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (d.title LIKE ? OR d.type LIKE ? OR d.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND d.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.category) {
      query += ` AND d.category = ?`;
      params.push(filters.category);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND d.status = ?`;
      params.push(filters.status);
    }

    // Filter by department through projects
    if (filters.departmentId) {
      // Get department name from departments table
      query += ` AND EXISTS (
        SELECT 1 FROM projects pr
        INNER JOIN departments dept ON pr.department = dept.name
        WHERE pr.id = d.project_id AND dept.id = ?
      )`;
      params.push(filters.departmentId);
    } else if (filters.departmentName) {
      // Filter by department name directly
      query += ` AND p.department = ?`;
      params.push(filters.departmentName);
    }

    query += ` ORDER BY d.submission_date DESC, d.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToDeliverable(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT d.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
              s2.first_name as reviewer_first_name, s2.last_name as reviewer_last_name
       FROM deliverables d
       LEFT JOIN projects p ON d.project_id = p.id
       LEFT JOIN staff s1 ON d.submitted_by = s1.id
       LEFT JOIN staff s2 ON d.reviewed_by = s2.id
       WHERE d.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToDeliverable(rows[0]);
  }

  static async findByDeliverableId(deliverableId) {
    const [rows] = await pool.execute(
      `SELECT d.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
              s2.first_name as reviewer_first_name, s2.last_name as reviewer_last_name
       FROM deliverables d
       LEFT JOIN projects p ON d.project_id = p.id
       LEFT JOIN staff s1 ON d.submitted_by = s1.id
       LEFT JOIN staff s2 ON d.reviewed_by = s2.id
       WHERE d.deliverable_id = ?`,
      [deliverableId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToDeliverable(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      type: 'type',
      category: 'category',
      title: 'title',
      description: 'description',
      status: 'status',
      filePath: 'file_path',
      fileData: 'file_data',
      fileName: 'file_name',
      fileType: 'file_type',
      fileSize: 'file_size',
      version: 'version',
      reviewedBy: 'reviewed_by',
      reviewedByName: 'reviewed_by_name',
      reviewDate: 'review_date',
      reviewComments: 'review_comments',
      approvalDate: 'approval_date',
      priority: 'priority'
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
      `UPDATE deliverables SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM deliverables WHERE id = ?', [id]);
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
      FROM deliverables
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToDeliverable(row) {
    return {
      id: row.deliverable_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      type: row.type,
      category: row.category,
      title: row.title,
      description: row.description,
      submittedBy: row.submitted_by,
      submittedByName: row.submitted_by_name || (row.submitter_first_name && row.submitter_last_name
        ? `${row.submitter_first_name} ${row.submitter_last_name}` : null),
      submissionDate: row.submission_date ? row.submission_date.toISOString().split('T')[0] : null,
      status: row.status,
      filePath: row.file_path,
      fileData: row.file_data,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      version: row.version,
      reviewedBy: row.reviewed_by,
      reviewedByName: row.reviewed_by_name || (row.reviewer_first_name && row.reviewer_last_name
        ? `${row.reviewer_first_name} ${row.reviewer_last_name}` : null),
      reviewDate: row.review_date ? row.review_date.toISOString().split('T')[0] : null,
      reviewComments: row.review_comments,
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Deliverable;

