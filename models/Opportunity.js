import pool from '../config/db.js';
import {
  DEFAULT_OPPORTUNITY_DECISION,
  DEFAULT_OPPORTUNITY_URGENCY,
} from '../constants/opportunityOptions.js';

class Opportunity {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS opportunities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        opportunity_id VARCHAR(50) NOT NULL UNIQUE,
        department VARCHAR(255) NOT NULL,
        country VARCHAR(255) NOT NULL,
        name VARCHAR(500) NOT NULL,
        legal_entity VARCHAR(255) NOT NULL,
        client VARCHAR(255) NOT NULL,
        contact VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        feedback_deadline DATE NULL,
        operation_date DATE NULL,
        win_probability INT DEFAULT 0,
        win_probability_document LONGTEXT NULL,
        bid_currency VARCHAR(10) NOT NULL,
        fund_agency VARCHAR(255) NULL,
        urgency ENUM('not_urgent', 'urgent', 'very_urgent', 'past_due') DEFAULT 'not_urgent',
        supporting_document LONGTEXT NULL,
        comment TEXT NULL,
        year VARCHAR(4) NOT NULL,
        status ENUM('open', 'qualified', 'proposal', 'won', 'lost') DEFAULT 'open',
        decision ENUM('submitted', 'under_preparation', 'internal_review', 'overdue', 'failed') DEFAULT 'submitted',
        value DECIMAL(15,2) NOT NULL DEFAULT 0,
        expected_close_date DATE NULL,
        assigned_to TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_urgency (urgency),
        INDEX idx_department (department),
        INDEX idx_year (year),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Opportunities table created or already exists.');
  }

  static async generateOpportunityId() {
    try {
      const year = new Date().getFullYear();
      const yearPrefix = `OPP-${year}-`;
      
      // Get the maximum sequence number for current year
      const [rows] = await pool.execute(
        `SELECT opportunity_id FROM opportunities 
         WHERE opportunity_id LIKE ?
         ORDER BY opportunity_id DESC LIMIT 1`,
        [`${yearPrefix}%`]
      );
      
      let sequence = 1;
      if (rows.length > 0 && rows[0].opportunity_id) {
        // Extract sequence number from existing ID (format: OPP-YYYY-XXX)
        const lastId = String(rows[0].opportunity_id);
        const parts = lastId.split('-');
        if (parts.length >= 3) {
          const lastSequence = parseInt(parts[2]);
          if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
          }
        }
      }
      
      // Ensure sequence doesn't exceed 999
      if (sequence > 999) {
        sequence = 1;
      }
      
      const sequenceStr = String(sequence).padStart(3, '0');
      const oppId = `${yearPrefix}${sequenceStr}`;
      
      // Double-check if this ID exists (race condition protection)
      const existing = await this.findByOpportunityId(oppId);
      if (existing) {
        // If exists, increment and try again
        sequence++;
        const newSequenceStr = String(sequence).padStart(3, '0');
        return `${yearPrefix}${newSequenceStr}`;
      }
      
      return oppId;
    } catch (error) {
      console.error('Error generating opportunity ID:', error);
      // Fallback to timestamp-based ID
      const timestamp = Date.now();
      return `OPP-${timestamp}`;
    }
  }

  static async create({
    opportunityId,
    department,
    country,
    name,
    legalEntity,
    client,
    contact,
    description,
    feedbackDeadline,
    operationDate,
    winProbability = 0,
    winProbabilityDocument,
    bidCurrency,
    fundAgency,
    urgency = DEFAULT_OPPORTUNITY_URGENCY,
    supportingDocument,
    comment,
    year,
    status = 'open',
    decision = DEFAULT_OPPORTUNITY_DECISION,
    value = 0,
    expectedCloseDate,
    assignedTo
  }) {
    try {
      // Generate opportunity ID if not provided
      const oppId = opportunityId || await this.generateOpportunityId();

      // Validate and clean required fields (check for empty strings too)
      const dept = (department && String(department).trim()) || '';
      const cntry = (country && String(country).trim()) || '';
      const nme = (name && String(name).trim()) || '';
      const legal = (legalEntity && String(legalEntity).trim()) || '';
      const clnt = (client && String(client).trim()) || '';
      const cntct = (contact && String(contact).trim()) || '';
      const desc = (description && String(description).trim()) || '';
      const bid = (bidCurrency && String(bidCurrency).trim()) || '';
      const yr = (year && String(year).trim()) || '';

      if (!dept || !cntry || !nme || !legal || !clnt || !cntct || !desc || !bid || !yr) {
        throw new Error('Missing required fields: department, country, name, legalEntity, client, contact, description, bidCurrency, and year are required');
      }

      console.log('Creating opportunity with ID:', oppId);
      console.log('Data validation passed');

      // Get a connection - GLOBAL max_allowed_packet should be set to 300MB
      // SESSION max_allowed_packet is read-only, so we rely on GLOBAL setting
      const connection = await pool.getConnection();
      try {
        // Verify max_allowed_packet is sufficient (should be 300MB from GLOBAL setting)
        // Note: SESSION max_allowed_packet is read-only, so we can't set it here
        // The GLOBAL setting (300MB) should be used by default for new connections

        const [result] = await connection.execute(
        `INSERT INTO opportunities (
          opportunity_id, department, country, name, legal_entity, client, contact,
          description, feedback_deadline, operation_date, win_probability,
          win_probability_document, bid_currency, fund_agency, urgency,
          supporting_document, comment, year, status, decision, value,
          expected_close_date, assigned_to
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          oppId, 
          dept, 
          cntry, 
          nme, 
          legal, 
          clnt, 
          cntct,
          desc, 
          (feedbackDeadline && String(feedbackDeadline).trim()) || null, 
          (operationDate && String(operationDate).trim()) || null, 
          parseInt(String(winProbability)) || 0,
          (winProbabilityDocument && String(winProbabilityDocument).trim()) || null, 
          bid, 
          (fundAgency && String(fundAgency).trim()) || null, 
          (urgency && String(urgency).trim()) || DEFAULT_OPPORTUNITY_URGENCY,
          (supportingDocument && String(supportingDocument).trim()) || null, 
          (comment && String(comment).trim()) || null, 
          yr, 
          (status && String(status).trim()) || 'open', 
          (decision && String(decision).trim()) || DEFAULT_OPPORTUNITY_DECISION, 
          parseFloat(String(value)) || 0,
          (expectedCloseDate && String(expectedCloseDate).trim()) || null, 
          (assignedTo && String(assignedTo).trim()) || null
        ]
        );

        console.log('Opportunity inserted successfully with ID:', result.insertId);

        const createdOpportunity = await this.findById(result.insertId);
        if (!createdOpportunity) {
          throw new Error('Failed to retrieve created opportunity');
        }
        return createdOpportunity;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in Opportunity.create:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sql: error.sql
      });
      throw error;
    }
  }

  /** List query — excludes LONGTEXT documents to keep responses fast */
  static LIST_SELECT_BASIC = `
    id, opportunity_id, department, country, name, legal_entity, client, contact,
    LEFT(description, 1000) AS description, feedback_deadline, operation_date, win_probability, bid_currency,
    fund_agency, urgency, comment, year, status, decision, value, expected_close_date,
    assigned_to, created_at, updated_at,
    (supporting_document IS NOT NULL) AS has_supporting_document,
    (win_probability_document IS NOT NULL) AS has_win_probability_document
  `;

  static LIST_SELECT = `
    o.id, o.opportunity_id, o.department, o.country, o.name, o.legal_entity, o.client, o.contact,
    LEFT(o.description, 1000) AS description, o.feedback_deadline, o.operation_date, o.win_probability, o.bid_currency,
    o.fund_agency, o.urgency, o.comment, o.year, o.status, o.decision, o.value, o.expected_close_date,
    o.assigned_to, o.created_at, o.updated_at,
    (o.supporting_document IS NOT NULL) AS has_supporting_document,
    (o.win_probability_document IS NOT NULL) AS has_win_probability_document,
    (SELECT e.eoi_id FROM eois e WHERE e.opportunity_id = o.id LIMIT 1) AS linked_eoi_id,
    (SELECT e.id FROM eois e WHERE e.opportunity_id = o.id LIMIT 1) AS linked_eoi_db_id,
    (SELECT e.go_decision FROM eois e WHERE e.opportunity_id = o.id LIMIT 1) AS linked_eoi_go_decision,
    EXISTS(SELECT 1 FROM opportunity_proposals op WHERE op.opportunity_id = o.id) AS has_proposal
  `;

  static isPipelineSchemaError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('opportunity_proposals') ||
      message.includes('opportunity_id') ||
      message.includes("doesn't exist") ||
      message.includes('unknown column') ||
      message.includes('er_no_such_table')
    );
  }

  static async preparePipelineSchema() {
    try {
      const { default: EOI } = await import('./EOI.js');
      const { default: OpportunityProposal } = await import('./OpportunityProposal.js');
      await EOI.ensureOpportunityLink();
      await OpportunityProposal.ensureTable();
      return true;
    } catch (error) {
      console.warn('Could not prepare opportunity pipeline schema:', error.message);
      return false;
    }
  }

  static async findAll(filters = {}) {
    await this.preparePipelineSchema();

    try {
      return await this.findAllWithPipeline(filters);
    } catch (error) {
      if (this.isPipelineSchemaError(error)) {
        console.warn(
          'Pipeline opportunity query failed, using basic list query:',
          error.message
        );
        return await this.findAllBasic(filters);
      }
      throw error;
    }
  }

  static async findAllWithPipeline(filters = {}) {
    let query = `
      SELECT ${this.LIST_SELECT}
      FROM opportunities o
      WHERE 1=1
    `;
    return this.executeListQuery(query, filters, true);
  }

  static async findAllBasic(filters = {}) {
    let query = `SELECT ${this.LIST_SELECT_BASIC} FROM opportunities WHERE 1=1`;
    return this.executeListQuery(query, filters, false);
  }

  static async executeListQuery(query, filters = {}, useAlias = true) {
    const prefix = useAlias ? 'o.' : '';
    const params = [];

    if (filters.pipelineStage === 'active') {
      query += ` AND ${prefix}status IN ('open', 'qualified')`;
    } else if (filters.pipelineStage === 'proposals') {
      query += ` AND (
        EXISTS (
          SELECT 1 FROM opportunity_proposals op
          WHERE op.opportunity_id = ${prefix}id
          AND (op.implementation_id IS NULL OR op.implementation_id = 0)
        )
        OR EXISTS (
          SELECT 1 FROM eois e
          WHERE e.opportunity_id = ${prefix}id
          AND e.go_decision = 'go'
        )
      )`;
    }

    if (filters.userEmail) {
      query += ` AND (
        ${prefix}assigned_to LIKE ? OR
        ${prefix}assigned_to LIKE ? OR
        ${prefix}assigned_to LIKE ? OR
        ${prefix}assigned_to = ?
      )`;
      const emailPattern1 = `${filters.userEmail},%`;
      const emailPattern2 = `%,${filters.userEmail},%`;
      const emailPattern3 = `%,${filters.userEmail}`;
      const exactMatch = filters.userEmail;
      params.push(emailPattern1, emailPattern2, emailPattern3, exactMatch);
    }

    if (filters.search) {
      query += ` AND (
        ${prefix}name LIKE ? OR
        ${prefix}client LIKE ? OR
        ${prefix}department LIKE ? OR
        ${prefix}country LIKE ? OR
        ${prefix}opportunity_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND ${prefix}status = ?`;
      params.push(filters.status);
    }

    if (filters.department) {
      query += ` AND ${prefix}department = ?`;
      params.push(filters.department);
    }

    if (filters.year) {
      query += ` AND ${prefix}year = ?`;
      params.push(filters.year);
    }

    if (filters.urgency) {
      query += ` AND ${prefix}urgency = ?`;
      params.push(filters.urgency);
    }

    if (filters.decision && filters.decision !== 'all') {
      query += ` AND ${prefix}decision = ?`;
      params.push(filters.decision);
    }

    query += ` ORDER BY ${prefix}created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map((row) => this.mapRowToOpportunity(row, { forList: true }));
  }

  static async findById(id, options = {}) {
    const { excludeDocuments = false } = options;
    const query = excludeDocuments
      ? `SELECT
          id,
          opportunity_id,
          department,
          country,
          name,
          legal_entity,
          client,
          contact,
          description,
          feedback_deadline,
          operation_date,
          win_probability,
          (win_probability_document IS NOT NULL AND LENGTH(win_probability_document) > 0) AS has_win_probability_document,
          bid_currency,
          fund_agency,
          urgency,
          (supporting_document IS NOT NULL AND LENGTH(supporting_document) > 0) AS has_supporting_document,
          comment,
          year,
          status,
          decision,
          value,
          expected_close_date,
          assigned_to,
          created_at,
          updated_at
        FROM opportunities
        WHERE id = ?`
      : 'SELECT * FROM opportunities WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToOpportunity(rows[0], { forList: excludeDocuments });
  }

  static async findByOpportunityId(opportunityId, options = {}) {
    const { excludeDocuments = false } = options;
    const query = excludeDocuments
      ? `SELECT
          id,
          opportunity_id,
          department,
          country,
          name,
          legal_entity,
          client,
          contact,
          description,
          feedback_deadline,
          operation_date,
          win_probability,
          (win_probability_document IS NOT NULL AND LENGTH(win_probability_document) > 0) AS has_win_probability_document,
          bid_currency,
          fund_agency,
          urgency,
          (supporting_document IS NOT NULL AND LENGTH(supporting_document) > 0) AS has_supporting_document,
          comment,
          year,
          status,
          decision,
          value,
          expected_close_date,
          assigned_to,
          created_at,
          updated_at
        FROM opportunities
        WHERE opportunity_id = ?`
      : 'SELECT * FROM opportunities WHERE opportunity_id = ?';
    const [rows] = await pool.execute(query, [opportunityId]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToOpportunity(rows[0], { forList: excludeDocuments });
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      department: 'department',
      country: 'country',
      name: 'name',
      legalEntity: 'legal_entity',
      client: 'client',
      contact: 'contact',
      description: 'description',
      feedbackDeadline: 'feedback_deadline',
      operationDate: 'operation_date',
      winProbability: 'win_probability',
      winProbabilityDocument: 'win_probability_document',
      bidCurrency: 'bid_currency',
      fundAgency: 'fund_agency',
      urgency: 'urgency',
      supportingDocument: 'supporting_document',
      comment: 'comment',
      year: 'year',
      status: 'status',
      decision: 'decision',
      value: 'value',
      expectedCloseDate: 'expected_close_date',
      assignedTo: 'assigned_to'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    if (updateFields.length === 0) return false;

    params.push(id);

    const hasLargeDocumentFields = ['winProbabilityDocument', 'supportingDocument'].some(
      (field) => updateData[field] !== undefined
    );

    if (!hasLargeDocumentFields) {
      const [result] = await pool.execute(
        `UPDATE opportunities SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
      return result.affectedRows > 0;
    }
    
    // Use getConnection pattern for better error handling with retry logic
    let connection = null;
    let retryConnection = null;
    try {
      connection = await pool.getConnection();
      // Set max_allowed_packet for this connection (300MB = 314572800 bytes)
      try {
        await connection.execute("SET SESSION max_allowed_packet = 314572800");
        // Verify it was set correctly
        const [result] = await connection.execute("SHOW VARIABLES LIKE 'max_allowed_packet'");
        if (result.length > 0) {
          const currentValue = parseInt(result[0].Value);
          console.log(`📦 max_allowed_packet set to: ${(currentValue / 1024 / 1024).toFixed(2)}MB`);
        }
      } catch (setPacketError) {
        console.warn('⚠️ Could not set SESSION max_allowed_packet:', setPacketError.message);
        // Try to set GLOBAL instead (requires SUPER privilege)
        try {
          await connection.execute("SET GLOBAL max_allowed_packet = 314572800");
        } catch (globalError) {
          console.warn('⚠️ Could not set GLOBAL max_allowed_packet:', globalError.message);
        }
      }
      
      const [result] = await connection.execute(
        `UPDATE opportunities SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
      connection.release();
      connection = null;
      return result.affectedRows > 0;
    } catch (error) {
      // Release first connection if it exists
      if (connection) {
        try {
          connection.release();
          connection = null;
        } catch (releaseError) {
          console.error('Error releasing initial connection:', releaseError);
        }
      }
      
      // If connection error or packet too large, try once more with a new connection
      const errorMessage = error.message || '';
      const shouldRetry = error.code === 'ECONNRESET' || 
                         error.code === 'PROTOCOL_CONNECTION_LOST' || 
                         error.code === 'PROTOCOL_ENQUEUE_AFTER_QUIT' || 
                         error.code === 'ER_NET_PACKET_TOO_LARGE' ||
                         errorMessage.includes('closed state') ||
                         errorMessage.includes('connection') ||
                         errorMessage.includes('Connection');
      
      if (shouldRetry) {
        try {
          // Wait a bit before retry to allow connection pool to recover
          await new Promise(resolve => setTimeout(resolve, 100));
          
          retryConnection = await pool.getConnection();
          
          // Verify connection is alive before using it
          try {
            await retryConnection.ping();
          } catch (pingError) {
            retryConnection.release();
            retryConnection = null;
            throw new Error('Connection ping failed during retry');
          }
          
          // Set max_allowed_packet for retry connection (300MB = 314572800 bytes)
          try {
            await retryConnection.execute("SET SESSION max_allowed_packet = 314572800");
            // Verify it was set correctly
            const [result] = await retryConnection.execute("SHOW VARIABLES LIKE 'max_allowed_packet'");
            if (result.length > 0) {
              const currentValue = parseInt(result[0].Value);
              console.log(`📦 Retry connection max_allowed_packet set to: ${(currentValue / 1024 / 1024).toFixed(2)}MB`);
            }
          } catch (setPacketError) {
            console.warn('⚠️ Could not set SESSION max_allowed_packet on retry:', setPacketError.message);
            // Try to set GLOBAL instead (requires SUPER privilege)
            try {
              await retryConnection.execute("SET GLOBAL max_allowed_packet = 314572800");
            } catch (globalError) {
              console.warn('⚠️ Could not set GLOBAL max_allowed_packet on retry:', globalError.message);
            }
          }
          
          const [result] = await retryConnection.execute(
            `UPDATE opportunities SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            params
          );
          
          retryConnection.release();
          retryConnection = null;
          return result.affectedRows > 0;
        } catch (retryError) {
          // Release retry connection if retry also fails
          if (retryConnection) {
            try {
              retryConnection.release();
              retryConnection = null;
            } catch (releaseError) {
              console.error('Error releasing retry connection after failure:', releaseError);
            }
          }
          throw retryError;
        }
      }
      throw error;
    } finally {
      // Ensure all connections are released
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error releasing connection in finally block:', releaseError);
        }
      }
      if (retryConnection) {
        try {
          retryConnection.release();
        } catch (releaseError) {
          console.error('Error releasing retry connection in finally block:', releaseError);
        }
      }
    }
  }

  static async delete(id) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute('DELETE FROM opportunities WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  static async getStats(userEmail = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(value) as totalValue,
        SUM(value * win_probability / 100) as weightedValue,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN status = 'proposal' THEN 1 ELSE 0 END) as proposal,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost
      FROM opportunities
      WHERE 1=1
    `;
    const params = [];

    // Filter by assigned user email (if provided)
    if (userEmail) {
      query += ` AND (
        assigned_to LIKE ? OR
        assigned_to LIKE ? OR
        assigned_to LIKE ? OR
        assigned_to = ?
      )`;
      const emailPattern1 = `${userEmail},%`;
      const emailPattern2 = `%,${userEmail},%`;
      const emailPattern3 = `%,${userEmail}`;
      const exactMatch = userEmail;
      params.push(emailPattern1, emailPattern2, emailPattern3, exactMatch);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToOpportunity(row, options = {}) {
    const { forList = false } = options;
    const hasSupportingDocument = Boolean(row.has_supporting_document);
    const hasWinProbabilityDocument = Boolean(row.has_win_probability_document);

    return {
      id: row.opportunity_id,
      dbId: row.id,
      department: row.department,
      country: row.country,
      name: row.name,
      legalEntity: row.legal_entity,
      client: row.client,
      contact: row.contact,
      description: row.description,
      feedbackDeadline: row.feedback_deadline ? row.feedback_deadline.toISOString().split('T')[0] : null,
      operationDate: row.operation_date ? row.operation_date.toISOString().split('T')[0] : null,
      winProbability: row.win_probability,
      winProbabilityDocument: forList
        ? null
        : row.win_probability_document,
      hasWinProbabilityDocument: forList ? hasWinProbabilityDocument : undefined,
      bidCurrency: row.bid_currency,
      fundAgency: row.fund_agency,
      urgency: row.urgency,
      supportingDocument: forList ? null : row.supporting_document,
      hasSupportingDocument: forList ? hasSupportingDocument : undefined,
      comment: row.comment,
      year: row.year,
      status: row.status,
      decision: row.decision,
      value: parseFloat(row.value),
      expectedCloseDate: row.expected_close_date ? row.expected_close_date.toISOString().split('T')[0] : null,
      assignedTo: row.assigned_to,
      linkedEoiId: row.linked_eoi_id || null,
      linkedEoiDbId: row.linked_eoi_db_id || null,
      linkedEoiGoDecision: row.linked_eoi_go_decision || null,
      hasProposal: Boolean(Number(row.has_proposal || 0)),
      createdDate: row.created_at ? row.created_at.toISOString().split('T')[0] : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Opportunity;

