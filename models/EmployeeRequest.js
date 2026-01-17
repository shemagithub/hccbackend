import pool from '../config/db.js';

class EmployeeRequest {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS employee_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        project_id INT NULL,
        request_type ENUM('resource', 'expense', 'equipment', 'support', 'other') NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(15,2) NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        status ENUM('pending', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
        requested_date DATE NOT NULL,
        required_date DATE NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        rejection_reason TEXT NULL,
        attachments TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_project (project_id),
        INDEX idx_request_type (request_type),
        INDEX idx_status (status),
        INDEX idx_requested_date (requested_date),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Employee requests table created or already exists.');
  }

  static async generateRequestId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM employee_requests WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `ER-${year}-${sequence}`;
  }

  static async create({
    requestId, staffId, projectId, requestType, title, description, amount,
    currency = 'USD', priority = 'medium', status = 'pending', requestedDate,
    requiredDate, approvedBy, approvedByName, approvalDate, rejectionReason,
    attachments, notes
  }) {
    const rId = requestId || await this.generateRequestId();

    const [result] = await pool.execute(
      `INSERT INTO employee_requests (
        request_id, staff_id, project_id, request_type, title, description, amount, currency,
        priority, status, requested_date, required_date, approved_by, approved_by_name,
        approval_date, rejection_reason, attachments, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rId, staffId, projectId || null, requestType, title, description,
        amount || null, currency, priority, status,
        requestedDate || new Date().toISOString().split('T')[0], requiredDate || null,
        approvedBy || null, approvedByName || null, approvalDate || null,
        rejectionReason || null, attachments ? JSON.stringify(attachments) : null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT er.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
             p.name as project_name, p.project_id as project_code,
             d.name as department_name,
             a.first_name as approver_first_name, a.last_name as approver_last_name
      FROM employee_requests er
      LEFT JOIN staff s ON er.staff_id = s.id
      LEFT JOIN projects p ON er.project_id = p.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN staff a ON er.approved_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND er.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.projectId) {
      query += ` AND er.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.requestType && filters.requestType !== 'all') {
      query += ` AND er.request_type = ?`;
      params.push(filters.requestType);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND er.status = ?`;
      params.push(filters.status);
    }

    if (filters.priority && filters.priority !== 'all') {
      query += ` AND er.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.startDate) {
      query += ` AND er.requested_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND er.requested_date <= ?`;
      params.push(filters.endDate);
    }

    if (filters.search) {
      query += ` AND (er.title LIKE ? OR er.description LIKE ? OR p.name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY er.requested_date DESC, er.created_at DESC`;

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
      `SELECT er.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              p.name as project_name, p.project_id as project_code,
              d.name as department_name,
              a.first_name as approver_first_name, a.last_name as approver_last_name
       FROM employee_requests er
       LEFT JOIN staff s ON er.staff_id = s.id
       LEFT JOIN projects p ON er.project_id = p.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff a ON er.approved_by = a.id
       WHERE er.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToRequest(rows[0]);
  }

  static async findByRequestId(requestId) {
    const [rows] = await pool.execute(
      `SELECT er.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              p.name as project_name, p.project_id as project_code,
              d.name as department_name,
              a.first_name as approver_first_name, a.last_name as approver_last_name
       FROM employee_requests er
       LEFT JOIN staff s ON er.staff_id = s.id
       LEFT JOIN projects p ON er.project_id = p.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff a ON er.approved_by = a.id
       WHERE er.request_id = ?`,
      [requestId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToRequest(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      requestType: 'request_type',
      title: 'title',
      description: 'description',
      amount: 'amount',
      currency: 'currency',
      priority: 'priority',
      status: 'status',
      requiredDate: 'required_date',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      approvalDate: 'approval_date',
      rejectionReason: 'rejection_reason',
      attachments: 'attachments',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'attachments') {
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
      `UPDATE employee_requests SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM employee_requests WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToRequest(row) {
    return {
      id: row.request_id,
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
      requestType: row.request_type,
      title: row.title,
      description: row.description,
      amount: row.amount ? parseFloat(row.amount) : null,
      currency: row.currency,
      priority: row.priority,
      status: row.status,
      requestedDate: row.requested_date ? row.requested_date.toISOString().split('T')[0] : null,
      requiredDate: row.required_date ? row.required_date.toISOString().split('T')[0] : null,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      rejectionReason: row.rejection_reason,
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default EmployeeRequest;
