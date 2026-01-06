import Project from '../models/Project.js';

export class ProjectController {
  // Create a new project
  static async createProject(req, res) {
    try {
      const {
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
        location
      } = req.body;

      // Validation
      if (!name || !client || !manager || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, client, manager, startDate, and endDate are required'
        });
      }

      // Validate dates
      if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
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
      if (!['planning', 'ongoing', 'near_completion', 'completed', 'overdue', 'on_hold', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      // Validate priority
      if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid priority value'
        });
      }

      const project = await Project.create({
        projectId,
        name,
        client,
        department,
        manager,
        status,
        startDate,
        endDate,
        progress,
        budget,
        spent,
        teamSize,
        priority,
        description,
        location
      });

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create project',
        error: error.message
      });
    }
  }

  // Get all projects
  static async getProjects(req, res) {
    try {
      const {
        search,
        status,
        priority,
        client,
        department,
        departmentId,
        manager,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        search,
        status,
        priority,
        client,
        department,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        manager,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const projects = await Project.findAll(filters);
      const stats = await Project.getStats(filters);

      res.json({
        success: true,
        data: projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          totalBudget: parseFloat(stats.totalBudget || 0),
          totalSpent: parseFloat(stats.totalSpent || 0),
          planning: stats.planning,
          ongoing: stats.ongoing,
          nearCompletion: stats.nearCompletion,
          completed: stats.completed,
          overdue: stats.overdue,
          onHold: stats.onHold
        }
      });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch projects',
        error: error.message
      });
    }
  }

  // Get project by ID
  static async getProjectById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }

      let project = await Project.findById(parseInt(id));
      if (!project) {
        project = await Project.findByProjectId(id);
      }
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Get project by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch project',
        error: error.message
      });
    }
  }

  // Update project
  static async updateProject(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }

      let project = await Project.findById(parseInt(id));
      if (!project) {
        project = await Project.findByProjectId(id);
      }

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      // Validate progress if provided
      if (updateData.progress !== undefined && (updateData.progress < 0 || updateData.progress > 100)) {
        return res.status(400).json({
          success: false,
          message: 'Progress must be between 0 and 100'
        });
      }

      const dbId = project.dbId || parseInt(id);
      const success = await Project.update(dbId, updateData);

      if (success) {
        const updatedProject = await Project.findById(dbId);
        res.json({
          success: true,
          message: 'Project updated successfully',
          data: updatedProject
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update project'
        });
      }
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update project',
        error: error.message
      });
    }
  }

  // Delete project
  static async deleteProject(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }

      let project = await Project.findById(parseInt(id));
      if (!project) {
        project = await Project.findByProjectId(id);
      }
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      const dbId = project.dbId || parseInt(id);
      const success = await Project.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Project deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete project'
        });
      }
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete project',
        error: error.message
      });
    }
  }

  // Get project statistics
  static async getProjectStats(req, res) {
    try {
      const stats = await Project.getStats();
      
      res.json({
        success: true,
        data: {
          total: stats.total,
          totalBudget: parseFloat(stats.totalBudget || 0),
          totalSpent: parseFloat(stats.totalSpent || 0),
          planning: stats.planning,
          ongoing: stats.ongoing,
          nearCompletion: stats.nearCompletion,
          completed: stats.completed,
          overdue: stats.overdue,
          onHold: stats.onHold
        }
      });
    } catch (error) {
      console.error('Get project stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch project statistics',
        error: error.message
      });
    }
  }
}

