import pool from '../config/db.js';
import { ensureTableColumns } from '../utils/schemaMigration.js';

class Task {
  static schemaReady = false;

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
        attachment_data LONGTEXT NULL,
        attachment_name VARCHAR(255) NULL,
        attachment_type VARCHAR(100) NULL,
        attachment_size VARCHAR(50) NULL,
        approval_status ENUM('not_required', 'pending_approval', 'approved', 'rejected') DEFAULT 'not_required',
        approved_by INT NULL,
        approval_notes TEXT NULL,
        submitted_at TIMESTAMP NULL,
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
    await this.ensureSchemaFields();
    console.log('Tasks table created or already exists.');
  }

  static async ensureSchemaFields() {
    if (this.schemaReady) return;

    await ensureTableColumns('tasks', [
      { name: 'assignee_ids', ddl: 'ADD COLUMN assignee_ids TEXT NULL' },
      { name: 'assignee_names', ddl: 'ADD COLUMN assignee_names TEXT NULL' },
      { name: 'attachment_data', ddl: 'ADD COLUMN attachment_data LONGTEXT NULL' },
      { name: 'attachment_name', ddl: 'ADD COLUMN attachment_name VARCHAR(255) NULL' },
      { name: 'attachment_type', ddl: 'ADD COLUMN attachment_type VARCHAR(100) NULL' },
      { name: 'attachment_size', ddl: 'ADD COLUMN attachment_size VARCHAR(50) NULL' },
      {
        name: 'approval_status',
        ddl: "ADD COLUMN approval_status ENUM('not_required', 'pending_approval', 'approved', 'rejected') DEFAULT 'not_required'",
      },
      { name: 'approved_by', ddl: 'ADD COLUMN approved_by INT NULL' },
      { name: 'approval_notes', ddl: 'ADD COLUMN approval_notes TEXT NULL' },
      { name: 'submitted_at', ddl: 'ADD COLUMN submitted_at TIMESTAMP NULL' },
      { name: 'approval_stage', ddl: "ADD COLUMN approval_stage VARCHAR(50) DEFAULT 'none'" },
      { name: 'submitted_by', ddl: 'ADD COLUMN submitted_by INT NULL' },
      { name: 'submitter_role', ddl: 'ADD COLUMN submitter_role VARCHAR(50) NULL' },
      { name: 'team_lead_approved_by', ddl: 'ADD COLUMN team_lead_approved_by INT NULL' },
      { name: 'team_lead_approved_at', ddl: 'ADD COLUMN team_lead_approved_at TIMESTAMP NULL' },
      { name: 'pm_approved_by', ddl: 'ADD COLUMN pm_approved_by INT NULL' },
      { name: 'pm_approved_at', ddl: 'ADD COLUMN pm_approved_at TIMESTAMP NULL' },
      { name: 'superadmin_approved_by', ddl: 'ADD COLUMN superadmin_approved_by INT NULL' },
      { name: 'superadmin_approved_at', ddl: 'ADD COLUMN superadmin_approved_at TIMESTAMP NULL' },
    ]);

    this.schemaReady = true;
  }

  static async generateTaskId() {
    const year = new Date().getFullYear();
    const prefix = `TASK-${year}-`;
    const [rows] = await pool.execute(
      'SELECT task_id FROM tasks WHERE task_id LIKE ?',
      [`${prefix}%`]
    );

    let maxSeq = 0;
    for (const row of rows) {
      const match = String(row.task_id).match(/-(\d+)$/);
      if (match) {
        maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
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
    attachmentData,
    attachmentName,
    attachmentType,
    attachmentSize,
    approvalStatus = 'not_required',
    approvalStage = 'none',
    approvedBy = null,
    approvalNotes = null,
    submittedAt = null,
    submittedBy = null,
    submitterRole = null,
    teamLeadApprovedBy = null,
    teamLeadApprovedAt = null,
    pmApprovedBy = null,
    pmApprovedAt = null,
    superadminApprovedBy = null,
    superadminApprovedAt = null,
    createdBy
  }) {
    await this.ensureSchemaFields();

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

    const insertSql = `INSERT INTO tasks (
        task_id, project_id, title, description, assignee_id, assignee_name, assignee_ids, assignee_names, status, priority,
        start_date, due_date, progress, estimated_hours, actual_hours, dependencies, tags,
        attachment_data, attachment_name, attachment_type, attachment_size,
        approval_status, approval_stage, approved_by, approval_notes, submitted_at, submitted_by, submitter_role,
        team_lead_approved_by, team_lead_approved_at, pm_approved_by, pm_approved_at,
        superadmin_approved_by, superadmin_approved_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const insertParams = [
      null,
      cleanProjectId, cleanTitle, cleanDescription, primaryAssigneeId, primaryAssigneeName,
      assigneeIdsJson, assigneeNamesJson, cleanStatus, cleanPriority, cleanStartDate, cleanDueDate, cleanProgress,
      cleanEstimatedHours, cleanActualHours, depsJson, tagsJson,
      attachmentData || null, attachmentName || null, attachmentType || null, attachmentSize || null,
      approvalStatus || 'not_required', approvalStage || 'none', approvedBy || null, approvalNotes || null,
      submittedAt || null, submittedBy || null, submitterRole || null,
      teamLeadApprovedBy || null, teamLeadApprovedAt || null, pmApprovedBy || null, pmApprovedAt || null,
      superadminApprovedBy || null, superadminApprovedAt || null,
      createdBy || null,
    ];

    let resolvedTaskId = taskId || null;
    let lastError = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!resolvedTaskId) {
        resolvedTaskId = await this.generateTaskId();
      }
      insertParams[0] = resolvedTaskId;

      console.log('Inserting task with data:', {
        taskId: resolvedTaskId,
        projectId: cleanProjectId,
        title: cleanTitle,
        tags: tagsJson,
      });

      try {
        const [result] = await pool.execute(insertSql, insertParams);
        return await this.findById(result.insertId);
      } catch (error) {
        lastError = error;
        const isDuplicateTaskId =
          error?.code === 'ER_DUP_ENTRY' &&
          String(error?.sqlMessage || '').includes('task_id');

        if (!taskId && isDuplicateTaskId && attempt < 4) {
          resolvedTaskId = null;
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Failed to generate a unique task ID');
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
      tags: 'tags',
      attachmentData: 'attachment_data',
      attachmentName: 'attachment_name',
      attachmentType: 'attachment_type',
      attachmentSize: 'attachment_size',
      approvalStatus: 'approval_status',
      approvalStage: 'approval_stage',
      approvedBy: 'approved_by',
      approvalNotes: 'approval_notes',
      submittedAt: 'submitted_at',
      submittedBy: 'submitted_by',
      submitterRole: 'submitter_role',
      teamLeadApprovedBy: 'team_lead_approved_by',
      teamLeadApprovedAt: 'team_lead_approved_at',
      pmApprovedBy: 'pm_approved_by',
      pmApprovedAt: 'pm_approved_at',
      superadminApprovedBy: 'superadmin_approved_by',
      superadminApprovedAt: 'superadmin_approved_at',
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
      attachmentData: row.attachment_data || null,
      attachmentName: row.attachment_name || null,
      attachmentType: row.attachment_type || null,
      attachmentSize: row.attachment_size || null,
      approvalStatus: row.approval_status || 'not_required',
      approvalStage: row.approval_stage || 'none',
      approvedBy: row.approved_by || null,
      approvalNotes: row.approval_notes || null,
      submittedAt: row.submitted_at || null,
      submittedBy: row.submitted_by || null,
      submitterRole: row.submitter_role || null,
      teamLeadApprovedBy: row.team_lead_approved_by || null,
      teamLeadApprovedAt: row.team_lead_approved_at || null,
      pmApprovedBy: row.pm_approved_by || null,
      pmApprovedAt: row.pm_approved_at || null,
      superadminApprovedBy: row.superadmin_approved_by || null,
      superadminApprovedAt: row.superadmin_approved_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Task;

