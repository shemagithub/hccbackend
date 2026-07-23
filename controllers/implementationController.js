import Implementation from '../models/Implementation.js';
import Staff from '../models/Staff.js';
import { syncProjectTeam } from '../utils/projectTeam.js';
import { startImplementationWorkflow } from '../utils/bootstrapProjectManagement.js';
import { isSuperAdminRole } from '../utils/rolePermissions.js';

export class ImplementationController {
  // Create a new implementation
  static async createImplementation(req, res) {
    try {
      const {
        projectId,
        title,
        client,
        description,
        startDate,
        endDate,
        status = 'in_progress',
        progress = 0,
        budget = 0,
        spent = 0,
        assignedTo,
        teamSize = 0,
        priority = 'medium',
        team,
      } = req.body;

      // Validation
      if (!title || !client || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Title, client, start date, and end date are required'
        });
      }

      if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      const implementation = await Implementation.create({
        projectId: projectId || null,
        title,
        client,
        description: description || null,
        startDate,
        endDate,
        status,
        progress: parseInt(progress) || 0,
        budget: parseFloat(budget) || 0,
        spent: parseFloat(spent) || 0,
        assignedTo: assignedTo || null,
        teamSize: parseInt(teamSize) || 0,
        priority,
        createdBy: req.staffId || null
      });

      let result = implementation;
      if (!implementation.projectId && implementation.dbId) {
        const linked = await Implementation.ensureLinkedProject(implementation.dbId);
        result = linked.implementation;
      }

      if (Array.isArray(team) && team.length > 0 && result?.projectId) {
        await syncProjectTeam(result.projectId, team, {
          startDate,
          endDate,
          createdBy: req.staffId || null,
        });
        result = await Implementation.findById(result.dbId);
      }

      if (result?.projectId) {
        await startImplementationWorkflow(result.projectId, {
          staffId: req.staffId || null,
          startDate,
          endDate,
        });
        result = await Implementation.findById(result.dbId);
      }

      res.status(201).json({
        success: true,
        message: 'Implementation started. Initiation and planning are complete; execution is in progress.',
        data: result
      });
    } catch (error) {
      console.error('Create implementation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create implementation',
        error: error.message
      });
    }
  }

  // Get all implementations
  static async getImplementations(req, res) {
    try {
      const {
        status,
        priority,
        client,
        projectId,
        department,
        departmentId,
        page = 1,
        limit = 50,
        includeAll = false
      } = req.query;

      // Get the logged-in user's email from staff ID
      // Only filter by user if includeAll is not true
      // SuperAdmin users always get all implementations regardless of includeAll flag
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
            if (isSuperAdminRole(staff.role) || userRole === 'finance' || userRole === 'admin' || userRole === 'administrator') {
              isSuperAdmin = true;
              userEmail = null; // SuperAdmin and Finance get all implementations
              console.log(`📋 getImplementations - ${staff.role} user detected, granting full access`);
            } else if (!shouldIncludeAll && staff.email) {
              // Regular users: filter by their email unless includeAll is true
              userEmail = staff.email;
              console.log(`📋 getImplementations - Filtering by user email: ${userEmail}`);
            }
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
          // Continue without filtering if staff lookup fails
        }
      }
      
      console.log('📋 getImplementations - includeAll:', includeAll, 'shouldIncludeAll:', shouldIncludeAll, 'isSuperAdmin:', isSuperAdmin, 'userEmail:', userEmail);

      const filters = {
        status,
        priority,
        client,
        projectId: projectId ? parseInt(projectId) : undefined,
        department,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        userEmail, // Filter by assigned user (null for SuperAdmin or when includeAll is true)
        requireLinkedProject: !isSuperAdmin,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const implementations = await Implementation.findAll(filters);
      const stats = await Implementation.getStats();

      res.json({
        success: true,
        data: implementations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats
      });
    } catch (error) {
      console.error('Get implementations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch implementations',
        error: error.message
      });
    }
  }

  // Get implementation by ID
  static async getImplementationById(req, res) {
    try {
      const { id } = req.params;
      
      const implementation = await Implementation.findById(parseInt(id)) || 
                             await Implementation.findByImplementationId(id);

      if (!implementation) {
        return res.status(404).json({
          success: false,
          message: 'Implementation not found'
        });
      }

      res.json({
        success: true,
        data: implementation
      });
    } catch (error) {
      console.error('Get implementation by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch implementation',
        error: error.message
      });
    }
  }

  // Update implementation
  static async updateImplementation(req, res) {
    try {
      const { id } = req.params;
      const { team, ...updateData } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Implementation ID is required'
        });
      }

      const implementation = await Implementation.findById(parseInt(id)) || 
                             await Implementation.findByImplementationId(id);

      if (!implementation) {
        return res.status(404).json({
          success: false,
          message: 'Implementation not found'
        });
      }

      const dbId = implementation.dbId || parseInt(id);
      const updated = await Implementation.update(dbId, updateData);

      if (updated) {
        if (Array.isArray(team) && updated.projectId) {
          await syncProjectTeam(updated.projectId, team, {
            startDate: updateData.startDate || updated.startDate,
            endDate: updateData.endDate || updated.endDate,
            createdBy: req.staffId || null,
          });
        }

        const refreshed = await Implementation.findById(dbId);
        const projectId = refreshed?.projectId || updated.projectId;
        const wasNotInExecution = implementation.status !== 'in_progress';
        const isNowInExecution = (refreshed?.status || updateData.status) === 'in_progress';

        if (projectId && wasNotInExecution && isNowInExecution) {
          await startImplementationWorkflow(projectId, {
            staffId: req.staffId || null,
            startDate: updateData.startDate || refreshed?.startDate || updated.startDate,
            endDate: updateData.endDate || refreshed?.endDate || updated.endDate,
          });
        }

        const finalRecord = projectId ? await Implementation.findById(dbId) : refreshed;
        res.json({
          success: true,
          message: wasNotInExecution && isNowInExecution
            ? 'Implementation updated. Initiation and planning are complete; execution is in progress.'
            : 'Implementation updated successfully',
          data: finalRecord || refreshed || updated
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update implementation'
        });
      }
    } catch (error) {
      console.error('Update implementation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update implementation',
        error: error.message
      });
    }
  }

  // Delete implementation
  static async deleteImplementation(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Implementation ID is required'
        });
      }

      const implementation = await Implementation.findById(parseInt(id)) || 
                             await Implementation.findByImplementationId(id);

      if (!implementation) {
        return res.status(404).json({
          success: false,
          message: 'Implementation not found'
        });
      }

      const dbId = implementation.dbId || parseInt(id);
      const success = await Implementation.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Implementation deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete implementation'
        });
      }
    } catch (error) {
      console.error('Delete implementation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete implementation',
        error: error.message
      });
    }
  }

  static async startWorkflowForProject(req, res) {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (!projectId) {
        return res.status(400).json({ success: false, message: 'Valid project ID is required' });
      }

      const result = await startImplementationWorkflow(projectId, {
        staffId: req.staffId || null,
      });

      if (!result.started) {
        return res.status(400).json({
          success: false,
          message: result.reason === 'project_not_found' ? 'Project not found' : 'Could not start workflow',
        });
      }

      res.json({
        success: true,
        message: 'Implementation workflow initialized. Initiation and planning are complete; execution is in progress.',
        data: result,
      });
    } catch (error) {
      console.error('Start workflow error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to start implementation workflow',
      });
    }
  }

  static async getWorkspace(req, res) {
    try {
      const { id } = req.params;
      const implementation = await Implementation.findById(parseInt(id, 10)) ||
        await Implementation.findByImplementationId(id);

      if (!implementation?.dbId) {
        return res.status(404).json({ success: false, message: 'Implementation not found' });
      }

      const workspace = await Implementation.getWorkspace(implementation.dbId);
      res.json({ success: true, data: workspace });
    } catch (error) {
      console.error('Get implementation workspace error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load implementation workspace',
        error: error.message,
      });
    }
  }

  static async getWorkspaceByProject(req, res) {
    try {
      const { projectId } = req.params;
      const workspace = await Implementation.getWorkspaceByProject(projectId);
      res.json({ success: true, data: workspace });
    } catch (error) {
      console.error('Get workspace by project error:', error);
      const status = error.message === 'Project not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message === 'Project not found'
          ? 'Project not found'
          : 'Failed to load project workspace',
        error: error.message,
      });
    }
  }

  static async ensureProject(req, res) {
    try {
      const { id } = req.params;
      const implementation = await Implementation.findById(parseInt(id, 10)) ||
        await Implementation.findByImplementationId(id);

      if (!implementation?.dbId) {
        return res.status(404).json({ success: false, message: 'Implementation not found' });
      }

      const linked = await Implementation.ensureLinkedProject(implementation.dbId);
      res.json({
        success: true,
        message: 'Project linked successfully',
        data: linked,
      });
    } catch (error) {
      console.error('Ensure implementation project error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to link project',
        error: error.message,
      });
    }
  }
}

