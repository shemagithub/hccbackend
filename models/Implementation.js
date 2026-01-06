import pool from '../config/db.js';

class Implementation {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS implementations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        implementation_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        client VARCHAR(255) NOT NULL,
        description TEXT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('planning', 'in_progress', 'testing', 'deployment', 'completed', 'on_hold') DEFAULT 'planning',
        progress INT DEFAULT 0,
        budget DECIMAL(15,2) NOT NULL DEFAULT 0,
        spent DECIMAL(15,2) NOT NULL DEFAULT 0,
        assigned_to VARCHAR(255) NULL,
        team_size INT DEFAULT 0,
        priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_client (client),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Implementations table created or already exists.');
  }

  static async generateImplementationId() {
    const [rows] = await pool.execute(
      'SELECT implementation_id FROM implementations ORDER BY id DESC LIMIT 1'
    );
    
    if (rows.length === 0) {
      return 'IMP-001';
    }
    
    const lastId = rows[0].implementation_id;
    const match = lastId.match(/IMP-(\d+)/);
    
    if (match) {
      const num = parseInt(match[1], 10);
      const nextNum = num + 1;
      return `IMP-${nextNum.toString().padStart(3, '0')}`;
    }
    
    return 'IMP-001';
  }

  static async create({
    implementationId,
    projectId,
    title,
    client,
    description,
    startDate,
    endDate,
    status = 'planning',
    progress = 0,
    budget = 0,
    spent = 0,
    assignedTo,
    teamSize = 0,
    priority = 'medium',
    createdBy
  }) {
    const impId = implementationId || await this.generateImplementationId();
    
    const [result] = await pool.execute(
      `INSERT INTO implementations (
        implementation_id, project_id, title, client, description, start_date, end_date,
        status, progress, budget, spent, assigned_to, team_size, priority, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        impId, projectId || null, title, client, description || null,
        startDate, endDate, status, progress, budget, spent,
        assignedTo || null, teamSize, priority, createdBy || null
      ]
    );

    return this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT i.*, p.name as project_name
      FROM implementations i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ` AND i.status = ?`;
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ` AND i.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.client) {
      query += ` AND i.client LIKE ?`;
      params.push(`%${filters.client}%`);
    }

    if (filters.projectId) {
      query += ` AND i.project_id = ?`;
      params.push(filters.projectId);
    }

    query += ` ORDER BY i.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToImplementation(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT i.*, p.name as project_name
       FROM implementations i
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToImplementation(rows[0]);
  }

  static async findByImplementationId(implementationId) {
    const [rows] = await pool.execute(
      'SELECT i.*, p.name as project_name FROM implementations i LEFT JOIN projects p ON i.project_id = p.id WHERE i.implementation_id = ?',
      [implementationId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToImplementation(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      title: 'title',
      client: 'client',
      description: 'description',
      startDate: 'start_date',
      endDate: 'end_date',
      status: 'status',
      progress: 'progress',
      budget: 'budget',
      spent: 'spent',
      assignedTo: 'assigned_to',
      teamSize: 'team_size',
      priority: 'priority'
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
      `UPDATE implementations SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0 ? this.findById(id) : null;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM implementations WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToImplementation(row) {
    return {
      id: row.implementation_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      title: row.title,
      client: row.client,
      description: row.description,
      startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : null,
      endDate: row.end_date ? row.end_date.toISOString().split('T')[0] : null,
      status: row.status,
      progress: row.progress || 0,
      budget: parseFloat(row.budget || 0),
      spent: parseFloat(row.spent || 0),
      assignedTo: row.assigned_to,
      teamSize: row.team_size || 0,
      priority: row.priority,
      createdBy: row.created_by,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null
    };
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status NOT IN ('completed', 'on_hold') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(budget) as total_budget,
        SUM(spent) as total_spent,
        AVG(progress) as avg_progress
      FROM implementations
    `);

    return rows[0] || {
      total: 0,
      active: 0,
      completed: 0,
      total_budget: 0,
      total_spent: 0,
      avg_progress: 0
    };
  }
}

export default Implementation;

