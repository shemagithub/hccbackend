import pool from '../config/db.js';
import { addAwardedDecisionFields } from '../scripts/add-awarded-decision-fields.js';

class EOI {
  static awardedFieldsReady = false;
  static opportunityLinkReady = false;
  static attachmentFieldsReady = false;
  static goDecisionFieldReady = false;
  static assignedToColumnReady = false;

  static async ensureAssignedToColumn() {
    if (this.assignedToColumnReady) return;
    await this.createTable();

    const [rows] = await pool.execute(
      `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'eois'
         AND COLUMN_NAME = 'assigned_to'`
    );

    if (rows.length > 0) {
      const dataType = String(rows[0].DATA_TYPE || '').toLowerCase();
      const maxLen = Number(rows[0].CHARACTER_MAXIMUM_LENGTH || 0);
      // Prefer TEXT; fall back already applied DBs stay TEXT. Widen short VARCHAR.
      if (dataType === 'varchar' && maxLen > 0 && maxLen < 2000) {
        await pool.execute('ALTER TABLE eois MODIFY COLUMN assigned_to TEXT NULL');
        console.log('Widened eois.assigned_to to TEXT');
      }
    }

    this.assignedToColumnReady = true;
  }

  static async ensureGoDecisionField() {
    if (this.goDecisionFieldReady) return;
    await this.createTable();

    const [rows] = await pool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'eois'
         AND COLUMN_NAME = 'go_decision'`
    );

    if (rows.length === 0) {
      await pool.execute(
        "ALTER TABLE eois ADD COLUMN go_decision ENUM('pending', 'go', 'not_go') NOT NULL DEFAULT 'pending' AFTER status"
      );
      console.log('Added eois.go_decision');
    }

    this.goDecisionFieldReady = true;
  }

  static async ensureAttachmentFields() {
    if (this.attachmentFieldsReady) return;
    await this.createTable();

    const columns = [
      { name: 'attached_document', ddl: 'ADD COLUMN attached_document LONGTEXT NULL' },
      { name: 'attached_document_name', ddl: 'ADD COLUMN attached_document_name VARCHAR(255) NULL' },
    ];

    for (const column of columns) {
      const [rows] = await pool.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'eois'
           AND COLUMN_NAME = ?`,
        [column.name]
      );

      if (rows.length === 0) {
        await pool.execute(`ALTER TABLE eois ${column.ddl}`);
        console.log(`Added eois.${column.name}`);
      }
    }

    this.attachmentFieldsReady = true;
  }

  static async ensureOpportunityLink() {
    if (this.opportunityLinkReady) return;
    await this.createTable();

    const [rows] = await pool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'eois'
         AND COLUMN_NAME = 'opportunity_id'`
    );

    if (rows.length === 0) {
      await pool.execute(
        'ALTER TABLE eois ADD COLUMN opportunity_id INT NULL UNIQUE AFTER eoi_id'
      );
      console.log('Added eois.opportunity_id');
    }

    this.opportunityLinkReady = true;
  }

  static async ensureAwardedFields() {
    if (this.awardedFieldsReady) return;
    await this.createTable();
    await this.ensureOpportunityLink();
    await addAwardedDecisionFields();
    this.awardedFieldsReady = true;
  }

  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS eois (
        id INT AUTO_INCREMENT PRIMARY KEY,
        eoi_id VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        organization VARCHAR(255) NOT NULL,
        submission_date DATE NOT NULL,
        deadline DATE NOT NULL,
        status ENUM('draft', 'submitted', 'under_review', 'shortlisted', 'rejected', 'accepted') DEFAULT 'draft',
        value DECIMAL(15,2) NOT NULL DEFAULT 0,
        assigned_to TEXT NULL,
        description TEXT NOT NULL,
        requirements TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_organization (organization),
        INDEX idx_deadline (deadline),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('EOIs table created or already exists.');
  }

  static async generateEOIId() {
    try {
      const year = new Date().getFullYear();
      const yearPrefix = `EOI-${year}-`;
      
      const [rows] = await pool.execute(
        `SELECT eoi_id FROM eois 
         WHERE eoi_id LIKE ?
         ORDER BY eoi_id DESC LIMIT 1`,
        [`${yearPrefix}%`]
      );
      
      let sequence = 1;
      if (rows.length > 0 && rows[0].eoi_id) {
        const lastId = String(rows[0].eoi_id);
        const parts = lastId.split('-');
        if (parts.length >= 3) {
          const lastSequence = parseInt(parts[2]);
          if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
          }
        }
      }
      
      if (sequence > 999) {
        sequence = 1;
      }
      
      const sequenceStr = String(sequence).padStart(3, '0');
      const eoiId = `${yearPrefix}${sequenceStr}`;
      
      const existing = await this.findByEOIId(eoiId);
      if (existing) {
        sequence++;
        const newSequenceStr = String(sequence).padStart(3, '0');
        return `${yearPrefix}${newSequenceStr}`;
      }
      
      return eoiId;
    } catch (error) {
      console.error('Error generating EOI ID:', error);
      const timestamp = Date.now();
      return `EOI-${timestamp}`;
    }
  }

  static async create({
    eoiId,
    opportunityId,
    title,
    organization,
    submissionDate,
    deadline,
    status = 'draft',
    value = 0,
    assignedTo,
    description,
    requirements
  }) {
    await this.ensureOpportunityLink();
    await this.ensureAssignedToColumn();
    const id = eoiId || await this.generateEOIId();
    
    // Convert requirements array to JSON string if array, otherwise store as is
    const requirementsStr = Array.isArray(requirements) 
      ? JSON.stringify(requirements) 
      : requirements || null;

    const assignedToValue = Array.isArray(assignedTo)
      ? assignedTo.join(', ')
      : assignedTo || null;
    
    const [result] = await pool.execute(
      `INSERT INTO eois (
        eoi_id, opportunity_id, title, organization, submission_date, deadline, status, 
        value, assigned_to, description, requirements
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, opportunityId || null, title, organization, submissionDate, deadline, status,
        value, assignedToValue, description, requirementsStr
      ]
    );

    return this.findById(result.insertId);
  }

  static async findByOpportunityDbId(opportunityDbId) {
    await this.ensureOpportunityLink();
    const [rows] = await pool.execute(
      'SELECT * FROM eois WHERE opportunity_id = ? LIMIT 1',
      [opportunityDbId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToEOI(rows[0]);
  }

  static async findGoLinkedOpportunityIds() {
    await this.ensureGoDecisionField();
    const [rows] = await pool.execute(
      `SELECT opportunity_id
       FROM eois
       WHERE go_decision = 'go'
         AND opportunity_id IS NOT NULL
         AND opportunity_id > 0`
    );
    return rows.map((row) => row.opportunity_id);
  }

  static async findAllGoWithOpportunityLink() {
    await this.ensureGoDecisionField();
    const [rows] = await pool.execute(
      `SELECT id, eoi_id, opportunity_id, title, go_decision
       FROM eois
       WHERE go_decision = 'go'
         AND opportunity_id IS NOT NULL
         AND opportunity_id > 0`
    );
    return rows.map((row) => ({
      dbId: row.id,
      id: row.eoi_id,
      opportunityId: row.opportunity_id,
      title: row.title,
      goDecision: row.go_decision,
    }));
  }

  static async findAll(filters = {}) {
    await this.ensureAttachmentFields();
    await this.ensureGoDecisionField();

    try {
      return await this.findAllWithAttachments(filters);
    } catch (error) {
      if (this.isAttachmentSchemaError(error)) {
        console.warn('EOI attachment list query failed, using basic list query:', error.message);
        return await this.findAllBasic(filters);
      }
      throw error;
    }
  }

  static isAttachmentSchemaError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('attached_document') ||
      message.includes('go_decision') ||
      message.includes('unknown column') ||
      message.includes("doesn't exist")
    );
  }

  static async findAllWithAttachments(filters = {}) {
    const excludeDocuments = filters.excludeDocuments !== false;
    const selectClause = excludeDocuments
      ? `id, eoi_id, opportunity_id, title, organization, submission_date, deadline, status, go_decision,
         value, assigned_to, description, requirements, decision, implementation_start_date,
         implementation_due_date, implementation_id, attached_document_name, created_at, updated_at,
         (attached_document IS NOT NULL) AS has_attached_document`
      : '*';

    let query = `
      SELECT ${selectClause} FROM eois WHERE 1=1
    `;
    return this.executeListQuery(query, [], excludeDocuments, filters);
  }

  static async findAllBasic(filters = {}) {
    let query = `SELECT * FROM eois WHERE 1=1`;
    return this.executeListQuery(query, [], false, filters);
  }

  static async executeListQuery(query, initialParams, forList, filters = {}) {
    const params = [...initialParams];

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (title LIKE ? OR organization LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.excludeImplemented === true || filters.excludeImplemented === 'true') {
      query += ` AND (implementation_id IS NULL OR implementation_id = 0)`;
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map((row) => this.mapRowToEOI(row, { forList }));
  }

  static async findById(id, options = {}) {
    await this.ensureAwardedFields();
    await this.ensureAttachmentFields();
    await this.ensureGoDecisionField();
    const excludeDocuments = options.excludeDocuments === true;
    const selectClause = excludeDocuments
      ? `id, eoi_id, opportunity_id, title, organization, submission_date, deadline, status, go_decision,
         value, assigned_to, description, requirements, decision, implementation_start_date,
         implementation_due_date, implementation_id, attached_document_name, created_at, updated_at,
         (attached_document IS NOT NULL) AS has_attached_document`
      : '*';

    const [rows] = await pool.execute(`SELECT ${selectClause} FROM eois WHERE id = ?`, [id]);

    if (rows.length === 0) return null;
    return this.mapRowToEOI(rows[0], { forList: excludeDocuments });
  }

  static async findByEOIId(eoiId, options = {}) {
    await this.ensureAwardedFields();
    await this.ensureAttachmentFields();
    await this.ensureGoDecisionField();
    const excludeDocuments = options.excludeDocuments === true;
    const selectClause = excludeDocuments
      ? `id, eoi_id, opportunity_id, title, organization, submission_date, deadline, status, go_decision,
         value, assigned_to, description, requirements, decision, implementation_start_date,
         implementation_due_date, implementation_id, attached_document_name, created_at, updated_at,
         (attached_document IS NOT NULL) AS has_attached_document`
      : '*';

    const [rows] = await pool.execute(`SELECT ${selectClause} FROM eois WHERE eoi_id = ?`, [eoiId]);

    if (rows.length === 0) return null;
    return this.mapRowToEOI(rows[0], { forList: excludeDocuments });
  }

  static async update(id, updateData) {
    await this.ensureAwardedFields();
    await this.ensureAttachmentFields();
    await this.ensureGoDecisionField();
    await this.ensureAssignedToColumn();
    const fields = [];
    const values = [];

    if (updateData.title !== undefined) {
      fields.push('title = ?');
      values.push(updateData.title);
    }
    if (updateData.organization !== undefined) {
      fields.push('organization = ?');
      values.push(updateData.organization);
    }
    if (updateData.submissionDate !== undefined) {
      fields.push('submission_date = ?');
      values.push(updateData.submissionDate);
    }
    if (updateData.deadline !== undefined) {
      fields.push('deadline = ?');
      values.push(updateData.deadline);
    }
    if (updateData.status !== undefined) {
      fields.push('status = ?');
      values.push(updateData.status);
    }
    if (updateData.goDecision !== undefined) {
      fields.push('go_decision = ?');
      values.push(updateData.goDecision);
    }
    if (updateData.value !== undefined) {
      fields.push('value = ?');
      values.push(updateData.value);
    }
    if (updateData.assignedTo !== undefined) {
      const assignedToValue = Array.isArray(updateData.assignedTo)
        ? updateData.assignedTo.join(', ')
        : updateData.assignedTo;
      fields.push('assigned_to = ?');
      values.push(assignedToValue);
    }
    if (updateData.description !== undefined) {
      fields.push('description = ?');
      values.push(updateData.description);
    }
    if (updateData.requirements !== undefined) {
      const requirementsStr = Array.isArray(updateData.requirements) 
        ? JSON.stringify(updateData.requirements) 
        : updateData.requirements || null;
      fields.push('requirements = ?');
      values.push(requirementsStr);
    }
    if (updateData.decision !== undefined) {
      fields.push('decision = ?');
      values.push(updateData.decision);
    }
    if (updateData.implementationStartDate !== undefined) {
      fields.push('implementation_start_date = ?');
      values.push(updateData.implementationStartDate || null);
    }
    if (updateData.implementationDueDate !== undefined) {
      fields.push('implementation_due_date = ?');
      values.push(updateData.implementationDueDate || null);
    }
    if (updateData.implementationId !== undefined) {
      fields.push('implementation_id = ?');
      values.push(updateData.implementationId || null);
    }
    if (updateData.attachedDocument !== undefined) {
      fields.push('attached_document = ?');
      values.push(updateData.attachedDocument || null);
    }
    if (updateData.attachedDocumentName !== undefined) {
      fields.push('attached_document_name = ?');
      values.push(updateData.attachedDocumentName || null);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `UPDATE eois SET ${fields.join(', ')} WHERE id = ?`;
    
    await pool.execute(query, values);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM eois WHERE id = ?', [id]);
    return true;
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status NOT IN ('rejected', 'accepted') THEN 1 ELSE 0 END) as active,
        SUM(value) as totalValue,
        SUM(CASE WHEN status IN ('shortlisted', 'accepted') THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN deadline >= CURDATE() AND deadline <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as upcomingDeadlines
      FROM eois
    `);

    const stats = rows[0];
    const successRate = stats.total > 0 
      ? Math.round((stats.successful / stats.total) * 100) 
      : 0;

    return {
      total: stats.total || 0,
      active: stats.active || 0,
      totalValue: parseFloat(stats.totalValue) || 0,
      successful: stats.successful || 0,
      successRate,
      upcomingDeadlines: stats.upcomingDeadlines || 0
    };
  }

  static mapRowToEOI(row, options = {}) {
    const { forList = false } = options;
    // Parse requirements JSON string to array
    let requirements = [];
    if (row.requirements) {
      try {
        requirements = JSON.parse(row.requirements);
        if (!Array.isArray(requirements)) {
          requirements = [];
        }
      } catch (e) {
        requirements = [];
      }
    }

    return {
      id: row.eoi_id,
      dbId: row.id,
      opportunityId: row.opportunity_id || null,
      title: row.title,
      organization: row.organization,
      submissionDate: row.submission_date ? row.submission_date.toISOString().split('T')[0] : null,
      deadline: row.deadline ? row.deadline.toISOString().split('T')[0] : null,
      status: row.status,
      goDecision: row.go_decision || 'pending',
      value: parseFloat(row.value) || 0,
      assignedTo: row.assigned_to,
      description: row.description,
      requirements,
      decision: row.decision || 'pending',
      implementationStartDate: row.implementation_start_date
        ? row.implementation_start_date.toISOString().split('T')[0]
        : null,
      implementationDueDate: row.implementation_due_date
        ? row.implementation_due_date.toISOString().split('T')[0]
        : null,
      implementationId: row.implementation_id || null,
      attachedDocument: forList ? null : row.attached_document || null,
      attachedDocumentName: row.attached_document_name || null,
      hasAttachedDocument: Boolean(
        row.has_attached_document ??
          (row.attached_document && String(row.attached_document).length > 0)
      ),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default EOI;

