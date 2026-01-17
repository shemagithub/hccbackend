import Project from '../models/Project.js';
import Staff from '../models/Staff.js';
import Implementation from '../models/Implementation.js';

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
        location,
        assignedTo
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
        location,
        assignedTo
      });

      // If project status is "ongoing" (approved), automatically create an implementation
      if (status === 'ongoing' && project.dbId) {
        try {
          // Check if implementation already exists for this project
          const existingImplementation = await Implementation.findAll({ projectId: project.dbId });
          if (existingImplementation.length === 0) {
            await Implementation.create({
              projectId: project.dbId,
              title: name,
              client: client,
              description: description || null,
              startDate: startDate,
              endDate: endDate,
              status: 'planning',
              progress: progress || 0,
              budget: budget || 0,
              spent: spent || 0,
              assignedTo: assignedTo || null,
              teamSize: teamSize || 0,
              priority: priority || 'medium',
              createdBy: req.staffId || null
            });
            console.log(`✅ Auto-created implementation for approved project: ${project.name}`);
          }
        } catch (implError) {
          console.error('Error auto-creating implementation:', implError);
          // Don't fail the project creation if implementation creation fails
        }
      }

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
        limit = 10,
        includeAll = false
      } = req.query;

      // Get the logged-in user's email from staff ID
      // Only filter by user if includeAll is not true
      // SuperAdmin users always get all projects regardless of includeAll flag
      let userEmail = null;
      let isSuperAdmin = false;
      
      // Check includeAll - it comes as a string from query params
      const shouldIncludeAll = includeAll === 'true' || includeAll === true || includeAll === '1';
      
      if (req.staffId) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            // Check if user is SuperAdmin or Finance - always give full access
            const userRole = staff.role?.toLowerCase() || '';
            if (userRole === 'superadmin' || userRole === 'finance') {
              isSuperAdmin = true;
              userEmail = null; // SuperAdmin and Finance get all projects
              console.log(`📋 getProjects - ${staff.role} user detected, granting full access`);
            } else if (!shouldIncludeAll && staff.email) {
              // Regular users: filter by their email unless includeAll is true
              userEmail = staff.email;
              console.log(`📋 getProjects - Filtering by user email: ${userEmail}`);
            }
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
          // Continue without filtering if staff lookup fails
        }
      }
      
      console.log('📋 getProjects - includeAll:', includeAll, 'shouldIncludeAll:', shouldIncludeAll, 'isSuperAdmin:', isSuperAdmin, 'userEmail:', userEmail);

      const filters = {
        search,
        status,
        priority,
        client,
        department,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        manager,
        userEmail, // Filter by assigned user (null for SuperAdmin or when includeAll is true)
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
      const oldStatus = project.status;
      const success = await Project.update(dbId, updateData);

      if (success) {
        const updatedProject = await Project.findById(dbId);
        
        // If project status changed to "ongoing" (approved), automatically create an implementation
        if (updateData.status === 'ongoing' && oldStatus !== 'ongoing' && updatedProject.dbId) {
          try {
            // Check if implementation already exists for this project
            const existingImplementation = await Implementation.findAll({ projectId: updatedProject.dbId });
            if (existingImplementation.length === 0) {
              await Implementation.create({
                projectId: updatedProject.dbId,
                title: updatedProject.name,
                client: updatedProject.client,
                description: updatedProject.description || null,
                startDate: updatedProject.startDate,
                endDate: updatedProject.endDate,
                status: 'planning',
                progress: updatedProject.progress || 0,
                budget: updatedProject.budget || 0,
                spent: updatedProject.spent || 0,
                assignedTo: updatedProject.assignedTo || null,
                teamSize: updatedProject.teamSize || 0,
                priority: updatedProject.priority || 'medium',
                createdBy: req.staffId || null
              });
              console.log(`✅ Auto-created implementation for approved project: ${updatedProject.name}`);
            }
          } catch (implError) {
            console.error('Error auto-creating implementation:', implError);
            // Don't fail the project update if implementation creation fails
          }
        }
        
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

