import pool from '../config/db.js';

class Document {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        name VARCHAR(500) NOT NULL,
        description TEXT NULL,
        file_type VARCHAR(50) NULL,
        file_size VARCHAR(50) NULL,
        file_data LONGTEXT NULL,
        permissions ENUM('view_only', 'view_edit', 'full_access') DEFAULT 'view_only',
        status ENUM('active', 'archived', 'pending') DEFAULT 'active',
        uploaded_by INT NULL,
        uploaded_by_name VARCHAR(255) NULL,
        upload_date DATE NOT NULL,
        last_modified DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_file_type (file_type),
        INDEX idx_upload_date (upload_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (uploaded_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Documents table created or already exists.');
  }

  static async generateDocumentId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM documents WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `DOC-${year}-${sequence}`;
  }

  static async create({
    documentId,
    projectId,
    name,
    description,
    fileType,
    fileSize,
    fileData,
    permissions = 'view_only',
    status = 'active',
    uploadedBy,
    uploadedByName,
    uploadDate
  }) {
    try {
      const docId = documentId || await this.generateDocumentId();
      const today = uploadDate || new Date().toISOString().split('T')[0];

      // Set max_allowed_packet for large file uploads
      try {
        await pool.execute('SET SESSION max_allowed_packet = 300*1024*1024');
      } catch (packetError) {
        console.warn('Could not set max_allowed_packet:', packetError.message);
      }

      const [result] = await pool.execute(
        `INSERT INTO documents (
          document_id, project_id, name, description, file_type, file_size, file_data,
          permissions, status, uploaded_by, uploaded_by_name, upload_date, last_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          docId, projectId || null, name, description || null, fileType || null, fileSize || null,
          fileData || null, permissions, status, uploadedBy || null, uploadedByName || null,
          today, today
        ]
      );

      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Error in Document.create:', error);
      console.error('Error stack:', error.stack);
      throw error; // Re-throw to be handled by controller
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT d.*, p.name as project_name, p.project_id as project_code
        FROM documents d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.search) {
        query += ` AND (d.name LIKE ? OR d.description LIKE ? OR d.document_id LIKE ?)`;
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (filters.projectId && filters.projectId !== null && filters.projectId !== undefined) {
        query += ` AND d.project_id = ?`;
        params.push(filters.projectId);
      }

      if (filters.status && filters.status !== 'all') {
        query += ` AND d.status = ?`;
        params.push(filters.status);
      }

      if (filters.fileType && filters.fileType !== 'all') {
        query += ` AND d.file_type LIKE ?`;
        params.push(`%${filters.fileType}%`);
      }

      query += ` ORDER BY d.upload_date DESC, d.created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(parseInt(filters.limit));
      }

      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(parseInt(filters.offset));
      }

      const [rows] = await pool.execute(query, params);
      return rows.map(row => this.mapRowToDocument(row));
    } catch (error) {
      console.error('Error in Document.findAll:', error);
      console.error('Error stack:', error.stack);
      console.error('Filters:', filters);
      throw error; // Re-throw to be handled by controller
    }
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT d.*, p.name as project_name, p.project_id as project_code
       FROM documents d
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.id = ?`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapRowToDocument(rows[0]);
  }

  static async findByDocumentId(documentId) {
    const [rows] = await pool.execute(
      `SELECT d.*, p.name as project_name, p.project_id as project_code
       FROM documents d
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.document_id = ?`,
      [documentId]
    );
    if (rows.length === 0) return null;
    return this.mapRowToDocument(rows[0]);
  }

  static async update(id, updateData) {
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) return await this.findById(id);

    values.push(id);
    await pool.execute(
      `UPDATE documents SET ${fields.join(', ')}, last_modified = CURDATE() WHERE id = ?`,
      values
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM documents WHERE id = ?', [id]);
    return true;
  }

  static async getStats(filters = {}) {
    try {
      // Handle case where filters might be null or a number directly
      const filterObj = typeof filters === 'object' && filters !== null ? filters : { projectId: filters || null };
      
      let query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN file_type LIKE '%pdf%' THEN 1 END) as pdf_count,
          COUNT(CASE WHEN permissions = 'view_edit' THEN 1 END) as shared_count
        FROM documents
        WHERE 1=1
      `;
      const params = [];

      if (filterObj.projectId && filterObj.projectId !== null && filterObj.projectId !== undefined) {
        query += ` AND project_id = ?`;
        params.push(filterObj.projectId);
      }

      const [rows] = await pool.execute(query, params);
      const result = rows[0] || { total: 0, active: 0, archived: 0, pending: 0, pdf_count: 0, shared_count: 0 };
      
      // Ensure all values are strings (as expected by frontend)
      return {
        total: String(result.total || 0),
        active: String(result.active || 0),
        archived: String(result.archived || 0),
        pending: String(result.pending || 0),
        pdf_count: String(result.pdf_count || 0),
        shared_count: String(result.shared_count || 0)
      };
    } catch (error) {
      console.error('Error in Document.getStats:', error);
      console.error('Error stack:', error.stack);
      // Return default stats on error
      return { total: '0', active: '0', archived: '0', pending: '0', pdf_count: '0', shared_count: '0' };
    }
  }

  static mapRowToDocument(row) {
    return {
      id: row.document_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      name: row.name,
      description: row.description,
      fileType: row.file_type,
      fileSize: row.file_size,
      fileData: row.file_data,
      permissions: row.permissions,
      status: row.status,
      uploadedBy: row.uploaded_by,
      uploadedByName: row.uploaded_by_name,
      uploadDate: row.upload_date ? row.upload_date.toISOString().split('T')[0] : null,
      lastModified: row.last_modified ? row.last_modified.toISOString().split('T')[0] : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Document;

