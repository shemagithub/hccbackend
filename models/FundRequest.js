import pool from '../config/db.js';

class FundRequest {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS fund_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NOT NULL,
        title VARCHAR(500) NOT NULL,
        requested_amount DECIMAL(15,2) NOT NULL,
        approved_amount DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        status ENUM('pending', 'under_review', 'approved', 'rejected', 'disbursed') DEFAULT 'pending',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        purpose TEXT NOT NULL,
        justification TEXT NOT NULL,
        requested_by INT NOT NULL,
        requested_by_name VARCHAR(255) NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        request_date DATE NOT NULL,
        approval_date DATE NULL,
        disbursement_date DATE NULL,
        rejection_reason TEXT NULL,
        attachments TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_requested_by (requested_by),
        INDEX idx_request_date (request_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (requested_by) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Fund requests table created or already exists.');
  }

  static async generateRequestId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM fund_requests WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `FR-${year}-${sequence}`;
  }

  static async create({
    requestId, projectId, title, requestedAmount, approvedAmount = 0,
    currency = 'USD', status = 'pending', priority = 'medium',
    purpose, justification, requestedBy, requestedByName,
    approvedBy, approvedByName, requestDate, approvalDate,
    disbursementDate, rejectionReason, attachments, notes
  }) {
    const rId = requestId || await this.generateRequestId();

    const [result] = await pool.execute(
      `INSERT INTO fund_requests (
        request_id, project_id, title, requested_amount, approved_amount, currency,
        status, priority, purpose, justification, requested_by, requested_by_name,
        approved_by, approved_by_name, request_date, approval_date, disbursement_date,
        rejection_reason, attachments, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rId, projectId, title, requestedAmount, approvedAmount, currency,
        status, priority, purpose, justification, requestedBy, requestedByName || null,
        approvedBy || null, approvedByName || null, requestDate || new Date().toISOString().split('T')[0],
        approvalDate || null, disbursementDate || null, rejectionReason || null,
        attachments ? JSON.stringify(attachments) : null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT fr.*, p.name as project_name, p.project_id as project_code,
             r.first_name as requester_first_name, r.last_name as requester_last_name, r.email as requester_email,
             a.first_name as approver_first_name, a.last_name as approver_last_name
      FROM fund_requests fr
      LEFT JOIN projects p ON fr.project_id = p.id
      LEFT JOIN staff r ON fr.requested_by = r.id
      LEFT JOIN staff a ON fr.approved_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.projectId) {
      query += ` AND fr.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND fr.status = ?`;
      params.push(filters.status);
    }

    if (filters.priority && filters.priority !== 'all') {
      query += ` AND fr.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.requestedBy) {
      query += ` AND fr.requested_by = ?`;
      params.push(filters.requestedBy);
    }

    if (filters.startDate) {
      query += ` AND fr.request_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND fr.request_date <= ?`;
      params.push(filters.endDate);
    }

    if (filters.search) {
      query += ` AND (fr.title LIKE ? OR fr.purpose LIKE ? OR p.name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY fr.request_date DESC, fr.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToRequest(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT fr.*, p.name as project_name, p.project_id as project_code,
              r.first_name as requester_first_name, r.last_name as requester_last_name, r.email as requester_email,
              a.first_name as approver_first_name, a.last_name as approver_last_name
       FROM fund_requests fr
       LEFT JOIN projects p ON fr.project_id = p.id
       LEFT JOIN staff r ON fr.requested_by = r.id
       LEFT JOIN staff a ON fr.approved_by = a.id
       WHERE fr.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToRequest(rows[0]);
  }

  static async findByRequestId(requestId) {
    const [rows] = await pool.execute(
      `SELECT fr.*, p.name as project_name, p.project_id as project_code,
              r.first_name as requester_first_name, r.last_name as requester_last_name, r.email as requester_email,
              a.first_name as approver_first_name, a.last_name as approver_last_name
       FROM fund_requests fr
       LEFT JOIN projects p ON fr.project_id = p.id
       LEFT JOIN staff r ON fr.requested_by = r.id
       LEFT JOIN staff a ON fr.approved_by = a.id
       WHERE fr.request_id = ?`,
      [requestId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToRequest(rows[0]);
  }

  static async update(id, updateData) {
    const allowedFields = [
      'title', 'requested_amount', 'approved_amount', 'currency', 'status', 'priority',
      'purpose', 'justification', 'approved_by', 'approved_by_name', 'approval_date',
      'disbursement_date', 'rejection_reason', 'attachments', 'notes'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updates.push(`${dbField} = ?`);
        if (field === 'attachments' && updateData[field]) {
          values.push(JSON.stringify(updateData[field]));
        } else {
          values.push(updateData[field]);
        }
      }
    }

    if (updates.length === 0) return false;

    values.push(id);

    const [result] = await pool.execute(
      `UPDATE fund_requests SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM fund_requests WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToRequest(row) {
    return {
      id: row.request_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      requestedAmount: parseFloat(row.requested_amount),
      approvedAmount: parseFloat(row.approved_amount || 0),
      currency: row.currency,
      status: row.status,
      priority: row.priority,
      purpose: row.purpose,
      justification: row.justification,
      requestedBy: row.requested_by,
      requestedByName: row.requested_by_name || (row.requester_first_name && row.requester_last_name
        ? `${row.requester_first_name} ${row.requester_last_name}` : null),
      requestedByEmail: row.requester_email,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      requestDate: row.request_date ? row.request_date.toISOString().split('T')[0] : null,
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      disbursementDate: row.disbursement_date ? row.disbursement_date.toISOString().split('T')[0] : null,
      rejectionReason: row.rejection_reason,
      attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default FundRequest;
