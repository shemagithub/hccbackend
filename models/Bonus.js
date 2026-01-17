import pool from '../config/db.js';

class Bonus {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS bonuses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bonus_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        bonus_type ENUM('performance', 'holiday', 'project', 'retention', 'referral', 'other') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_period VARCHAR(50) NULL,
        payment_date DATE NULL,
        status ENUM('pending', 'approved', 'paid', 'cancelled') DEFAULT 'pending',
        description TEXT NULL,
        notes TEXT NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_type (bonus_type),
        INDEX idx_status (status),
        INDEX idx_payment_date (payment_date),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Bonuses table created or already exists.');
  }

  static async generateBonusId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM bonuses WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `BON-${year}-${sequence}`;
  }

  static async create({
    bonusId,
    staffId,
    bonusType,
    amount,
    currency = 'USD',
    paymentPeriod,
    paymentDate,
    status = 'pending',
    description,
    notes,
    approvedBy,
    approvedByName,
    approvalDate,
    createdBy,
    createdByName
  }) {
    if (!bonusId) {
      bonusId = await this.generateBonusId();
    }

    const [result] = await pool.execute(
      `INSERT INTO bonuses (
        bonus_id, staff_id, bonus_type, amount, currency, payment_period,
        payment_date, status, description, notes, approved_by, approved_by_name,
        approval_date, created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bonusId, staffId, bonusType, parseFloat(amount), currency,
        paymentPeriod || null, paymentDate || null, status,
        description || null, notes || null, approvedBy || null,
        approvedByName || null, approvalDate || null,
        createdBy || null, createdByName || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT b.*, 
        s.first_name, s.last_name, s.email, s.position
      FROM bonuses b
      LEFT JOIN staff s ON b.staff_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ' AND b.staff_id = ?';
      params.push(parseInt(filters.staffId));
    }

    if (filters.bonusType) {
      query += ' AND b.bonus_type = ?';
      params.push(filters.bonusType);
    }

    if (filters.status) {
      query += ' AND b.status = ?';
      params.push(filters.status);
    }

    if (filters.paymentPeriod) {
      query += ' AND b.payment_period = ?';
      params.push(filters.paymentPeriod);
    }

    if (filters.search) {
      query += ' AND (b.bonus_id LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR b.description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.startDate) {
      query += ' AND b.payment_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND b.payment_date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY b.payment_date DESC, b.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.offset));
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToBonus(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT b.*, 
        s.first_name, s.last_name, s.email, s.position
      FROM bonuses b
      LEFT JOIN staff s ON b.staff_id = s.id
      WHERE b.id = ?`,
      [id]
    );
    return rows.length > 0 ? this.mapRowToBonus(rows[0]) : null;
  }

  static async update(id, updates) {
    const allowedFields = [
      'staffId', 'bonusType', 'amount', 'currency', 'paymentPeriod',
      'paymentDate', 'status', 'description', 'notes', 'approvedBy',
      'approvedByName', 'approvalDate'
    ];

    const fieldMapping = {
      staffId: 'staff_id',
      bonusType: 'bonus_type',
      paymentPeriod: 'payment_period',
      paymentDate: 'payment_date',
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
        } else if (key === 'staffId' || key === 'approvedBy') {
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
      `UPDATE bonuses SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM bonuses WHERE id = ?', [id]);
    return true;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as totalPaid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as totalPending,
        SUM(amount) as totalAmount,
        bonus_type,
        SUM(amount) as typeAmount
      FROM bonuses
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

    query += ' GROUP BY bonus_type';

    const [rows] = await pool.execute(query, params);
    
    const stats = {
      total: 0,
      totalPaid: 0,
      totalPending: 0,
      totalAmount: 0,
      byType: {}
    };

    rows.forEach(row => {
      stats.total += parseInt(row.total);
      stats.totalPaid += parseFloat(row.totalPaid || 0);
      stats.totalPending += parseFloat(row.totalPending || 0);
      stats.totalAmount += parseFloat(row.typeAmount || 0);
      stats.byType[row.bonus_type] = {
        count: parseInt(row.total),
        amount: parseFloat(row.typeAmount || 0)
      };
    });

    return stats;
  }

  static mapRowToBonus(row) {
    return {
      id: row.id,
      bonusId: row.bonus_id,
      staffId: row.staff_id,
      bonusType: row.bonus_type,
      amount: parseFloat(row.amount || 0),
      currency: row.currency,
      paymentPeriod: row.payment_period,
      paymentDate: row.payment_date,
      status: row.status,
      description: row.description,
      notes: row.notes,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name,
      approvalDate: row.approval_date,
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

export default Bonus;
