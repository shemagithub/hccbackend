import Project from '../models/Project.js';
import ProjectAssignment from '../models/ProjectAssignment.js';
import Task from '../models/Task.js';
import Deliverable from '../models/Deliverable.js';
import Staff from '../models/Staff.js';
import {
  formatProjectRole,
  assignStaffToProject,
  assignMultipleStaffToProject,
  getStaffWorkspaceProjects,
  resolveManagerPortalProjects,
  isProjectManagerPortalStaff,
  resolveCreatorContext,
  canCreatorAssignRole,
  mapProjectRoleToSystemRole,
  mapProjectRoleToDefaultPosition,
  mapProjectRoleToControlPanel,
  applyStaffPortalForProjectRole,
  getProjectTeamResources,
  userHasProjectAccess,
  getProjectAssignments,
  isElevatedProjectTeamCreator,
} from '../utils/projectTeam.js';

function generateTemporaryPassword() {
  const suffix = Math.random().toString(36).slice(-6);
  return `Hcc${suffix}9A`;
}


export class ProjectTeamController {
  static async getPermissions(req, res) {
    try {
      if (!req.staffId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const projectId = req.query.projectId ? parseInt(req.query.projectId, 10) : null;
      const context = await resolveCreatorContext(req.staffId, projectId);

      res.json({
        success: true,
        data: {
          ...context,
          canManage: context.isElevated || ['project_manager', 'team_lead'].includes(context.creatorRole),
          canContribute:
            context.isElevated ||
            ['project_manager', 'team_lead', 'contributor'].includes(context.creatorRole),
          isViewer: context.creatorRole === 'viewer',
        },
      });
    } catch (error) {
      console.error('Get project team permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load project team permissions',
        error: error.message,
      });
    }
  }

  static async getProjectResources(req, res) {
    try {
      if (!req.staffId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const projectId = parseInt(req.params.projectId, 10);
      if (!projectId || Number.isNaN(projectId)) {
        return res.status(400).json({ success: false, message: 'Valid project ID is required' });
      }

      const staff = await Staff.findById(req.staffId);
      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      const assignments = await getProjectAssignments(project.dbId);
      const isElevated = isElevatedProjectTeamCreator(staff);
      const hasAccess = isElevated || (await userHasProjectAccess({ project, staff, assignments }));

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this project team',
        });
      }

      const resources = await getProjectTeamResources(project.dbId);

      res.json({
        success: true,
        data: resources,
      });
    } catch (error) {
      console.error('Get project team resources error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load project team resources',
        error: error.message,
      });
    }
  }

  static async getWorkspace(req, res) {
    try {
      if (!req.staffId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const staff = await Staff.findById(req.staffId);
      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      const { assignments, projects: workspaceProjects } = await getStaffWorkspaceProjects(staff);
      const projects = isProjectManagerPortalStaff(staff)
        ? await resolveManagerPortalProjects(staff)
        : workspaceProjects;
      const projectIds = projects.map((project) => project.dbId).filter(Boolean);

      let tasks = [];
      let deliverables = [];

      if (projectIds.length > 0) {
        const taskResults = await Promise.all(
          projectIds.map((projectId) =>
            Task.findAll({ projectId, assigneeId: req.staffId, limit: 200 }).catch(() => [])
          )
        );
        tasks = taskResults.flat();

        const deliverableResults = await Promise.all(
          projectIds.map((projectId) =>
            Deliverable.findAll({ projectId, limit: 100 }).catch(() => [])
          )
        );
        deliverables = deliverableResults
          .flat()
          .filter((item) => item.submittedBy === req.staffId);
      }

      const stats = {
        totalProjects: projects.length,
        activeProjects: projects.filter((project) =>
          ['planning', 'ongoing', 'near_completion'].includes(project.status)
        ).length,
        managedProjects: projects.filter((project) => project.canManage).length,
        totalTasks: tasks.length,
        openTasks: tasks.filter((task) => !['completed', 'cancelled'].includes(task.status)).length,
        overdueTasks: tasks.filter((task) => task.status === 'overdue').length,
        myDeliverables: deliverables.length,
        pendingDeliverables: deliverables.filter((item) =>
          ['pending_review', 'under_review', 'draft'].includes(item.status)
        ).length,
      };

      res.json({
        success: true,
        data: {
          staff: {
            id: staff.id,
            firstName: staff.firstName,
            lastName: staff.lastName,
            email: staff.email,
            role: staff.role,
            position: staff.position,
            controlPanel: staff.controlPanel,
          },
          assignments,
          projects,
          tasks,
          deliverables,
          stats,
        },
      });
    } catch (error) {
      console.error('Get project team workspace error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load project team workspace',
        error: error.message,
      });
    }
  }

  static async createTeamMember(req, res) {
    try {
      if (!req.staffId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        password,
        position,
        departmentId,
        projectId,
        projectRole = 'contributor',
        status = 'active',
      } = req.body;

      const projectIdValue = projectId ? parseInt(projectId, 10) : null;
      const creatorContext = await resolveCreatorContext(req.staffId, projectIdValue);

      if (!creatorContext.canCreate) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to create project team users for this project',
        });
      }

      if (!canCreatorAssignRole(creatorContext.creatorRole, projectRole, creatorContext.isElevated)) {
        return res.status(403).json({
          success: false,
          message: `Your role cannot assign the ${formatProjectRole(projectRole)} role`,
        });
      }

      if (!firstName || !lastName || !email) {
        return res.status(400).json({
          success: false,
          message: 'First name, last name, and email are required',
        });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }

      const normalizedEmail = email.trim();
      const existingStaff = await Staff.findByEmail(normalizedEmail);

      if (existingStaff) {
        let assignment = null;

        if (projectIdValue) {
          const project = await Project.findById(projectIdValue);
          if (!project?.dbId) {
            return res.status(404).json({ success: false, message: 'Project not found for assignment' });
          }

          assignment = await assignStaffToProject({
            projectId: project.dbId,
            staffId: existingStaff.id,
            projectRole: projectRole || 'contributor',
            createdBy: req.staffId,
          });
        } else {
          await applyStaffPortalForProjectRole(existingStaff.id, projectRole || 'contributor');
        }

        const staff = await Staff.findById(existingStaff.id);

        return res.status(200).json({
          success: true,
          message: projectIdValue
            ? 'Existing user added to this project team'
            : 'Existing user selected for the project team',
          data: {
            staff,
            assignment,
            projectRole: projectRole || 'contributor',
            existingUser: true,
            temporaryPassword: null,
          },
        });
      }

      const creator = await Staff.findById(req.staffId);
      const resolvedPassword = password || generateTemporaryPassword();

      if (resolvedPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long',
        });
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(resolvedPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        });
      }

      const resolvedDepartmentId = departmentId
        ? parseInt(departmentId, 10)
        : creator?.departmentId || null;

      const staffRecord = await Staff.create({
        firstName,
        lastName,
        email: normalizedEmail,
        phone: phone || null,
        password: resolvedPassword,
        departmentId: resolvedDepartmentId,
        position: position || mapProjectRoleToDefaultPosition(projectRole),
        role: mapProjectRoleToSystemRole(projectRole),
        controlPanel: mapProjectRoleToControlPanel(projectRole),
        status,
        notes: `Created for project team as ${formatProjectRole(projectRole)} by ${creator?.email || 'project management'}`,
      });

      const newStaff = await Staff.findById(staffRecord.id);
      let assignment = null;

      if (projectIdValue) {
        const project = await Project.findById(projectIdValue);
        if (!project) {
          return res.status(404).json({ success: false, message: 'Project not found for assignment' });
        }

        assignment = await assignStaffToProject({
          projectId: project.dbId,
          staffId: staffRecord.id,
          projectRole: projectRole || 'contributor',
          createdBy: req.staffId,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Project team user created successfully',
        data: {
          staff: newStaff,
          assignment,
          projectRole: projectRole || 'contributor',
          temporaryPassword: password ? null : resolvedPassword,
        },
      });
    } catch (error) {
      console.error('Create project team member error:', error);
      const statusCode = error.code === 'ER_DUP_ENTRY' ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.code === 'ER_DUP_ENTRY'
          ? 'Could not assign this user to the project because of a duplicate team record. Please refresh and try again.'
          : (error.message || 'Failed to create project team user'),
        error: error.message,
      });
    }
  }

  static async assignMembers(req, res) {
    try {
      if (!req.staffId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const projectId = parseInt(req.params.projectId, 10);
      if (!projectId || Number.isNaN(projectId)) {
        return res.status(400).json({ success: false, message: 'Valid project ID is required' });
      }

      const { members = [] } = req.body;
      if (!Array.isArray(members) || members.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one team member is required',
        });
      }

      const creatorContext = await resolveCreatorContext(req.staffId, projectId);
      if (!creatorContext.canCreate && !creatorContext.isElevated && !['project_manager', 'team_lead'].includes(creatorContext.creatorRole)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to assign users to this project',
        });
      }

      for (const member of members) {
        const projectRole = member.projectRole || 'contributor';
        if (!canCreatorAssignRole(creatorContext.creatorRole, projectRole, creatorContext.isElevated)) {
          return res.status(403).json({
            success: false,
            message: `Your role cannot assign the ${formatProjectRole(projectRole)} role`,
          });
        }
      }

      const assignments = await assignMultipleStaffToProject({
        projectId,
        members,
        createdBy: req.staffId,
      });

      res.status(200).json({
        success: true,
        message: `${assignments.length} team member${assignments.length === 1 ? '' : 's'} assigned successfully`,
        data: {
          assignments,
          teamSize: assignments.length,
        },
      });
    } catch (error) {
      console.error('Assign project team members error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to assign project team members',
        error: error.message,
      });
    }
  }
}
