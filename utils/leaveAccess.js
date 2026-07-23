import Staff from '../models/Staff.js';
import { isElevatedProjectTeamCreator, isProjectManagerPortalStaff } from './projectTeam.js';

function normalizeRole(staff) {
  return (staff?.role || '').toLowerCase().replace(/\s+/g, '_');
}

function normalizePortal(staff) {
  return String(staff?.controlPanel || staff?.roleControlPanel || '')
    .toLowerCase()
    .replace(/_/g, '-');
}

function normalizeDepartment(staff) {
  return {
    name: String(staff?.departmentName || staff?.department || '').toLowerCase(),
    code: String(staff?.departmentCode || '').toLowerCase(),
  };
}

/** SuperAdmin / Admin — org-wide leave authority */
export function isLeaveAdmin(staff) {
  const role = normalizeRole(staff);
  return ['superadmin', 'admin', 'administrator', 'system_admin', 'systemadmin'].includes(role);
}

/**
 * HR / Team Skills — org-wide leave authority.
 * Matches role names like HR, HR Manager, portals like team-skills, and HR departments.
 */
export function isLeaveHr(staff) {
  if (!staff) return false;
  const role = normalizeRole(staff);
  const portal = normalizePortal(staff);
  const { name: dept, code } = normalizeDepartment(staff);

  if (role === 'hr' || role === 'hr_manager' || role.startsWith('hr_') || role.endsWith('_hr') || role.includes('_hr_')) {
    return true;
  }
  if (role.includes('human_resource')) return true;
  if (portal === 'team-skills' || portal.includes('team-skill')) return true;
  if (code.startsWith('hr') || code.includes('hr-')) return true;
  if (dept.includes('human resource') || dept.includes('human resources')) return true;
  if (/\bhr\b/.test(dept)) return true;
  return false;
}

/**
 * Person in charge of leave approvals:
 * admin, HR, department directors (scoped), project managers, team leads, elevated creators.
 */
export function isLeaveManager(staff) {
  if (!staff) return false;
  if (isLeaveAdmin(staff) || isLeaveHr(staff)) return true;
  if (isElevatedProjectTeamCreator(staff) || isProjectManagerPortalStaff(staff)) return true;

  const role = normalizeRole(staff);
  const portal = normalizePortal(staff);

  if (
    portal === 'project-manager' ||
    portal === 'department-director' ||
    portal === 'team-skills' ||
    portal.includes('project-manager') ||
    portal.includes('department-director')
  ) {
    return true;
  }

  return (
    [
      'manager',
      'project_manager',
      'department_director',
      'departmentdirector',
      'team_lead',
      'teamlead',
      'team_skills',
      'teamskills',
      'head_of_department',
      'headofdepartment',
    ].includes(role) ||
    role.includes('director') ||
    role.includes('manager') ||
    role.includes('team_lead') ||
    role.endsWith('_lead')
  );
}

/** Department directors only approve leave for their own department */
export function isDepartmentScopedLeaveManager(staff) {
  if (!staff) return false;
  if (isLeaveAdmin(staff) || isLeaveHr(staff)) return false;

  const role = normalizeRole(staff);
  const portal = normalizePortal(staff);
  return (
    role === 'department_director' ||
    role === 'departmentdirector' ||
    role.includes('department_director') ||
    role === 'head_of_department' ||
    portal === 'department-director' ||
    portal.includes('department-director')
  );
}

export async function buildLeaveRequestFilters(req) {
  const filters = {};
  const { query } = req;

  if (query.staffId) filters.staffId = parseInt(query.staffId, 10);
  if (query.leaveType) filters.leaveType = query.leaveType;
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

  if (isLeaveManager(staff)) {
    if (isDepartmentScopedLeaveManager(staff) && staff.departmentId) {
      filters.departmentId = staff.departmentId;
    }
    return { filters, staff };
  }

  filters.staffEmail = staff.email;
  return { filters, staff };
}

export async function canAccessLeaveRequest(staffId, leaveRequest) {
  if (!staffId || !leaveRequest) return false;

  const staff = await Staff.findById(staffId);
  if (!staff) return false;

  if (isLeaveAdmin(staff) || isLeaveHr(staff)) return true;

  if (isLeaveManager(staff)) {
    if (isDepartmentScopedLeaveManager(staff) && staff.departmentId) {
      return leaveRequest.departmentId === staff.departmentId;
    }
    return true;
  }

  return leaveRequest.staffId === parseInt(staffId, 10);
}

export async function canManageLeaveRequest(staffId, leaveRequest) {
  if (!staffId || !leaveRequest) return false;
  if (leaveRequest.status !== 'pending') return false;

  const staff = await Staff.findById(staffId);
  if (!staff || !isLeaveManager(staff)) return false;

  if (isDepartmentScopedLeaveManager(staff) && staff.departmentId) {
    return leaveRequest.departmentId === staff.departmentId;
  }

  return true;
}

export async function canModifyOwnLeaveRequest(staffId, leaveRequest) {
  if (!staffId || !leaveRequest) return false;
  return leaveRequest.staffId === parseInt(staffId, 10);
}
