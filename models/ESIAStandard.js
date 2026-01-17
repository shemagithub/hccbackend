import pool from '../config/db.js';

class ESIAStandard {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS esia_standards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        esia_standard_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        standard_type ENUM('Environmental Impact Assessment', 'Social Impact Assessment', 'Biodiversity Assessment', 'Health Impact Assessment', 'Economic Impact Assessment', 'Other') NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        compliance_status ENUM('compliant', 'partial', 'non_compliant', 'pending', 'in_progress') DEFAULT 'pending',
        compliance_score INT NULL,
        requirements TEXT NULL,
        findings TEXT NULL,
        gaps TEXT NULL,
        action_plan TEXT NULL,
        assessed_by INT NULL,
        assessed_by_name VARCHAR(255) NULL,
        assessment_date DATE NULL,
        next_review_date DATE NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_standard_type (standard_type),
        INDEX idx_compliance_status (compliance_status),
        INDEX idx_assessment_date (assessment_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (assessed_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('ESIA standards table created or already exists.');
  }

  static async generateESIAStandardId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM esia_standards WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `ESIA-${year}-${sequence}`;
  }

  static async create({
    esiaStandardId,
    projectId,
    standardType,
    title,
    description,
    complianceStatus = 'pending',
    complianceScore,
    requirements,
    findings,
    gaps,
    actionPlan,
    assessedBy,
    assessedByName,
    assessmentDate,
    nextReviewDate,
    priority = 'medium'
  }) {
    const esiaId = esiaStandardId || await this.generateESIAStandardId();

    const [result] = await pool.execute(
      `INSERT INTO esia_standards (
        esia_standard_id, project_id, standard_type, title, description, compliance_status,
        compliance_score, requirements, findings, gaps, action_plan,
        assessed_by, assessed_by_name, assessment_date, next_review_date, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        esiaId, projectId || null, standardType, title, description || null, complianceStatus,
        complianceScore || null, requirements || null, findings || null, gaps || null,
        actionPlan || null, assessedBy || null, assessedByName || null, assessmentDate || null,
        nextReviewDate || null, priority
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT es.*, p.name as project_name, p.project_id as project_code,
             s.first_name as assessor_first_name, s.last_name as assessor_last_name
      FROM esia_standards es
      LEFT JOIN projects p ON es.project_id = p.id
      LEFT JOIN staff s ON es.assessed_by = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (es.title LIKE ? OR es.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND es.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.standardType) {
      query += ` AND es.standard_type = ?`;
      params.push(filters.standardType);
    }

    if (filters.complianceStatus && filters.complianceStatus !== 'all') {
      query += ` AND es.compliance_status = ?`;
      params.push(filters.complianceStatus);
    }

    query += ` ORDER BY es.assessment_date DESC, es.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToESIAStandard(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT es.*, p.name as project_name, p.project_id as project_code,
              s.first_name as assessor_first_name, s.last_name as assessor_last_name
       FROM esia_standards es
       LEFT JOIN projects p ON es.project_id = p.id
       LEFT JOIN staff s ON es.assessed_by = s.id
       WHERE es.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToESIAStandard(rows[0]);
  }

  static async findByESIAStandardId(esiaStandardId) {
    const [rows] = await pool.execute(
      `SELECT es.*, p.name as project_name, p.project_id as project_code,
              s.first_name as assessor_first_name, s.last_name as assessor_last_name
       FROM esia_standards es
       LEFT JOIN projects p ON es.project_id = p.id
       LEFT JOIN staff s ON es.assessed_by = s.id
       WHERE es.esia_standard_id = ?`,
      [esiaStandardId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToESIAStandard(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      standardType: 'standard_type',
      title: 'title',
      description: 'description',
      complianceStatus: 'compliance_status',
      complianceScore: 'compliance_score',
      requirements: 'requirements',
      findings: 'findings',
      gaps: 'gaps',
      actionPlan: 'action_plan',
      assessedBy: 'assessed_by',
      assessedByName: 'assessed_by_name',
      assessmentDate: 'assessment_date',
      nextReviewDate: 'next_review_date',
      priority: 'priority'
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
      `UPDATE esia_standards SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM esia_standards WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN compliance_status = 'compliant' THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN compliance_status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN compliance_status = 'non_compliant' THEN 1 ELSE 0 END) as nonCompliant,
        SUM(CASE WHEN compliance_status = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(compliance_score) as avgComplianceScore
      FROM esia_standards
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToESIAStandard(row) {
    return {
      id: row.esia_standard_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      standardType: row.standard_type,
      title: row.title,
      description: row.description,
      complianceStatus: row.compliance_status,
      complianceScore: row.compliance_score ? parseInt(row.compliance_score) : null,
      requirements: row.requirements,
      findings: row.findings,
      gaps: row.gaps,
      actionPlan: row.action_plan,
      assessedBy: row.assessed_by,
      assessedByName: row.assessed_by_name || (row.assessor_first_name && row.assessor_last_name
        ? `${row.assessor_first_name} ${row.assessor_last_name}` : null),
      assessmentDate: row.assessment_date ? row.assessment_date.toISOString().split('T')[0] : null,
      nextReviewDate: row.next_review_date ? row.next_review_date.toISOString().split('T')[0] : null,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default ESIAStandard;
