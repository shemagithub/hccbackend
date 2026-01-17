import pool from '../config/db.js';

class ClientBilling {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS client_billings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        billing_id VARCHAR(50) NOT NULL UNIQUE,
        client_id INT NOT NULL,
        project_id INT NULL,
        billing_date DATE NOT NULL,
        due_date DATE NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
        invoice_id VARCHAR(50) NULL,
        description TEXT NULL,
        payment_date DATE NULL,
        payment_method ENUM('bank_transfer', 'check', 'cash', 'credit_card', 'other') NULL,
        reference_number VARCHAR(100) NULL,
        notes TEXT NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_client (client_id),
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_billing_date (billing_date),
        INDEX idx_due_date (due_date),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Client billings table created or already exists.');
  }

  static async generateBillingId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM client_billings WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `BLG-${year}-${sequence}`;
  }

  static async create({
    billingId,
    clientId,
    projectId,
    billingDate,
    dueDate,
    amount,
    currency = 'USD',
    status = 'draft',
    invoiceId,
    description,
    paymentDate,
    paymentMethod,
    referenceNumber,
    notes,
    createdBy,
    createdByName
  }) {
    if (!billingId) {
      billingId = await this.generateBillingId();
    }

    const [result] = await pool.execute(
      `INSERT INTO client_billings (
        billing_id, client_id, project_id, billing_date, due_date, amount, currency,
        status, invoice_id, description, payment_date, payment_method, reference_number,
        notes, created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        billingId, clientId, projectId || null, billingDate, dueDate,
        parseFloat(amount), currency, status, invoiceId || null, description || null,
        paymentDate || null, paymentMethod || null, referenceNumber || null,
        notes || null, createdBy || null, createdByName || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT cb.*, 
        c.name as client_name, c.company as client_company, c.email as client_email,
        p.name as project_name, p.project_id as project_code
      FROM client_billings cb
      LEFT JOIN clients c ON cb.client_id = c.id
      LEFT JOIN projects p ON cb.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.clientId) {
      query += ' AND cb.client_id = ?';
      params.push(parseInt(filters.clientId));
    }

    if (filters.projectId) {
      query += ' AND cb.project_id = ?';
      params.push(parseInt(filters.projectId));
    }

    if (filters.status) {
      query += ' AND cb.status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (cb.billing_id LIKE ? OR c.name LIKE ? OR c.company LIKE ? OR cb.description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.startDate) {
      query += ' AND cb.billing_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND cb.billing_date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY cb.billing_date DESC, cb.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.offset));
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToBilling(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT cb.*, 
        c.name as client_name, c.company as client_company, c.email as client_email,
        p.name as project_name, p.project_id as project_code
      FROM client_billings cb
      LEFT JOIN clients c ON cb.client_id = c.id
      LEFT JOIN projects p ON cb.project_id = p.id
      WHERE cb.id = ?`,
      [id]
    );
    return rows.length > 0 ? this.mapRowToBilling(rows[0]) : null;
  }

  static async findByBillingId(billingId) {
    const [rows] = await pool.execute(
      `SELECT cb.*, 
        c.name as client_name, c.company as client_company, c.email as client_email,
        p.name as project_name, p.project_id as project_code
      FROM client_billings cb
      LEFT JOIN clients c ON cb.client_id = c.id
      LEFT JOIN projects p ON cb.project_id = p.id
      WHERE cb.billing_id = ?`,
      [billingId]
    );
    return rows.length > 0 ? this.mapRowToBilling(rows[0]) : null;
  }

  static async update(id, updates) {
    const allowedFields = [
      'clientId', 'projectId', 'billingDate', 'dueDate', 'amount', 'currency',
      'status', 'invoiceId', 'description', 'paymentDate', 'paymentMethod',
      'referenceNumber', 'notes'
    ];

    const fieldMapping = {
      clientId: 'client_id',
      projectId: 'project_id',
      billingDate: 'billing_date',
      dueDate: 'due_date',
      paymentDate: 'payment_date',
      paymentMethod: 'payment_method',
      referenceNumber: 'reference_number',
      invoiceId: 'invoice_id'
    };

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = fieldMapping[key] || key;
        setClauses.push(`${dbField} = ?`);
        
        if (key === 'amount') {
          params.push(parseFloat(value));
        } else if (key === 'clientId' || key === 'projectId') {
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
      `UPDATE client_billings SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM client_billings WHERE id = ?', [id]);
    return true;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as totalPaid,
        SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as totalOverdue,
        SUM(CASE WHEN status = 'sent' THEN amount ELSE 0 END) as totalPending,
        SUM(amount) as totalAmount
      FROM client_billings
      WHERE 1=1
    `;
    const params = [];

    if (filters.clientId) {
      query += ' AND client_id = ?';
      params.push(parseInt(filters.clientId));
    }

    if (filters.projectId) {
      query += ' AND project_id = ?';
      params.push(parseInt(filters.projectId));
    }

    if (filters.startDate) {
      query += ' AND billing_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND billing_date <= ?';
      params.push(filters.endDate);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToBilling(row) {
    return {
      id: row.id,
      billingId: row.billing_id,
      clientId: row.client_id,
      projectId: row.project_id,
      billingDate: row.billing_date,
      dueDate: row.due_date,
      amount: parseFloat(row.amount || 0),
      currency: row.currency,
      status: row.status,
      invoiceId: row.invoice_id,
      description: row.description,
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      notes: row.notes,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Joined fields
      clientName: row.client_name,
      clientCompany: row.client_company,
      clientEmail: row.client_email,
      projectName: row.project_name,
      projectCode: row.project_code
    };
  }
}

export default ClientBilling;
