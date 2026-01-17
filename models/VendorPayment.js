import pool from '../config/db.js';

class VendorPayment {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS vendor_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id VARCHAR(50) NOT NULL UNIQUE,
        vendor_name VARCHAR(255) NOT NULL,
        vendor_id INT NULL,
        project_id INT NULL,
        invoice_number VARCHAR(100) NULL,
        invoice_date DATE NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        due_date DATE NOT NULL,
        payment_date DATE NULL,
        status ENUM('pending_approval', 'approved', 'paid', 'cancelled', 'overdue') DEFAULT 'pending_approval',
        payment_method ENUM('bank_transfer', 'check', 'cash', 'credit_card', 'other') NULL,
        reference_number VARCHAR(100) NULL,
        description TEXT NULL,
        category VARCHAR(100) NULL,
        requested_by INT NULL,
        requested_by_name VARCHAR(255) NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vendor (vendor_name),
        INDEX idx_vendor_id (vendor_id),
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date),
        INDEX idx_category (category),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (requested_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Vendor payments table created or already exists.');
  }

  static async generatePaymentId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM vendor_payments WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `VPAY-${year}-${sequence}`;
  }

  static async create({
    paymentId,
    vendorName,
    vendorId,
    projectId,
    invoiceNumber,
    invoiceDate,
    amount,
    currency = 'USD',
    dueDate,
    paymentDate,
    status = 'pending_approval',
    paymentMethod,
    referenceNumber,
    description,
    category,
    requestedBy,
    requestedByName,
    approvedBy,
    approvedByName,
    approvalDate,
    notes
  }) {
    if (!paymentId) {
      paymentId = await this.generatePaymentId();
    }

    const [result] = await pool.execute(
      `INSERT INTO vendor_payments (
        payment_id, vendor_name, vendor_id, project_id, invoice_number, invoice_date,
        amount, currency, due_date, payment_date, status, payment_method, reference_number,
        description, category, requested_by, requested_by_name, approved_by, approved_by_name,
        approval_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId, vendorName, vendorId || null, projectId || null,
        invoiceNumber || null, invoiceDate || null, parseFloat(amount), currency,
        dueDate, paymentDate || null, status, paymentMethod || null,
        referenceNumber || null, description || null, category || null,
        requestedBy || null, requestedByName || null, approvedBy || null,
        approvedByName || null, approvalDate || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT vp.*, p.name as project_name, p.project_id as project_code
      FROM vendor_payments vp
      LEFT JOIN projects p ON vp.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.vendorName) {
      query += ' AND vp.vendor_name LIKE ?';
      params.push(`%${filters.vendorName}%`);
    }

    if (filters.vendorId) {
      query += ' AND vp.vendor_id = ?';
      params.push(parseInt(filters.vendorId));
    }

    if (filters.projectId) {
      query += ' AND vp.project_id = ?';
      params.push(parseInt(filters.projectId));
    }

    if (filters.status) {
      query += ' AND vp.status = ?';
      params.push(filters.status);
    }

    if (filters.category) {
      query += ' AND vp.category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      query += ' AND (vp.payment_id LIKE ? OR vp.vendor_name LIKE ? OR vp.invoice_number LIKE ? OR vp.description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.startDate) {
      query += ' AND vp.due_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND vp.due_date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY vp.due_date DESC, vp.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.offset));
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToPayment(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT vp.*, p.name as project_name, p.project_id as project_code
      FROM vendor_payments vp
      LEFT JOIN projects p ON vp.project_id = p.id
      WHERE vp.id = ?`,
      [id]
    );
    return rows.length > 0 ? this.mapRowToPayment(rows[0]) : null;
  }

  static async findByPaymentId(paymentId) {
    const [rows] = await pool.execute(
      `SELECT vp.*, p.name as project_name, p.project_id as project_code
      FROM vendor_payments vp
      LEFT JOIN projects p ON vp.project_id = p.id
      WHERE vp.payment_id = ?`,
      [paymentId]
    );
    return rows.length > 0 ? this.mapRowToPayment(rows[0]) : null;
  }

  static async update(id, updates) {
    const allowedFields = [
      'vendorName', 'vendorId', 'projectId', 'invoiceNumber', 'invoiceDate',
      'amount', 'currency', 'dueDate', 'paymentDate', 'status', 'paymentMethod',
      'referenceNumber', 'description', 'category', 'approvedBy', 'approvedByName',
      'approvalDate', 'notes'
    ];

    const fieldMapping = {
      vendorName: 'vendor_name',
      vendorId: 'vendor_id',
      projectId: 'project_id',
      invoiceNumber: 'invoice_number',
      invoiceDate: 'invoice_date',
      paymentDate: 'payment_date',
      paymentMethod: 'payment_method',
      referenceNumber: 'reference_number',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      approvalDate: 'approval_date'
    };

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = fieldMapping[key] || key;
        setClauses.push(`${dbField} = ?`);
        
        if (key === 'amount') {
          params.push(parseFloat(value));
        } else if (key === 'vendorId' || key === 'projectId' || key === 'approvedBy') {
          params.push(value ? parseInt(value) : null);
        } else {
          params.push(value);
        }
      }
    }

    if (setClauses.length === 0) {
      return await this.findById(id);
    }

    params.push(id);
    await pool.execute(
      `UPDATE vendor_payments SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM vendor_payments WHERE id = ?', [id]);
    return true;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as totalPaid,
        SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as totalOverdue,
        SUM(CASE WHEN status IN ('pending_approval', 'approved') THEN amount ELSE 0 END) as totalPending,
        SUM(amount) as totalAmount
      FROM vendor_payments
      WHERE 1=1
    `;
    const params = [];

    if (filters.vendorId) {
      query += ' AND vendor_id = ?';
      params.push(parseInt(filters.vendorId));
    }

    if (filters.projectId) {
      query += ' AND project_id = ?';
      params.push(parseInt(filters.projectId));
    }

    if (filters.startDate) {
      query += ' AND due_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND due_date <= ?';
      params.push(filters.endDate);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToPayment(row) {
    return {
      id: row.id,
      paymentId: row.payment_id,
      vendorName: row.vendor_name,
      vendorId: row.vendor_id,
      projectId: row.project_id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      amount: parseFloat(row.amount || 0),
      currency: row.currency,
      dueDate: row.due_date,
      paymentDate: row.payment_date,
      status: row.status,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      description: row.description,
      category: row.category,
      requestedBy: row.requested_by,
      requestedByName: row.requested_by_name,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name,
      approvalDate: row.approval_date,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Joined fields
      projectName: row.project_name,
      projectCode: row.project_code
    };
  }
}

export default VendorPayment;
