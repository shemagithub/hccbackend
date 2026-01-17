import pool from '../config/db.js';

class Contract {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS contracts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contract_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        client_name VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL,
        total_value DECIMAL(18,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        payment_terms VARCHAR(255) NULL,
        status ENUM('draft','active','expired','terminated') DEFAULT 'active',
        renewal_status ENUM('none','upcoming','renewed','cancelled') DEFAULT 'none',
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_dates (start_date, end_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await pool.execute(query);
    console.log('Contracts table created or already exists.');
  }

  static async generateContractId() {
    const prefix = 'CTR';
    const year = new Date().getFullYear();
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM contracts WHERE YEAR(created_at) = ?',
      [year]
    );
    const count = rows[0]?.count || 0;
    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  static async create(data) {
    const contractId = await Contract.generateContractId();
    const {
      projectId,
      clientName,
      title,
      totalValue,
      currency = 'USD',
      startDate,
      endDate,
      paymentTerms,
      status = 'active',
      renewalStatus = 'none',
      createdBy,
      createdByName,
    } = data;

    const query = `
      INSERT INTO contracts (
        contract_id, project_id, client_name, title, total_value, currency,
        start_date, end_date, payment_terms, status, renewal_status,
        created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      contractId,
      projectId || null,
      clientName,
      title,
      totalValue || 0,
      currency,
      startDate,
      endDate,
      paymentTerms || null,
      status,
      renewalStatus,
      createdBy || null,
      createdByName || null,
    ]);

    return { id: result.insertId, contract_id: contractId, ...data };
  }

  static async findAll(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.renewalStatus) {
      conditions.push('renewal_status = ?');
      params.push(filters.renewalStatus);
    }

    if (filters.projectId) {
      conditions.push('project_id = ?');
      params.push(filters.projectId);
    }

    if (filters.expiringBefore) {
      conditions.push('end_date <= ?');
      params.push(filters.expiringBefore);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM contracts
      ${whereClause}
      ORDER BY end_date ASC
      LIMIT 1000
    `;

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM contracts WHERE id = ? OR contract_id = ? LIMIT 1',
      [id, id]
    );
    return rows[0] || null;
  }

  static async update(id, data) {
    const fields = [];
    const params = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      params.push(data.title);
    }
    if (data.clientName !== undefined) {
      fields.push('client_name = ?');
      params.push(data.clientName);
    }
    if (data.totalValue !== undefined) {
      fields.push('total_value = ?');
      params.push(data.totalValue);
    }
    if (data.currency !== undefined) {
      fields.push('currency = ?');
      params.push(data.currency);
    }
    if (data.startDate !== undefined) {
      fields.push('start_date = ?');
      params.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      fields.push('end_date = ?');
      params.push(data.endDate);
    }
    if (data.paymentTerms !== undefined) {
      fields.push('payment_terms = ?');
      params.push(data.paymentTerms);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(data.status);
    }
    if (data.renewalStatus !== undefined) {
      fields.push('renewal_status = ?');
      params.push(data.renewalStatus);
    }

    if (!fields.length) return null;

    params.push(id);
    const query = `
      UPDATE contracts
      SET ${fields.join(', ')}
      WHERE id = ? OR contract_id = ?
    `;

    params.push(id);

    await pool.execute(query, params);
    return Contract.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM contracts WHERE id = ? OR contract_id = ?', [id, id]);
    return true;
  }
}

export default Contract;

