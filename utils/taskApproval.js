import Staff from '../models/Staff.js';
import { getStaffProjectRole, isProjectManagerPortalStaff, isElevatedProjectTeamCreator } from './projectTeam.js';

export const APPROVAL_STAGES = {
  NONE: 'none',
  PENDING_TEAM_LEAD: 'pending_team_lead',
  PENDING_PROJECT_MANAGER: 'pending_project_manager',
  PENDING_SUPERADMIN: 'pending_superadmin',
  APPROVED: 'approved',
};

export function normalizeSystemRole(staff) {
  return (staff?.role || '').toLowerCase().trim().replace(/\s+/g, '');
}

export function isSuperAdminStaff(staff) {
  return normalizeSystemRole(staff) === 'superadmin';
}

export function getInitialApprovalStage(submitterRole) {
  switch (submitterRole) {
    case 'contributor':
    case 'viewer':
      return APPROVAL_STAGES.PENDING_TEAM_LEAD;
    case 'team_lead':
      return APPROVAL_STAGES.PENDING_PROJECT_MANAGER;
    case 'project_manager':
      return APPROVAL_STAGES.PENDING_SUPERADMIN;
    default:
      return APPROVAL_STAGES.PENDING_TEAM_LEAD;
  }
}

export function getApprovalStageLabel(stage, approvalStatus) {
  if (approvalStatus === 'approved') return 'Approved / Task ended';
  if (approvalStatus === 'rejected') return 'Rejected — rework required';
  if (approvalStatus === 'not_required' || !stage || stage === APPROVAL_STAGES.NONE) {
    return 'Awaiting work';
  }
  switch (stage) {
    case APPROVAL_STAGES.PENDING_TEAM_LEAD:
      return 'Awaiting Team Lead approval';
    case APPROVAL_STAGES.PENDING_PROJECT_MANAGER:
      return 'Awaiting Project Manager approval';
    case APPROVAL_STAGES.PENDING_SUPERADMIN:
      return 'Awaiting SuperAdmin approval';
    case APPROVAL_STAGES.APPROVED:
      return 'Approved / Task ended';
    default:
      return 'Pending approval';
  }
}

export async function resolveTaskApprovalContext(staffId, projectId) {
  const staff = staffId ? await Staff.findById(staffId) : null;
  const projectRole = projectId && staffId ? await getStaffProjectRole(staffId, projectId) : null;
  const isElevated = staff ? isElevatedProjectTeamCreator(staff) : false;
  const isPmPortal = staff ? isProjectManagerPortalStaff(staff) : false;
  const isSuperAdmin = staff ? isSuperAdminStaff(staff) : false;

  return { staff, projectRole, isElevated, isPmPortal, isSuperAdmin };
}

export function canReviewTaskAtStage(context, task) {
  const stage = task.approvalStage || task.approval_stage;
  if (task.approvalStatus !== 'pending_approval' && task.approval_status !== 'pending_approval') {
    return false;
  }

  const { projectRole, isPmPortal, isSuperAdmin } = context;

  switch (stage) {
    case APPROVAL_STAGES.PENDING_TEAM_LEAD:
      return (
        projectRole === 'team_lead' ||
        projectRole === 'project_manager' ||
        isPmPortal ||
        isSuperAdmin
      );
    case APPROVAL_STAGES.PENDING_PROJECT_MANAGER:
      return projectRole === 'project_manager' || isPmPortal || isSuperAdmin;
    case APPROVAL_STAGES.PENDING_SUPERADMIN:
      return isSuperAdmin;
    default:
      return isSuperAdmin || projectRole === 'project_manager' || isPmPortal;
  }
}

export function buildSubmissionUpdate(submitterRole, staffId) {
  const approvalStage = getInitialApprovalStage(submitterRole);
  return {
    status: 'completed',
    progress: 100,
    approvalStatus: 'pending_approval',
    approvalStage,
    submittedBy: staffId,
    submitterRole: submitterRole || 'contributor',
    submittedAt: new Date(),
    approvedBy: null,
    teamLeadApprovedBy: null,
    teamLeadApprovedAt: null,
    pmApprovedBy: null,
    pmApprovedAt: null,
    superadminApprovedBy: null,
    superadminApprovedAt: null,
  };
}

export function buildApprovalUpdate(task, context, { action, notes, staffId }) {
  const stage = task.approvalStage || task.approval_stage || APPROVAL_STAGES.NONE;

  if (action === 'reject') {
    return {
      approvalStatus: 'rejected',
      approvalStage: APPROVAL_STAGES.NONE,
      status: 'in_progress',
      progress: Math.min(task.progress || 90, 90),
      approvalNotes: notes || null,
    };
  }

  const now = new Date();
  const base = { approvalNotes: notes || null };

  switch (stage) {
    case APPROVAL_STAGES.PENDING_TEAM_LEAD:
      return {
        ...base,
        approvalStatus: 'approved',
        approvalStage: APPROVAL_STAGES.APPROVED,
        status: 'completed',
        progress: 100,
        approvedBy: staffId,
        teamLeadApprovedBy: staffId,
        teamLeadApprovedAt: now,
      };
    case APPROVAL_STAGES.PENDING_PROJECT_MANAGER:
      return {
        ...base,
        approvalStatus: 'pending_approval',
        approvalStage: APPROVAL_STAGES.PENDING_SUPERADMIN,
        status: 'completed',
        progress: 100,
        pmApprovedBy: staffId,
        pmApprovedAt: now,
      };
    case APPROVAL_STAGES.PENDING_SUPERADMIN:
      return {
        ...base,
        approvalStatus: 'approved',
        approvalStage: APPROVAL_STAGES.APPROVED,
        status: 'completed',
        progress: 100,
        approvedBy: staffId,
        superadminApprovedBy: staffId,
        superadminApprovedAt: now,
      };
    default:
      if (context.isSuperAdmin) {
        return {
          ...base,
          approvalStatus: 'approved',
          approvalStage: APPROVAL_STAGES.APPROVED,
          status: 'completed',
          progress: 100,
          approvedBy: staffId,
          superadminApprovedBy: staffId,
          superadminApprovedAt: now,
        };
      }
      return {
        ...base,
        approvalStatus: 'approved',
        approvalStage: APPROVAL_STAGES.APPROVED,
        status: 'completed',
        progress: 100,
        approvedBy: staffId,
      };
  }
}
