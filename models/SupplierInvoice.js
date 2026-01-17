import pool from '../config/db.js';

class SupplierInvoice {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS supplier_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id VARCHAR(50) NOT NULL UNIQUE,
        supplier_name VARCHAR(255) NOT NULL,
        supplier_id INT NULL,
        project_id INT NULL,
        invoice_number VARCHAR(100) NOT NULL,
        invoice_date DATE NOT NULL,
        received_date DATE NOT NULL,
        due_date DATE NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL,
        status ENUM('pending', 'approved', 'paid', 'rejected', 'overdue') DEFAULT 'pending',
        payment_id VARCHAR(50) NULL,
        payment_date DATE NULL,
        payment_method ENUM('bank_transfer', 'check', 'cash', 'credit_card', 'other') NULL,
        description TEXT NULL,
        items JSON NULL,
        category VARCHAR(100) NULL,
        received_by INT NULL,
        received_by_name VARCHAR(255) NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_supplier (supplier_name),
        INDEX idx_supplier_id (supplier_id),
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date),
        INDEX idx_invoice_number (invoice_number),
        INDEX idx_category (category),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (received_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Supplier invoices table created or already exists.');
  }

  static async generateInvoiceId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM supplier_invoices WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `SINV-${year}-${sequence}`;
  }

  static async create({
    invoiceId,
    supplierName,
    supplierId,
    projectId,
    invoiceNumber,
    invoiceDate,
    receivedDate,
    dueDate,
    amount,
    currency = 'USD',
    taxAmount = 0,
    totalAmount,
    status = 'pending',
    paymentId,
    paymentDate,
    paymentMethod,
    description,
    items,
    category,
    receivedBy,
    receivedByName,
    approvedBy,
    approvedByName,
    approvalDate,
    notes
  }) {
    if (!invoiceId) {
      invoiceId = await this.generateInvoiceId();
    }

    if (!totalAmount) {
      totalAmount = parseFloat(amount) + parseFloat(taxAmount || 0);
    }

    const itemsJson = items ? JSON.stringify(items) : null;

    const [result] = await pool.execute(
      `INSERT INTO supplier_invoices (
        invoice_id, supplier_name, supplier_id, project_id, invoice_number, invoice_date,
        received_date, due_date, amount, currency, tax_amount, total_amount, status,
        payment_id, payment_date, payment_method, description, items, category,
        received_by, received_by_name, approved_by, approved_by_name, approval_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId, supplierName, supplierId || null, projectId || null,
        invoiceNumber, invoiceDate, receivedDate, dueDate,
        parseFloat(amount), currency, parseFloat(taxAmount || 0), parseFloat(totalAmount),
        status, paymentId || null, paymentDate || null, paymentMethod || null,
        description || null, itemsJson, category || null,
        receivedBy || null, receivedByName || null, approvedBy || null,
        approvedByName || null, approvalDate || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT si.*, p.name as project_name, p.project_id as project_code
      FROM supplier_invoices si
      LEFT JOIN projects p ON si.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.supplierName) {
      query += ' AND si.supplier_name LIKE ?';
      params.push(`%${filters.supplierName}%`);
    }

    if (filters.supplierId) {
      query += ' AND si.supplier_id = ?';
      params.push(parseInt(filters.supplierId));
    }

    if (filters.projectId) {
      query += ' AND si.project_id = ?';
      params.push(parseInt(filters.projectId));
    }

    if (filters.status) {
      query += ' AND si.status = ?';
      params.push(filters.status);
    }

    if (filters.category) {
      query += ' AND si.category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      query += ' AND (si.invoice_id LIKE ? OR si.supplier_name LIKE ? OR si.invoice_number LIKE ? OR si.description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.startDate) {
      query += ' AND si.due_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND si.due_date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY si.due_date DESC, si.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.offset));
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToInvoice(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT si.*, p.name as project_name, p.project_id as project_code
      FROM supplier_invoices si
      LEFT JOIN projects p ON si.project_id = p.id
      WHERE si.id = ?`,
      [id]
    );
    return rows.length > 0 ? this.mapRowToInvoice(rows[0]) : null;
  }

  static async findByInvoiceId(invoiceId) {
    const [rows] = await pool.execute(
      `SELECT si.*, p.name as project_name, p.project_id as project_code
      FROM supplier_invoices si
      LEFT JOIN projects p ON si.project_id = p.id
      WHERE si.invoice_id = ?`,
      [invoiceId]
    );
    return rows.length > 0 ? this.mapRowToInvoice(rows[0]) : null;
  }

  static async update(id, updates) {
    const allowedFields = [
      'supplierName', 'supplierId', 'projectId', 'invoiceNumber', 'invoiceDate',
      'receivedDate', 'dueDate', 'amount', 'currency', 'taxAmount', 'totalAmount',
      'status', 'paymentId', 'paymentDate', 'paymentMethod', 'description', 'items',
      'category', 'approvedBy', 'approvedByName', 'approvalDate', 'notes'
    ];

    const fieldMapping = {
      supplierName: 'supplier_name',
      supplierId: 'supplier_id',
      projectId: 'project_id',
      invoiceNumber: 'invoice_number',
      invoiceDate: 'invoice_date',
      receivedDate: 'received_date',
      paymentDate: 'payment_date',
      paymentMethod: 'payment_method',
      paymentId: 'payment_id',
      taxAmount: 'tax_amount',
      totalAmount: 'total_amount',
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
        
        if (key === 'amount' || key === 'taxAmount' || key === 'totalAmount') {
          params.push(parseFloat(value));
        } else if (key === 'supplierId' || key === 'projectId' || key === 'approvedBy') {
          params.push(value ? parseInt(value) : null);
        } else if (key === 'items') {
          params.push(value ? JSON.stringify(value) : null);
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
      `UPDATE supplier_invoices SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM supplier_invoices WHERE id = ?', [id]);
    return true;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as totalPaid,
        SUM(CASE WHEN status = 'overdue' THEN total_amount ELSE 0 END) as totalOverdue,
        SUM(CASE WHEN status IN ('pending', 'approved') THEN total_amount ELSE 0 END) as totalPending,
        SUM(total_amount) as totalAmount
      FROM supplier_invoices
      WHERE 1=1
    `;
    const params = [];

    if (filters.supplierId) {
      query += ' AND supplier_id = ?';
      params.push(parseInt(filters.supplierId));
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

  static mapRowToInvoice(row) {
    let items = null;
    if (row.items) {
      try {
        items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
      } catch (e) {
        items = null;
      }
    }

    return {
      id: row.id,
      invoiceId: row.invoice_id,
      supplierName: row.supplier_name,
      supplierId: row.supplier_id,
      projectId: row.project_id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      receivedDate: row.received_date,
      dueDate: row.due_date,
      amount: parseFloat(row.amount || 0),
      currency: row.currency,
      taxAmount: parseFloat(row.tax_amount || 0),
      totalAmount: parseFloat(row.total_amount || 0),
      status: row.status,
      paymentId: row.payment_id,
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      description: row.description,
      items: items,
      category: row.category,
      receivedBy: row.received_by,
      receivedByName: row.received_by_name,
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

export default SupplierInvoice;
