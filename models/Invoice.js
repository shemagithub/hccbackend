import pool from '../config/db.js';

class Invoice {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id VARCHAR(50) NOT NULL UNIQUE,
        client_id INT NULL,
        project_id INT NULL,
        invoice_number VARCHAR(100) NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
        subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_rate DECIMAL(5,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        discount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        description TEXT NULL,
        items JSON NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        sent_date DATE NULL,
        paid_date DATE NULL,
        payment_method ENUM('bank_transfer', 'check', 'cash', 'credit_card', 'other') NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_client (client_id),
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_invoice_date (invoice_date),
        INDEX idx_due_date (due_date),
        INDEX idx_invoice_number (invoice_number),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Invoices table created or already exists.');
  }

  static async generateInvoiceId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM invoices WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${year}-${sequence}`;
  }

  static async create({
    invoiceId,
    clientId,
    projectId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    status = 'draft',
    subtotal = 0,
    taxRate = 0,
    taxAmount = 0,
    discount = 0,
    totalAmount = 0,
    currency = 'USD',
    description,
    items,
    createdBy,
    createdByName,
    sentDate,
    paidDate,
    paymentMethod,
    notes
  }) {
    const invId = invoiceId || await this.generateInvoiceId();

    // Convert items to JSON string if it's an array/object
    const itemsJson = items ? JSON.stringify(items) : null;

    const [result] = await pool.execute(
      `INSERT INTO invoices (
        invoice_id, client_id, project_id, invoice_number, invoice_date, due_date,
        status, subtotal, tax_rate, tax_amount, discount, total_amount, currency,
        description, items, created_by, created_by_name, sent_date, paid_date,
        payment_method, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invId, clientId || null, projectId || null, invoiceNumber, invoiceDate, dueDate,
        status, parseFloat(subtotal), parseFloat(taxRate), parseFloat(taxAmount),
        parseFloat(discount), parseFloat(totalAmount), currency,
        description || null, itemsJson, createdBy || null, createdByName || null,
        sentDate || null, paidDate || null, paymentMethod || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT i.*, c.name as client_name, c.company as client_company, c.email as client_email,
             p.name as project_name, p.project_id as project_code,
             s.first_name as creator_first_name, s.last_name as creator_last_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN staff s ON i.created_by = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (i.invoice_number LIKE ? OR c.name LIKE ? OR c.company LIKE ? OR i.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.clientId) {
      query += ` AND i.client_id = ?`;
      params.push(filters.clientId);
    }

    if (filters.projectId) {
      query += ` AND i.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND i.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND i.invoice_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND i.invoice_date <= ?`;
      params.push(filters.endDate);
    }

    // Filter by department through projects
    if (filters.departmentId) {
      // Get department name from departments table
      query += ` AND EXISTS (
        SELECT 1 FROM projects pr
        INNER JOIN departments d ON pr.department = d.name
        WHERE pr.id = i.project_id AND d.id = ?
      )`;
      params.push(filters.departmentId);
    } else if (filters.departmentName) {
      // Filter by department name directly
      query += ` AND p.department = ?`;
      params.push(filters.departmentName);
    }

    query += ` ORDER BY i.invoice_date DESC, i.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToInvoice(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT i.*, c.name as client_name, c.company as client_company, c.email as client_email,
              p.name as project_name, p.project_id as project_code,
              s.first_name as creator_first_name, s.last_name as creator_last_name
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN staff s ON i.created_by = s.id
       WHERE i.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRowToInvoice(rows[0]);
  }

  static async findByInvoiceId(invoiceId) {
    const [rows] = await pool.execute(
      `SELECT i.*, c.name as client_name, c.company as client_company, c.email as client_email,
              p.name as project_name, p.project_id as project_code,
              s.first_name as creator_first_name, s.last_name as creator_last_name
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN staff s ON i.created_by = s.id
       WHERE i.invoice_id = ?`,
      [invoiceId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToInvoice(rows[0]);
  }

  static async update(id, {
    clientId,
    projectId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    status,
    subtotal,
    taxRate,
    taxAmount,
    discount,
    totalAmount,
    currency,
    description,
    items,
    sentDate,
    paidDate,
    paymentMethod,
    notes
  }) {
    const updates = [];
    const params = [];

    if (clientId !== undefined) {
      updates.push('client_id = ?');
      params.push(clientId || null);
    }
    if (projectId !== undefined) {
      updates.push('project_id = ?');
      params.push(projectId || null);
    }
    if (invoiceNumber !== undefined) {
      updates.push('invoice_number = ?');
      params.push(invoiceNumber);
    }
    if (invoiceDate !== undefined) {
      updates.push('invoice_date = ?');
      params.push(invoiceDate);
    }
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(dueDate);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (subtotal !== undefined) {
      updates.push('subtotal = ?');
      params.push(parseFloat(subtotal));
    }
    if (taxRate !== undefined) {
      updates.push('tax_rate = ?');
      params.push(parseFloat(taxRate));
    }
    if (taxAmount !== undefined) {
      updates.push('tax_amount = ?');
      params.push(parseFloat(taxAmount));
    }
    if (discount !== undefined) {
      updates.push('discount = ?');
      params.push(parseFloat(discount));
    }
    if (totalAmount !== undefined) {
      updates.push('total_amount = ?');
      params.push(parseFloat(totalAmount));
    }
    if (currency !== undefined) {
      updates.push('currency = ?');
      params.push(currency);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (items !== undefined) {
      updates.push('items = ?');
      params.push(items ? JSON.stringify(items) : null);
    }
    if (sentDate !== undefined) {
      updates.push('sent_date = ?');
      params.push(sentDate || null);
    }
    if (paidDate !== undefined) {
      updates.push('paid_date = ?');
      params.push(paidDate || null);
    }
    if (paymentMethod !== undefined) {
      updates.push('payment_method = ?');
      params.push(paymentMethod || null);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes || null);
    }

    if (updates.length === 0) return false;

    params.push(id);

    await pool.execute(
      `UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return true;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM invoices WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [totalRows] = await pool.execute('SELECT COUNT(*) as total FROM invoices');
    const [paidRows] = await pool.execute("SELECT COUNT(*) as total FROM invoices WHERE status = 'paid'");
    const [pendingRows] = await pool.execute("SELECT COUNT(*) as total FROM invoices WHERE status IN ('draft', 'sent')");
    const [overdueRows] = await pool.execute("SELECT COUNT(*) as total FROM invoices WHERE status = 'overdue'");
    const [totalAmountRows] = await pool.execute('SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices');
    const [paidAmountRows] = await pool.execute("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid'");

    return {
      total: totalRows[0].total,
      paid: paidRows[0].total,
      pending: pendingRows[0].total,
      overdue: overdueRows[0].total,
      totalAmount: parseFloat(totalAmountRows[0].total || 0),
      paidAmount: parseFloat(paidAmountRows[0].total || 0)
    };
  }

  static mapRowToInvoice(row) {
    let items = null;
    try {
      if (row.items) {
        items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
      }
    } catch (e) {
      console.error('Error parsing invoice items:', e);
      items = null;
    }

    return {
      id: row.id,
      invoiceId: row.invoice_id,
      clientId: row.client_id,
      projectId: row.project_id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date ? row.invoice_date.toISOString().split('T')[0] : null,
      dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      status: row.status,
      subtotal: parseFloat(row.subtotal || 0),
      taxRate: parseFloat(row.tax_rate || 0),
      taxAmount: parseFloat(row.tax_amount || 0),
      discount: parseFloat(row.discount || 0),
      totalAmount: parseFloat(row.total_amount || 0),
      currency: row.currency || 'USD',
      description: row.description,
      items: items,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      sentDate: row.sent_date ? row.sent_date.toISOString().split('T')[0] : null,
      paidDate: row.paid_date ? row.paid_date.toISOString().split('T')[0] : null,
      paymentMethod: row.payment_method,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Joined data
      clientName: row.client_name,
      clientCompany: row.client_company,
      clientEmail: row.client_email,
      projectName: row.project_name,
      projectCode: row.project_code,
      creatorFirstName: row.creator_first_name,
      creatorLastName: row.creator_last_name
    };
  }
}

export default Invoice;

