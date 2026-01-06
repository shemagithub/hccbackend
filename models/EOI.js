import pool from '../config/db.js';

class EOI {
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
        assigned_to VARCHAR(255) NULL,
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
    const id = eoiId || await this.generateEOIId();
    
    // Convert requirements array to JSON string if array, otherwise store as is
    const requirementsStr = Array.isArray(requirements) 
      ? JSON.stringify(requirements) 
      : requirements || null;
    
    const [result] = await pool.execute(
      `INSERT INTO eois (
        eoi_id, title, organization, submission_date, deadline, status, 
        value, assigned_to, description, requirements
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, title, organization, submissionDate, deadline, status,
        value, assignedTo || null, description, requirementsStr
      ]
    );

    return this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT * FROM eois WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (title LIKE ? OR organization LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
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
    return rows.map(row => this.mapRowToEOI(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM eois WHERE id = ?',
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRowToEOI(rows[0]);
  }

  static async findByEOIId(eoiId) {
    const [rows] = await pool.execute(
      'SELECT * FROM eois WHERE eoi_id = ?',
      [eoiId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToEOI(rows[0]);
  }

  static async update(id, updateData) {
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
    if (updateData.value !== undefined) {
      fields.push('value = ?');
      values.push(updateData.value);
    }
    if (updateData.assignedTo !== undefined) {
      fields.push('assigned_to = ?');
      values.push(updateData.assignedTo);
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

  static mapRowToEOI(row) {
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
      title: row.title,
      organization: row.organization,
      submissionDate: row.submission_date ? row.submission_date.toISOString().split('T')[0] : null,
      deadline: row.deadline ? row.deadline.toISOString().split('T')[0] : null,
      status: row.status,
      value: parseFloat(row.value) || 0,
      assignedTo: row.assigned_to,
      description: row.description,
      requirements,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default EOI;

