import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Deliverable from '../models/Deliverable.js';
import Risk from '../models/Risk.js';
import Issue from '../models/Issue.js';
import WorkReport from '../models/WorkReport.js';
import Staff from '../models/Staff.js';
import {
  getStaffWorkspaceProjects,
  isElevatedProjectTeamCreator,
  isProjectManagerPortalStaff,
  resolveManagerPortalProjects,
} from './projectTeam.js';

function formatLabel(value) {
  if (!value) return 'N/A';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isOverdueTask(task) {
  if (!task?.dueDate || ['completed', 'cancelled'].includes(task.status)) return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function buildAlerts({ overdueTasks, pendingDeliverables, pendingWorkReports, activeRisks, activeIssues }) {
  const alerts = [];

  overdueTasks.slice(0, 5).forEach((task) => {
    alerts.push({
      id: `task-${task.dbId || task.id}`,
      type: 'urgent',
      message: `Overdue task: ${task.title}${task.projectName ? ` — ${task.projectName}` : ''}`,
      link: '/tasks',
      time: task.dueDate,
    });
  });

  pendingDeliverables.slice(0, 5).forEach((item) => {
    alerts.push({
      id: `deliverable-${item.dbId || item.id}`,
      type: 'warning',
      message: `Deliverable pending review: ${item.title}${item.projectName ? ` — ${item.projectName}` : ''}`,
      link: '/deliverables',
      time: item.submissionDate || item.createdAt,
    });
  });

  pendingWorkReports.slice(0, 3).forEach((report) => {
    alerts.push({
      id: `work-report-${report.dbId || report.id}`,
      type: 'info',
      message: `Work report submitted by ${report.staffName || 'team member'}`,
      link: '/projects',
      time: report.reportDate,
    });
  });

  activeRisks.slice(0, 3).forEach((risk) => {
    alerts.push({
      id: `risk-${risk.dbId || risk.id}`,
      type: risk.severity === 'critical' || risk.severity === 'high' ? 'urgent' : 'warning',
      message: `Active risk: ${risk.title}${risk.projectName ? ` — ${risk.projectName}` : ''}`,
      link: '/risks',
      time: risk.updatedAt || risk.createdAt,
    });
  });

  activeIssues.slice(0, 2).forEach((issue) => {
    alerts.push({
      id: `issue-${issue.dbId || issue.id}`,
      type: issue.severity === 'critical' || issue.severity === 'high' ? 'urgent' : 'warning',
      message: `Open issue: ${issue.title}${issue.projectName ? ` — ${issue.projectName}` : ''}`,
      link: '/risks',
      time: issue.updatedAt || issue.createdAt,
    });
  });

  return alerts.slice(0, 12);
}

async function resolveManagedProjects(staff) {
  if (isProjectManagerPortalStaff(staff)) {
    return resolveManagerPortalProjects(staff);
  }

  const isElevated = isElevatedProjectTeamCreator(staff);

  if (isElevated) {
    const filters = { limit: 500 };
    if (staff.departmentId) {
      filters.departmentId = staff.departmentId;
    }
    const projects = await Project.findAll(filters);
    return projects.map((project) => ({
      ...project,
      projectRole: 'project_manager',
      canManage: true,
    }));
  }

  const workspace = await getStaffWorkspaceProjects(staff);
  const managed = workspace.projects.filter((project) => project.canManage);
  return managed.length > 0 ? managed : workspace.projects;
}

async function fetchProjectScopedItems(projectIds) {
  if (!projectIds.length) {
    return { tasks: [], deliverables: [], risks: [], issues: [], workReports: [] };
  }

  const results = await Promise.all(
    projectIds.map(async (projectId) => {
      const [tasks, deliverables, risks, issues, workReports] = await Promise.all([
        Task.findAll({ projectId, limit: 300 }).catch(() => []),
        Deliverable.findAll({ projectId, limit: 200 }).catch(() => []),
        Risk.findAll({ projectId, limit: 100 }).catch(() => []),
        Issue.findAll({ projectId, limit: 100 }).catch(() => []),
        WorkReport.findAll({ projectId, limit: 100 }).catch(() => []),
      ]);
      return { tasks, deliverables, risks, issues, workReports };
    })
  );

  return {
    tasks: results.flatMap((item) => item.tasks),
    deliverables: results.flatMap((item) => item.deliverables),
    risks: results.flatMap((item) => item.risks),
    issues: results.flatMap((item) => item.issues),
    workReports: results.flatMap((item) => item.workReports),
  };
}

export async function buildManagerDashboard(staffId) {
  const staff = await Staff.findById(staffId);
  if (!staff) {
    return null;
  }

  const projects = await resolveManagedProjects(staff);
  const projectIds = projects.map((project) => project.dbId).filter(Boolean);
  const projectNameById = new Map(projects.map((project) => [project.dbId, project.name]));

  const scoped = await fetchProjectScopedItems(projectIds);
  const tasks = scoped.tasks.map((task) => ({
    ...task,
    projectName: task.projectName || projectNameById.get(task.projectId) || 'N/A',
  }));
  const deliverables = scoped.deliverables.map((item) => ({
    ...item,
    projectName: item.projectName || projectNameById.get(item.projectId) || 'N/A',
  }));
  const risks = scoped.risks.map((item) => ({
    ...item,
    projectName: item.projectName || projectNameById.get(item.projectId) || 'N/A',
  }));
  const issues = scoped.issues.map((item) => ({
    ...item,
    projectName: item.projectName || projectNameById.get(item.projectId) || 'N/A',
  }));

  const activeProjects = projects.filter((project) =>
    ['planning', 'ongoing', 'near_completion', 'in_progress'].includes(project.status)
  );
  const delayedProjects = projects.filter((project) =>
    project.status === 'overdue' || project.status === 'on_hold'
  );
  const onTrackProjects = activeProjects.filter((project) => project.status !== 'overdue');

  const overdueTasks = tasks.filter(isOverdueTask);
  const openTasks = tasks.filter((task) => !['completed', 'cancelled'].includes(task.status));
  const pendingDeliverables = deliverables.filter((item) =>
    ['pending_review', 'under_review', 'submitted', 'draft'].includes(item.status)
  );
  const pendingWorkReports = scoped.workReports.filter((report) => report.status === 'submitted');
  const activeRisks = risks.filter((risk) =>
    ['identified', 'assessed', 'mitigated', 'monitored', 'escalated', 'open'].includes(risk.status)
  );
  const activeIssues = issues.filter((issue) =>
    ['open', 'in_progress', 'escalated'].includes(issue.status)
  );

  const averageProgress = projects.length
    ? Math.round(projects.reduce((sum, project) => sum + (parseFloat(project.progress) || 0), 0) / projects.length)
    : 0;

  const statusBreakdown = projects.reduce((acc, project) => {
    const key = formatLabel(project.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const priorityBreakdown = tasks.reduce((acc, task) => {
    const key = formatLabel(task.priority || 'medium');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const alerts = buildAlerts({
    overdueTasks,
    pendingDeliverables,
    pendingWorkReports,
    activeRisks,
    activeIssues,
  });

  return {
    staff: {
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      role: staff.role,
      position: staff.position,
      departmentId: staff.departmentId,
    },
    stats: {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      delayedProjects: delayedProjects.length,
      onTrackProjects: onTrackProjects.length,
      pendingApprovals: pendingDeliverables.length,
      overdueTasks: overdueTasks.length,
      openTasks: openTasks.length,
      activeRisks: activeRisks.length,
      activeIssues: activeIssues.length,
      pendingWorkReports: pendingWorkReports.length,
      alertCount: alerts.length,
      averageProgress,
      completedTasks: tasks.filter((task) => task.status === 'completed').length,
      totalTasks: tasks.length,
    },
    charts: {
      projectStatus: Object.entries(statusBreakdown).map(([label, value]) => ({ label, value })),
      taskPriority: Object.entries(priorityBreakdown).map(([label, value]) => ({ label, value })),
      progressTrend: projects.slice(0, 6).map((project) => ({
        label: project.name,
        value: parseFloat(project.progress) || 0,
      })),
    },
    projects: projects.slice(0, 10).map((project) => ({
      id: project.id,
      dbId: project.dbId,
      name: project.name,
      client: project.client,
      status: project.status,
      statusLabel: formatLabel(project.status),
      progress: parseFloat(project.progress) || 0,
      priority: project.priority,
      endDate: project.endDate,
      projectRole: project.projectRole,
      canManage: project.canManage,
      routeId: project.dbId || project.id,
    })),
    tasks: openTasks
      .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
      .slice(0, 12)
      .map((task) => ({
        id: task.taskId || task.id,
        dbId: task.dbId,
        title: task.title,
        projectId: task.projectId,
        projectName: task.projectName,
        assignee: task.assigneeName || 'Unassigned',
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        statusLabel: formatLabel(task.status),
        isOverdue: isOverdueTask(task),
      })),
    deliverables: pendingDeliverables.slice(0, 8).map((item) => ({
      id: item.deliverableId || item.id,
      dbId: item.dbId,
      title: item.title,
      category: item.category,
      projectId: item.projectId,
      projectName: item.projectName,
      status: item.status,
      statusLabel: formatLabel(item.status),
      submissionDate: item.submissionDate,
      priority: item.priority,
    })),
    risks: activeRisks.slice(0, 8).map((risk) => ({
      id: risk.riskId || risk.id,
      dbId: risk.dbId,
      title: risk.title,
      projectId: risk.projectId,
      projectName: risk.projectName,
      severity: risk.severity,
      status: risk.status,
      statusLabel: formatLabel(risk.status),
    })),
    alerts,
  };
}
