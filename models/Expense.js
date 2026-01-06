import pool from '../config/db.js';

class Expense {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        category ENUM('Personnel', 'Transport & Fuel', 'Field Activities', 'Consultants', 'Materials', 'Equipment', 'Other') NOT NULL,
        description VARCHAR(500) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        expense_date DATE NOT NULL,
        submitted_by INT NULL,
        submitted_by_name VARCHAR(255) NULL,
        status ENUM('draft', 'pending', 'approved', 'rejected') DEFAULT 'pending',
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        approval_comments TEXT NULL,
        receipt_path VARCHAR(500) NULL,
        vendor VARCHAR(255) NULL,
        invoice_number VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_category (category),
        INDEX idx_status (status),
        INDEX idx_expense_date (expense_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (submitted_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Expenses table created or already exists.');
  }

  static async generateExpenseId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM expenses WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `EXP-${year}-${sequence}`;
  }

  static async create({
    expenseId,
    projectId,
    category,
    description,
    amount,
    currency = 'USD',
    expenseDate,
    submittedBy,
    submittedByName,
    status = 'pending',
    receiptPath,
    vendor,
    invoiceNumber
  }) {
    const expId = expenseId || await this.generateExpenseId();

    const [result] = await pool.execute(
      `INSERT INTO expenses (
        expense_id, project_id, category, description, amount, currency, expense_date,
        submitted_by, submitted_by_name, status, receipt_path, vendor, invoice_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expId, projectId || null, category, description, amount, currency,
        expenseDate || new Date().toISOString().split('T')[0],
        submittedBy || null, submittedByName || null, status,
        receiptPath || null, vendor || null, invoiceNumber || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT e.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
             s2.first_name as approver_first_name, s2.last_name as approver_last_name
      FROM expenses e
      LEFT JOIN projects p ON e.project_id = p.id
      LEFT JOIN staff s1 ON e.submitted_by = s1.id
      LEFT JOIN staff s2 ON e.approved_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (e.description LIKE ? OR e.vendor LIKE ? OR e.invoice_number LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND e.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.category) {
      query += ` AND e.category = ?`;
      params.push(filters.category);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND e.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND e.expense_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND e.expense_date <= ?`;
      params.push(filters.endDate);
    }

    // Filter by department through projects
    if (filters.departmentId) {
      // Get department name from departments table
      query += ` AND EXISTS (
        SELECT 1 FROM projects pr
        INNER JOIN departments d ON pr.department = d.name
        WHERE pr.id = e.project_id AND d.id = ?
      )`;
      params.push(filters.departmentId);
    } else if (filters.departmentName) {
      // Filter by department name directly
      query += ` AND p.department = ?`;
      params.push(filters.departmentName);
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToExpense(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT e.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
              s2.first_name as approver_first_name, s2.last_name as approver_last_name
       FROM expenses e
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN staff s1 ON e.submitted_by = s1.id
       LEFT JOIN staff s2 ON e.approved_by = s2.id
       WHERE e.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToExpense(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      category: 'category',
      description: 'description',
      amount: 'amount',
      currency: 'currency',
      expenseDate: 'expense_date',
      status: 'status',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      approvalDate: 'approval_date',
      approvalComments: 'approval_comments',
      receiptPath: 'receipt_path',
      vendor: 'vendor',
      invoiceNumber: 'invoice_number'
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
      `UPDATE expenses SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM expenses WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(amount) as totalAmount,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approvedAmount,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN category = 'Personnel' THEN amount ELSE 0 END) as personnelAmount,
        SUM(CASE WHEN category = 'Transport & Fuel' THEN amount ELSE 0 END) as transportAmount,
        SUM(CASE WHEN category = 'Field Activities' THEN amount ELSE 0 END) as fieldAmount,
        SUM(CASE WHEN category = 'Consultants' THEN amount ELSE 0 END) as consultantsAmount,
        SUM(CASE WHEN category = 'Materials' THEN amount ELSE 0 END) as materialsAmount
      FROM expenses
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToExpense(row) {
    return {
      id: row.expense_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      category: row.category,
      description: row.description,
      amount: parseFloat(row.amount),
      currency: row.currency,
      expenseDate: row.expense_date ? row.expense_date.toISOString().split('T')[0] : null,
      submittedBy: row.submitted_by,
      submittedByName: row.submitted_by_name || (row.submitter_first_name && row.submitter_last_name
        ? `${row.submitter_first_name} ${row.submitter_last_name}` : null),
      status: row.status,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      approvalComments: row.approval_comments,
      receiptPath: row.receipt_path,
      vendor: row.vendor,
      invoiceNumber: row.invoice_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Expense;

