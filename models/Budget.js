import pool from '../config/db.js';

class Budget {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        budget_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NOT NULL,
        approved_budget DECIMAL(15,2) NOT NULL,
        revised_budget DECIMAL(15,2) NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        fiscal_year VARCHAR(10) NULL,
        approved_date DATE NULL,
        revised_date DATE NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Budgets table created or already exists.');
  }

  static async generateBudgetId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM budgets WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `BUD-${year}-${sequence}`;
  }

  static async create({
    budgetId,
    projectId,
    approvedBudget,
    revisedBudget,
    currency = 'USD',
    fiscalYear,
    approvedDate,
    revisedDate,
    approvedBy,
    approvedByName,
    notes
  }) {
    const budId = budgetId || await this.generateBudgetId();

    const [result] = await pool.execute(
      `INSERT INTO budgets (
        budget_id, project_id, approved_budget, revised_budget, currency, fiscal_year,
        approved_date, revised_date, approved_by, approved_by_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        budId, projectId, approvedBudget, revisedBudget || null, currency, fiscalYear || null,
        approvedDate || null, revisedDate || null, approvedBy || null, approvedByName || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT b.*, p.name as project_name, p.project_id as project_code,
             s.first_name as approver_first_name, s.last_name as approver_last_name
      FROM budgets b
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN staff s ON b.approved_by = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.projectId) {
      query += ` AND b.project_id = ?`;
      params.push(filters.projectId);
    }

    query += ` ORDER BY b.created_at DESC`;

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToBudget(row));
  }

  static async findByProjectId(projectId) {
    const [rows] = await pool.execute(
      `SELECT b.*, p.name as project_name, p.project_id as project_code,
              s.first_name as approver_first_name, s.last_name as approver_last_name
       FROM budgets b
       LEFT JOIN projects p ON b.project_id = p.id
       LEFT JOIN staff s ON b.approved_by = s.id
       WHERE b.project_id = ?
       ORDER BY b.created_at DESC
       LIMIT 1`,
      [projectId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToBudget(rows[0]);
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT b.*, p.name as project_name, p.project_id as project_code,
              s.first_name as approver_first_name, s.last_name as approver_last_name
       FROM budgets b
       LEFT JOIN projects p ON b.project_id = p.id
       LEFT JOIN staff s ON b.approved_by = s.id
       WHERE b.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToBudget(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      revisedBudget: 'revised_budget',
      revisedDate: 'revised_date',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      approvedDate: 'approved_date',
      notes: 'notes'
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
      `UPDATE budgets SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static mapRowToBudget(row) {
    return {
      id: row.budget_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      approvedBudget: parseFloat(row.approved_budget),
      revisedBudget: row.revised_budget ? parseFloat(row.revised_budget) : null,
      currency: row.currency,
      fiscalYear: row.fiscal_year,
      approvedDate: row.approved_date ? row.approved_date.toISOString().split('T')[0] : null,
      revisedDate: row.revised_date ? row.revised_date.toISOString().split('T')[0] : null,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Budget;

