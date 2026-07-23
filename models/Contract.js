import pool from '../config/db.js';
import { ensureImplementationForApprovedContract } from '../utils/contractImplementation.js';

class Contract {
  static linkFieldsReady = false;
  static approvalFieldsReady = false;
  static paymentTermsColumnReady = false;

  static async ensurePaymentTermsColumn() {
    if (this.paymentTermsColumnReady) return;

    const [rows] = await pool.execute(
      `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'contracts'
         AND COLUMN_NAME = 'payment_terms'`
    );

    if (rows.length > 0) {
      const dataType = String(rows[0].DATA_TYPE || '').toLowerCase();
      const maxLen = Number(rows[0].CHARACTER_MAXIMUM_LENGTH || 0);
      if (dataType === 'varchar' && maxLen > 0 && maxLen < 2000) {
        await pool.execute('ALTER TABLE contracts MODIFY COLUMN payment_terms TEXT NULL');
        console.log('Widened contracts.payment_terms to TEXT');
      }
    }

    this.paymentTermsColumnReady = true;
  }

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
        payment_terms TEXT NULL,
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
    await this.ensureLinkFields();
    await this.ensureApprovalFields();
    await this.ensurePaymentTermsColumn();
    console.log('Contracts table created or already exists.');
  }

  static async ensureApprovalFields() {
    if (this.approvalFieldsReady) return;
    await this.ensureLinkFields();

    const columns = [
      {
        name: 'approval_status',
        ddl: "ADD COLUMN approval_status ENUM('draft','in_review','approved','rejected') NOT NULL DEFAULT 'draft' AFTER renewal_status",
      },
      {
        name: 'current_approval_step',
        ddl: "ADD COLUMN current_approval_step ENUM('none','project_manager','finance','director','completed') NOT NULL DEFAULT 'none' AFTER approval_status",
      },
      {
        name: 'project_manager_status',
        ddl: "ADD COLUMN project_manager_status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft' AFTER current_approval_step",
      },
      {
        name: 'finance_status',
        ddl: "ADD COLUMN finance_status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft' AFTER project_manager_status",
      },
      {
        name: 'director_status',
        ddl: "ADD COLUMN director_status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft' AFTER finance_status",
      },
      { name: 'submitted_by', ddl: 'ADD COLUMN submitted_by INT NULL AFTER director_status' },
      { name: 'submitted_by_name', ddl: 'ADD COLUMN submitted_by_name VARCHAR(255) NULL AFTER submitted_by' },
      { name: 'submitted_at', ddl: 'ADD COLUMN submitted_at TIMESTAMP NULL AFTER submitted_by_name' },
      { name: 'project_manager_by', ddl: 'ADD COLUMN project_manager_by INT NULL AFTER submitted_at' },
      { name: 'project_manager_by_name', ddl: 'ADD COLUMN project_manager_by_name VARCHAR(255) NULL AFTER project_manager_by' },
      { name: 'project_manager_at', ddl: 'ADD COLUMN project_manager_at TIMESTAMP NULL AFTER project_manager_by_name' },
      { name: 'finance_by', ddl: 'ADD COLUMN finance_by INT NULL AFTER project_manager_at' },
      { name: 'finance_by_name', ddl: 'ADD COLUMN finance_by_name VARCHAR(255) NULL AFTER finance_by' },
      { name: 'finance_at', ddl: 'ADD COLUMN finance_at TIMESTAMP NULL AFTER finance_by_name' },
      { name: 'director_by', ddl: 'ADD COLUMN director_by INT NULL AFTER finance_at' },
      { name: 'director_by_name', ddl: 'ADD COLUMN director_by_name VARCHAR(255) NULL AFTER director_by' },
      { name: 'director_at', ddl: 'ADD COLUMN director_at TIMESTAMP NULL AFTER director_by_name' },
      { name: 'rejection_reason', ddl: 'ADD COLUMN rejection_reason TEXT NULL AFTER director_at' },
      { name: 'rejected_by', ddl: 'ADD COLUMN rejected_by INT NULL AFTER rejection_reason' },
      { name: 'rejected_by_name', ddl: 'ADD COLUMN rejected_by_name VARCHAR(255) NULL AFTER rejected_by' },
      { name: 'rejected_at', ddl: 'ADD COLUMN rejected_at TIMESTAMP NULL AFTER rejected_by_name' },
    ];

    for (const column of columns) {
      const [rows] = await pool.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'contracts'
           AND COLUMN_NAME = ?`,
        [column.name]
      );

      if (rows.length === 0) {
        await pool.execute(`ALTER TABLE contracts ${column.ddl}`);
        console.log(`Added contracts.${column.name}`);
      }
    }

    this.approvalFieldsReady = true;
  }

  static async ensureLinkFields() {
    if (this.linkFieldsReady) return;

    const columns = [
      { name: 'opportunity_id', ddl: 'ADD COLUMN opportunity_id INT NULL AFTER project_id' },
      { name: 'proposal_id', ddl: 'ADD COLUMN proposal_id INT NULL AFTER opportunity_id' },
      { name: 'contract_document', ddl: 'ADD COLUMN contract_document LONGTEXT NULL' },
      { name: 'contract_document_name', ddl: 'ADD COLUMN contract_document_name VARCHAR(255) NULL' },
      { name: 'supporting_document', ddl: 'ADD COLUMN supporting_document LONGTEXT NULL' },
      { name: 'supporting_document_name', ddl: 'ADD COLUMN supporting_document_name VARCHAR(255) NULL' },
      { name: 'technical_attachment', ddl: 'ADD COLUMN technical_attachment LONGTEXT NULL' },
      { name: 'technical_attachment_name', ddl: 'ADD COLUMN technical_attachment_name VARCHAR(255) NULL' },
      { name: 'financial_attachment', ddl: 'ADD COLUMN financial_attachment LONGTEXT NULL' },
      { name: 'financial_attachment_name', ddl: 'ADD COLUMN financial_attachment_name VARCHAR(255) NULL' },
      { name: 'implementation_id', ddl: 'ADD COLUMN implementation_id INT NULL AFTER proposal_id' },
    ];

    for (const column of columns) {
      const [rows] = await pool.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'contracts'
           AND COLUMN_NAME = ?`,
        [column.name]
      );

      if (rows.length === 0) {
        await pool.execute(`ALTER TABLE contracts ${column.ddl}`);
        console.log(`Added contracts.${column.name}`);
      }
    }

    this.linkFieldsReady = true;
  }

  static formatContract(row, options = {}) {
    if (!row) return null;
    const { excludeDocuments = false } = options;

    return {
      id: row.id,
      contractId: row.contract_id,
      projectId: row.project_id,
      opportunityId: row.opportunity_id,
      proposalId: row.proposal_id,
      implementationId: row.implementation_id || null,
      clientName: row.client_name,
      title: row.title,
      totalValue: Number(row.total_value ?? 0),
      currency: row.currency || 'USD',
      startDate: row.start_date
        ? (row.start_date instanceof Date
            ? row.start_date.toISOString().split('T')[0]
            : String(row.start_date).split('T')[0])
        : null,
      endDate: row.end_date
        ? (row.end_date instanceof Date
            ? row.end_date.toISOString().split('T')[0]
            : String(row.end_date).split('T')[0])
        : null,
      paymentTerms: row.payment_terms,
      status: row.status,
      renewalStatus: row.renewal_status,
      contractDocument: excludeDocuments ? null : row.contract_document || null,
      contractDocumentName: row.contract_document_name || null,
      supportingDocument: excludeDocuments ? null : row.supporting_document || null,
      supportingDocumentName: row.supporting_document_name || null,
      technicalAttachment: excludeDocuments ? null : row.technical_attachment || null,
      technicalAttachmentName: row.technical_attachment_name || null,
      financialAttachment: excludeDocuments ? null : row.financial_attachment || null,
      financialAttachmentName: row.financial_attachment_name || null,
      hasContractDocument: Boolean(row.contract_document),
      hasSupportingDocument: Boolean(row.supporting_document),
      hasTechnicalAttachment: Boolean(row.technical_attachment),
      hasFinancialAttachment: Boolean(row.financial_attachment),
      approvalStatus: row.approval_status || 'draft',
      currentApprovalStep: row.current_approval_step || 'none',
      projectManagerStatus: row.project_manager_status || 'draft',
      financeStatus: row.finance_status || 'draft',
      directorStatus: row.director_status || 'draft',
      submittedBy: row.submitted_by,
      submittedByName: row.submitted_by_name,
      submittedAt: row.submitted_at,
      projectManagerBy: row.project_manager_by,
      projectManagerByName: row.project_manager_by_name,
      projectManagerAt: row.project_manager_at,
      financeBy: row.finance_by,
      financeByName: row.finance_by_name,
      financeAt: row.finance_at,
      directorBy: row.director_by,
      directorByName: row.director_by_name,
      directorAt: row.director_at,
      rejectionReason: row.rejection_reason,
      rejectedBy: row.rejected_by,
      rejectedByName: row.rejected_by_name,
      rejectedAt: row.rejected_at,
      projectName: row.project_name || null,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
    await this.ensureLinkFields();
    await this.ensurePaymentTermsColumn();
    const contractId = await Contract.generateContractId();
    const {
      projectId,
      opportunityId,
      proposalId,
      clientName,
      title,
      totalValue,
      currency = 'USD',
      startDate,
      endDate,
      paymentTerms,
      status = 'draft',
      renewalStatus = 'none',
      contractDocument,
      contractDocumentName,
      supportingDocument,
      supportingDocumentName,
      technicalAttachment,
      technicalAttachmentName,
      financialAttachment,
      financialAttachmentName,
      createdBy,
      createdByName,
    } = data;

    const query = `
      INSERT INTO contracts (
        contract_id, project_id, opportunity_id, proposal_id,
        client_name, title, total_value, currency,
        start_date, end_date, payment_terms, status, renewal_status,
        contract_document, contract_document_name,
        supporting_document, supporting_document_name,
        technical_attachment, technical_attachment_name,
        financial_attachment, financial_attachment_name,
        created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      contractId,
      projectId || null,
      opportunityId || null,
      proposalId || null,
      clientName,
      title,
      totalValue || 0,
      currency,
      startDate,
      endDate,
      paymentTerms || null,
      status,
      renewalStatus,
      contractDocument || null,
      contractDocumentName || null,
      supportingDocument || null,
      supportingDocumentName || null,
      technicalAttachment || null,
      technicalAttachmentName || null,
      financialAttachment || null,
      financialAttachmentName || null,
      createdBy || null,
      createdByName || null,
    ]);

    return Contract.findById(result.insertId);
  }

  static async findAll(filters = {}, options = {}) {
    await this.ensureLinkFields();
    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push('c.status = ?');
      params.push(filters.status);
    }

    if (filters.renewalStatus) {
      conditions.push('c.renewal_status = ?');
      params.push(filters.renewalStatus);
    }

    if (filters.projectId) {
      conditions.push('c.project_id = ?');
      params.push(filters.projectId);
    }

    if (filters.opportunityId) {
      conditions.push('c.opportunity_id = ?');
      params.push(filters.opportunityId);
    }

    if (filters.approvalStatus) {
      conditions.push('c.approval_status = ?');
      params.push(filters.approvalStatus);
    }

    if (filters.currentApprovalStep) {
      conditions.push('c.current_approval_step = ?');
      params.push(filters.currentApprovalStep);
    }

    if (filters.expiringBefore) {
      conditions.push('c.end_date <= ?');
      params.push(filters.expiringBefore);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT
        c.id, c.contract_id, c.project_id, c.opportunity_id, c.proposal_id,
        c.client_name, c.title, c.total_value, c.currency,
        c.start_date, c.end_date, c.payment_terms, c.status, c.renewal_status,
        c.approval_status, c.current_approval_step,
        c.project_manager_status, c.finance_status, c.director_status,
        c.submitted_by, c.submitted_by_name, c.submitted_at,
        c.project_manager_by, c.project_manager_by_name, c.project_manager_at,
        c.finance_by, c.finance_by_name, c.finance_at,
        c.director_by, c.director_by_name, c.director_at,
        c.rejection_reason, c.rejected_by, c.rejected_by_name, c.rejected_at,
        c.contract_document IS NOT NULL AS has_contract_document,
        c.supporting_document IS NOT NULL AS has_supporting_document,
        c.technical_attachment IS NOT NULL AS has_technical_attachment,
        c.financial_attachment IS NOT NULL AS has_financial_attachment,
        c.contract_document_name, c.supporting_document_name,
        c.technical_attachment_name, c.financial_attachment_name,
        c.created_by, c.created_by_name, c.created_at, c.updated_at,
        p.name AS project_name
      FROM contracts c
      LEFT JOIN projects p ON p.id = c.project_id
      ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT 1000
    `;

    const [rows] = await pool.execute(query, params);
    return rows.map((row) =>
      Contract.formatContract(
        {
          ...row,
          contract_document: row.has_contract_document ? '1' : null,
          supporting_document: row.has_supporting_document ? '1' : null,
          technical_attachment: row.has_technical_attachment ? '1' : null,
          financial_attachment: row.has_financial_attachment ? '1' : null,
        },
        { excludeDocuments: true }
      )
    );
  }

  static async findById(id, options = {}) {
    await this.ensureApprovalFields();
    const { excludeDocuments = false } = options;
    const [rows] = await pool.execute(
      `SELECT c.*, p.name AS project_name
       FROM contracts c
       LEFT JOIN projects p ON p.id = c.project_id
       WHERE c.id = ? OR c.contract_id = ?
       LIMIT 1`,
      [id, id]
    );
    return Contract.formatContract(rows[0] || null, { excludeDocuments });
  }

  static async findByOpportunityId(opportunityId, options = {}) {
    await this.ensureLinkFields();
    const [rows] = await pool.execute(
      'SELECT * FROM contracts WHERE opportunity_id = ? ORDER BY id DESC LIMIT 1',
      [opportunityId]
    );
    return Contract.formatContract(rows[0] || null, options);
  }

  static parseProposalBudget(proposal, opportunity) {
    let budget = opportunity.value || 0;
    let currency = opportunity.bidCurrency || opportunity.bid_currency || 'USD';

    try {
      const financial = proposal.financialProposal ? JSON.parse(proposal.financialProposal) : null;
      if (financial?.totalAmount) budget = financial.totalAmount;
      if (financial?.currency) currency = financial.currency;
    } catch {
      // keep opportunity defaults
    }

    return { budget, currency };
  }

  static async createFromWonProposal({
    opportunity,
    proposal,
    projectId = null,
    createdBy = null,
    createdByName = null,
  }) {
    await this.ensureLinkFields();

    const existing = await Contract.findByOpportunityId(opportunity.dbId);
    if (existing) {
      const updates = {};
      if (projectId && !existing.projectId) updates.projectId = projectId;
      if (proposal?.technicalAttachment && !existing.hasTechnicalAttachment) {
        updates.technicalAttachment = proposal.technicalAttachment;
        updates.technicalAttachmentName = proposal.technicalAttachmentName;
      }
      if (proposal?.financialAttachment && !existing.hasFinancialAttachment) {
        updates.financialAttachment = proposal.financialAttachment;
        updates.financialAttachmentName = proposal.financialAttachmentName;
      }
      if (Object.keys(updates).length > 0) {
        return Contract.update(existing.id, updates);
      }
      return existing;
    }

    const { budget, currency } = Contract.parseProposalBudget(proposal, opportunity);

    return Contract.create({
      projectId,
      opportunityId: opportunity.dbId,
      proposalId: proposal.id || null,
      clientName: opportunity.client,
      title: opportunity.name,
      totalValue: budget,
      currency,
      startDate: proposal.implementationStartDate,
      endDate: proposal.implementationDueDate,
      paymentTerms: null,
      status: 'draft',
      renewalStatus: 'none',
      technicalAttachment: proposal.technicalAttachment || null,
      technicalAttachmentName: proposal.technicalAttachmentName || null,
      financialAttachment: proposal.financialAttachment || null,
      financialAttachmentName: proposal.financialAttachmentName || null,
      createdBy,
      createdByName,
    });
  }

  static async update(id, data) {
    await this.ensureLinkFields();
    await this.ensurePaymentTermsColumn();
    const fields = [];
    const params = [];

    const fieldMap = {
      title: 'title',
      clientName: 'client_name',
      totalValue: 'total_value',
      currency: 'currency',
      startDate: 'start_date',
      endDate: 'end_date',
      paymentTerms: 'payment_terms',
      status: 'status',
      renewalStatus: 'renewal_status',
      projectId: 'project_id',
      opportunityId: 'opportunity_id',
      proposalId: 'proposal_id',
      implementationId: 'implementation_id',
      approvalStatus: 'approval_status',
      currentApprovalStep: 'current_approval_step',
      projectManagerStatus: 'project_manager_status',
      financeStatus: 'finance_status',
      directorStatus: 'director_status',
      submittedBy: 'submitted_by',
      submittedByName: 'submitted_by_name',
      submittedAt: 'submitted_at',
      projectManagerBy: 'project_manager_by',
      projectManagerByName: 'project_manager_by_name',
      projectManagerAt: 'project_manager_at',
      financeBy: 'finance_by',
      financeByName: 'finance_by_name',
      financeAt: 'finance_at',
      directorBy: 'director_by',
      directorByName: 'director_by_name',
      directorAt: 'director_at',
      rejectionReason: 'rejection_reason',
      rejectedBy: 'rejected_by',
      rejectedByName: 'rejected_by_name',
      rejectedAt: 'rejected_at',
      contractDocument: 'contract_document',
      contractDocumentName: 'contract_document_name',
      supportingDocument: 'supporting_document',
      supportingDocumentName: 'supporting_document_name',
      technicalAttachment: 'technical_attachment',
      technicalAttachmentName: 'technical_attachment_name',
      financialAttachment: 'financial_attachment',
      financialAttachmentName: 'financial_attachment_name',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = ?`);
        params.push(data[key]);
      }
    }

    if (!fields.length) return Contract.findById(id);

    params.push(id, id);
    const query = `
      UPDATE contracts
      SET ${fields.join(', ')}
      WHERE id = ? OR contract_id = ?
    `;

    await pool.execute(query, params);
    return Contract.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM contracts WHERE id = ? OR contract_id = ?', [id, id]);
    return true;
  }

  static async submitForApproval(id, { staffId, staffName }) {
    await this.ensureApprovalFields();
    const contract = await this.findById(id);
    if (!contract) return null;

    if (!contract.projectId && !contract.opportunityId) {
      throw new Error('Link this contract to a project before submitting for approval');
    }

    if (!contract.title || !contract.clientName || !contract.startDate || !contract.endDate) {
      throw new Error('Complete contract details before submitting for approval');
    }

    await this.update(id, {
      approvalStatus: 'in_review',
      currentApprovalStep: 'project_manager',
      projectManagerStatus: 'submitted',
      financeStatus: 'draft',
      directorStatus: 'draft',
      submittedBy: staffId,
      submittedByName: staffName,
      submittedAt: new Date(),
      rejectionReason: null,
      rejectedBy: null,
      rejectedByName: null,
      rejectedAt: null,
      status: 'draft',
    });

    return this.findById(id);
  }

  static async approveStep(id, step, { staffId, staffName }) {
    await this.ensureApprovalFields();
    const contract = await this.findById(id);
    if (!contract) return null;

    const camelUpdates = {};

    if (step === 'project_manager') {
      camelUpdates.projectManagerStatus = 'approved';
      camelUpdates.projectManagerBy = staffId;
      camelUpdates.projectManagerByName = staffName;
      camelUpdates.projectManagerAt = new Date();
      camelUpdates.financeStatus = 'submitted';
      camelUpdates.currentApprovalStep = 'finance';
    } else if (step === 'finance') {
      camelUpdates.financeStatus = 'approved';
      camelUpdates.financeBy = staffId;
      camelUpdates.financeByName = staffName;
      camelUpdates.financeAt = new Date();
      camelUpdates.directorStatus = 'submitted';
      camelUpdates.currentApprovalStep = 'director';
    } else if (step === 'director') {
      camelUpdates.directorStatus = 'approved';
      camelUpdates.directorBy = staffId;
      camelUpdates.directorByName = staffName;
      camelUpdates.directorAt = new Date();
      camelUpdates.currentApprovalStep = 'completed';
      camelUpdates.approvalStatus = 'approved';
      camelUpdates.status = 'active';
    } else {
      throw new Error('Invalid approval step');
    }

    await this.update(id, camelUpdates);

    if (step === 'director') {
      const approvedContract = await this.findById(id);
      try {
        await ensureImplementationForApprovedContract(approvedContract, {
          staffId,
        });
      } catch (implError) {
        console.error('Error starting implementation from approved contract:', implError);
        throw new Error(
          implError.message || 'Contract approved but failed to start project implementation'
        );
      }
    }

    return this.findById(id);
  }

  static async rejectStep(id, step, { staffId, staffName, reason }) {
    await this.ensureApprovalFields();
    const laneKey =
      step === 'project_manager'
        ? 'projectManagerStatus'
        : step === 'finance'
          ? 'financeStatus'
          : 'directorStatus';

    await this.update(id, {
      [laneKey]: 'rejected',
      approvalStatus: 'rejected',
      currentApprovalStep: 'none',
      status: 'draft',
      rejectionReason: reason || 'Rejected',
      rejectedBy: staffId,
      rejectedByName: staffName,
      rejectedAt: new Date(),
    });

    return this.findById(id);
  }

  static async findPendingForStep(step, filters = {}) {
    await this.ensureApprovalFields();
    return this.findAll({
      ...filters,
      approvalStatus: 'in_review',
      currentApprovalStep: step,
    });
  }
}

export default Contract;
