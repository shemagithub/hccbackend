import pool from '../config/db.js';

class TaxManagement {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS tax_management (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tax_id VARCHAR(50) NOT NULL UNIQUE,
        tax_type ENUM('federal_income', 'state_income', 'social_security', 'medicare', 'additional_medicare', 'futa', 'suta', 'other') NOT NULL,
        tax_name VARCHAR(255) NOT NULL,
        tax_period VARCHAR(50) NOT NULL,
        due_date DATE NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        percentage DECIMAL(5,2) NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        status ENUM('pending', 'paid', 'overdue', 'filed') DEFAULT 'pending',
        payment_date DATE NULL,
        payment_method ENUM('bank_transfer', 'check', 'electronic', 'other') NULL,
        reference_number VARCHAR(100) NULL,
        filing_form VARCHAR(100) NULL,
        filing_status ENUM('not_filed', 'filed', 'pending') DEFAULT 'not_filed',
        filing_date DATE NULL,
        description TEXT NULL,
        notes TEXT NULL,
        processed_by INT NULL,
        processed_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tax_type (tax_type),
        INDEX idx_tax_period (tax_period),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date),
        FOREIGN KEY (processed_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Tax management table created or already exists.');
  }

  static async generateTaxId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM tax_management WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `TAX-${year}-${sequence}`;
  }

  static async create({
    taxId,
    taxType,
    taxName,
    taxPeriod,
    dueDate,
    amount,
    percentage,
    currency = 'USD',
    status = 'pending',
    paymentDate,
    paymentMethod,
    referenceNumber,
    filingForm,
    filingStatus = 'not_filed',
    filingDate,
    description,
    notes,
    processedBy,
    processedByName
  }) {
    if (!taxId) {
      taxId = await this.generateTaxId();
    }

    const [result] = await pool.execute(
      `INSERT INTO tax_management (
        tax_id, tax_type, tax_name, tax_period, due_date, amount, percentage, currency,
        status, payment_date, payment_method, reference_number, filing_form,
        filing_status, filing_date, description, notes, processed_by, processed_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taxId, taxType, taxName, taxPeriod, dueDate, parseFloat(amount),
        percentage ? parseFloat(percentage) : null, currency, status,
        paymentDate || null, paymentMethod || null, referenceNumber || null,
        filingForm || null, filingStatus, filingDate || null,
        description || null, notes || null, processedBy || null, processedByName || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT * FROM tax_management WHERE 1=1
    `;
    const params = [];

    if (filters.taxType) {
      query += ' AND tax_type = ?';
      params.push(filters.taxType);
    }

    if (filters.taxPeriod) {
      query += ' AND tax_period = ?';
      params.push(filters.taxPeriod);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.filingStatus) {
      query += ' AND filing_status = ?';
      params.push(filters.filingStatus);
    }

    if (filters.search) {
      query += ' AND (tax_id LIKE ? OR tax_name LIKE ? OR filing_form LIKE ? OR description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.startDate) {
      query += ' AND due_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND due_date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY due_date DESC, created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.offset));
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToTax(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM tax_management WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? this.mapRowToTax(rows[0]) : null;
  }

  static async findByTaxId(taxId) {
    const [rows] = await pool.execute(
      'SELECT * FROM tax_management WHERE tax_id = ?',
      [taxId]
    );
    return rows.length > 0 ? this.mapRowToTax(rows[0]) : null;
  }

  static async update(id, updates) {
    const allowedFields = [
      'taxType', 'taxName', 'taxPeriod', 'dueDate', 'amount', 'percentage',
      'currency', 'status', 'paymentDate', 'paymentMethod', 'referenceNumber',
      'filingForm', 'filingStatus', 'filingDate', 'description', 'notes',
      'processedBy', 'processedByName'
    ];

    const fieldMapping = {
      taxType: 'tax_type',
      taxName: 'tax_name',
      taxPeriod: 'tax_period',
      dueDate: 'due_date',
      paymentDate: 'payment_date',
      paymentMethod: 'payment_method',
      referenceNumber: 'reference_number',
      filingForm: 'filing_form',
      filingStatus: 'filing_status',
      filingDate: 'filing_date',
      processedBy: 'processed_by',
      processedByName: 'processed_by_name'
    };

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = fieldMapping[key] || key;
        setClauses.push(`${dbField} = ?`);
        
        if (key === 'amount') {
          params.push(parseFloat(value));
        } else if (key === 'percentage') {
          params.push(value ? parseFloat(value) : null);
        } else if (key === 'processedBy') {
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
      `UPDATE tax_management SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM tax_management WHERE id = ?', [id]);
    return true;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as totalPaid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as totalPending,
        SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as totalOverdue,
        SUM(amount) as totalAmount,
        tax_type,
        SUM(amount) as typeAmount
      FROM tax_management
      WHERE 1=1
    `;
    const params = [];

    if (filters.taxPeriod) {
      query += ' AND tax_period = ?';
      params.push(filters.taxPeriod);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' GROUP BY tax_type';

    const [rows] = await pool.execute(query, params);
    
    const stats = {
      total: 0,
      totalPaid: 0,
      totalPending: 0,
      totalOverdue: 0,
      totalAmount: 0,
      byType: {}
    };

    rows.forEach(row => {
      stats.total += parseInt(row.total);
      stats.totalPaid += parseFloat(row.totalPaid || 0);
      stats.totalPending += parseFloat(row.totalPending || 0);
      stats.totalOverdue += parseFloat(row.totalOverdue || 0);
      stats.totalAmount += parseFloat(row.typeAmount || 0);
      stats.byType[row.tax_type] = {
        count: parseInt(row.total),
        amount: parseFloat(row.typeAmount || 0)
      };
    });

    return stats;
  }

  static mapRowToTax(row) {
    return {
      id: row.id,
      taxId: row.tax_id,
      taxType: row.tax_type,
      taxName: row.tax_name,
      taxPeriod: row.tax_period,
      dueDate: row.due_date,
      amount: parseFloat(row.amount || 0),
      percentage: row.percentage ? parseFloat(row.percentage) : null,
      currency: row.currency,
      status: row.status,
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      filingForm: row.filing_form,
      filingStatus: row.filing_status,
      filingDate: row.filing_date,
      description: row.description,
      notes: row.notes,
      processedBy: row.processed_by,
      processedByName: row.processed_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default TaxManagement;
