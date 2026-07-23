/** Contract approval workflow: Project Manager → Finance → Director */

export const CONTRACT_APPROVAL_STEPS = ['project_manager', 'finance', 'director'];

export const LANE_STATUSES = ['draft', 'submitted', 'approved', 'rejected'];

export function normalizeRole(role = '') {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function normalizeControlPanel(panel = '') {
  return String(panel || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

const ADMIN_ROLES = new Set(['superadmin', 'super_admin', 'admin', 'administrator']);

const SUPERADMIN_ROLE_HINTS = ['superadmin', 'super_admin', 'system_administrator'];

const PROJECT_MANAGER_ROLES = new Set([
  'superadmin',
  'admin',
  'administrator',
  'project_manager',
  'team_lead',
  'operations_manager',
  'department_director',
]);

const FINANCE_ROLES = new Set([
  'superadmin',
  'admin',
  'administrator',
  'finance',
  'finance_analyst',
  'finance_analyst',
]);

const DIRECTOR_ROLES = new Set([
  'superadmin',
  'admin',
  'administrator',
  'department_director',
  'operations_manager',
]);

const FINANCE_PANELS = new Set(['finance', 'finance_department', 'finance_project', 'finance_project']);
const PM_PANELS = new Set(['project_manager', 'department_director', 'dashboard']);
const DIRECTOR_PANELS = new Set(['department_director', 'finance_department', 'dashboard']);

export function isSuperAdminRole(role, position) {
  const normalizedRole = normalizeRole(role);
  const normalizedPosition = normalizeRole(position);

  if (ADMIN_ROLES.has(normalizedRole)) {
    return normalizedRole === 'superadmin' || normalizedRole === 'super_admin';
  }

  return (
    SUPERADMIN_ROLE_HINTS.some(
      (hint) => normalizedRole.includes(hint) || normalizedPosition.includes(hint)
    ) || normalizedRole === 'superadmin'
  );
}

export function isAdminRole(role, position) {
  const normalizedRole = normalizeRole(role);
  const normalizedPosition = normalizeRole(position);

  if (ADMIN_ROLES.has(normalizedRole)) return true;

  return (
    isSuperAdminRole(role, position) ||
    normalizedRole.includes('administrator') ||
    normalizedPosition.includes('system_administrator')
  );
}

export function canApproveStep(staff, step) {
  const role = typeof staff === 'string' ? staff : staff?.role;
  const controlPanel = typeof staff === 'string' ? undefined : staff?.controlPanel;
  const position = typeof staff === 'string' ? undefined : staff?.position;
  const normalizedRole = normalizeRole(role);
  const panel = normalizeControlPanel(controlPanel);

  if (isAdminRole(role, position)) return true;

  switch (step) {
    case 'project_manager':
      return (
        PROJECT_MANAGER_ROLES.has(normalizedRole) ||
        PM_PANELS.has(panel) ||
        normalizedRole.includes('project_manager')
      );
    case 'finance':
      return FINANCE_ROLES.has(normalizedRole) || FINANCE_PANELS.has(panel);
    case 'director':
      return DIRECTOR_ROLES.has(normalizedRole) || DIRECTOR_PANELS.has(panel);
    default:
      return false;
  }
}

export function getStepLabel(step) {
  switch (step) {
    case 'project_manager':
      return 'Project Manager';
    case 'finance':
      return 'Finance';
    case 'director':
      return 'Director / Executive';
    case 'completed':
      return 'Completed';
    default:
      return 'Not started';
  }
}

export function getLaneField(step) {
  switch (step) {
    case 'project_manager':
      return 'projectManagerStatus';
    case 'finance':
      return 'financeStatus';
    case 'director':
      return 'directorStatus';
    default:
      return null;
  }
}

export function getLaneDbField(step) {
  switch (step) {
    case 'project_manager':
      return 'project_manager_status';
    case 'finance':
      return 'finance_status';
    case 'director':
      return 'director_status';
    default:
      return null;
  }
}

export function computeApprovalSummary(contract) {
  const lanes = {
    project_manager: contract.project_manager_status || contract.projectManagerStatus || 'draft',
    finance: contract.finance_status || contract.financeStatus || 'draft',
    director: contract.director_status || contract.directorStatus || 'draft',
  };

  if (Object.values(lanes).some((status) => status === 'rejected')) {
    return { approvalStatus: 'rejected', currentStep: contract.current_approval_step || contract.currentApprovalStep || 'none' };
  }

  if (
    lanes.project_manager === 'approved' &&
    lanes.finance === 'approved' &&
    lanes.director === 'approved'
  ) {
    return { approvalStatus: 'approved', currentStep: 'completed' };
  }

  if (lanes.project_manager === 'submitted' || lanes.project_manager === 'approved') {
    if (lanes.project_manager !== 'approved') {
      return { approvalStatus: 'in_review', currentStep: 'project_manager' };
    }
    if (lanes.finance !== 'approved') {
      return { approvalStatus: 'in_review', currentStep: 'finance' };
    }
    if (lanes.director !== 'approved') {
      return { approvalStatus: 'in_review', currentStep: 'director' };
    }
  }

  if (contract.submitted_at || contract.submittedAt) {
    return { approvalStatus: 'in_review', currentStep: 'project_manager' };
  }

  return { approvalStatus: 'draft', currentStep: 'none' };
}

export function canStaffActOnContract(staff, contract) {
  if (!staff || !contract) {
    return {
      canView: false,
      canEdit: false,
      canApprove: false,
      canSubmit: false,
      canApproveAll: false,
    };
  }

  const isAdmin = isAdminRole(staff.role, staff.position);
  const isSuperAdmin = isSuperAdminRole(staff.role, staff.position);
  const currentStep = contract.currentApprovalStep || contract.current_approval_step || 'none';
  const approvalStatus = contract.approvalStatus || contract.approval_status || 'draft';
  const createdBy = contract.createdBy || contract.created_by;
  const isCreator = createdBy && String(createdBy) === String(staff.id);
  const inReview =
    approvalStatus === 'in_review' &&
    currentStep !== 'none' &&
    currentStep !== 'completed';

  const canApprove = inReview && (isAdmin || canApproveStep(staff, currentStep));

  const canSubmit =
    (approvalStatus === 'draft' || approvalStatus === 'rejected') &&
    (isCreator || isAdmin || canApproveStep(staff, 'project_manager'));

  const canEdit =
    approvalStatus === 'draft' ||
    approvalStatus === 'rejected' ||
    isAdmin ||
    isCreator;

  const canView = isAdmin || isCreator || canApprove || approvalStatus !== 'draft';
  const canApproveAll =
    isSuperAdmin &&
    (inReview || approvalStatus === 'draft' || approvalStatus === 'rejected');

  return { canView, canEdit, canApprove, canSubmit, canApproveAll, currentStep, isSuperAdmin };
}
