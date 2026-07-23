import Project from '../models/Project.js';
import Implementation from '../models/Implementation.js';
import ProjectAssignment from '../models/ProjectAssignment.js';
import Staff from '../models/Staff.js';

export const PROJECT_TEAM_ROLES = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'viewer', label: 'Viewer' },
];

export function formatProjectRole(role) {
  const match = PROJECT_TEAM_ROLES.find((item) => item.value === role);
  return match?.label || role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Contributor';
}

export function isElevatedProjectTeamCreator(staff) {
  const role = staff?.role?.toLowerCase() || '';
  const panel = (staff?.controlPanel || '').toLowerCase().replace(/_/g, '-');
  if (panel === 'project-manager') return true;
  return (
    ['superadmin', 'finance', 'admin', 'administrator', 'department director'].includes(role) ||
    role === 'project manager' ||
    role === 'projectmanager' ||
    role === 'project_manager' ||
    role.includes('manager')
  );
}

export function isProjectManagerPortalStaff(staff) {
  const panel = (staff?.controlPanel || '').toLowerCase().replace(/_/g, '-');
  if (panel === 'project-manager') return true;
  const role = staff?.role?.toLowerCase() || '';
  return ['project manager', 'projectmanager', 'project_manager'].includes(role);
}

export function canApproveProjectTasks(role, { isPmPortal = false, isElevated = false } = {}) {
  if (isPmPortal || isElevated) return true;
  return role === 'project_manager';
}

export function canApproveProjectDeliverables(role, { isPmPortal = false, isElevated = false } = {}) {
  if (isPmPortal || isElevated) return true;
  return role === 'project_manager';
}

export function canManageProjectRole(role) {
  return role === 'project_manager' || role === 'team_lead';
}

export function isViewerProjectRole(role) {
  return role === 'viewer';
}

export function isViewerPortalStaff(staff) {
  const panel = normalizeControlPanel(staff?.controlPanel);
  return panel === 'viewer';
}

export function canCommentOnProjectRisks(role, { isViewerPortal = false } = {}) {
  if (isViewerPortal) return true;
  const normalized = normalizeProjectRole(role);
  if (normalized === 'viewer') return true;
  return ['project_manager', 'team_lead', 'contributor', 'viewer'].includes(normalized || '');
}

export function canCreateProjectDeliverables(role, { isViewerPortal = false } = {}) {
  if (isViewerPortal || role === 'viewer') return false;
  return ['project_manager', 'team_lead', 'contributor'].includes(role);
}

export function canRequestProjectExpenses(role, { isViewerPortal = false } = {}) {
  if (isViewerPortal || role === 'viewer') return false;
  return ['project_manager', 'team_lead', 'contributor'].includes(role);
}

export function normalizeProjectRole(role) {
  if (!role) return null;
  const normalized = String(role).toLowerCase().trim().replace(/\s+/g, '_');
  const map = {
    teamlead: 'team_lead',
    team_lead: 'team_lead',
    projectmanager: 'project_manager',
    project_manager: 'project_manager',
    project_lead: 'team_lead',
  };
  if (map[normalized]) return map[normalized];
  if (['project_manager', 'team_lead', 'contributor', 'viewer'].includes(normalized)) {
    return normalized;
  }
  if (normalized.includes('team') && normalized.includes('lead')) return 'team_lead';
  if (normalized.includes('project') && normalized.includes('manager')) return 'project_manager';
  return normalized;
}

export function canEvaluateProjectRisks(role, { isPmPortal = false, isElevated = false, isSuperAdmin = false } = {}) {
  if (isPmPortal || isElevated || isSuperAdmin) return true;
  return role === 'project_manager';
}

/** Assigned team members (not viewers) can log risks/issues on the project. */
export function canCreateProjectRisks(role, { isViewerPortal = false, isElevated = false, isPmPortal = false } = {}) {
  if (isElevated || isPmPortal) return true;
  if (isViewerPortal || role === 'viewer') return false;
  const normalized = normalizeProjectRole(role);
  return ['project_manager', 'team_lead', 'contributor'].includes(normalized || '');
}

/** Contributors and team leads can update progress and submit completed work for approval. */
export function canWorkOnProjectTasks(role, { isViewerPortal = false, isElevated = false } = {}) {
  if (isElevated) return true;
  if (isViewerPortal || role === 'viewer') return false;
  return ['project_manager', 'team_lead', 'contributor'].includes(role);
}

export function isTaskAssignee(task, staffId) {
  if (!task || !staffId) return false;
  const id = parseInt(staffId, 10);
  if (!id || Number.isNaN(id)) return false;
  if (task.assigneeId === id || task.assignee_id === id) return true;
  const ids = task.assigneeIds || task.assignee_ids;
  if (Array.isArray(ids) && ids.some((value) => parseInt(value, 10) === id)) return true;
  return false;
}

export async function resolveStaffProjectPermissions(staffId, projectId = null) {
  const staff = staffId ? await Staff.findById(staffId) : null;
  const isViewerPortal = isViewerPortalStaff(staff);
  const isPmPortal = isProjectManagerPortalStaff(staff);
  const isElevated = staff ? isElevatedProjectTeamCreator(staff) : false;
  const isSuperAdmin = (staff?.role || '').toLowerCase().replace(/\s+/g, '') === 'superadmin';
  const projectRole = projectId ? await resolveEffectiveProjectRole(staffId, projectId) : null;
  const effectiveRole = projectRole || (isViewerPortal ? 'viewer' : null);

  return {
    staff,
    projectRole: effectiveRole,
    isViewer: isViewerProjectRole(effectiveRole) || isViewerPortal,
    isViewerPortal,
    isPmPortal,
    isElevated,
    canCommentOnRisks: canCommentOnProjectRisks(effectiveRole, { isViewerPortal }),
    canCreateRisks: canCreateProjectRisks(effectiveRole, { isViewerPortal, isElevated, isPmPortal }),
    canEvaluateRisks: canEvaluateProjectRisks(effectiveRole, { isPmPortal, isElevated, isSuperAdmin }),
    canCreateDeliverables: canCreateProjectDeliverables(effectiveRole, { isViewerPortal }),
    canRequestExpenses: canRequestProjectExpenses(effectiveRole, { isViewerPortal }),
  };
}

export function getAssignableRolesForCreator(creatorRole, isElevated = false) {
  if (isElevated) {
    return PROJECT_TEAM_ROLES.map((item) => item.value);
  }

  switch (creatorRole) {
    case 'project_manager':
      return ['team_lead', 'contributor', 'viewer'];
    case 'team_lead':
      return ['contributor', 'viewer'];
    default:
      return [];
  }
}

export function canCreateTeamMembers(creatorRole, isElevated = false) {
  return isElevated || canManageProjectRole(creatorRole);
}

export function canCreatorAssignRole(creatorRole, targetRole, isElevated = false) {
  return getAssignableRolesForCreator(creatorRole, isElevated).includes(targetRole);
}

export function mapProjectRoleToSystemRole(projectRole) {
  switch (projectRole) {
    case 'project_manager':
      return 'Project Manager';
    case 'team_lead':
      return 'Team Lead';
    default:
      return 'Employee';
  }
}

export function mapProjectRoleToDefaultPosition(projectRole) {
  switch (projectRole) {
    case 'project_manager':
      return 'Project Manager';
    case 'team_lead':
      return 'Team Lead';
    case 'contributor':
      return 'Project Contributor';
    case 'viewer':
      return 'Project Viewer';
    default:
      return 'Project Team Member';
  }
}

export function mapProjectRoleToControlPanel(projectRole) {
  switch (projectRole) {
    case 'project_manager':
      return 'project-manager';
    case 'contributor':
      return 'contributor';
    case 'viewer':
      return 'viewer';
    default:
      return 'project-team';
  }
}

function normalizeControlPanel(panel) {
  return String(panel || '').toLowerCase().replace(/_/g, '-').trim();
}

/** Apply the correct portal when a user is assigned a project team role. */
export async function applyStaffPortalForProjectRole(staffId, projectRole) {
  if (!staffId || !projectRole) return;

  const staff = await Staff.findById(staffId);
  if (!staff) return;

  const currentPanel = normalizeControlPanel(staff.controlPanel);

  if (projectRole === 'project_manager') {
    const updates = {};
    const canAssignPmPanel =
      !currentPanel ||
      ['project-team', 'project-manager', 'contributor', 'viewer'].includes(currentPanel);

    if (canAssignPmPanel) {
      updates.controlPanel = 'project-manager';
    }

    const roleNorm = (staff.role || '').toLowerCase().trim();
    const isAlreadyPmRole = ['project manager', 'projectmanager', 'project_manager'].includes(roleNorm);
    const isProtectedRole = ['superadmin', 'admin', 'administrator'].includes(roleNorm.replace(/\s+/g, ''));

    if (!isAlreadyPmRole && !isProtectedRole) {
      updates.role = 'Project Manager';
    }

    if (Object.keys(updates).length > 0) {
      await Staff.update(staffId, updates);
    }
    return;
  }

  if (projectRole === 'contributor') {
    const updates = {};
    const canAssignContributorPanel =
      !currentPanel || ['project-team', 'contributor', 'viewer'].includes(currentPanel);

    if (canAssignContributorPanel) {
      updates.controlPanel = 'contributor';
    }

    if (Object.keys(updates).length > 0) {
      await Staff.update(staffId, updates);
    }
    return;
  }

  if (projectRole === 'viewer') {
    const updates = {};
    const canAssignViewerPanel =
      !currentPanel || ['project-team', 'contributor', 'viewer'].includes(currentPanel);

    if (canAssignViewerPanel) {
      updates.controlPanel = 'viewer';
    }

    if (Object.keys(updates).length > 0) {
      await Staff.update(staffId, updates);
    }
    return;
  }

  if (projectRole === 'team_lead') {
    if (!currentPanel || ['contributor', 'viewer'].includes(currentPanel)) {
      if (currentPanel !== 'project-manager') {
        await Staff.update(staffId, { controlPanel: 'project-team' });
      }
    }
    return;
  }
}

export async function getStaffProjectRole(staffId, projectId) {
  return resolveEffectiveProjectRole(staffId, projectId);
}

export async function resolveEffectiveProjectRole(staffId, projectId, project = null) {
  if (!staffId || !projectId) return null;

  const staff = await Staff.findById(staffId);
  if (!staff) return null;

  if (isElevatedProjectTeamCreator(staff) || isProjectManagerPortalStaff(staff)) {
    return 'project_manager';
  }

  if (isViewerPortalStaff(staff)) {
    return 'viewer';
  }

  const assignments = await getProjectAssignments(projectId);
  const staffIdNum = parseInt(staffId, 10);
  const email = staff.email?.toLowerCase();
  const byAssignment = assignments.find(
    (assignment) =>
      ['active', 'pending'].includes(assignment.status) &&
      (parseInt(assignment.staffId, 10) === staffIdNum ||
        assignment.staffEmail?.toLowerCase() === email)
  );

  if (byAssignment?.role) {
    return normalizeProjectRole(byAssignment.role);
  }

  const projectRecord = project || (await Project.findById(projectId));
  if (!projectRecord) return null;

  const managerName = getStaffDisplayName(staff);
  if (managerName && projectRecord.manager?.trim() === managerName) {
    return 'project_manager';
  }

  const assignedEmails = parseAssignedToEmails(projectRecord.assignedTo).map((item) => item.toLowerCase());
  if (email && assignedEmails.includes(email)) {
    const systemRole = staff.role?.toLowerCase() || '';
    if (systemRole.includes('team') && systemRole.includes('lead')) return 'team_lead';
    return 'contributor';
  }

  return null;
}

export async function resolveCreatorContext(staffId, projectId = null) {
  const staff = await Staff.findById(staffId);
  if (!staff) {
    return {
      creatorRole: null,
      isElevated: false,
      canCreate: false,
      assignableRoles: [],
    };
  }

  const isElevated = isElevatedProjectTeamCreator(staff);
  if (isElevated) {
    return {
      creatorRole: 'project_manager',
      isElevated: true,
      canCreate: true,
      assignableRoles: getAssignableRolesForCreator(null, true),
    };
  }

  let creatorRole = null;
  if (projectId) {
    creatorRole = await getStaffProjectRole(staffId, projectId);
  } else {
    const assignments = await ProjectAssignment.findAll({ staffId, limit: 200 });
    const managingAssignment = assignments.find(
      (assignment) =>
        ['active', 'pending'].includes(assignment.status) &&
        canManageProjectRole(assignment.role)
    );
    creatorRole = managingAssignment?.role || null;
  }

  return {
    creatorRole,
    isElevated: false,
    canCreate: canCreateTeamMembers(creatorRole, false),
    assignableRoles: getAssignableRolesForCreator(creatorRole, false),
  };
}

export function getRoleCapabilities(role) {
  const map = {
    project_manager: [
      'Manage the full implementation project',
      'Add tasks, expenses, risks, and deliverables',
      'Assign and review team work',
      'Track budget and project progress',
    ],
    team_lead: [
      'Manage and assign project tasks',
      'Review deliverables and work reports',
      'Track team progress on the project',
      'Coordinate implementation activities',
    ],
    contributor: [
      'Complete assigned tasks',
      'Submit deliverables and work reports',
      'Update progress on your work',
      'Collaborate on implementation activities',
    ],
    viewer: [
      'View project progress and timeline',
      'Access contracts and download documents',
      'Comment on risks and issues',
      'Export project reports',
      'Monitor implementation status',
    ],
  };
  return map[role] || map.contributor;
}

function enrichWorkspaceProject(project, assignment, fallbackRole = null) {
  const role = assignment?.role || fallbackRole || 'contributor';
  return {
    ...project,
    projectRole: role,
    projectRoleLabel: formatProjectRole(role),
    assignmentStatus: assignment?.status || 'active',
    canManage: ['project_manager', 'team_lead'].includes(role),
    canContribute: ['project_manager', 'team_lead', 'contributor'].includes(role),
    isViewer: role === 'viewer',
    capabilities: getRoleCapabilities(role),
    managerName: project.manager,
    assignmentStartDate: assignment?.startDate || project.startDate,
    assignmentEndDate: assignment?.endDate || project.endDate,
    source: assignment ? 'assignment' : 'assigned_to',
  };
}

export async function getStaffWorkspaceProjects(staff) {
  if (!staff?.id) {
    return { assignments: [], projects: [] };
  }

  const assignments = await ProjectAssignment.findAll({
    staffId: staff.id,
    limit: 1000,
  });
  const activeAssignments = assignments.filter((assignment) =>
    ['active', 'pending'].includes(assignment.status)
  );

  const projectMap = new Map();

  for (const assignment of activeAssignments) {
    const project = await Project.findById(assignment.projectId);
    if (!project?.dbId) continue;
    projectMap.set(project.dbId, enrichWorkspaceProject(project, assignment));
  }

  if (staff.email) {
    const emailProjects = await Project.findAll({ userEmail: staff.email, limit: 1000 });
    for (const project of emailProjects) {
      if (!project?.dbId || projectMap.has(project.dbId)) continue;
      projectMap.set(project.dbId, enrichWorkspaceProject(project, null, 'contributor'));
    }
  }

  const enrichedAssignments = [];

  for (const assignment of activeAssignments) {
    const project = await Project.findById(assignment.projectId);
    if (!project?.dbId) continue;

    enrichedAssignments.push({
      ...assignment,
      projectName: project.name,
      projectClient: project.client,
      projectStatus: project.status,
      projectProgress: project.progress || 0,
      projectManager: project.manager,
      projectStartDate: project.startDate,
      projectEndDate: project.endDate,
      projectRoleLabel: formatProjectRole(assignment.role),
      capabilities: getRoleCapabilities(assignment.role),
    });
  }

  return {
    assignments: enrichedAssignments,
    projects: [...projectMap.values()],
  };
}

/** Live projects for the Project Manager portal — assignments + manager role only (no deleted/orphan rows). */
export async function resolveManagerPortalProjects(staff) {
  if (!staff?.id) return [];

  const projectMap = new Map();
  const { projects: assignedProjects } = await getStaffWorkspaceProjects(staff);

  for (const project of assignedProjects) {
    if (project?.dbId) projectMap.set(project.dbId, project);
  }

  const managerName = getStaffDisplayName(staff);
  if (managerName) {
    const managedProjects = await Project.findAll({ manager: managerName, limit: 1000 });
    for (const project of managedProjects) {
      if (!project?.dbId || projectMap.has(project.dbId)) continue;
      const assignment = await ProjectAssignment.findByProjectAndStaff(project.dbId, staff.id);
      projectMap.set(
        project.dbId,
        enrichWorkspaceProject(project, assignment, 'project_manager'),
      );
    }
  }

  return [...projectMap.values()];
}

export function parseAssignedToEmails(assignedTo) {
  if (!assignedTo) return [];
  return assignedTo.split(',').map((email) => email.trim()).filter(Boolean);
}

export function buildAssignedToFromEmails(emails = []) {
  return [...new Set(emails.filter(Boolean))].join(', ');
}

export function getStaffDisplayName(staff) {
  if (!staff) return '';
  const firstName = staff.firstName || staff.first_name || '';
  const lastName = staff.lastName || staff.last_name || '';
  return `${firstName} ${lastName}`.trim();
}

export async function getProjectTeamResources(projectId) {
  if (!projectId) {
    return { project: null, members: [], assignments: [], teamSize: 0 };
  }

  const project = await Project.findById(projectId);
  if (!project?.dbId) {
    return { project: null, members: [], assignments: [], teamSize: 0 };
  }

  const assignments = await getProjectAssignments(project.dbId);
  const activeAssignments = assignments.filter((assignment) =>
    ['active', 'pending'].includes(assignment.status)
  );

  const members = activeAssignments.map(mapAssignmentToTeamMember);
  const memberEmails = new Set(
    members.map((member) => member.email?.toLowerCase()).filter(Boolean)
  );

  const legacyEmails = parseAssignedToEmails(project.assignedTo);
  for (const email of legacyEmails) {
    const normalizedEmail = email.toLowerCase();
    if (memberEmails.has(normalizedEmail)) continue;

    const staffRecord = await Staff.findByEmail(email);
    if (!staffRecord) continue;

    members.push({
      id: staffRecord.id,
      dbId: staffRecord.id,
      firstName: staffRecord.firstName,
      lastName: staffRecord.lastName,
      staffName: getStaffDisplayName(staffRecord),
      email: staffRecord.email,
      position: staffRecord.position,
      department: staffRecord.departmentName || staffRecord.department,
      projectRole: 'contributor',
      assignmentStatus: 'legacy',
      assignmentId: null,
      startDate: project.startDate,
      endDate: project.endDate,
    });
    memberEmails.add(normalizedEmail);
  }

  const roleOrder = { project_manager: 0, team_lead: 1, contributor: 2, viewer: 3 };
  members.sort(
    (a, b) =>
      (roleOrder[a.projectRole] ?? 9) - (roleOrder[b.projectRole] ?? 9) ||
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );

  return {
    project: {
      id: project.id,
      dbId: project.dbId,
      name: project.name,
      manager: project.manager,
      assignedTo: project.assignedTo,
      teamSize: members.length,
    },
    members,
    assignments: activeAssignments,
    teamSize: members.length,
  };
}

export function mapAssignmentToTeamMember(assignment) {
  const staffName = assignment.staffName || '';
  const nameParts = staffName.trim().split(/\s+/);

  return {
    id: assignment.staffId,
    dbId: assignment.staffId,
    firstName: nameParts[0] || staffName || 'Unknown',
    lastName: nameParts.slice(1).join(' ') || '',
    staffName: assignment.staffName,
    email: assignment.staffEmail,
    position: assignment.staffPosition,
    department: assignment.departmentName,
    projectRole: assignment.role || 'contributor',
    assignmentStatus: assignment.status || 'active',
    assignmentId: assignment.dbId,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
  };
}

export async function getProjectAssignments(projectId) {
  if (!projectId) return [];
  return ProjectAssignment.findAll({ projectId, limit: 1000 });
}

export async function userHasProjectAccess({ project, staff, assignments = null }) {
  if (!staff) return false;

  const role = staff.role?.toLowerCase() || '';
  if (['superadmin', 'finance', 'admin', 'administrator'].includes(role)) {
    return true;
  }

  const email = staff.email?.toLowerCase();
  if (!email || !project) return false;

  const managerName = getStaffDisplayName(staff);
  if (project.manager && managerName && project.manager.trim() === managerName) {
    return true;
  }

  const assignedEmails = parseAssignedToEmails(project.assignedTo).map((item) => item.toLowerCase());
  if (assignedEmails.includes(email)) {
    return true;
  }

  const projectAssignments = assignments || await getProjectAssignments(project.dbId || project.id);
  return projectAssignments.some(
    (assignment) =>
      assignment.staffEmail?.toLowerCase() === email &&
      ['active', 'pending'].includes(assignment.status)
  );
}

export async function getUserProjectRole(projectId, staff) {
  if (!projectId || !staff?.email) return null;

  const assignments = await getProjectAssignments(projectId);
  const match = assignments.find(
    (assignment) =>
      assignment.staffEmail?.toLowerCase() === staff.email.toLowerCase() &&
      ['active', 'pending'].includes(assignment.status)
  );

  return match?.role || null;
}

export async function rebuildProjectTeamFromAssignments(projectId) {
  if (!projectId) return null;

  const assignments = await getProjectAssignments(projectId);
  const activeAssignments = assignments.filter((assignment) =>
    ['active', 'pending'].includes(assignment.status)
  );

  const emails = activeAssignments.map((assignment) => assignment.staffEmail).filter(Boolean);
  const projectManager = activeAssignments.find((assignment) => assignment.role === 'project_manager');

  const projectUpdate = {
    assignedTo: buildAssignedToFromEmails(emails),
    teamSize: activeAssignments.length,
  };

  if (projectManager?.staffName) {
    projectUpdate.manager = projectManager.staffName;
  }

  await Project.update(projectId, projectUpdate);

  const implementation = await Implementation.findByProjectId(projectId);
  if (implementation?.dbId) {
    await Implementation.update(implementation.dbId, {
      assignedTo: projectUpdate.assignedTo,
      teamSize: projectUpdate.teamSize,
    });
  }

  return Project.findById(projectId);
}

/**
 * Replace the full project team from implementation management.
 * team: [{ staffId, role }]
 */
export async function syncProjectTeam(projectId, team = [], options = {}) {
  if (!projectId) {
    throw new Error('Project ID is required to sync team');
  }

  const normalizedTeam = (Array.isArray(team) ? team : [])
    .filter((member) => member?.staffId)
    .map((member) => ({
      staffId: parseInt(member.staffId, 10),
      role: member.role || 'contributor',
    }));

  const uniqueByStaff = new Map();
  normalizedTeam.forEach((member) => uniqueByStaff.set(member.staffId, member));
  const finalTeam = [...uniqueByStaff.values()];

  const staffRecords = await Promise.all(finalTeam.map((member) => Staff.findById(member.staffId)));
  const emails = staffRecords.filter(Boolean).map((record) => record.email).filter(Boolean);
  const projectManagerMember = finalTeam.find((member) => member.role === 'project_manager');
  const projectManagerStaff = projectManagerMember
    ? staffRecords[finalTeam.indexOf(projectManagerMember)]
    : null;

  const { startDate, endDate, createdBy } = options;
  const fallbackStartDate = startDate || new Date().toISOString().split('T')[0];

  const existingAssignments = await getProjectAssignments(projectId);
  const nextStaffIds = new Set(finalTeam.map((member) => member.staffId));

  for (const assignment of existingAssignments) {
    if (!nextStaffIds.has(assignment.staffId)) {
      await ProjectAssignment.delete(assignment.dbId);
    }
  }

  for (const member of finalTeam) {
    const existing = existingAssignments.find((assignment) => assignment.staffId === member.staffId);

    if (existing) {
      await ProjectAssignment.update(existing.dbId, {
        role: member.role,
        status: 'active',
        startDate: startDate || existing.startDate || fallbackStartDate,
        endDate: endDate ?? existing.endDate ?? null,
      });
    } else {
      await ProjectAssignment.create({
        projectId,
        staffId: member.staffId,
        role: member.role,
        startDate: fallbackStartDate,
        endDate: endDate || null,
        status: 'active',
        createdBy: createdBy || null,
      });
    }

    await applyStaffPortalForProjectRole(member.staffId, member.role);
  }

  const projectUpdate = {
    assignedTo: buildAssignedToFromEmails(emails),
    teamSize: finalTeam.length,
  };

  if (projectManagerStaff) {
    projectUpdate.manager = getStaffDisplayName(projectManagerStaff);
  }

  await Project.update(projectId, projectUpdate);

  const implementation = await Implementation.findByProjectId(projectId);
  if (implementation?.dbId) {
    await Implementation.update(implementation.dbId, {
      assignedTo: projectUpdate.assignedTo,
      teamSize: projectUpdate.teamSize,
    });
  }

  return {
    project: await Project.findById(projectId),
    assignments: await getProjectAssignments(projectId),
  };
}

export async function assignStaffToProject({
  projectId,
  staffId,
  projectRole = 'contributor',
  createdBy = null,
}) {
  if (!projectId || !staffId) {
    throw new Error('Project ID and staff ID are required');
  }

  const project = await Project.findById(projectId);
  if (!project?.dbId) {
    throw new Error('Project not found');
  }

  const existing = await ProjectAssignment.findByProjectAndStaff(project.dbId, staffId);

  let assignment;
  if (existing?.dbId) {
    await ProjectAssignment.update(existing.dbId, {
      role: projectRole,
      status: 'active',
      startDate: existing.startDate || project.startDate || new Date().toISOString().split('T')[0],
      endDate: existing.endDate ?? project.endDate ?? null,
    });
    assignment = await ProjectAssignment.findById(existing.dbId);
  } else {
    assignment = await ProjectAssignment.create({
      projectId: project.dbId,
      staffId,
      role: projectRole,
      startDate: project.startDate || new Date().toISOString().split('T')[0],
      endDate: project.endDate || null,
      status: 'active',
      createdBy,
    });
  }

  await rebuildProjectTeamFromAssignments(project.dbId);
  await applyStaffPortalForProjectRole(staffId, projectRole);
  return assignment;
}

export async function assignMultipleStaffToProject({
  projectId,
  members = [],
  createdBy = null,
}) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  const normalizedMembers = (Array.isArray(members) ? members : [])
    .map((member) => ({
      staffId: parseInt(member.staffId, 10),
      projectRole: member.projectRole || 'contributor',
    }))
    .filter((member) => member.staffId && !Number.isNaN(member.staffId));

  if (normalizedMembers.length === 0) {
    throw new Error('At least one valid staff member is required');
  }

  const project = await Project.findById(projectId);
  if (!project?.dbId) {
    throw new Error('Project not found');
  }

  const fallbackStartDate = project.startDate || new Date().toISOString().split('T')[0];
  const assignments = [];

  for (const member of normalizedMembers) {
    const existing = await ProjectAssignment.findByProjectAndStaff(project.dbId, member.staffId);
    let assignment;

    if (existing?.dbId) {
      await ProjectAssignment.update(existing.dbId, {
        role: member.projectRole,
        status: 'active',
        startDate: existing.startDate || fallbackStartDate,
        endDate: existing.endDate ?? project.endDate ?? null,
      });
      assignment = await ProjectAssignment.findById(existing.dbId);
    } else {
      assignment = await ProjectAssignment.create({
        projectId: project.dbId,
        staffId: member.staffId,
        role: member.projectRole,
        startDate: fallbackStartDate,
        endDate: project.endDate || null,
        status: 'active',
        createdBy,
      });
    }

    assignments.push(assignment);
    await applyStaffPortalForProjectRole(member.staffId, member.projectRole);
  }

  await rebuildProjectTeamFromAssignments(project.dbId);

  return assignments;
}
