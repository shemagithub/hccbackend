import pool from '../config/db.js';

class SupportTicket {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        category ENUM('Technical Issue', 'Integration Issue', 'Billing Question', 'Performance Issue', 'Feature Request', 'General Question') NOT NULL,
        status ENUM('open', 'in_progress', 'under_review', 'resolved', 'closed') DEFAULT 'open',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        submitted_by INT NULL,
        submitted_by_name VARCHAR(255) NULL,
        submitted_by_email VARCHAR(255) NULL,
        assigned_to INT NULL,
        assigned_to_name VARCHAR(255) NULL,
        attachments TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_category (category),
        INDEX idx_submitted_by (submitted_by),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (submitted_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Support tickets table created or already exists.');
  }

  static async generateTicketId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM support_tickets WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `TICKET-${sequence}`;
  }

  static async create({
    ticketId,
    title,
    description,
    category,
    priority = 'medium',
    submittedBy,
    submittedByName,
    submittedByEmail,
    assignedTo = null,
    assignedToName = null,
    attachments = null,
    status = 'open'
  }) {
    const tId = ticketId || await this.generateTicketId();

    const [result] = await pool.execute(
      `INSERT INTO support_tickets (
        ticket_id, title, description, category, priority, status,
        submitted_by, submitted_by_name, submitted_by_email,
        assigned_to, assigned_to_name, attachments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tId, title, description, category, priority, status,
        submittedBy || null, submittedByName || null, submittedByEmail || null,
        assignedTo || null, assignedToName || null, attachments ? JSON.stringify(attachments) : null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT t.*, 
             s1.first_name as submitter_first_name, s1.last_name as submitter_last_name, s1.email as submitter_email,
             s2.first_name as assignee_first_name, s2.last_name as assignee_last_name, s2.email as assignee_email
      FROM support_tickets t
      LEFT JOIN staff s1 ON t.submitted_by = s1.id
      LEFT JOIN staff s2 ON t.assigned_to = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (t.title LIKE ? OR t.description LIKE ? OR t.ticket_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.status) {
      query += ` AND t.status = ?`;
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ` AND t.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.category) {
      query += ` AND t.category = ?`;
      params.push(filters.category);
    }

    if (filters.submittedBy) {
      query += ` AND t.submitted_by = ?`;
      params.push(parseInt(filters.submittedBy));
    }

    if (filters.assignedTo) {
      query += ` AND t.assigned_to = ?`;
      params.push(parseInt(filters.assignedTo));
    }

    if (filters.startDate) {
      query += ` AND DATE(t.created_at) >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND DATE(t.created_at) <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY t.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToTicket(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT t.*, 
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name, s1.email as submitter_email,
              s2.first_name as assignee_first_name, s2.last_name as assignee_last_name, s2.email as assignee_email
       FROM support_tickets t
       LEFT JOIN staff s1 ON t.submitted_by = s1.id
       LEFT JOIN staff s2 ON t.assigned_to = s2.id
       WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRowToTicket(rows[0]);
  }

  static async findByTicketId(ticketId) {
    const [rows] = await pool.execute(
      `SELECT t.*, 
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name, s1.email as submitter_email,
              s2.first_name as assignee_first_name, s2.last_name as assignee_last_name, s2.email as assignee_email
       FROM support_tickets t
       LEFT JOIN staff s1 ON t.submitted_by = s1.id
       LEFT JOIN staff s2 ON t.assigned_to = s2.id
       WHERE t.ticket_id = ?`,
      [ticketId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToTicket(rows[0]);
  }

  static async update(id, updates) {
    const allowedFields = [
      'title', 'description', 'category', 'status', 'priority',
      'assigned_to', 'assigned_to_name', 'attachments', 'resolved_at'
    ];
    
    const updateFields = [];
    const params = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        if (key === 'attachments' && Array.isArray(updates[key])) {
          updateFields.push(`${key} = ?`);
          params.push(JSON.stringify(updates[key]));
        } else if (key === 'resolved_at' && updates.status === 'resolved' && !updates.resolved_at) {
          updateFields.push(`resolved_at = NOW()`);
        } else {
          updateFields.push(`${key} = ?`);
          params.push(updates[key]);
        }
      }
    });

    if (updateFields.length === 0) return false;

    params.push(id);
    await pool.execute(
      `UPDATE support_tickets SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    return true;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM support_tickets WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(filters = {}) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
          SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high
        FROM support_tickets
        WHERE 1=1
      `;
      const params = [];

      if (filters.submittedBy) {
        query += ` AND submitted_by = ?`;
        params.push(parseInt(filters.submittedBy));
      }

      if (filters.assignedTo) {
        query += ` AND assigned_to = ?`;
        params.push(parseInt(filters.assignedTo));
      }

      const [rows] = await pool.execute(query, params);
      return {
        total: rows[0].total || 0,
        open: rows[0].open || 0,
        inProgress: rows[0].in_progress || 0,
        resolved: rows[0].resolved || 0,
        closed: rows[0].closed || 0,
        urgent: rows[0].urgent || 0,
        high: rows[0].high || 0
      };
    } catch (error) {
      console.error('Error getting support ticket stats:', error);
      return {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        urgent: 0,
        high: 0
      };
    }
  }

  static mapRowToTicket(row) {
    return {
      id: row.ticket_id,
      dbId: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      priority: row.priority,
      submittedBy: row.submitted_by,
      submittedByName: row.submitted_by_name || (row.submitter_first_name && row.submitter_last_name ? `${row.submitter_first_name} ${row.submitter_last_name}` : null),
      submittedByEmail: row.submitted_by_email || row.submitter_email,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name || (row.assignee_first_name && row.assignee_last_name ? `${row.assignee_first_name} ${row.assignee_last_name}` : null),
      attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at
    };
  }
}

export default SupportTicket;
