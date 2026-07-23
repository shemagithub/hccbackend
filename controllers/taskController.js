import Task from '../models/Task.js';
import Staff from '../models/Staff.js';
import {
  isElevatedProjectTeamCreator,
  isProjectManagerPortalStaff,
  getStaffProjectRole,
  canManageProjectRole,
  isTaskAssignee,
} from '../utils/projectTeam.js';
import {
  resolveTaskApprovalContext,
  canReviewTaskAtStage,
  buildSubmissionUpdate,
  buildApprovalUpdate,
  getApprovalStageLabel,
} from '../utils/taskApproval.js';

export class TaskController {
  // Create a new task
  static async createTask(req, res) {
    try {
      const {
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
      } = req.body;

      const createdBy = req.staffId || null;

      // Validation
      if (!title || !dueDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: title and dueDate are required'
        });
      }

      // Validate progress
      if (progress < 0 || progress > 100) {
        return res.status(400).json({
          success: false,
          message: 'Progress must be between 0 and 100'
        });
      }

      // Validate status
      if (!['pending', 'in_progress', 'completed', 'overdue', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      // Validate priority
      if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid priority value'
        });
      }

      // Clean and prepare data
      const cleanTitle = title ? String(title).trim() : '';
      if (!cleanTitle) {
        return res.status(400).json({
          success: false,
          message: 'Title is required and cannot be empty'
        });
      }

      const cleanDescription = description ? String(description).trim() : null;
      const cleanProjectId = projectId && !isNaN(parseInt(projectId)) ? parseInt(projectId) : null;
      const cleanProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
      const cleanEstimatedHours = estimatedHours && !isNaN(parseFloat(estimatedHours)) ? parseFloat(estimatedHours) : null;
      const cleanActualHours = actualHours && !isNaN(parseFloat(actualHours)) ? parseFloat(actualHours) : null;
      
      // Clean dates
      const cleanStartDate = startDate && String(startDate).trim() ? String(startDate).trim() : null;
      const cleanDueDate = dueDate && String(dueDate).trim() ? String(dueDate).trim() : null;
      
      if (!cleanDueDate) {
        return res.status(400).json({
          success: false,
          message: 'Due date is required'
        });
      }

      // Validate date range
      if (cleanStartDate && cleanDueDate && new Date(cleanStartDate) > new Date(cleanDueDate)) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before or equal to due date'
        });
      }

      // Clean assignee data
      let cleanAssigneeIds = null;
      if (assigneeIds) {
        if (Array.isArray(assigneeIds)) {
          cleanAssigneeIds = assigneeIds.filter(id => id && !isNaN(parseInt(id))).map(id => parseInt(id));
        }
      } else if (assigneeId && !isNaN(parseInt(assigneeId))) {
        cleanAssigneeIds = [parseInt(assigneeId)];
      }

      let cleanAssigneeNames = null;
      if (assigneeNames) {
        if (Array.isArray(assigneeNames)) {
          cleanAssigneeNames = assigneeNames.filter(name => name && String(name).trim()).map(name => String(name).trim());
        }
      } else if (assigneeName && String(assigneeName).trim()) {
        cleanAssigneeNames = [String(assigneeName).trim()];
      }

      // Clean dependencies and tags
      let cleanDependencies = null;
      if (dependencies) {
        if (Array.isArray(dependencies)) {
          cleanDependencies = dependencies.length > 0 ? dependencies : null;
        } else if (typeof dependencies === 'string') {
          try {
            const parsed = JSON.parse(dependencies);
            cleanDependencies = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
          } catch {
            cleanDependencies = null;
          }
        }
      }

      let cleanTags = null;
      if (tags) {
        if (Array.isArray(tags)) {
          cleanTags = tags.length > 0 ? tags : null;
        } else if (typeof tags === 'string') {
          try {
            const parsed = JSON.parse(tags);
            cleanTags = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
          } catch {
            cleanTags = null;
          }
        }
      }

      const task = await Task.create({
        taskId,
        projectId: cleanProjectId,
        title: cleanTitle,
        description: cleanDescription,
        assigneeId: cleanAssigneeIds && cleanAssigneeIds.length > 0 ? cleanAssigneeIds[0] : null,
        assigneeIds: cleanAssigneeIds,
        assigneeName: cleanAssigneeNames && cleanAssigneeNames.length > 0 ? cleanAssigneeNames[0] : null,
        assigneeNames: cleanAssigneeNames,
        status,
        priority,
        startDate: cleanStartDate,
        dueDate: cleanDueDate,
        progress: cleanProgress,
        estimatedHours: cleanEstimatedHours,
        actualHours: cleanActualHours,
        dependencies: cleanDependencies,
        tags: cleanTags,
        attachmentData: attachmentData || null,
        attachmentName: attachmentName || null,
        attachmentType: attachmentType || null,
        attachmentSize: attachmentSize || null,
        approvalStatus: 'not_required',
        approvalStage: 'none',
        approvedBy: null,
        approvalNotes: null,
        submittedAt: null,
        submittedBy: null,
        submitterRole: null,
        createdBy
      });

      res.status(201).json({
        success: true,
        message: 'Task created. Assignee must complete work and submit for approval.',
        data: task
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create task',
        error: error.message
      });
    }
  }

  // Get all tasks
  static async getTasks(req, res) {
    try {
      const {
        search,
        projectId,
        assigneeId,
        status,
        priority,
        overdue,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : null,
        assigneeId: assigneeId ? parseInt(assigneeId) : null,
        status,
        priority,
        overdue: overdue === 'true' || overdue === true,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const tasks = await Task.findAll(filters);
      const stats = await Task.getStats(filters.projectId);

      res.json({
        success: true,
        data: tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats
      });
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tasks',
        error: error.message
      });
    }
  }

  // Get task by ID
  static async getTaskById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Task ID is required'
        });
      }

      let task = await Task.findById(parseInt(id));
      if (!task) {
        task = await Task.findByTaskId(id);
      }
      
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Get task by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch task',
        error: error.message
      });
    }
  }

  // Update task
  static async updateTask(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Task ID is required'
        });
      }

      // Validate progress if provided
      if (updateData.progress !== undefined && (updateData.progress < 0 || updateData.progress > 100)) {
        return res.status(400).json({
          success: false,
          message: 'Progress must be between 0 and 100'
        });
      }

      let taskId = parseInt(id);
      let task = await Task.findById(taskId);
      if (!task) {
        task = await Task.findByTaskId(id);
        if (!task) {
          return res.status(404).json({
            success: false,
            message: 'Task not found'
          });
        }
        taskId = task.dbId;
      } else {
        taskId = task.dbId;
      }

      const approvalContext = await resolveTaskApprovalContext(req.staffId, task.projectId);
      const isAssignee = isTaskAssignee(task, req.staffId);
      const canManageTask =
        approvalContext.isSuperAdmin ||
        approvalContext.isPmPortal ||
        canManageProjectRole(approvalContext.projectRole);

      if (!canManageTask && !isAssignee) {
        return res.status(403).json({
          success: false,
          message: 'You can only update tasks assigned to you on this project',
        });
      }

      if (!canManageTask && isAssignee) {
        const allowedFields = new Set([
          'status',
          'progress',
          'actualHours',
          'description',
          'attachmentData',
          'attachmentName',
          'attachmentType',
          'attachmentSize',
          'submitForApproval',
          'approvalNotes',
        ]);
        Object.keys(updateData).forEach((key) => {
          if (!allowedFields.has(key)) delete updateData[key];
        });
      }

      if (
        (updateData.approvalStatus || updateData.approvalStage) &&
        !canManageTask &&
        !canReviewTaskAtStage(approvalContext, task)
      ) {
        delete updateData.approvalStatus;
        delete updateData.approvalStage;
        delete updateData.approvedBy;
        delete updateData.approvalNotes;
      }

      const wantsApproval =
        updateData.submitForApproval === true ||
        (!canManageTask && (updateData.status === 'completed' || updateData.progress === 100));

      const submittingForApproval =
        isAssignee &&
        wantsApproval &&
        ['contributor', 'team_lead', 'project_manager'].includes(approvalContext.projectRole || 'contributor');

      let submissionStage = null;
      if (submittingForApproval) {
        const submission = buildSubmissionUpdate(
          approvalContext.projectRole || 'contributor',
          req.staffId,
        );
        submissionStage = submission.approvalStage;
        Object.assign(updateData, submission);
        delete updateData.submitForApproval;
      }

      const updated = await Task.update(taskId, updateData);
      
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
      }

      const updatedTask = await Task.findById(taskId);

      const message = submittingForApproval
        ? `Work submitted. ${getApprovalStageLabel(submissionStage, 'pending_approval')}.`
        : 'Task updated successfully';

      res.json({
        success: true,
        message,
        data: updatedTask
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update task',
        error: error.message
      });
    }
  }

  static async reviewTask(req, res) {
    try {
      const { id } = req.params;
      const { action, notes } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be approve or reject',
        });
      }

      let taskId = parseInt(id, 10);
      let task = await Task.findById(taskId);
      if (!task) {
        task = await Task.findByTaskId(id);
        if (!task) {
          return res.status(404).json({ success: false, message: 'Task not found' });
        }
        taskId = task.dbId;
      } else {
        taskId = task.dbId;
      }

      const approvalContext = await resolveTaskApprovalContext(req.staffId, task.projectId);
      if (!canReviewTaskAtStage(approvalContext, task)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to review this task at the current approval step',
        });
      }

      const updates = buildApprovalUpdate(task, approvalContext, {
        action,
        notes,
        staffId: req.staffId,
      });

      const updated = await Task.update(taskId, updates);

      if (!updated) {
        return res.status(400).json({ success: false, message: 'Failed to review task' });
      }

      const updatedTask = await Task.findById(taskId);
      let message = action === 'approve' ? 'Task approved successfully' : 'Task rejected and sent back for rework';
      if (action === 'approve' && updatedTask.approvalStatus === 'pending_approval') {
        message = 'Approved at this step. Waiting for the next approver in the chain.';
      } else if (action === 'approve' && updatedTask.approvalStatus === 'approved') {
        message = 'Task fully approved and ended.';
      }

      res.json({
        success: true,
        message,
        data: updatedTask,
      });
    } catch (error) {
      console.error('Review task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to review task',
        error: error.message,
      });
    }
  }

  // Delete task
  static async deleteTask(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Task ID is required'
        });
      }

      let taskId = parseInt(id);
      let task = await Task.findById(taskId);
      if (!task) {
        task = await Task.findByTaskId(id);
        if (!task) {
          return res.status(404).json({
            success: false,
            message: 'Task not found'
          });
        }
        taskId = task.dbId;
      } else {
        taskId = task.dbId;
      }

      await Task.delete(taskId);

      res.json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete task',
        error: error.message
      });
    }
  }

  // Get task statistics
  static async getTaskStats(req, res) {
    try {
      const { projectId } = req.query;
      
      const stats = await Task.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get task stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch task statistics',
        error: error.message
      });
    }
  }
}

