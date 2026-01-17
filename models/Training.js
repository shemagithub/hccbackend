import pool from '../config/db.js';

class Training {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS training (
        id INT AUTO_INCREMENT PRIMARY KEY,
        training_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NULL,
        skill_id INT NULL,
        skill_name VARCHAR(255) NULL,
        training_type VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        provider VARCHAR(255) NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        status ENUM('planned', 'in_progress', 'completed', 'cancelled') DEFAULT 'planned',
        completion_percentage DECIMAL(5,2) DEFAULT 0,
        certification_issued BOOLEAN DEFAULT FALSE,
        certification_expiry DATE NULL,
        cost DECIMAL(15,2) NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        notes TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_skill (skill_id),
        INDEX idx_status (status),
        INDEX idx_start_date (start_date),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Training table created or already exists.');
  }

  static async generateTrainingId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM training WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `TRG-${year}-${sequence}`;
  }

  static async create({
    trainingId, staffId, skillId, skillName, trainingType, title, description,
    provider, startDate, endDate, status = 'planned', completionPercentage = 0,
    certificationIssued = false, certificationExpiry, cost, currency = 'USD', notes, createdBy
  }) {
    const tId = trainingId || await this.generateTrainingId();

    const [result] = await pool.execute(
      `INSERT INTO training (
        training_id, staff_id, skill_id, skill_name, training_type, title, description,
        provider, start_date, end_date, status, completion_percentage, certification_issued,
        certification_expiry, cost, currency, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tId, staffId || null, skillId || null, skillName || null, trainingType, title,
        description || null, provider || null, startDate || null, endDate || null,
        status, completionPercentage, certificationIssued, certificationExpiry || null,
        cost || null, currency, notes || null, createdBy || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT t.*, s.first_name, s.last_name, s.email, s.position,
             sk.name as skill_full_name, sk.category as skill_category,
             cb.first_name as creator_first_name, cb.last_name as creator_last_name
      FROM training t
      LEFT JOIN staff s ON t.staff_id = s.id
      LEFT JOIN skills sk ON t.skill_id = sk.id
      LEFT JOIN staff cb ON t.created_by = cb.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND t.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.skillId) {
      query += ` AND t.skill_id = ?`;
      params.push(filters.skillId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND t.status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (t.title LIKE ? OR t.training_type LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY t.start_date DESC, t.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToTraining(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT t.*, s.first_name, s.last_name, s.email, s.position,
              sk.name as skill_full_name, sk.category as skill_category,
              cb.first_name as creator_first_name, cb.last_name as creator_last_name
       FROM training t
       LEFT JOIN staff s ON t.staff_id = s.id
       LEFT JOIN skills sk ON t.skill_id = sk.id
       LEFT JOIN staff cb ON t.created_by = cb.id
       WHERE t.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToTraining(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      staffId: 'staff_id',
      skillId: 'skill_id',
      skillName: 'skill_name',
      trainingType: 'training_type',
      title: 'title',
      description: 'description',
      provider: 'provider',
      startDate: 'start_date',
      endDate: 'end_date',
      status: 'status',
      completionPercentage: 'completion_percentage',
      certificationIssued: 'certification_issued',
      certificationExpiry: 'certification_expiry',
      cost: 'cost',
      currency: 'currency',
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
      `UPDATE training SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM training WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToTraining(row) {
    return {
      id: row.training_id,
      dbId: row.id,
      staffId: row.staff_id,
      staffName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      staffEmail: row.email,
      staffPosition: row.position,
      skillId: row.skill_id,
      skillName: row.skill_name,
      skillFullName: row.skill_full_name,
      skillCategory: row.skill_category,
      trainingType: row.training_type,
      title: row.title,
      description: row.description,
      provider: row.provider,
      startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : null,
      endDate: row.end_date ? row.end_date.toISOString().split('T')[0] : null,
      status: row.status,
      completionPercentage: row.completion_percentage ? parseFloat(row.completion_percentage) : 0,
      certificationIssued: row.certification_issued === 1,
      certificationExpiry: row.certification_expiry ? row.certification_expiry.toISOString().split('T')[0] : null,
      cost: row.cost ? parseFloat(row.cost) : null,
      currency: row.currency,
      notes: row.notes,
      createdBy: row.created_by,
      createdByName: row.creator_first_name && row.creator_last_name
        ? `${row.creator_first_name} ${row.creator_last_name}` : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Training;
