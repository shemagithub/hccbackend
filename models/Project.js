import pool from '../config/db.js';

class Project {
  static linkFieldsReady = false;

  static async ensureLinkFields() {
    if (this.linkFieldsReady) return;

    const columns = [
      { name: 'opportunity_id', ddl: 'ADD COLUMN opportunity_id INT NULL AFTER assigned_to' },
      { name: 'contract_id', ddl: 'ADD COLUMN contract_id INT NULL AFTER opportunity_id' },
    ];

    for (const column of columns) {
      const [rows] = await pool.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'projects'
           AND COLUMN_NAME = ?`,
        [column.name]
      );

      if (rows.length === 0) {
        await pool.execute(`ALTER TABLE projects ${column.ddl}`);
        console.log(`Added projects.${column.name}`);
      }
    }

    this.linkFieldsReady = true;
  }

  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(500) NOT NULL,
        client VARCHAR(255) NOT NULL,
        department VARCHAR(255) NULL,
        manager VARCHAR(255) NOT NULL,
        status ENUM('planning', 'ongoing', 'near_completion', 'completed', 'overdue', 'on_hold', 'cancelled') DEFAULT 'planning',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        progress INT DEFAULT 0,
        budget DECIMAL(15,2) NOT NULL DEFAULT 0,
        spent DECIMAL(15,2) NOT NULL DEFAULT 0,
        team_size INT DEFAULT 0,
        priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        description TEXT NULL,
        location VARCHAR(255) NULL,
        assigned_to TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_client (client),
        INDEX idx_department (department),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    await this.ensureLinkFields();
    console.log('Projects table created or already exists.');
  }

  static async generateProjectId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM projects WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(3, '0');
    return `PRJ-${year}-${sequence}`;
  }

  static async create({
    projectId,
    name,
    client,
    department,
    manager,
    status = 'planning',
    startDate,
    endDate,
    progress = 0,
    budget = 0,
    spent = 0,
    teamSize = 0,
    priority = 'medium',
    description,
    location,
    assignedTo
  }) {
    const projId = projectId || await this.generateProjectId();

    const [result] = await pool.execute(
      `INSERT INTO projects (
        project_id, name, client, department, manager, status, start_date, end_date,
        progress, budget, spent, team_size, priority, description, location, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projId, name, client, department || null, manager, status, startDate, endDate,
        progress, budget, spent, teamSize, priority, description || null, location || null,
        (assignedTo && String(assignedTo).trim()) || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `SELECT * FROM projects WHERE 1=1`;
    const params = [];

    // Filter by assigned user email (if provided)
    // assigned_to is a comma-separated string of emails
    if (filters.userEmail) {
      query += ` AND (
        assigned_to LIKE ? OR
        assigned_to LIKE ? OR
        assigned_to LIKE ? OR
        assigned_to = ? OR
        id IN (
          SELECT pa.project_id
          FROM project_assignments pa
          INNER JOIN staff s ON pa.staff_id = s.id
          WHERE s.email = ? AND pa.status IN ('active', 'pending')
        )
      )`;
      // Match email at start, middle, or end of comma-separated list
      const emailPattern1 = `${filters.userEmail},%`; // Email at start
      const emailPattern2 = `%,${filters.userEmail},%`; // Email in middle
      const emailPattern3 = `%,${filters.userEmail}`; // Email at end
      const exactMatch = filters.userEmail; // Exact match (single email)
      params.push(emailPattern1, emailPattern2, emailPattern3, exactMatch, filters.userEmail);
    }

    if (filters.search) {
      query += ` AND (
        name LIKE ? OR
        client LIKE ? OR
        manager LIKE ? OR
        project_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ` AND priority = ?`;
      params.push(filters.priority);
    }

    if (filters.client) {
      query += ` AND client LIKE ?`;
      params.push(`%${filters.client}%`);
    }

    if (filters.department) {
      query += ` AND department = ?`;
      params.push(filters.department);
    }

    // Filter by departmentId - join with departments table
    if (filters.departmentId) {
      query += ` AND EXISTS (
        SELECT 1 FROM departments d WHERE d.id = ? AND d.name = projects.department
      )`;
      params.push(filters.departmentId);
    }

    if (filters.manager) {
      query += ` AND manager = ?`;
      params.push(filters.manager);
    }

    if (filters.id) {
      query += ` AND id = ?`;
      params.push(parseInt(filters.id, 10));
    } else if (filters.projectId) {
      query += ` AND id = ?`;
      params.push(parseInt(filters.projectId, 10));
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
    return rows.map(row => this.mapRowToProject(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM projects WHERE id = ?', [id]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToProject(rows[0]);
  }

  static async findByProjectId(projectId) {
    const [rows] = await pool.execute('SELECT * FROM projects WHERE project_id = ?', [projectId]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToProject(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      name: 'name',
      client: 'client',
      manager: 'manager',
      status: 'status',
      startDate: 'start_date',
      endDate: 'end_date',
      progress: 'progress',
      budget: 'budget',
      spent: 'spent',
      teamSize: 'team_size',
      priority: 'priority',
      description: 'description',
      location: 'location',
      assignedTo: 'assigned_to',
      opportunityId: 'opportunity_id',
      contractId: 'contract_id',
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
      `UPDATE projects SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    await pool.execute('DELETE FROM implementations WHERE project_id = ?', [id]);
    const [result] = await pool.execute('DELETE FROM projects WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(budget) as totalBudget,
        SUM(spent) as totalSpent,
        SUM(CASE WHEN status = 'planning' THEN 1 ELSE 0 END) as planning,
        SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) as ongoing,
        SUM(CASE WHEN status = 'near_completion' THEN 1 ELSE 0 END) as nearCompletion,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) as onHold
      FROM projects
      WHERE 1=1
    `;
    const params = [];

    if (filters.department) {
      query += ` AND department = ?`;
      params.push(filters.department);
    }

    if (filters.departmentId) {
      query += ` AND EXISTS (
        SELECT 1 FROM departments d WHERE d.id = ? AND d.name = projects.department
      )`;
      params.push(filters.departmentId);
    }

    if (filters.manager) {
      query += ` AND manager = ?`;
      params.push(filters.manager);
    }

    if (filters.id) {
      query += ` AND id = ?`;
      params.push(parseInt(filters.id, 10));
    } else if (filters.projectId) {
      query += ` AND id = ?`;
      params.push(parseInt(filters.projectId, 10));
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToProject(row) {
    return {
      id: row.project_id,
      dbId: row.id,
      name: row.name,
      client: row.client,
      department: row.department || null,
      manager: row.manager,
      status: row.status,
      startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : null,
      endDate: row.end_date ? row.end_date.toISOString().split('T')[0] : null,
      progress: row.progress,
      budget: parseFloat(row.budget),
      spent: parseFloat(row.spent),
      teamSize: row.team_size,
      priority: row.priority,
      description: row.description,
      location: row.location,
      assignedTo: row.assigned_to,
      opportunityId: row.opportunity_id || null,
      contractId: row.contract_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Project;

