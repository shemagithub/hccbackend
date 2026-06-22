import pool from '../config/db.js';
import Opportunity from './Opportunity.js';
import { addAwardedDecisionFields } from '../scripts/add-awarded-decision-fields.js';

class OpportunityProposal {
  static tableReady = false;

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
        decision ENUM('pending', 'under_review', 'awarded', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        implementation_start_date DATE NULL,
        implementation_due_date DATE NULL,
        implementation_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_opportunity_id (opportunity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    await addAwardedDecisionFields();
    this.tableReady = true;
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

  static async findByOpportunityDbId(opportunityDbId) {
    await this.ensureTable();
    const [rows] = await pool.execute(
      'SELECT * FROM opportunity_proposals WHERE opportunity_id = ?',
      [opportunityDbId]
    );

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  static async upsert(opportunityDbId, data) {
    await this.ensureTable();
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
          implementation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  static mapRow(row) {
    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      technicalProposal: row.technical_proposal || '',
      financialProposal: row.financial_proposal || '',
      technicalStatus: row.technical_status,
      financialStatus: row.financial_status,
      decision: row.decision || 'pending',
      implementationStartDate: row.implementation_start_date
        ? row.implementation_start_date.toISOString().split('T')[0]
        : null,
      implementationDueDate: row.implementation_due_date
        ? row.implementation_due_date.toISOString().split('T')[0]
        : null,
      implementationId: row.implementation_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default OpportunityProposal;
