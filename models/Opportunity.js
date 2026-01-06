import pool from '../config/db.js';

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
        urgency ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        supporting_document LONGTEXT NULL,
        comment TEXT NULL,
        year VARCHAR(4) NOT NULL,
        status ENUM('open', 'qualified', 'proposal', 'won', 'lost') DEFAULT 'open',
        decision ENUM('pending', 'approved', 'rejected', 'under_review', 'cancelled') DEFAULT 'pending',
        value DECIMAL(15,2) NOT NULL DEFAULT 0,
        expected_close_date DATE NULL,
        assigned_to VARCHAR(255) NULL,
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
    urgency = 'medium',
    supportingDocument,
    comment,
    year,
    status = 'open',
    decision = 'pending',
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
          (urgency && String(urgency).trim()) || 'medium',
          (supportingDocument && String(supportingDocument).trim()) || null, 
          (comment && String(comment).trim()) || null, 
          yr, 
          (status && String(status).trim()) || 'open', 
          (decision && String(decision).trim()) || 'pending', 
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

  static async findAll(filters = {}) {
    let query = `SELECT * FROM opportunities WHERE 1=1`;
    const params = [];

    // Filter by assigned user email (if provided)
    // assigned_to is a comma-separated string of emails
    if (filters.userEmail) {
      query += ` AND (
        assigned_to LIKE ? OR
        assigned_to LIKE ? OR
        assigned_to LIKE ? OR
        assigned_to = ?
      )`;
      // Match email at start, middle, or end of comma-separated list
      const emailPattern1 = `${filters.userEmail},%`; // Email at start
      const emailPattern2 = `%,${filters.userEmail},%`; // Email in middle
      const emailPattern3 = `%,${filters.userEmail}`; // Email at end
      const exactMatch = filters.userEmail; // Exact match (single email)
      params.push(emailPattern1, emailPattern2, emailPattern3, exactMatch);
    }

    if (filters.search) {
      query += ` AND (
        name LIKE ? OR
        client LIKE ? OR
        department LIKE ? OR
        country LIKE ? OR
        opportunity_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.department) {
      query += ` AND department = ?`;
      params.push(filters.department);
    }

    if (filters.year) {
      query += ` AND year = ?`;
      params.push(filters.year);
    }

    if (filters.urgency) {
      query += ` AND urgency = ?`;
      params.push(filters.urgency);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToOpportunity(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM opportunities WHERE id = ?', [id]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToOpportunity(rows[0]);
  }

  static async findByOpportunityId(opportunityId) {
    const [rows] = await pool.execute('SELECT * FROM opportunities WHERE opportunity_id = ?', [opportunityId]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToOpportunity(rows[0]);
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
    const [result] = await pool.execute(
      `UPDATE opportunities SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM opportunities WHERE id = ?', [id]);
    return result.affectedRows > 0;
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

  static mapRowToOpportunity(row) {
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
      winProbabilityDocument: row.win_probability_document,
      bidCurrency: row.bid_currency,
      fundAgency: row.fund_agency,
      urgency: row.urgency,
      supportingDocument: row.supporting_document,
      comment: row.comment,
      year: row.year,
      status: row.status,
      decision: row.decision,
      value: parseFloat(row.value),
      expectedCloseDate: row.expected_close_date ? row.expected_close_date.toISOString().split('T')[0] : null,
      assignedTo: row.assigned_to,
      createdDate: row.created_at ? row.created_at.toISOString().split('T')[0] : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Opportunity;

