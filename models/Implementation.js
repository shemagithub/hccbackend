import pool from '../config/db.js';
import Project from './Project.js';
import Staff from './Staff.js';

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
      SELECT i.*, p.name as project_name, p.department as project_department
      FROM implementations i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by assigned user email (if provided)
    // assigned_to is a comma-separated string of emails
    if (filters.userEmail) {
      query += ` AND (
        i.assigned_to LIKE ? OR
        i.assigned_to LIKE ? OR
        i.assigned_to LIKE ? OR
        i.assigned_to = ?
      )`;
      // Match email at start, middle, or end of comma-separated list
      const emailPattern1 = `${filters.userEmail},%`; // Email at start
      const emailPattern2 = `%,${filters.userEmail},%`; // Email in middle
      const emailPattern3 = `%,${filters.userEmail}`; // Email at end
      const exactMatch = filters.userEmail; // Exact match (single email)
      params.push(emailPattern1, emailPattern2, emailPattern3, exactMatch);
    }

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

    // Filter by department (through project)
    if (filters.department) {
      query += ` AND p.department = ?`;
      params.push(filters.department);
    }

    if (filters.departmentId) {
      query += ` AND EXISTS (
        SELECT 1 FROM departments d WHERE d.id = ? AND d.name = p.department
      )`;
      params.push(filters.departmentId);
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

  static async findByProjectId(projectRef) {
    const numericId = parseInt(projectRef, 10);
    let projectDbId = null;

    if (!Number.isNaN(numericId)) {
      const [byFk] = await pool.execute(
        `SELECT i.*, p.name as project_name, p.department as project_department
         FROM implementations i
         LEFT JOIN projects p ON i.project_id = p.id
         WHERE i.project_id = ?`,
        [numericId]
      );
      if (byFk.length > 0) {
        return this.mapRowToImplementation(byFk[0]);
      }
      projectDbId = numericId;
    }

    const project =
      (projectDbId ? await Project.findById(projectDbId) : null) ||
      (typeof projectRef === 'string' ? await Project.findByProjectId(projectRef) : null);

    if (!project?.dbId) {
      return null;
    }

    const [rows] = await pool.execute(
      `SELECT i.*, p.name as project_name, p.department as project_department
       FROM implementations i
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.project_id = ?`,
      [project.dbId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToImplementation(rows[0]);
  }

  static mapProjectStatusToImplementation(status) {
    const map = {
      planning: 'planning',
      ongoing: 'in_progress',
      near_completion: 'in_progress',
      completed: 'completed',
      on_hold: 'on_hold',
      overdue: 'in_progress',
      cancelled: 'on_hold',
    };
    return map[status] || 'planning';
  }

  /** Ensure a project record has a linked implementation row for the pipeline workspace. */
  static async ensureLinkedImplementation(projectRef) {
    let project = null;
    const numericId = parseInt(projectRef, 10);

    if (!Number.isNaN(numericId)) {
      project = await Project.findById(numericId);
    }
    if (!project && typeof projectRef === 'string') {
      project = await Project.findByProjectId(projectRef);
    }
    if (!project) {
      throw new Error('Project not found');
    }

    const existing = await this.findByProjectId(project.dbId);
    if (existing) {
      return { implementation: existing, project };
    }

    const implementation = await this.create({
      projectId: project.dbId,
      title: project.name,
      client: project.client,
      description: project.description || null,
      startDate: project.startDate,
      endDate: project.endDate,
      status: this.mapProjectStatusToImplementation(project.status),
      progress: project.progress || 0,
      budget: project.budget || 0,
      spent: project.spent || 0,
      assignedTo: project.assignedTo || null,
      teamSize: project.teamSize || 0,
      priority: project.priority || 'medium',
    });

    return { implementation, project };
  }

  static async getWorkspaceByProject(projectRef) {
    const { implementation } = await this.ensureLinkedImplementation(projectRef);
    return this.getWorkspace(implementation.dbId);
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
      projectDepartment: row.project_department || null,
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

  /** Create an implementation record when an EOI or proposal is awarded. Also provisions a linked project. */
  static async createFromAwarded({
    title,
    client,
    description,
    startDate,
    endDate,
    budget = 0,
    assignedTo,
    createdBy,
    department = null,
    manager = null,
  }) {
    if (!title || !client || !startDate || !endDate) {
      throw new Error('Title, client, start date, and due date are required to start implementation');
    }

    if (new Date(startDate) > new Date(endDate)) {
      throw new Error('Due date must be on or after the start date');
    }

    const teamSize = assignedTo
      ? assignedTo.split(',').map((item) => item.trim()).filter(Boolean).length
      : 0;

    const resolvedManager = manager || (await this.resolveManagerName(assignedTo, createdBy));

    const project = await Project.create({
      name: title,
      client,
      department,
      manager: resolvedManager,
      status: 'planning',
      startDate,
      endDate,
      progress: 0,
      budget: parseFloat(budget) || 0,
      spent: 0,
      teamSize,
      priority: 'medium',
      description: description || null,
      assignedTo: assignedTo || null,
    });

    return this.create({
      projectId: project.dbId,
      title,
      client,
      description: description || null,
      startDate,
      endDate,
      status: 'planning',
      progress: 0,
      budget: parseFloat(budget) || 0,
      spent: 0,
      assignedTo: assignedTo || null,
      teamSize,
      priority: 'medium',
      createdBy: createdBy || null,
    });
  }

  static async resolveManagerName(assignedTo, createdBy) {
    if (createdBy) {
      try {
        const staff = await Staff.findById(createdBy);
        if (staff?.firstName) {
          return `${staff.firstName} ${staff.lastName || ''}`.trim();
        }
      } catch {
        // fall through
      }
    }
    if (assignedTo) {
      const first = assignedTo.split(',')[0]?.trim();
      if (first) return first;
    }
    return 'Project Manager';
  }

  /** Ensure every implementation has a linked project record for PM features (tasks, deliverables, etc.). */
  static async ensureLinkedProject(implementationDbId) {
    const impl = await this.findById(implementationDbId);
    if (!impl) {
      throw new Error('Implementation not found');
    }

    if (impl.projectId) {
      const project = await Project.findById(impl.projectId);
      if (project) {
        return { implementation: impl, project };
      }
    }

    const manager = await this.resolveManagerName(impl.assignedTo, impl.createdBy);
    const project = await Project.create({
      name: impl.title,
      client: impl.client,
      department: impl.projectDepartment || null,
      manager,
      status: impl.status === 'completed' ? 'completed' : impl.status === 'on_hold' ? 'on_hold' : 'ongoing',
      startDate: impl.startDate,
      endDate: impl.endDate,
      progress: impl.progress || 0,
      budget: impl.budget || 0,
      spent: impl.spent || 0,
      teamSize: impl.teamSize || 0,
      priority: impl.priority || 'medium',
      description: impl.description || null,
      assignedTo: impl.assignedTo || null,
    });

    const updated = await this.update(implementationDbId, { projectId: project.dbId });
    return { implementation: updated || { ...impl, projectId: project.dbId }, project };
  }

  /** Load implementation + linked project + live counts for the management workspace. */
  static async getWorkspace(implementationDbId) {
    const { implementation, project } = await this.ensureLinkedProject(implementationDbId);
    const projectId = project.dbId;

    const [[taskRow], [deliverableRow], [expenseRow], [riskRow], [openTaskRow]] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?', [projectId]),
      pool.execute('SELECT COUNT(*) AS count FROM deliverables WHERE project_id = ?', [projectId]),
      pool.execute(
        'SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses WHERE project_id = ?',
        [projectId]
      ),
      pool.execute('SELECT COUNT(*) AS count FROM risks WHERE project_id = ?', [projectId]),
      pool.execute(
        "SELECT COUNT(*) AS count FROM tasks WHERE project_id = ? AND status NOT IN ('completed', 'cancelled')",
        [projectId]
      ),
    ]);

    const spent = parseFloat(expenseRow[0]?.total || 0);
    const budget = parseFloat(project.budget || implementation.budget || 0);
    const taskCount = taskRow[0]?.count || 0;
    const completedTasks = taskCount - (openTaskRow[0]?.count || 0);
    const progress =
      taskCount > 0 ? Math.min(100, Math.round((completedTasks / taskCount) * 100)) : implementation.progress || 0;

    if (spent !== implementation.spent || progress !== implementation.progress) {
      await this.update(implementationDbId, { spent, progress });
      await Project.update(projectId, { spent, progress });
    }

    const refreshedImpl = (await this.findById(implementationDbId)) || implementation;
    const refreshedProject = (await Project.findById(projectId)) || project;

    return {
      implementation: refreshedImpl,
      project: refreshedProject,
      stats: {
        tasks: taskCount,
        openTasks: openTaskRow[0]?.count || 0,
        deliverables: deliverableRow[0]?.count || 0,
        expenses: expenseRow[0]?.count || 0,
        expenseTotal: spent,
        risks: riskRow[0]?.count || 0,
        budget,
        budgetUsedPercent: budget > 0 ? Math.round((spent / budget) * 100) : 0,
        progress,
      },
    };
  }
}

export default Implementation;

