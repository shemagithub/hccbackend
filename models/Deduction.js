import pool from '../config/db.js';

class Deduction {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS deductions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        deduction_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        deduction_type ENUM('tax', 'social', 'benefit', 'retirement', 'other') NOT NULL,
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        percentage DECIMAL(5,2) NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_period VARCHAR(50) NULL,
        effective_date DATE NOT NULL,
        end_date DATE NULL,
        status ENUM('active', 'inactive', 'cancelled') DEFAULT 'active',
        description TEXT NULL,
        notes TEXT NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_type (deduction_type),
        INDEX idx_status (status),
        INDEX idx_payment_period (payment_period),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Deductions table created or already exists.');
  }

  static async generateDeductionId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM deductions WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `DED-${year}-${sequence}`;
  }

  static async create({
    deductionId,
    staffId,
    deductionType,
    name,
    amount,
    percentage,
    currency = 'USD',
    paymentPeriod,
    effectiveDate,
    endDate,
    status = 'active',
    description,
    notes,
    createdBy,
    createdByName
  }) {
    if (!deductionId) {
      deductionId = await this.generateDeductionId();
    }

    const [result] = await pool.execute(
      `INSERT INTO deductions (
        deduction_id, staff_id, deduction_type, name, amount, percentage, currency,
        payment_period, effective_date, end_date, status, description, notes,
        created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deductionId, staffId, deductionType, name, parseFloat(amount),
        percentage ? parseFloat(percentage) : null, currency,
        paymentPeriod || null, effectiveDate, endDate || null, status,
        description || null, notes || null, createdBy || null, createdByName || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT d.*, 
        s.first_name, s.last_name, s.email, s.position
      FROM deductions d
      LEFT JOIN staff s ON d.staff_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ' AND d.staff_id = ?';
      params.push(parseInt(filters.staffId));
    }

    if (filters.deductionType) {
      query += ' AND d.deduction_type = ?';
      params.push(filters.deductionType);
    }

    if (filters.status) {
      query += ' AND d.status = ?';
      params.push(filters.status);
    }

    if (filters.paymentPeriod) {
      query += ' AND d.payment_period = ?';
      params.push(filters.paymentPeriod);
    }

    if (filters.search) {
      query += ' AND (d.deduction_id LIKE ? OR d.name LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY d.effective_date DESC, d.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.offset));
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToDeduction(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT d.*, 
        s.first_name, s.last_name, s.email, s.position
      FROM deductions d
      LEFT JOIN staff s ON d.staff_id = s.id
      WHERE d.id = ?`,
      [id]
    );
    return rows.length > 0 ? this.mapRowToDeduction(rows[0]) : null;
  }

  static async update(id, updates) {
    const allowedFields = [
      'staffId', 'deductionType', 'name', 'amount', 'percentage', 'currency',
      'paymentPeriod', 'effectiveDate', 'endDate', 'status', 'description', 'notes'
    ];

    const fieldMapping = {
      staffId: 'staff_id',
      deductionType: 'deduction_type',
      paymentPeriod: 'payment_period',
      effectiveDate: 'effective_date',
      endDate: 'end_date'
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
        } else if (key === 'staffId') {
          params.push(parseInt(value));
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
      `UPDATE deductions SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM deductions WHERE id = ?', [id]);
    return true;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as totalActive,
        SUM(amount) as totalAmount,
        deduction_type,
        SUM(amount) as typeAmount
      FROM deductions
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ' AND staff_id = ?';
      params.push(parseInt(filters.staffId));
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' GROUP BY deduction_type';

    const [rows] = await pool.execute(query, params);
    
    const stats = {
      total: 0,
      totalActive: 0,
      totalAmount: 0,
      byType: {}
    };

    rows.forEach(row => {
      stats.total += parseInt(row.total);
      stats.totalActive += parseFloat(row.totalActive || 0);
      stats.totalAmount += parseFloat(row.typeAmount || 0);
      stats.byType[row.deduction_type] = {
        count: parseInt(row.total),
        amount: parseFloat(row.typeAmount || 0)
      };
    });

    return stats;
  }

  static mapRowToDeduction(row) {
    return {
      id: row.id,
      deductionId: row.deduction_id,
      staffId: row.staff_id,
      deductionType: row.deduction_type,
      name: row.name,
      amount: parseFloat(row.amount || 0),
      percentage: row.percentage ? parseFloat(row.percentage) : null,
      currency: row.currency,
      paymentPeriod: row.payment_period,
      effectiveDate: row.effective_date,
      endDate: row.end_date,
      status: row.status,
      description: row.description,
      notes: row.notes,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Joined fields
      staffFirstName: row.first_name,
      staffLastName: row.last_name,
      staffEmail: row.email,
      staffPosition: row.position
    };
  }
}

export default Deduction;
