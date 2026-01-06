import pool from '../config/db.js';

class Task {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NULL,
        assignee_id INT NULL,
        assignee_name VARCHAR(255) NULL,
        assignee_ids TEXT NULL,
        assignee_names TEXT NULL,
        status ENUM('pending', 'in_progress', 'completed', 'overdue', 'cancelled') DEFAULT 'pending',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        start_date DATE NULL,
        due_date DATE NOT NULL,
        progress INT DEFAULT 0,
        estimated_hours DECIMAL(10,2) NULL,
        actual_hours DECIMAL(10,2) NULL,
        dependencies TEXT NULL,
        tags TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_assignee (assignee_id),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_due_date (due_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (assignee_id) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    
    // Add new columns if they don't exist (for existing tables)
    try {
      await pool.execute(`
        ALTER TABLE tasks 
        ADD COLUMN IF NOT EXISTS assignee_ids TEXT NULL,
        ADD COLUMN IF NOT EXISTS assignee_names TEXT NULL
      `);
    } catch (error) {
      // Columns might already exist, ignore error
      console.log('Note: assignee_ids and assignee_names columns may already exist');
    }
    
    console.log('Tasks table created or already exists.');
  }

  static async generateTaskId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM tasks WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `TASK-${year}-${sequence}`;
  }

  static async create({
    taskId,
    projectId,
    title,
    description,
    assigneeId,
    assigneeIds,
    assigneeName,
    assigneeNames,
    status = 'pending',
    priority = 'medium',
    startDate,
    dueDate,
    progress = 0,
    estimatedHours,
    actualHours,
    dependencies,
    tags,
    createdBy
  }) {
    const tId = taskId || await this.generateTaskId();
    
    // Clean and validate title
    const cleanTitle = title ? String(title).trim() : '';
    if (!cleanTitle) {
      throw new Error('Task title is required');
    }
    
    // Clean description
    const cleanDescription = description ? String(description).trim() : null;
    
    // Validate and clean projectId
    const cleanProjectId = projectId && !isNaN(parseInt(projectId)) ? parseInt(projectId) : null;
    
    // Handle dependencies as JSON array
    let depsJson = null;
    if (dependencies) {
      if (Array.isArray(dependencies)) {
        depsJson = dependencies.length > 0 ? JSON.stringify(dependencies) : null;
      } else if (typeof dependencies === 'string') {
        try {
          const parsed = JSON.parse(dependencies);
          depsJson = Array.isArray(parsed) && parsed.length > 0 ? JSON.stringify(parsed) : null;
        } catch {
          depsJson = null;
        }
      }
    }
    
    // Handle tags as JSON array
    let tagsJson = null;
    if (tags) {
      if (Array.isArray(tags)) {
        tagsJson = tags.length > 0 ? JSON.stringify(tags) : null;
      } else if (typeof tags === 'string') {
        try {
          const parsed = JSON.parse(tags);
          tagsJson = Array.isArray(parsed) && parsed.length > 0 ? JSON.stringify(parsed) : null;
        } catch {
          tagsJson = null;
        }
      }
    }
    
    // Handle multiple assignees - support both single and multiple
    // If assigneeIds is provided (array), use it; otherwise fall back to assigneeId
    let assigneeIdsArray = [];
    if (assigneeIds && Array.isArray(assigneeIds)) {
      assigneeIdsArray = assigneeIds.filter(id => id && !isNaN(parseInt(id))).map(id => parseInt(id));
    } else if (assigneeId && !isNaN(parseInt(assigneeId))) {
      assigneeIdsArray = [parseInt(assigneeId)];
    }
    
    const assigneeIdsJson = assigneeIdsArray.length > 0 ? JSON.stringify(assigneeIdsArray) : null;
    
    // Handle assignee names - support both single and multiple
    let assigneeNamesArray = [];
    if (assigneeNames && Array.isArray(assigneeNames)) {
      assigneeNamesArray = assigneeNames.filter(name => name && String(name).trim()).map(name => String(name).trim());
    } else if (assigneeName && String(assigneeName).trim()) {
      assigneeNamesArray = [String(assigneeName).trim()];
    }
    
    const assigneeNamesJson = assigneeNamesArray.length > 0 ? JSON.stringify(assigneeNamesArray) : null;
    
    // For backward compatibility, set assignee_id to first assignee if available
    const primaryAssigneeId = assigneeIdsArray.length > 0 ? assigneeIdsArray[0] : null;
    const primaryAssigneeName = assigneeNamesArray.length > 0 ? assigneeNamesArray[0] : null;
    
    // Validate and clean dates
    const cleanStartDate = startDate && startDate.trim() ? startDate.trim() : null;
    const cleanDueDate = dueDate && dueDate.trim() ? dueDate.trim() : null;
    
    if (!cleanDueDate) {
      throw new Error('Due date is required');
    }
    
    // Validate progress
    const cleanProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
    
    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'];
    const cleanStatus = validStatuses.includes(status) ? status : 'pending';
    
    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const cleanPriority = validPriorities.includes(priority) ? priority : 'medium';
    
    // Clean estimated and actual hours
    const cleanEstimatedHours = estimatedHours && !isNaN(parseFloat(estimatedHours)) ? parseFloat(estimatedHours) : null;
    const cleanActualHours = actualHours && !isNaN(parseFloat(actualHours)) ? parseFloat(actualHours) : null;

    console.log('Inserting task with data:', {
      taskId: tId,
      projectId: cleanProjectId,
      title: cleanTitle,
      description: cleanDescription,
      assigneeId: primaryAssigneeId,
      assigneeName: primaryAssigneeName,
      assigneeIds: assigneeIdsJson,
      assigneeNames: assigneeNamesJson,
      status: cleanStatus,
      priority: cleanPriority,
      startDate: cleanStartDate,
      dueDate: cleanDueDate,
      progress: cleanProgress,
      estimatedHours: cleanEstimatedHours,
      actualHours: cleanActualHours,
      dependencies: depsJson,
      tags: tagsJson
    });

    const [result] = await pool.execute(
      `INSERT INTO tasks (
        task_id, project_id, title, description, assignee_id, assignee_name, assignee_ids, assignee_names, status, priority,
        start_date, due_date, progress, estimated_hours, actual_hours, dependencies, tags, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tId, cleanProjectId, cleanTitle, cleanDescription, primaryAssigneeId, primaryAssigneeName,
        assigneeIdsJson, assigneeNamesJson, cleanStatus, cleanPriority, cleanStartDate, cleanDueDate, cleanProgress, 
        cleanEstimatedHours, cleanActualHours, depsJson, tagsJson, createdBy || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT t.*, p.name as project_name, p.project_id as project_code,
             s.first_name as assignee_first_name, s.last_name as assignee_last_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN staff s ON t.assignee_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (t.title LIKE ? OR t.description LIKE ? OR t.task_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND t.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.assigneeId) {
      query += ` AND t.assignee_id = ?`;
      params.push(filters.assigneeId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND t.status = ?`;
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ` AND t.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.overdue) {
      query += ` AND t.due_date < CURDATE() AND t.status NOT IN ('completed', 'cancelled')`;
    }

    query += ` ORDER BY t.due_date ASC, t.priority DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToTask(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT t.*, p.name as project_name, p.project_id as project_code,
              s.first_name as assignee_first_name, s.last_name as assignee_last_name
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN staff s ON t.assignee_id = s.id
       WHERE t.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToTask(rows[0]);
  }

  static async findByTaskId(taskId) {
    const [rows] = await pool.execute(
      `SELECT t.*, p.name as project_name, p.project_id as project_code,
              s.first_name as assignee_first_name, s.last_name as assignee_last_name
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN staff s ON t.assignee_id = s.id
       WHERE t.task_id = ?`,
      [taskId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToTask(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      title: 'title',
      description: 'description',
      assigneeId: 'assignee_id',
      assigneeIds: 'assignee_ids',
      assigneeName: 'assignee_name',
      assigneeNames: 'assignee_names',
      status: 'status',
      priority: 'priority',
      startDate: 'start_date',
      dueDate: 'due_date',
      progress: 'progress',
      estimatedHours: 'estimated_hours',
      actualHours: 'actual_hours',
      dependencies: 'dependencies',
      tags: 'tags'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'dependencies' || key === 'tags' || key === 'assigneeIds' || key === 'assigneeNames') {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key] ? JSON.stringify(updateData[key]) : null);
          
          // For backward compatibility, also update assignee_id and assignee_name if assigneeIds/assigneeNames are updated
          if (key === 'assigneeIds' && Array.isArray(updateData[key]) && updateData[key].length > 0) {
            // Update primary assignee_id to first assignee
            if (!updateFields.includes('assignee_id = ?')) {
              updateFields.push('assignee_id = ?');
              params.splice(params.length - 1, 0, updateData[key][0]);
            }
          }
          if (key === 'assigneeNames' && Array.isArray(updateData[key]) && updateData[key].length > 0) {
            // Update primary assignee_name to first assignee
            if (!updateFields.includes('assignee_name = ?')) {
              updateFields.push('assignee_name = ?');
              params.splice(params.length - 1, 0, updateData[key][0]);
            }
          }
        } else {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE tasks SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN due_date < CURDATE() AND status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as overdueCount
      FROM tasks
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToTask(row) {
    // Parse assignee_ids and assignee_names if they exist
    let assigneeIds = [];
    let assigneeNames = [];
    
    if (row.assignee_ids) {
      try {
        assigneeIds = JSON.parse(row.assignee_ids);
      } catch (e) {
        assigneeIds = [];
      }
    }
    
    if (row.assignee_names) {
      try {
        assigneeNames = JSON.parse(row.assignee_names);
      } catch (e) {
        assigneeNames = [];
      }
    }
    
    // If no multiple assignees, fall back to single assignee for backward compatibility
    if (assigneeIds.length === 0 && row.assignee_id) {
      assigneeIds = [row.assignee_id];
    }
    
    if (assigneeNames.length === 0) {
      const singleName = row.assignee_name || (row.assignee_first_name && row.assignee_last_name 
        ? `${row.assignee_first_name} ${row.assignee_last_name}` : null);
      if (singleName) {
        assigneeNames = [singleName];
      }
    }
    
    return {
      id: row.task_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      description: row.description,
      assigneeId: row.assignee_id,
      assigneeIds: assigneeIds,
      assigneeName: row.assignee_name || (row.assignee_first_name && row.assignee_last_name 
        ? `${row.assignee_first_name} ${row.assignee_last_name}` : null),
      assigneeNames: assigneeNames,
      status: row.status,
      priority: row.priority,
      startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : null,
      dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      progress: row.progress,
      estimatedHours: row.estimated_hours ? parseFloat(row.estimated_hours) : null,
      actualHours: row.actual_hours ? parseFloat(row.actual_hours) : null,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Task;

