import pool from '../config/db.js';

class Risk {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS risks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        risk_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        category ENUM('Technical', 'Financial', 'Schedule', 'Resource', 'Stakeholder', 'Environmental', 'Legal', 'Other') DEFAULT 'Technical',
        probability ENUM('low', 'medium', 'high', 'very_high') DEFAULT 'medium',
        impact ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        status ENUM('identified', 'assessed', 'mitigated', 'monitored', 'closed', 'escalated') DEFAULT 'identified',
        owner_id INT NULL,
        owner_name VARCHAR(255) NULL,
        identified_by INT NULL,
        identified_by_name VARCHAR(255) NULL,
        identified_date DATE NOT NULL,
        risk_score INT NULL,
        mitigation_strategy TEXT NULL,
        contingency_plan TEXT NULL,
        residual_risk TEXT NULL,
        review_date DATE NULL,
        next_review_date DATE NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_category (category),
        INDEX idx_severity (severity),
        INDEX idx_status (status),
        INDEX idx_probability (probability),
        INDEX idx_impact (impact),
        INDEX idx_identified_date (identified_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (owner_id) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (identified_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Risks table created or already exists.');
  }

  static async generateRiskId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM risks WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `RISK-${year}-${sequence}`;
  }

  static calculateRiskScore(probability, impact) {
    const probScores = { low: 1, medium: 2, high: 3, very_high: 4 };
    const impactScores = { low: 1, medium: 2, high: 3, critical: 4 };
    return (probScores[probability] || 2) * (impactScores[impact] || 2);
  }

  static calculateSeverity(probability, impact) {
    const score = this.calculateRiskScore(probability, impact);
    if (score >= 12) return 'critical';
    if (score >= 9) return 'high';
    if (score >= 6) return 'medium';
    return 'low';
  }

  static async create({
    riskId,
    projectId,
    title,
    description,
    category = 'Technical',
    probability = 'medium',
    impact = 'medium',
    severity,
    status = 'identified',
    ownerId,
    ownerName,
    identifiedBy,
    identifiedByName,
    identifiedDate,
    riskScore,
    mitigationStrategy,
    contingencyPlan,
    residualRisk,
    reviewDate,
    nextReviewDate,
    priority = 'medium'
  }) {
    const rId = riskId || await this.generateRiskId();
    
    // Calculate severity and risk score if not provided
    const calculatedSeverity = severity || this.calculateSeverity(probability, impact);
    const calculatedScore = riskScore || this.calculateRiskScore(probability, impact);

    const [result] = await pool.execute(
      `INSERT INTO risks (
        risk_id, project_id, title, description, category, probability, impact, severity,
        status, owner_id, owner_name, identified_by, identified_by_name, identified_date,
        risk_score, mitigation_strategy, contingency_plan, residual_risk, review_date,
        next_review_date, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rId, projectId || null, title, description || null, category, probability, impact, calculatedSeverity,
        status, ownerId || null, ownerName || null, identifiedBy || null, identifiedByName || null,
        identifiedDate || new Date().toISOString().split('T')[0], calculatedScore, mitigationStrategy || null,
        contingencyPlan || null, residualRisk || null, reviewDate || null, nextReviewDate || null, priority
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT r.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as owner_first_name, s1.last_name as owner_last_name,
             s2.first_name as identifier_first_name, s2.last_name as identifier_last_name
      FROM risks r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN staff s1 ON r.owner_id = s1.id
      LEFT JOIN staff s2 ON r.identified_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (r.title LIKE ? OR r.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND r.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.category) {
      query += ` AND r.category = ?`;
      params.push(filters.category);
    }

    if (filters.severity) {
      query += ` AND r.severity = ?`;
      params.push(filters.severity);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND r.status = ?`;
      params.push(filters.status);
    }

    if (filters.activeOnly) {
      query += ` AND r.status IN ('identified', 'assessed', 'mitigated', 'monitored')`;
    }

    query += ` ORDER BY r.risk_score DESC, r.identified_date DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToRisk(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT r.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as owner_first_name, s1.last_name as owner_last_name,
              s2.first_name as identifier_first_name, s2.last_name as identifier_last_name
       FROM risks r
       LEFT JOIN projects p ON r.project_id = p.id
       LEFT JOIN staff s1 ON r.owner_id = s1.id
       LEFT JOIN staff s2 ON r.identified_by = s2.id
       WHERE r.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToRisk(rows[0]);
  }

  static async findByRiskId(riskId) {
    const [rows] = await pool.execute(
      `SELECT r.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as owner_first_name, s1.last_name as owner_last_name,
              s2.first_name as identifier_first_name, s2.last_name as identifier_last_name
       FROM risks r
       LEFT JOIN projects p ON r.project_id = p.id
       LEFT JOIN staff s1 ON r.owner_id = s1.id
       LEFT JOIN staff s2 ON r.identified_by = s2.id
       WHERE r.risk_id = ?`,
      [riskId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToRisk(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      title: 'title',
      description: 'description',
      category: 'category',
      probability: 'probability',
      impact: 'impact',
      severity: 'severity',
      status: 'status',
      ownerId: 'owner_id',
      ownerName: 'owner_name',
      mitigationStrategy: 'mitigation_strategy',
      contingencyPlan: 'contingency_plan',
      residualRisk: 'residual_risk',
      reviewDate: 'review_date',
      nextReviewDate: 'next_review_date',
      priority: 'priority'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    // Recalculate severity and risk score if probability or impact changed
    if (updateData.probability || updateData.impact) {
      const currentRisk = await this.findById(id);
      if (currentRisk) {
        const newProbability = updateData.probability || currentRisk.probability;
        const newImpact = updateData.impact || currentRisk.impact;
        const newSeverity = this.calculateSeverity(newProbability, newImpact);
        const newScore = this.calculateRiskScore(newProbability, newImpact);
        updateFields.push(`severity = ?`);
        updateFields.push(`risk_score = ?`);
        params.splice(params.length - 1, 0, newSeverity, newScore);
      }
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE risks SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM risks WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'identified' THEN 1 ELSE 0 END) as identified,
        SUM(CASE WHEN status = 'assessed' THEN 1 ELSE 0 END) as assessed,
        SUM(CASE WHEN status = 'mitigated' THEN 1 ELSE 0 END) as mitigated,
        SUM(CASE WHEN status = 'monitored' THEN 1 ELSE 0 END) as monitored,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN status IN ('identified', 'assessed', 'mitigated', 'monitored') THEN 1 ELSE 0 END) as active
      FROM risks
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToRisk(row) {
    return {
      id: row.risk_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      description: row.description,
      category: row.category,
      probability: row.probability,
      impact: row.impact,
      severity: row.severity,
      status: row.status,
      ownerId: row.owner_id,
      ownerName: row.owner_name || (row.owner_first_name && row.owner_last_name
        ? `${row.owner_first_name} ${row.owner_last_name}` : null),
      identifiedBy: row.identified_by,
      identifiedByName: row.identified_by_name || (row.identifier_first_name && row.identifier_last_name
        ? `${row.identifier_first_name} ${row.identifier_last_name}` : null),
      identifiedDate: row.identified_date ? row.identified_date.toISOString().split('T')[0] : null,
      riskScore: row.risk_score ? parseInt(row.risk_score) : null,
      mitigationStrategy: row.mitigation_strategy,
      contingencyPlan: row.contingency_plan,
      residualRisk: row.residual_risk,
      reviewDate: row.review_date ? row.review_date.toISOString().split('T')[0] : null,
      nextReviewDate: row.next_review_date ? row.next_review_date.toISOString().split('T')[0] : null,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Risk;
