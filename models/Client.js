import pool from '../config/db.js';

class Client {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        address TEXT NULL,
        status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
        projects_assigned INT DEFAULT 0,
        last_contact DATE NULL,
        access_level ENUM('no_access', 'limited_access', 'full_access') DEFAULT 'no_access',
        can_view_reports BOOLEAN DEFAULT FALSE,
        can_view_timelines BOOLEAN DEFAULT FALSE,
        can_view_invoices BOOLEAN DEFAULT FALSE,
        can_download_files BOOLEAN DEFAULT FALSE,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_email (email),
        INDEX idx_company (company),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Clients table created or already exists.');
  }

  static async generateClientId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM clients WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(3, '0');
    return `CLT-${year}-${sequence}`;
  }

  static async create({
    clientId,
    name,
    company,
    email,
    phone,
    address,
    status = 'pending',
    projectsAssigned = 0,
    lastContact,
    accessLevel = 'no_access',
    canViewReports = false,
    canViewTimelines = false,
    canViewInvoices = false,
    canDownloadFiles = false,
    notes
  }) {
    const cltId = clientId || await this.generateClientId();

    const [result] = await pool.execute(
      `INSERT INTO clients (
        client_id, name, company, email, phone, address, status,
        projects_assigned, last_contact, access_level,
        can_view_reports, can_view_timelines, can_view_invoices, can_download_files, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cltId, name, company, email, phone || null, address || null, status,
        projectsAssigned, lastContact || null, accessLevel,
        canViewReports, canViewTimelines, canViewInvoices, canDownloadFiles, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `SELECT * FROM clients WHERE 1=1`;
    const params = [];

    if (filters.search) {
      query += ` AND (
        name LIKE ? OR
        company LIKE ? OR
        email LIKE ? OR
        client_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.accessLevel) {
      query += ` AND access_level = ?`;
      params.push(filters.accessLevel);
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
    return rows.map(row => this.mapRowToClient(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM clients WHERE id = ?', [id]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToClient(rows[0]);
  }

  static async findByClientId(clientId) {
    const [rows] = await pool.execute('SELECT * FROM clients WHERE client_id = ?', [clientId]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToClient(rows[0]);
  }

  static async findByEmail(email) {
    const [rows] = await pool.execute('SELECT * FROM clients WHERE email = ?', [email]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToClient(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      name: 'name',
      company: 'company',
      email: 'email',
      phone: 'phone',
      address: 'address',
      status: 'status',
      projectsAssigned: 'projects_assigned',
      lastContact: 'last_contact',
      accessLevel: 'access_level',
      canViewReports: 'can_view_reports',
      canViewTimelines: 'can_view_timelines',
      canViewInvoices: 'can_view_invoices',
      canDownloadFiles: 'can_download_files',
      notes: 'notes'
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
      `UPDATE clients SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM clients WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(projects_assigned) as totalProjects
      FROM clients
    `);
    return rows[0];
  }

  static mapRowToClient(row) {
    return {
      id: row.client_id,
      dbId: row.id,
      name: row.name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      address: row.address,
      status: row.status,
      projectsAssigned: row.projects_assigned,
      lastContact: row.last_contact ? row.last_contact.toISOString().split('T')[0] : null,
      accessLevel: row.access_level,
      portalSettings: {
        canViewReports: Boolean(row.can_view_reports),
        canViewTimelines: Boolean(row.can_view_timelines),
        canViewInvoices: Boolean(row.can_view_invoices),
        canDownloadFiles: Boolean(row.can_download_files)
      },
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Client;

