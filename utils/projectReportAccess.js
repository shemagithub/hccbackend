import Staff from '../models/Staff.js';
import Project from '../models/Project.js';
import {
  getStaffProjectRole,
  isElevatedProjectTeamCreator,
  isProjectManagerPortalStaff,
} from './projectTeam.js';

function isAdminStaff(staff) {
  const role = staff?.role?.toLowerCase() || '';
  return ['superadmin', 'admin'].includes(role);
}

function isElevatedReportStaff(staff) {
  const role = staff?.role?.toLowerCase() || '';
  return ['superadmin', 'finance', 'admin'].includes(role);
}

export async function canViewAllProjectTeamReports(staffId, projectId) {
  const staff = await Staff.findById(staffId);
  if (!staff) return false;
  if (isElevatedProjectTeamCreator(staff)) return true;
  if (isProjectManagerPortalStaff(staff)) return true;

  const role = await getStaffProjectRole(staffId, projectId);
  return role === 'project_manager' || role === 'team_lead';
}

export async function canAccessProjectForReports(staffId, projectId) {
  const staff = await Staff.findById(staffId);
  if (!staff) {
    return { access: false, viewAll: false };
  }

  if (isAdminStaff(staff) || isElevatedProjectTeamCreator(staff) || isProjectManagerPortalStaff(staff)) {
    return { access: true, viewAll: true };
  }

  if (await canViewAllProjectTeamReports(staffId, projectId)) {
    return { access: true, viewAll: true };
  }

  const role = await getStaffProjectRole(staffId, projectId);
  if (role) {
    return { access: true, viewAll: false };
  }

  const project = await Project.findById(projectId);
  if (project?.assignedTo && staff.email) {
    const assignedEmails = project.assignedTo
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (assignedEmails.includes(staff.email.toLowerCase())) {
      return { access: true, viewAll: false };
    }
  }

  return { access: false, viewAll: false };
}

export async function buildProjectReportFilters(staffId, staff, { projectId, department } = {}) {
  const filters = {};
  if (department) filters.department = department;

  if (projectId) {
    const pid = parseInt(projectId, 10);
    if (!isAdminStaff(staff)) {
      const access = await canAccessProjectForReports(staffId, pid);
      if (!access.access) {
        return {
          error: 'FORBIDDEN',
          message: 'You do not have access to reports for this project.',
        };
      }
    }
    filters.id = pid;
    return { filters };
  }

  if (!isAdminStaff(staff) && staff?.email) {
    filters.userEmail = staff.email;
  }

  return { filters };
}

export async function buildWorkFieldReportFilters(req) {
  const filters = {};
  const { query } = req;

  if (query.staffId) filters.staffId = parseInt(query.staffId, 10);
  if (query.projectId) filters.projectId = parseInt(query.projectId, 10);
  if (query.reportType) filters.reportType = query.reportType;
  if (query.status) filters.status = query.status;
  if (query.startDate) filters.startDate = query.startDate;
  if (query.endDate) filters.endDate = query.endDate;
  if (query.search) filters.search = query.search;
  if (query.limit) filters.limit = parseInt(query.limit, 10);
  if (query.offset) filters.offset = parseInt(query.offset, 10);

  if (!req.staffId) {
    return { filters };
  }

  const staff = await Staff.findById(req.staffId);
  if (!staff) {
    return { filters };
  }

  if (isElevatedReportStaff(staff)) {
    return { filters };
  }

  if (filters.projectId) {
    const access = await canAccessProjectForReports(req.staffId, filters.projectId);
    if (!access.access) {
      return {
        error: 'FORBIDDEN',
        message: 'You do not have access to reports for this project.',
      };
    }
    if (!access.viewAll) {
      filters.staffEmail = staff.email;
    }
  } else {
    filters.staffEmail = staff.email;
  }

  return { filters };
}
