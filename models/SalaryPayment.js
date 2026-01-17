import pool from '../config/db.js';

class SalaryPayment {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS salary_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        payment_period VARCHAR(50) NOT NULL,
        payment_date DATE NOT NULL,
        base_salary DECIMAL(15,2) NOT NULL,
        bonuses DECIMAL(15,2) DEFAULT 0,
        deductions DECIMAL(15,2) DEFAULT 0,
        taxes DECIMAL(15,2) DEFAULT 0,
        net_salary DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        status ENUM('pending', 'processing', 'paid', 'cancelled') DEFAULT 'pending',
        payment_method ENUM('bank_transfer', 'check', 'cash', 'other') NULL,
        reference_number VARCHAR(100) NULL,
        notes TEXT NULL,
        processed_by INT NULL,
        processed_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_payment_period (payment_period),
        INDEX idx_payment_date (payment_date),
        INDEX idx_status (status),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (processed_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Salary payments table created or already exists.');
  }

  static async generatePaymentId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM salary_payments WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `SAL-${year}-${sequence}`;
  }

  static async create({
    paymentId,
    staffId,
    paymentPeriod,
    paymentDate,
    baseSalary,
    bonuses = 0,
    deductions = 0,
    taxes = 0,
    netSalary,
    currency = 'USD',
    status = 'pending',
    paymentMethod,
    referenceNumber,
    notes,
    processedBy,
    processedByName
  }) {
    if (!paymentId) {
      paymentId = await this.generatePaymentId();
    }

    if (!netSalary) {
      netSalary = parseFloat(baseSalary) + parseFloat(bonuses) - parseFloat(deductions) - parseFloat(taxes);
    }

    const [result] = await pool.execute(
      `INSERT INTO salary_payments (
        payment_id, staff_id, payment_period, payment_date, base_salary, bonuses,
        deductions, taxes, net_salary, currency, status, payment_method,
        reference_number, notes, processed_by, processed_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId, staffId, paymentPeriod, paymentDate,
        parseFloat(baseSalary), parseFloat(bonuses), parseFloat(deductions),
        parseFloat(taxes), parseFloat(netSalary), currency, status,
        paymentMethod || null, referenceNumber || null, notes || null,
        processedBy || null, processedByName || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT sp.*, 
        s.first_name, s.last_name, s.email, s.position, s.department_id,
        d.name as department_name
      FROM salary_payments sp
      LEFT JOIN staff s ON sp.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ' AND sp.staff_id = ?';
      params.push(parseInt(filters.staffId));
    }

    if (filters.paymentPeriod) {
      query += ' AND sp.payment_period = ?';
      params.push(filters.paymentPeriod);
    }

    if (filters.status) {
      query += ' AND sp.status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (sp.payment_id LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.startDate) {
      query += ' AND sp.payment_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND sp.payment_date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY sp.payment_date DESC, sp.created_at DESC';

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
      `SELECT sp.*, 
        s.first_name, s.last_name, s.email, s.position, s.department_id,
        d.name as department_name
      FROM salary_payments sp
      LEFT JOIN staff s ON sp.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE sp.id = ?`,
      [id]
    );
    return rows.length > 0 ? this.mapRowToPayment(rows[0]) : null;
  }

  static async findByPaymentId(paymentId) {
    const [rows] = await pool.execute(
      `SELECT sp.*, 
        s.first_name, s.last_name, s.email, s.position, s.department_id,
        d.name as department_name
      FROM salary_payments sp
      LEFT JOIN staff s ON sp.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE sp.payment_id = ?`,
      [paymentId]
    );
    return rows.length > 0 ? this.mapRowToPayment(rows[0]) : null;
  }

  static async update(id, updates) {
    const allowedFields = [
      'staffId', 'paymentPeriod', 'paymentDate', 'baseSalary', 'bonuses',
      'deductions', 'taxes', 'netSalary', 'currency', 'status', 'paymentMethod',
      'referenceNumber', 'notes', 'processedBy', 'processedByName'
    ];

    const fieldMapping = {
      staffId: 'staff_id',
      paymentPeriod: 'payment_period',
      paymentDate: 'payment_date',
      baseSalary: 'base_salary',
      netSalary: 'net_salary',
      paymentMethod: 'payment_method',
      referenceNumber: 'reference_number',
      processedBy: 'processed_by',
      processedByName: 'processed_by_name'
    };

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = fieldMapping[key] || key;
        setClauses.push(`${dbField} = ?`);
        
        if (['baseSalary', 'bonuses', 'deductions', 'taxes', 'netSalary'].includes(key)) {
          params.push(parseFloat(value));
        } else if (key === 'staffId' || key === 'processedBy') {
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
      `UPDATE salary_payments SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM salary_payments WHERE id = ?', [id]);
    return true;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN net_salary ELSE 0 END) as totalPaid,
        SUM(CASE WHEN status = 'pending' THEN net_salary ELSE 0 END) as totalPending,
        SUM(net_salary) as totalNetSalary,
        SUM(base_salary) as totalBaseSalary,
        SUM(bonuses) as totalBonuses,
        SUM(deductions) as totalDeductions,
        SUM(taxes) as totalTaxes
      FROM salary_payments
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ' AND staff_id = ?';
      params.push(parseInt(filters.staffId));
    }

    if (filters.paymentPeriod) {
      query += ' AND payment_period = ?';
      params.push(filters.paymentPeriod);
    }

    if (filters.startDate) {
      query += ' AND payment_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND payment_date <= ?';
      params.push(filters.endDate);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToPayment(row) {
    return {
      id: row.id,
      paymentId: row.payment_id,
      staffId: row.staff_id,
      paymentPeriod: row.payment_period,
      paymentDate: row.payment_date,
      baseSalary: parseFloat(row.base_salary || 0),
      bonuses: parseFloat(row.bonuses || 0),
      deductions: parseFloat(row.deductions || 0),
      taxes: parseFloat(row.taxes || 0),
      netSalary: parseFloat(row.net_salary || 0),
      currency: row.currency,
      status: row.status,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      notes: row.notes,
      processedBy: row.processed_by,
      processedByName: row.processed_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Joined fields
      staffFirstName: row.first_name,
      staffLastName: row.last_name,
      staffEmail: row.email,
      staffPosition: row.position,
      departmentId: row.department_id,
      departmentName: row.department_name
    };
  }
}

export default SalaryPayment;
