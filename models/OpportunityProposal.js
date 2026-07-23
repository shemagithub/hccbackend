import pool from '../config/db.js';
import Opportunity from './Opportunity.js';
import { addAwardedDecisionFields } from '../scripts/add-awarded-decision-fields.js';

class OpportunityProposal {
  static tableReady = false;
  static attachmentFieldsReady = false;
  static wonDecisionReady = false;

  static async ensureWonDecisionEnum() {
    if (this.wonDecisionReady) return;

    try {
      await pool.execute(
        `ALTER TABLE opportunity_proposals
         MODIFY COLUMN decision ENUM('pending', 'under_review', 'awarded', 'won', 'rejected', 'cancelled')
         NOT NULL DEFAULT 'pending'`
      );
      await pool.execute(
        `UPDATE opportunity_proposals SET decision = 'won' WHERE decision = 'awarded'`
      );
      await pool.execute(
        `ALTER TABLE opportunity_proposals
         MODIFY COLUMN decision ENUM('pending', 'under_review', 'won', 'rejected', 'cancelled')
         NOT NULL DEFAULT 'pending'`
      );
      console.log('Opportunity proposals decision enum migrated to won');
    } catch (error) {
      console.warn('Could not migrate opportunity_proposals decision to won:', error.message);
    }

    this.wonDecisionReady = true;
  }

  static async ensureAttachmentFields() {
    if (this.attachmentFieldsReady) return;
    await this.ensureTable();

    const columns = [
      { name: 'technical_attachment', ddl: 'ADD COLUMN technical_attachment LONGTEXT NULL' },
      { name: 'technical_attachment_name', ddl: 'ADD COLUMN technical_attachment_name VARCHAR(255) NULL' },
      { name: 'financial_attachment', ddl: 'ADD COLUMN financial_attachment LONGTEXT NULL' },
      { name: 'financial_attachment_name', ddl: 'ADD COLUMN financial_attachment_name VARCHAR(255) NULL' },
    ];

    for (const column of columns) {
      const [rows] = await pool.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'opportunity_proposals'
           AND COLUMN_NAME = ?`,
        [column.name]
      );

      if (rows.length === 0) {
        await pool.execute(`ALTER TABLE opportunity_proposals ${column.ddl}`);
        console.log(`Added opportunity_proposals.${column.name}`);
      }
    }

    this.attachmentFieldsReady = true;
  }

  static async ensureTable() {
    if (this.tableReady) return;

    const query = `
      CREATE TABLE IF NOT EXISTS opportunity_proposals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        opportunity_id INT NOT NULL UNIQUE,
        technical_proposal LONGTEXT NULL,
        financial_proposal LONGTEXT NULL,
        technical_status ENUM('draft', 'submitted', 'approved') DEFAULT 'draft',
        financial_status ENUM('draft', 'submitted', 'approved') DEFAULT 'draft',
        decision ENUM('pending', 'under_review', 'won', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        implementation_start_date DATE NULL,
        implementation_due_date DATE NULL,
        implementation_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_opportunity_id (opportunity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    this.tableReady = true;
    await addAwardedDecisionFields();
    await this.ensureWonDecisionEnum();
    console.log('Opportunity proposals table created or already exists.');
  }

  static async createTable() {
    await this.ensureTable();
  }

  static async resolveOpportunity(idParam) {
    if (!idParam) return null;

    const numericId = parseInt(idParam, 10);
    if (!Number.isNaN(numericId)) {
      const byDbId = await Opportunity.findById(numericId, { excludeDocuments: true });
      if (byDbId) return byDbId;
    }

    return Opportunity.findByOpportunityId(String(idParam), { excludeDocuments: true });
  }

  static async findAllWithOpportunities(filters = {}) {
    await this.ensureAttachmentFields();

    let query = `
      SELECT
        o.id, o.opportunity_id, o.department, o.country,         o.name, o.legal_entity, o.client, o.contact,
        LEFT(o.description, 1000) AS description, o.feedback_deadline, o.operation_date, o.win_probability, o.bid_currency,
        o.fund_agency, o.urgency, o.comment, o.year, o.status, o.decision, o.value, o.expected_close_date,
        o.assigned_to, o.created_at, o.updated_at,
        (o.supporting_document IS NOT NULL) AS has_supporting_document,
        (o.win_probability_document IS NOT NULL) AS has_win_probability_document,
        (SELECT e.eoi_id FROM eois e WHERE e.opportunity_id = o.id LIMIT 1) AS linked_eoi_id,
        (SELECT e.id FROM eois e WHERE e.opportunity_id = o.id LIMIT 1) AS linked_eoi_db_id,
        (SELECT e.go_decision FROM eois e WHERE e.opportunity_id = o.id LIMIT 1) AS linked_eoi_go_decision,
        op.id AS proposal_row_id,
        op.technical_status,
        op.financial_status,
        op.decision AS proposal_decision,
        op.implementation_start_date AS proposal_implementation_start_date,
        op.implementation_due_date AS proposal_implementation_due_date,
        op.implementation_id AS proposal_implementation_id,
        op.technical_attachment_name,
        op.financial_attachment_name,
        (op.technical_attachment IS NOT NULL) AS has_technical_attachment,
        (op.financial_attachment IS NOT NULL) AS has_financial_attachment,
        op.created_at AS proposal_created_at,
        op.updated_at AS proposal_updated_at
      FROM opportunity_proposals op
      INNER JOIN opportunities o ON o.id = op.opportunity_id
      WHERE (op.implementation_id IS NULL OR op.implementation_id = 0)
    `;
    const params = [];

    if (filters.userEmail) {
      query += ` AND (
        o.assigned_to LIKE ? OR
        o.assigned_to LIKE ? OR
        o.assigned_to LIKE ? OR
        o.assigned_to = ?
      )`;
      const emailPattern1 = `${filters.userEmail},%`;
      const emailPattern2 = `%,${filters.userEmail},%`;
      const emailPattern3 = `%,${filters.userEmail}`;
      params.push(emailPattern1, emailPattern2, emailPattern3, filters.userEmail);
    }

    if (filters.search) {
      query += ` AND (
        o.name LIKE ? OR
        o.client LIKE ? OR
        o.department LIKE ? OR
        o.country LIKE ? OR
        o.opportunity_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.department) {
      query += ` AND o.department = ?`;
      params.push(filters.department);
    }

    query += ` ORDER BY op.updated_at DESC, o.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit, 10));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset, 10));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map((row) => this.mapCombinedRow(row));
  }

  static mapCombinedRow(row) {
    const opportunity = Opportunity.mapRowToOpportunity(row, { forList: true });
    opportunity.hasProposal = true;

    const proposal = {
      id: row.proposal_row_id,
      opportunityId: row.id,
      technicalStatus: row.technical_status,
      financialStatus: row.financial_status,
      decision: row.proposal_decision === 'awarded' ? 'won' : row.proposal_decision || 'pending',
      implementationStartDate: row.proposal_implementation_start_date
        ? row.proposal_implementation_start_date.toISOString().split('T')[0]
        : null,
      implementationDueDate: row.proposal_implementation_due_date
        ? row.proposal_implementation_due_date.toISOString().split('T')[0]
        : null,
      implementationId: row.proposal_implementation_id || null,
      technicalAttachmentName: row.technical_attachment_name || null,
      financialAttachmentName: row.financial_attachment_name || null,
      hasTechnicalAttachment: Boolean(row.has_technical_attachment),
      hasFinancialAttachment: Boolean(row.has_financial_attachment),
      createdAt: row.proposal_created_at,
      updatedAt: row.proposal_updated_at,
    };

    return { opportunity, proposal };
  }

  static async findByOpportunityDbId(opportunityDbId, options = {}) {
    await this.ensureAttachmentFields();
    const excludeDocuments = options.excludeDocuments === true;
    const selectClause = excludeDocuments
      ? `id, opportunity_id, technical_status, financial_status,
         decision, implementation_start_date, implementation_due_date, implementation_id,
         technical_attachment_name, financial_attachment_name, created_at, updated_at,
         (technical_attachment IS NOT NULL) AS has_technical_attachment,
         (financial_attachment IS NOT NULL) AS has_financial_attachment`
      : '*';

    const [rows] = await pool.execute(
      `SELECT ${selectClause} FROM opportunity_proposals WHERE opportunity_id = ?`,
      [opportunityDbId]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0], { forList: excludeDocuments });
  }

  static async upsert(opportunityDbId, data) {
    await this.ensureAttachmentFields();
    const existing = await this.findByOpportunityDbId(opportunityDbId);

    if (!existing) {
      await pool.execute(
        `INSERT INTO opportunity_proposals (
          opportunity_id,
          technical_proposal,
          financial_proposal,
          technical_status,
          financial_status,
          decision,
          implementation_start_date,
          implementation_due_date,
          implementation_id,
          technical_attachment,
          technical_attachment_name,
          financial_attachment,
          financial_attachment_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          opportunityDbId,
          data.technicalProposal ?? null,
          data.financialProposal ?? null,
          data.technicalStatus ?? 'draft',
          data.financialStatus ?? 'draft',
          data.decision ?? 'pending',
          data.implementationStartDate ?? null,
          data.implementationDueDate ?? null,
          data.implementationId ?? null,
          data.technicalAttachment ?? null,
          data.technicalAttachmentName ?? null,
          data.financialAttachment ?? null,
          data.financialAttachmentName ?? null,
        ]
      );
    } else {
      const fields = [];
      const values = [];

      if (data.technicalProposal !== undefined) {
        fields.push('technical_proposal = ?');
        values.push(data.technicalProposal);
      }
      if (data.financialProposal !== undefined) {
        fields.push('financial_proposal = ?');
        values.push(data.financialProposal);
      }
      if (data.technicalStatus !== undefined) {
        fields.push('technical_status = ?');
        values.push(data.technicalStatus);
      }
      if (data.financialStatus !== undefined) {
        fields.push('financial_status = ?');
        values.push(data.financialStatus);
      }
      if (data.decision !== undefined) {
        fields.push('decision = ?');
        values.push(data.decision);
      }
      if (data.implementationStartDate !== undefined) {
        fields.push('implementation_start_date = ?');
        values.push(data.implementationStartDate || null);
      }
      if (data.implementationDueDate !== undefined) {
        fields.push('implementation_due_date = ?');
        values.push(data.implementationDueDate || null);
      }
      if (data.implementationId !== undefined) {
        fields.push('implementation_id = ?');
        values.push(data.implementationId || null);
      }
      if (data.technicalAttachment !== undefined) {
        fields.push('technical_attachment = ?');
        values.push(data.technicalAttachment || null);
      }
      if (data.technicalAttachmentName !== undefined) {
        fields.push('technical_attachment_name = ?');
        values.push(data.technicalAttachmentName || null);
      }
      if (data.financialAttachment !== undefined) {
        fields.push('financial_attachment = ?');
        values.push(data.financialAttachment || null);
      }
      if (data.financialAttachmentName !== undefined) {
        fields.push('financial_attachment_name = ?');
        values.push(data.financialAttachmentName || null);
      }

      if (fields.length === 0) {
        return this.findByOpportunityDbId(opportunityDbId);
      }

      values.push(opportunityDbId);
      await pool.execute(
        `UPDATE opportunity_proposals SET ${fields.join(', ')} WHERE opportunity_id = ?`,
        values
      );
    }

    return this.findByOpportunityDbId(opportunityDbId);
  }

  static mapRow(row, options = {}) {
    const { forList = false } = options;
    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      technicalProposal: row.technical_proposal || '',
      financialProposal: row.financial_proposal || '',
      technicalStatus: row.technical_status,
      financialStatus: row.financial_status,
      decision: row.decision === 'awarded' ? 'won' : row.decision || 'pending',
      implementationStartDate: row.implementation_start_date
        ? row.implementation_start_date.toISOString().split('T')[0]
        : null,
      implementationDueDate: row.implementation_due_date
        ? row.implementation_due_date.toISOString().split('T')[0]
        : null,
      implementationId: row.implementation_id || null,
      technicalAttachment: forList ? null : row.technical_attachment || null,
      technicalAttachmentName: row.technical_attachment_name || null,
      financialAttachment: forList ? null : row.financial_attachment || null,
      financialAttachmentName: row.financial_attachment_name || null,
      hasTechnicalAttachment: Boolean(
        row.has_technical_attachment ??
          (row.technical_attachment && String(row.technical_attachment).length > 0)
      ),
      hasFinancialAttachment: Boolean(
        row.has_financial_attachment ??
          (row.financial_attachment && String(row.financial_attachment).length > 0)
      ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default OpportunityProposal;
