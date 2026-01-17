import pool from '../config/db.js';

class QualityControl {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS quality_controls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quality_control_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        checklist_item VARCHAR(500) NOT NULL,
        category ENUM('Design', 'Documentation', 'Safety', 'Environmental', 'Technical', 'Other') DEFAULT 'Technical',
        description TEXT NULL,
        status ENUM('pending', 'compliant', 'non_compliant', 'in_progress') DEFAULT 'pending',
        compliance_score INT NULL,
        checked_by INT NULL,
        checked_by_name VARCHAR(255) NULL,
        check_date DATE NULL,
        findings TEXT NULL,
        corrective_actions TEXT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        due_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_category (category),
        INDEX idx_check_date (check_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (checked_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Quality controls table created or already exists.');
  }

  static async generateQualityControlId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM quality_controls WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `QC-${year}-${sequence}`;
  }

  static async create({
    qualityControlId,
    projectId,
    checklistItem,
    category = 'Technical',
    description,
    status = 'pending',
    complianceScore,
    checkedBy,
    checkedByName,
    checkDate,
    findings,
    correctiveActions,
    priority = 'medium',
    dueDate
  }) {
    const qcId = qualityControlId || await this.generateQualityControlId();

    const [result] = await pool.execute(
      `INSERT INTO quality_controls (
        quality_control_id, project_id, checklist_item, category, description, status,
        compliance_score, checked_by, checked_by_name, check_date, findings,
        corrective_actions, priority, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        qcId, projectId || null, checklistItem, category, description || null, status,
        complianceScore || null, checkedBy || null, checkedByName || null, checkDate || null,
        findings || null, correctiveActions || null, priority, dueDate || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT qc.*, p.name as project_name, p.project_id as project_code,
             s.first_name as checker_first_name, s.last_name as checker_last_name
      FROM quality_controls qc
      LEFT JOIN projects p ON qc.project_id = p.id
      LEFT JOIN staff s ON qc.checked_by = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (qc.checklist_item LIKE ? OR qc.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND qc.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.category) {
      query += ` AND qc.category = ?`;
      params.push(filters.category);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND qc.status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY qc.check_date DESC, qc.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToQualityControl(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT qc.*, p.name as project_name, p.project_id as project_code,
              s.first_name as checker_first_name, s.last_name as checker_last_name
       FROM quality_controls qc
       LEFT JOIN projects p ON qc.project_id = p.id
       LEFT JOIN staff s ON qc.checked_by = s.id
       WHERE qc.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToQualityControl(rows[0]);
  }

  static async findByQualityControlId(qualityControlId) {
    const [rows] = await pool.execute(
      `SELECT qc.*, p.name as project_name, p.project_id as project_code,
              s.first_name as checker_first_name, s.last_name as checker_last_name
       FROM quality_controls qc
       LEFT JOIN projects p ON qc.project_id = p.id
       LEFT JOIN staff s ON qc.checked_by = s.id
       WHERE qc.quality_control_id = ?`,
      [qualityControlId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToQualityControl(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      checklistItem: 'checklist_item',
      category: 'category',
      description: 'description',
      status: 'status',
      complianceScore: 'compliance_score',
      checkedBy: 'checked_by',
      checkedByName: 'checked_by_name',
      checkDate: 'check_date',
      findings: 'findings',
      correctiveActions: 'corrective_actions',
      priority: 'priority',
      dueDate: 'due_date'
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
      `UPDATE quality_controls SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM quality_controls WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'compliant' THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN status = 'non_compliant' THEN 1 ELSE 0 END) as nonCompliant,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        AVG(compliance_score) as avgComplianceScore
      FROM quality_controls
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToQualityControl(row) {
    return {
      id: row.quality_control_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      checklistItem: row.checklist_item,
      category: row.category,
      description: row.description,
      status: row.status,
      complianceScore: row.compliance_score ? parseInt(row.compliance_score) : null,
      checkedBy: row.checked_by,
      checkedByName: row.checked_by_name || (row.checker_first_name && row.checker_last_name
        ? `${row.checker_first_name} ${row.checker_last_name}` : null),
      checkDate: row.check_date ? row.check_date.toISOString().split('T')[0] : null,
      findings: row.findings,
      correctiveActions: row.corrective_actions,
      priority: row.priority,
      dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default QualityControl;
