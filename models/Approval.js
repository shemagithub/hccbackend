import pool from '../config/db.js';

class Approval {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        approval_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        type ENUM('Budget Increase', 'Budget Revision', 'Expense Approval', 'Payment Approval', 'Other') NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        amount DECIMAL(15,2) NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        requested_by INT NULL,
        requested_by_name VARCHAR(255) NULL,
        request_date DATE NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        decision_date DATE NULL,
        decision_comments TEXT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_type (type),
        INDEX idx_status (status),
        INDEX idx_request_date (request_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (requested_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Approvals table created or already exists.');
  }

  static async generateApprovalId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM approvals WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `APP-${year}-${sequence}`;
  }

  static async create({
    approvalId,
    projectId,
    type,
    title,
    description,
    amount,
    currency = 'USD',
    requestedBy,
    requestedByName,
    requestDate,
    status = 'pending',
    priority = 'medium'
  }) {
    const appId = approvalId || await this.generateApprovalId();

    const [result] = await pool.execute(
      `INSERT INTO approvals (
        approval_id, project_id, type, title, description, amount, currency,
        requested_by, requested_by_name, request_date, status, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appId, projectId || null, type, title, description || null, amount || null, currency,
        requestedBy || null, requestedByName || null, requestDate || new Date().toISOString().split('T')[0],
        status, priority
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT a.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as requester_first_name, s1.last_name as requester_last_name,
             s2.first_name as approver_first_name, s2.last_name as approver_last_name
      FROM approvals a
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN staff s1 ON a.requested_by = s1.id
      LEFT JOIN staff s2 ON a.approved_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (a.title LIKE ? OR a.description LIKE ? OR a.type LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND a.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.type) {
      query += ` AND a.type = ?`;
      params.push(filters.type);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND a.status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY a.request_date DESC, a.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToApproval(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT a.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as requester_first_name, s1.last_name as requester_last_name,
              s2.first_name as approver_first_name, s2.last_name as approver_last_name
       FROM approvals a
       LEFT JOIN projects p ON a.project_id = p.id
       LEFT JOIN staff s1 ON a.requested_by = s1.id
       LEFT JOIN staff s2 ON a.approved_by = s2.id
       WHERE a.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToApproval(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      status: 'status',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      decisionDate: 'decision_date',
      decisionComments: 'decision_comments'
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
      `UPDATE approvals SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM approvals WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as totalAmount
      FROM approvals
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToApproval(row) {
    return {
      id: row.approval_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      type: row.type,
      title: row.title,
      description: row.description,
      amount: row.amount ? parseFloat(row.amount) : null,
      currency: row.currency,
      requestedBy: row.requested_by,
      requestedByName: row.requested_by_name || (row.requester_first_name && row.requester_last_name
        ? `${row.requester_first_name} ${row.requester_last_name}` : null),
      requestDate: row.request_date ? row.request_date.toISOString().split('T')[0] : null,
      status: row.status,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      decisionDate: row.decision_date ? row.decision_date.toISOString().split('T')[0] : null,
      decisionComments: row.decision_comments,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Approval;

