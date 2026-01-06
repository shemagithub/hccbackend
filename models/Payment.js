import pool from '../config/db.js';

class Payment {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        supplier VARCHAR(255) NOT NULL,
        invoice_number VARCHAR(100) NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        due_date DATE NOT NULL,
        payment_date DATE NULL,
        status ENUM('pending_approval', 'approved', 'paid', 'cancelled', 'overdue') DEFAULT 'pending_approval',
        payment_method ENUM('bank_transfer', 'check', 'cash', 'credit_card', 'other') NULL,
        reference_number VARCHAR(100) NULL,
        description TEXT NULL,
        requested_by INT NULL,
        requested_by_name VARCHAR(255) NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        is_advance BOOLEAN DEFAULT FALSE,
        advance_amount DECIMAL(15,2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date),
        INDEX idx_supplier (supplier),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (requested_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Payments table created or already exists.');
  }

  static async generatePaymentId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM payments WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `PAY-${year}-${sequence}`;
  }

  static async create({
    paymentId,
    projectId,
    supplier,
    invoiceNumber,
    amount,
    currency = 'USD',
    dueDate,
    paymentDate,
    status = 'pending_approval',
    paymentMethod,
    referenceNumber,
    description,
    requestedBy,
    requestedByName,
    isAdvance = false,
    advanceAmount
  }) {
    const payId = paymentId || await this.generatePaymentId();

    const [result] = await pool.execute(
      `INSERT INTO payments (
        payment_id, project_id, supplier, invoice_number, amount, currency, due_date, payment_date,
        status, payment_method, reference_number, description, requested_by, requested_by_name,
        is_advance, advance_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payId, projectId || null, supplier, invoiceNumber || null, amount, currency,
        dueDate, paymentDate || null, status, paymentMethod || null, referenceNumber || null,
        description || null, requestedBy || null, requestedByName || null, isAdvance ? 1 : 0,
        advanceAmount || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT p.*, pr.name as project_name, pr.project_id as project_code,
             s1.first_name as requester_first_name, s1.last_name as requester_last_name,
             s2.first_name as approver_first_name, s2.last_name as approver_last_name
      FROM payments p
      LEFT JOIN projects pr ON p.project_id = pr.id
      LEFT JOIN staff s1 ON p.requested_by = s1.id
      LEFT JOIN staff s2 ON p.approved_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (p.supplier LIKE ? OR p.invoice_number LIKE ? OR p.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND p.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND p.status = ?`;
      params.push(filters.status);
    }

    if (filters.isAdvance !== undefined) {
      query += ` AND p.is_advance = ?`;
      params.push(filters.isAdvance ? 1 : 0);
    }

    if (filters.overdue) {
      query += ` AND p.due_date < CURDATE() AND p.status NOT IN ('paid', 'cancelled')`;
    }

    query += ` ORDER BY p.due_date ASC, p.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToPayment(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT p.*, pr.name as project_name, pr.project_id as project_code,
              s1.first_name as requester_first_name, s1.last_name as requester_last_name,
              s2.first_name as approver_first_name, s2.last_name as approver_last_name
       FROM payments p
       LEFT JOIN projects pr ON p.project_id = pr.id
       LEFT JOIN staff s1 ON p.requested_by = s1.id
       LEFT JOIN staff s2 ON p.approved_by = s2.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToPayment(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      supplier: 'supplier',
      invoiceNumber: 'invoice_number',
      amount: 'amount',
      currency: 'currency',
      dueDate: 'due_date',
      paymentDate: 'payment_date',
      status: 'status',
      paymentMethod: 'payment_method',
      referenceNumber: 'reference_number',
      description: 'description',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      approvalDate: 'approval_date'
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
      `UPDATE payments SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM payments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(amount) as totalAmount,
        SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END) as pendingApproval,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paidAmount,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN is_advance = 1 THEN amount ELSE 0 END) as advanceAmount
      FROM payments
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToPayment(row) {
    return {
      id: row.payment_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      supplier: row.supplier,
      invoiceNumber: row.invoice_number,
      amount: parseFloat(row.amount),
      currency: row.currency,
      dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      paymentDate: row.payment_date ? row.payment_date.toISOString().split('T')[0] : null,
      status: row.status,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      description: row.description,
      requestedBy: row.requested_by,
      requestedByName: row.requested_by_name || (row.requester_first_name && row.requester_last_name
        ? `${row.requester_first_name} ${row.requester_last_name}` : null),
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      isAdvance: row.is_advance === 1,
      advanceAmount: row.advance_amount ? parseFloat(row.advance_amount) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Payment;

