import pool from '../config/db.js';

class ComplianceCheck {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS compliance_checks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        compliance_check_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        category VARCHAR(255) NOT NULL,
        subcategory VARCHAR(255) NULL,
        description TEXT NULL,
        compliance_percentage INT NOT NULL DEFAULT 0,
        status ENUM('compliant', 'partial', 'non_compliant', 'pending') DEFAULT 'pending',
        checked_by INT NULL,
        checked_by_name VARCHAR(255) NULL,
        check_date DATE NULL,
        findings TEXT NULL,
        requirements TEXT NULL,
        gaps TEXT NULL,
        action_plan TEXT NULL,
        next_review_date DATE NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_category (category),
        INDEX idx_status (status),
        INDEX idx_check_date (check_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (checked_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Compliance checks table created or already exists.');
  }

  static async generateComplianceCheckId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM compliance_checks WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `CC-${year}-${sequence}`;
  }

  static async create({
    complianceCheckId,
    projectId,
    category,
    subcategory,
    description,
    compliancePercentage = 0,
    status = 'pending',
    checkedBy,
    checkedByName,
    checkDate,
    findings,
    requirements,
    gaps,
    actionPlan,
    nextReviewDate,
    priority = 'medium'
  }) {
    const ccId = complianceCheckId || await this.generateComplianceCheckId();

    // Determine status based on compliance percentage
    let autoStatus = status;
    if (status === 'pending') {
      if (compliancePercentage >= 95) {
        autoStatus = 'compliant';
      } else if (compliancePercentage >= 70) {
        autoStatus = 'partial';
      } else {
        autoStatus = 'non_compliant';
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO compliance_checks (
        compliance_check_id, project_id, category, subcategory, description, compliance_percentage,
        status, checked_by, checked_by_name, check_date, findings, requirements,
        gaps, action_plan, next_review_date, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ccId, projectId || null, category, subcategory || null, description || null, compliancePercentage,
        autoStatus, checkedBy || null, checkedByName || null, checkDate || null,
        findings || null, requirements || null, gaps || null, actionPlan || null,
        nextReviewDate || null, priority
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT cc.*, p.name as project_name, p.project_id as project_code,
             s.first_name as checker_first_name, s.last_name as checker_last_name
      FROM compliance_checks cc
      LEFT JOIN projects p ON cc.project_id = p.id
      LEFT JOIN staff s ON cc.checked_by = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (cc.category LIKE ? OR cc.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND cc.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.category) {
      query += ` AND cc.category = ?`;
      params.push(filters.category);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND cc.status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY cc.check_date DESC, cc.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToComplianceCheck(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT cc.*, p.name as project_name, p.project_id as project_code,
              s.first_name as checker_first_name, s.last_name as checker_last_name
       FROM compliance_checks cc
       LEFT JOIN projects p ON cc.project_id = p.id
       LEFT JOIN staff s ON cc.checked_by = s.id
       WHERE cc.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToComplianceCheck(rows[0]);
  }

  static async findByComplianceCheckId(complianceCheckId) {
    const [rows] = await pool.execute(
      `SELECT cc.*, p.name as project_name, p.project_id as project_code,
              s.first_name as checker_first_name, s.last_name as checker_last_name
       FROM compliance_checks cc
       LEFT JOIN projects p ON cc.project_id = p.id
       LEFT JOIN staff s ON cc.checked_by = s.id
       WHERE cc.compliance_check_id = ?`,
      [complianceCheckId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToComplianceCheck(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      category: 'category',
      subcategory: 'subcategory',
      description: 'description',
      compliancePercentage: 'compliance_percentage',
      status: 'status',
      checkedBy: 'checked_by',
      checkedByName: 'checked_by_name',
      checkDate: 'check_date',
      findings: 'findings',
      requirements: 'requirements',
      gaps: 'gaps',
      actionPlan: 'action_plan',
      nextReviewDate: 'next_review_date',
      priority: 'priority'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    // Auto-update status based on compliance percentage if not explicitly set
    if (updateData.compliancePercentage !== undefined && !updateData.status) {
      if (updateData.compliancePercentage >= 95) {
        updateFields.push(`status = ?`);
        params.splice(params.length - 1, 0, 'compliant');
      } else if (updateData.compliancePercentage >= 70) {
        updateFields.push(`status = ?`);
        params.splice(params.length - 1, 0, 'partial');
      } else {
        updateFields.push(`status = ?`);
        params.splice(params.length - 1, 0, 'non_compliant');
      }
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE compliance_checks SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM compliance_checks WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN status = 'non_compliant' THEN 1 ELSE 0 END) as nonCompliant,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(compliance_percentage) as avgCompliancePercentage
      FROM compliance_checks
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToComplianceCheck(row) {
    return {
      id: row.compliance_check_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      category: row.category,
      subcategory: row.subcategory,
      description: row.description,
      compliancePercentage: parseInt(row.compliance_percentage) || 0,
      status: row.status,
      checkedBy: row.checked_by,
      checkedByName: row.checked_by_name || (row.checker_first_name && row.checker_last_name
        ? `${row.checker_first_name} ${row.checker_last_name}` : null),
      checkDate: row.check_date ? row.check_date.toISOString().split('T')[0] : null,
      findings: row.findings,
      requirements: row.requirements,
      gaps: row.gaps,
      actionPlan: row.action_plan,
      nextReviewDate: row.next_review_date ? row.next_review_date.toISOString().split('T')[0] : null,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default ComplianceCheck;
