export const PORTAL_OPTIONS = [
  { value: 'dashboard', label: 'SuperAdmin Dashboard', path: '/superadmin-dashboard' },
  { value: 'employee', label: 'Employee Portal', path: '/employee/dashboard' },
  { value: 'project-team', label: 'Project Team Portal', path: '/project-team/dashboard' },
  { value: 'contributor', label: 'Contributor Portal', path: '/contributor/dashboard' },
  { value: 'viewer', label: 'Viewer Portal', path: '/viewer/dashboard' },
  { value: 'project-manager', label: 'Project Manager Portal', path: '/project-manager/dashboard' },
  { value: 'department-director', label: 'Department Director Portal', path: '/department-director/dashboard' },
  { value: 'team-skills', label: 'Team Skills Portal', path: '/team-skills/dashboard' },
  { value: 'finance', label: 'Finance Portal', path: '/finance/dashboard' },
  { value: 'finance-project', label: 'Finance Project Portal', path: '/finance-project/dashboard' },
  { value: 'finance-department', label: 'Finance Department Portal', path: '/finance/dashboard' },
  { value: 'logistic', label: 'Logistics Portal', path: '/logistic/dashboard' },
  { value: 'logistic-project', label: 'Logistic Project Portal', path: '/logistic-project/dashboard' },
  { value: 'driver', label: 'Driver Portal', path: '/driver/dashboard' },
];

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'manage'];

export const PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Main dashboard and analytics',
    portal: 'dashboard',
    subPages: [{ key: 'overview', label: 'Overview' }],
  },
  {
    key: 'projects',
    label: 'Projects',
    description: 'Project management and opportunities',
    portal: 'project-manager',
    subPages: [
      { key: 'opportunities', label: 'Opportunities' },
      { key: 'implementation', label: 'Implementation' },
      { key: 'fund_requests', label: 'Fund Requests' },
      { key: 'tasks', label: 'Tasks' },
      { key: 'documents', label: 'Documents' },
    ],
  },
  {
    key: 'leave',
    label: 'Leave Management',
    description: 'Employee leave requests and approvals',
    portal: 'employee',
    subPages: [
      { key: 'my_leave', label: 'My Leave' },
      { key: 'team_leave', label: 'Team Leave Management' },
    ],
  },
  {
    key: 'teams',
    label: 'Team Management',
    description: 'Staff, departments, and roles',
    portal: 'dashboard',
    subPages: [
      { key: 'staff_users', label: 'Staff Users' },
      { key: 'departments', label: 'Departments' },
      { key: 'roles', label: 'Roles' },
    ],
  },
  {
    key: 'finance',
    label: 'Financial Management',
    description: 'Budget, expenses, invoices',
    portal: 'finance',
    subPages: [
      { key: 'budget', label: 'Budget' },
      { key: 'expenses', label: 'Expenses' },
      { key: 'invoices', label: 'Invoices' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    description: 'Progress and financial reports',
    portal: 'dashboard',
    subPages: [
      { key: 'progress', label: 'Progress Reports' },
      { key: 'financial', label: 'Financial Reports' },
      { key: 'export', label: 'Export Data' },
    ],
  },
  {
    key: 'collaboration',
    label: 'Collaboration',
    description: 'Messaging and discussions',
    portal: 'employee',
    subPages: [
      { key: 'messenger', label: 'Messenger' },
      { key: 'discussion', label: 'Discussion' },
    ],
  },
  {
    key: 'settings',
    label: 'System Settings',
    description: 'System configuration and permissions',
    portal: 'dashboard',
    subPages: [
      { key: 'system', label: 'System Settings' },
      { key: 'permissions', label: 'Roles & Permissions' },
    ],
  },
];

export const SYSTEM_ROLE_NAMES = new Set([
  'superadmin',
  'administrator',
  'admin',
  'project manager',
  'department director',
  'employee',
  'finance',
  'logistic',
  'driver',
]);

const DEFAULT_PORTAL_BY_ROLE = {
  superadmin: 'dashboard',
  admin: 'dashboard',
  administrator: 'dashboard',
  'project manager': 'project-manager',
  project_manager: 'project-manager',
  'department director': 'department-director',
  department_director: 'department-director',
  employee: 'employee',
  finance: 'finance',
  'finance project': 'finance-project',
  financeproject: 'finance-project',
  logistic: 'logistic',
  logisticproject: 'logistic-project',
  driver: 'driver',
  'team skills': 'team-skills',
  team_skills: 'team-skills',
};

export function getPermissionCatalog() {
  return {
    portals: PORTAL_OPTIONS,
    actions: PERMISSION_ACTIONS,
    modules: PERMISSION_MODULES,
  };
}

export function normalizeRoleName(name = '') {
  return String(name).toLowerCase().trim().replace(/\s+/g, ' ');
}

export function isSuperAdminRole(role = '') {
  return normalizeRoleName(role).replace(/\s+/g, '') === 'superadmin';
}

export function resolvePortalForStaff(staff, roleRecord = null) {
  const staffPanel = (staff?.controlPanel || staff?.control_panel || '').toLowerCase().trim();
  if (staffPanel && staffPanel !== '__none__') {
    return staffPanel;
  }

  if (roleRecord?.controlPanel) {
    return roleRecord.controlPanel;
  }

  const roleKey = normalizeRoleName(staff?.role || '');
  return DEFAULT_PORTAL_BY_ROLE[roleKey] || DEFAULT_PORTAL_BY_ROLE[roleKey.replace(/\s+/g, '_')] || 'dashboard';
}

export function resolveEffectivePermissions(rolePermissions = [], userPermissions = []) {
  const effective = new Set(Array.isArray(rolePermissions) ? rolePermissions : []);

  userPermissions.forEach((perm) => {
    if (!perm?.permissionKey) return;
    if (perm.permissionValue === 'allow') {
      effective.add(perm.permissionKey);
    } else if (perm.permissionValue === 'deny') {
      effective.delete(perm.permissionKey);
    }
  });

  return [...effective];
}

export function hasPermission(effectivePermissions, moduleKey, action, { isSuperAdmin = false } = {}) {
  if (isSuperAdmin) return true;
  if (!Array.isArray(effectivePermissions)) return false;
  return effectivePermissions.includes(`${moduleKey}_${action}`);
}

export function canAccessPortal(staff, portalKey, roleRecord = null) {
  if (isSuperAdminRole(staff?.role)) return true;
  const assignedPortal = resolvePortalForStaff(staff, roleRecord);
  const normalizedAssigned = assignedPortal.toLowerCase().replace(/_/g, '-');
  const normalizedPortal = String(portalKey).toLowerCase().replace(/_/g, '-');
  return normalizedAssigned === normalizedPortal || normalizedAssigned.includes(normalizedPortal);
}

export function buildStaffAccessPayload(staff, roleRecord = null, userPermissions = []) {
  const rolePermissions = roleRecord?.permissions || [];
  const effectivePermissions = resolveEffectivePermissions(rolePermissions, userPermissions);
  const isSuperAdmin = isSuperAdminRole(staff?.role);

  return {
    rolePermissions,
    effectivePermissions,
    roleControlPanel: resolvePortalForStaff(staff, roleRecord),
    roleIsSystem: Boolean(roleRecord?.isSystem),
    roleRecordId: roleRecord?.id || null,
    isSuperAdmin,
    canManageRoles: isSuperAdmin || hasPermission(effectivePermissions, 'teams', 'manage', { isSuperAdmin }),
    canDeleteRoles: isSuperAdmin,
  };
}
