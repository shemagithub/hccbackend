import Project from '../models/Project.js';
import Implementation from '../models/Implementation.js';
import ProjectAssignment from '../models/ProjectAssignment.js';
import Task from '../models/Task.js';
import Deliverable from '../models/Deliverable.js';
import Expense from '../models/Expense.js';
import Review from '../models/Review.js';
import QualityControl from '../models/QualityControl.js';
import Risk from '../models/Risk.js';
import Issue from '../models/Issue.js';
import WorkReport from '../models/WorkReport.js';
import FieldReport from '../models/FieldReport.js';
import PDFDocument from 'pdfkit';

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(value, currency = 'USD') {
  const amount = parseFloat(value) || 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function formatLabel(value) {
  if (!value) return 'N/A';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function calcPerformanceMetrics(projectStats, taskStats, deliverableStats, reviewStats, projects, projectId) {
  const totalProjects = parseInt(projectStats.total || 0, 10);
  const completedProjects = parseInt(projectStats.completed || 0, 10);
  const totalTasks = parseInt(taskStats.total || 0, 10);
  const completedTasks = parseInt(taskStats.completed || 0, 10);
  const totalDeliverables = parseInt(deliverableStats.total || 0, 10);
  const approvedDeliverables = parseInt(deliverableStats.approved || 0, 10);
  const totalReviews = parseInt(reviewStats.total || 0, 10);
  const approvedReviews = parseInt(reviewStats.approved || 0, 10);
  const totalBudget = parseFloat(projectStats.totalBudget || 0);
  const totalSpent = parseFloat(projectStats.totalSpent || 0);

  const scopedToSingleProject = Boolean(projectId) && projects.length === 1;
  const averageCompletion = scopedToSingleProject
    ? parseFloat(projects[0].progress) || 0
    : totalProjects > 0
      ? projects.reduce((sum, p) => sum + (parseFloat(p.progress) || 0), 0) / totalProjects
      : 0;

  let onTimeDelivery = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;
  if (scopedToSingleProject && completedProjects === 0) {
    onTimeDelivery = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : averageCompletion;
  }

  const qualityScore = totalDeliverables > 0 ? (approvedDeliverables / totalDeliverables) * 100 : 0;
  const budgetEfficiency = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0;
  const timePerformance = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const costPerformance = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0;
  const clientSatisfaction = totalReviews > 0 ? (approvedReviews / totalReviews) * 100 : 0;

  return {
    averageCompletion: Math.round(averageCompletion),
    onTimeDelivery: Math.round(onTimeDelivery),
    qualityScore: Math.round(qualityScore),
    budgetEfficiency: Math.round(budgetEfficiency),
    timePerformance: Math.round(timePerformance),
    costPerformance: Math.round(costPerformance),
    clientSatisfaction: Math.round(clientSatisfaction),
    totals: {
      totalTasks,
      completedTasks,
      totalDeliverables,
      approvedDeliverables,
      totalReviews,
      approvedReviews,
      totalBudget,
      totalSpent,
    },
  };
}

export async function buildImplementationReport(projectId) {
  const pid = parseInt(projectId, 10);
  const project = await Project.findById(pid);
  if (!project) {
    return null;
  }

  const implementation = await Implementation.findByProjectId(pid);
  const team = await ProjectAssignment.findAll({ projectId: pid, limit: 500 });
  const tasks = await Task.findAll({ projectId: pid, limit: 1000 });
  const deliverables = await Deliverable.findAll({ projectId: pid, limit: 1000 });
  const expenses = await Expense.findAll({ projectId: pid, limit: 1000 });
  const reviews = await Review.findAll({ projectId: pid, limit: 1000 });
  const risks = await Risk.findAll({ projectId: pid, limit: 1000 });
  const issues = await Issue.findAll({ projectId: pid, limit: 1000 });
  const workReports = await WorkReport.findAll({ projectId: pid, limit: 500 });
  const fieldReports = await FieldReport.findAll({ projectId: pid, limit: 500 });

  const projectFilters = { id: pid };
  const projects = await Project.findAll(projectFilters);
  const projectStats = await Project.getStats(projectFilters);
  const taskStats = await Task.getStats(pid);
  const deliverableStats = await Deliverable.getStats(pid);
  const expenseStats = await Expense.getStats(pid);
  const reviewStats = await Review.getStats(pid);
  const qualityStats = await QualityControl.getStats(pid);
  const riskStats = await Risk.getStats(pid);
  const issueStats = await Issue.getStats(pid);

  const performance = calcPerformanceMetrics(
    projectStats,
    taskStats,
    deliverableStats,
    reviewStats,
    projects,
    pid
  );

  const deliverableReports = deliverables.filter((item) => item.category === 'Report');

  return {
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      dbId: project.dbId,
      name: project.name,
      client: project.client,
      department: project.department,
      manager: project.manager,
      status: project.status,
      priority: project.priority,
      progress: project.progress,
      budget: project.budget,
      spent: project.spent,
      startDate: project.startDate,
      endDate: project.endDate,
      location: project.location,
      description: project.description,
      teamSize: project.teamSize,
      assignedTo: project.assignedTo,
    },
    implementation: implementation
      ? {
          id: implementation.id,
          dbId: implementation.dbId,
          title: implementation.title,
          status: implementation.status,
          progress: implementation.progress,
          budget: implementation.budget,
          spent: implementation.spent,
          startDate: implementation.startDate,
          endDate: implementation.endDate,
          priority: implementation.priority,
          description: implementation.description,
        }
      : null,
    performance,
    stats: {
      projects: projectStats,
      tasks: taskStats,
      deliverables: deliverableStats,
      expenses: expenseStats,
      reviews: reviewStats,
      quality: qualityStats,
      risks: riskStats,
      issues: issueStats,
      workReports: {
        total: workReports.length,
        submitted: workReports.filter((r) => r.status === 'submitted').length,
        approved: workReports.filter((r) => r.status === 'approved').length,
      },
      fieldReports: {
        total: fieldReports.length,
        submitted: fieldReports.filter((r) => r.status === 'submitted').length,
        approved: fieldReports.filter((r) => r.status === 'approved').length,
      },
      deliverableReports: deliverableReports.length,
    },
    team: team.map((member) => ({
      name: member.staffName || `${member.firstName || ''} ${member.lastName || ''}`.trim(),
      email: member.staffEmail || member.email,
      role: member.role,
      status: member.status,
      position: member.position,
      department: member.departmentName,
    })),
    tasks: tasks.map((task) => ({
      id: task.taskId || task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignee: task.assigneeName || task.assignedTo,
      dueDate: task.dueDate,
      progress: task.progress,
    })),
    deliverables: deliverables.map((item) => ({
      id: item.deliverableId || item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      dueDate: item.dueDate,
      submittedBy: item.submittedByName,
    })),
    expenses: expenses.map((item) => ({
      id: item.expenseId || item.id,
      category: item.category,
      description: item.description,
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      date: item.expenseDate,
      submittedBy: item.submittedByName,
    })),
    risks: risks.map((item) => ({
      id: item.riskId || item.id,
      title: item.title,
      severity: item.severity,
      status: item.status,
      probability: item.probability,
      impact: item.impact,
    })),
    issues: issues.map((item) => ({
      id: item.issueId || item.id,
      title: item.title,
      severity: item.severity,
      status: item.status,
      reportedBy: item.reportedByName,
    })),
    workReports: workReports.map((item) => ({
      id: item.reportId || item.id,
      staffName: item.staffName,
      reportType: item.reportType,
      reportDate: item.reportDate,
      status: item.status,
      summary: item.progressSummary,
    })),
    fieldReports: fieldReports.map((item) => ({
      id: item.reportId || item.id,
      staffName: item.staffName,
      siteLocation: item.siteLocation,
      reportDate: item.reportDate,
      status: item.status,
      workPerformed: item.workPerformed,
    })),
    reviews: reviews.map((item) => ({
      id: item.reviewId || item.id,
      title: item.title,
      status: item.status,
      reviewDate: item.reviewDate,
      reviewer: item.reviewerName,
    })),
  };
}

function writeSectionTitle(doc, title) {
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(title);
  doc.moveDown(0.25);
  doc.strokeColor('#E5E7EB').moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.35);
}

function writeKeyValue(doc, label, value) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151').text(`${label}: `, { continued: true });
  doc.font('Helvetica').fillColor('#111827').text(value ?? 'N/A');
}

function writeTableHeader(doc, columns) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
  doc.text(columns.join(' | '));
  doc.font('Helvetica').fontSize(9);
}

function ensurePageSpace(doc, minHeight = 80) {
  if (doc.y + minHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

export function renderImplementationPdf(report, generatedBy = 'System') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const project = report.project;
    const impl = report.implementation;
    const perf = report.performance;

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text('Project Implementation Report');
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(11).fillColor('#4B5563')
      .text(`Generated by: ${generatedBy}`)
      .text(`Generated at: ${new Date(report.generatedAt).toLocaleString()}`);

    writeSectionTitle(doc, 'Project Overview');
    writeKeyValue(doc, 'Project Name', project.name);
    writeKeyValue(doc, 'Project Code', project.id);
    writeKeyValue(doc, 'Client', project.client);
    writeKeyValue(doc, 'Department', project.department);
    writeKeyValue(doc, 'Manager', project.manager);
    writeKeyValue(doc, 'Status', formatLabel(project.status));
    writeKeyValue(doc, 'Priority', formatLabel(project.priority));
    writeKeyValue(doc, 'Progress', `${project.progress || 0}%`);
    writeKeyValue(doc, 'Timeline', `${formatDate(project.startDate)} - ${formatDate(project.endDate)}`);
    writeKeyValue(doc, 'Location', project.location);
    writeKeyValue(doc, 'Budget', `${formatCurrency(project.budget)} (Spent: ${formatCurrency(project.spent)})`);
    if (project.description) {
      doc.moveDown(0.25);
      doc.font('Helvetica-Bold').fontSize(10).text('Description');
      doc.font('Helvetica').fontSize(10).text(project.description, { align: 'left' });
    }

    if (impl) {
      writeSectionTitle(doc, 'Implementation Details');
      writeKeyValue(doc, 'Implementation ID', impl.id);
      writeKeyValue(doc, 'Title', impl.title);
      writeKeyValue(doc, 'Status', formatLabel(impl.status));
      writeKeyValue(doc, 'Progress', `${impl.progress || 0}%`);
      writeKeyValue(doc, 'Timeline', `${formatDate(impl.startDate)} - ${formatDate(impl.endDate)}`);
      writeKeyValue(doc, 'Budget', `${formatCurrency(impl.budget)} (Spent: ${formatCurrency(impl.spent)})`);
      if (impl.description) {
        doc.moveDown(0.25);
        doc.font('Helvetica-Bold').fontSize(10).text('Implementation Description');
        doc.font('Helvetica').fontSize(10).text(impl.description);
      }
    }

    writeSectionTitle(doc, 'Performance Summary');
    writeKeyValue(doc, 'Average Completion', `${perf.averageCompletion}%`);
    writeKeyValue(doc, 'On-Time Delivery', `${perf.onTimeDelivery}%`);
    writeKeyValue(doc, 'Quality Score', `${perf.qualityScore}%`);
    writeKeyValue(doc, 'Budget Efficiency', `${perf.budgetEfficiency}%`);
    writeKeyValue(doc, 'Tasks Completed', `${perf.totals.completedTasks} / ${perf.totals.totalTasks}`);
    writeKeyValue(doc, 'Deliverables Approved', `${perf.totals.approvedDeliverables} / ${perf.totals.totalDeliverables}`);
    writeKeyValue(doc, 'Reviews Approved', `${perf.totals.approvedReviews} / ${perf.totals.totalReviews}`);

    writeSectionTitle(doc, 'Statistics');
    writeKeyValue(doc, 'Active Risks', String(report.stats.risks?.active || 0));
    writeKeyValue(doc, 'Open Issues', String(report.stats.issues?.open || 0));
    writeKeyValue(doc, 'Work Reports', `${report.stats.workReports.total} total (${report.stats.workReports.approved} approved)`);
    writeKeyValue(doc, 'Field Reports', `${report.stats.fieldReports.total} total (${report.stats.fieldReports.approved} approved)`);
    writeKeyValue(doc, 'Deliverable Reports', String(report.stats.deliverableReports || 0));
    writeKeyValue(doc, 'Total Expenses', formatCurrency(report.stats.expenses?.totalAmount || report.stats.expenses?.total_amount || perf.totals.totalSpent));

    if (report.team.length > 0) {
      ensurePageSpace(doc);
      writeSectionTitle(doc, `Project Team (${report.team.length})`);
      report.team.forEach((member) => {
        ensurePageSpace(doc, 20);
        doc.fontSize(9).text(`${member.name || 'N/A'} | ${formatLabel(member.role)} | ${member.email || 'N/A'} | ${formatLabel(member.status)}`);
      });
    }

    if (report.tasks.length > 0) {
      ensurePageSpace(doc);
      writeSectionTitle(doc, `Tasks (${report.tasks.length})`);
      report.tasks.slice(0, 40).forEach((task) => {
        ensurePageSpace(doc, 20);
        doc.fontSize(9).text(`${task.id || 'Task'} | ${task.title} | ${formatLabel(task.status)} | ${formatLabel(task.priority)} | Due: ${formatDate(task.dueDate)}`);
      });
      if (report.tasks.length > 40) {
        doc.text(`... and ${report.tasks.length - 40} more tasks`);
      }
    }

    if (report.deliverables.length > 0) {
      ensurePageSpace(doc);
      writeSectionTitle(doc, `Deliverables (${report.deliverables.length})`);
      report.deliverables.slice(0, 30).forEach((item) => {
        ensurePageSpace(doc, 20);
        doc.fontSize(9).text(`${item.id || 'Deliverable'} | ${item.title} | ${item.category || 'N/A'} | ${formatLabel(item.status)}`);
      });
    }

    if (report.expenses.length > 0) {
      ensurePageSpace(doc);
      writeSectionTitle(doc, `Expenses (${report.expenses.length})`);
      report.expenses.slice(0, 30).forEach((item) => {
        ensurePageSpace(doc, 20);
        doc.fontSize(9).text(`${item.id || 'Expense'} | ${item.category} | ${formatCurrency(item.amount, item.currency || 'USD')} | ${formatLabel(item.status)} | ${item.description}`);
      });
    }

    if (report.risks.length > 0) {
      ensurePageSpace(doc);
      writeSectionTitle(doc, `Risks (${report.risks.length})`);
      report.risks.slice(0, 20).forEach((item) => {
        ensurePageSpace(doc, 20);
        doc.fontSize(9).text(`${item.id || 'Risk'} | ${item.title} | ${formatLabel(item.severity)} | ${formatLabel(item.status)}`);
      });
    }

    if (report.issues.length > 0) {
      ensurePageSpace(doc);
      writeSectionTitle(doc, `Issues (${report.issues.length})`);
      report.issues.slice(0, 20).forEach((item) => {
        ensurePageSpace(doc, 20);
        doc.fontSize(9).text(`${item.id || 'Issue'} | ${item.title} | ${formatLabel(item.severity)} | ${formatLabel(item.status)}`);
      });
    }

    if (report.workReports.length > 0) {
      ensurePageSpace(doc);
      writeSectionTitle(doc, `Work Reports (${report.workReports.length})`);
      report.workReports.slice(0, 15).forEach((item) => {
        ensurePageSpace(doc, 30);
        doc.fontSize(9).text(`${item.id} | ${item.staffName || 'N/A'} | ${formatLabel(item.reportType)} | ${formatDate(item.reportDate)} | ${formatLabel(item.status)}`);
        if (item.summary) {
          doc.fontSize(8).fillColor('#4B5563').text(item.summary.slice(0, 180) + (item.summary.length > 180 ? '...' : ''));
          doc.fillColor('#111827');
        }
      });
    }

    if (report.fieldReports.length > 0) {
      ensurePageSpace(doc);
      writeSectionTitle(doc, `Field Reports (${report.fieldReports.length})`);
      report.fieldReports.slice(0, 15).forEach((item) => {
        ensurePageSpace(doc, 30);
        doc.fontSize(9).text(`${item.id} | ${item.staffName || 'N/A'} | ${item.siteLocation || 'N/A'} | ${formatDate(item.reportDate)} | ${formatLabel(item.status)}`);
        if (item.workPerformed) {
          doc.fontSize(8).fillColor('#4B5563').text(item.workPerformed.slice(0, 180) + (item.workPerformed.length > 180 ? '...' : ''));
          doc.fillColor('#111827');
        }
      });
    }

    doc.end();
  });
}

export function renderImplementationCsv(report, generatedBy = 'System') {
  const lines = [];
  const push = (...values) => lines.push(values.map(csvEscape).join(','));

  push('Project Implementation Report');
  push('Generated By', generatedBy);
  push('Generated At', new Date(report.generatedAt).toLocaleString());
  lines.push('');

  const project = report.project;
  push('Section', 'Field', 'Value');
  push('Project', 'Name', project.name);
  push('Project', 'Code', project.id);
  push('Project', 'Client', project.client);
  push('Project', 'Department', project.department);
  push('Project', 'Manager', project.manager);
  push('Project', 'Status', formatLabel(project.status));
  push('Project', 'Priority', formatLabel(project.priority));
  push('Project', 'Progress', `${project.progress || 0}%`);
  push('Project', 'Start Date', formatDate(project.startDate));
  push('Project', 'End Date', formatDate(project.endDate));
  push('Project', 'Budget', formatCurrency(project.budget));
  push('Project', 'Spent', formatCurrency(project.spent));
  push('Project', 'Description', project.description || '');

  if (report.implementation) {
    const impl = report.implementation;
    push('Implementation', 'ID', impl.id);
    push('Implementation', 'Title', impl.title);
    push('Implementation', 'Status', formatLabel(impl.status));
    push('Implementation', 'Progress', `${impl.progress || 0}%`);
    push('Implementation', 'Budget', formatCurrency(impl.budget));
    push('Implementation', 'Spent', formatCurrency(impl.spent));
  }

  lines.push('');
  push('Performance', 'Average Completion', `${report.performance.averageCompletion}%`);
  push('Performance', 'On-Time Delivery', `${report.performance.onTimeDelivery}%`);
  push('Performance', 'Quality Score', `${report.performance.qualityScore}%`);
  push('Performance', 'Budget Efficiency', `${report.performance.budgetEfficiency}%`);
  push('Performance', 'Tasks Completed', `${report.performance.totals.completedTasks}/${report.performance.totals.totalTasks}`);
  push('Performance', 'Deliverables Approved', `${report.performance.totals.approvedDeliverables}/${report.performance.totals.totalDeliverables}`);

  lines.push('');
  push('Team Member', 'Role', 'Email', 'Status', 'Department');
  report.team.forEach((member) => {
    push(member.name, formatLabel(member.role), member.email, formatLabel(member.status), member.department);
  });

  lines.push('');
  push('Task ID', 'Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Progress');
  report.tasks.forEach((task) => {
    push(task.id, task.title, formatLabel(task.status), formatLabel(task.priority), task.assignee, formatDate(task.dueDate), task.progress);
  });

  lines.push('');
  push('Deliverable ID', 'Title', 'Category', 'Status', 'Due Date', 'Submitted By');
  report.deliverables.forEach((item) => {
    push(item.id, item.title, item.category, formatLabel(item.status), formatDate(item.dueDate), item.submittedBy);
  });

  lines.push('');
  push('Expense ID', 'Category', 'Description', 'Amount', 'Currency', 'Status', 'Date', 'Submitted By');
  report.expenses.forEach((item) => {
    push(item.id, item.category, item.description, item.amount, item.currency, formatLabel(item.status), formatDate(item.date), item.submittedBy);
  });

  lines.push('');
  push('Risk ID', 'Title', 'Severity', 'Status', 'Probability', 'Impact');
  report.risks.forEach((item) => {
    push(item.id, item.title, formatLabel(item.severity), formatLabel(item.status), item.probability, item.impact);
  });

  lines.push('');
  push('Issue ID', 'Title', 'Severity', 'Status', 'Reported By');
  report.issues.forEach((item) => {
    push(item.id, item.title, formatLabel(item.severity), formatLabel(item.status), item.reportedBy);
  });

  lines.push('');
  push('Work Report ID', 'Employee', 'Type', 'Date', 'Status', 'Summary');
  report.workReports.forEach((item) => {
    push(item.id, item.staffName, formatLabel(item.reportType), formatDate(item.reportDate), formatLabel(item.status), item.summary);
  });

  lines.push('');
  push('Field Report ID', 'Employee', 'Site Location', 'Date', 'Status', 'Work Performed');
  report.fieldReports.forEach((item) => {
    push(item.id, item.staffName, item.siteLocation, formatDate(item.reportDate), formatLabel(item.status), item.workPerformed);
  });

  return lines.join('\n');
}

export function renderPerformanceCsv(reportData) {
  const lines = [];
  const push = (...values) => lines.push(values.map(csvEscape).join(','));
  push('Performance Report');
  push('Generated By', reportData.generatedBy);
  push('Generated At', new Date(reportData.generatedAt).toLocaleString());
  if (reportData.period) push('Period', reportData.period);
  lines.push('');
  push('Metric', 'Value');
  push('Total Projects', reportData.totalProjects);
  push('Active Projects', reportData.activeProjects);
  push('Completed Projects', reportData.completedProjects);
  push('Average Completion', `${reportData.averageCompletion}%`);
  push('On-Time Delivery', `${reportData.onTimeDelivery}%`);
  push('Quality Score', `${reportData.qualityScore}%`);
  push('Budget Efficiency', `${reportData.budgetEfficiency}%`);
  if (reportData.tasksCompleted != null) push('Tasks Completed', `${reportData.tasksCompleted}/${reportData.totalTasks}`);
  if (reportData.approvedDeliverables != null) push('Deliverables Approved', `${reportData.approvedDeliverables}/${reportData.totalDeliverables}`);
  return lines.join('\n');
}

export async function renderPerformancePdf(reportData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text(reportData.title || 'Performance Report');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11)
      .text(`Generated by: ${reportData.generatedBy}`)
      .text(`Generated at: ${new Date(reportData.generatedAt).toLocaleString()}`);
    if (reportData.period) doc.text(`Period: ${reportData.period}`);
    doc.moveDown();
    writeKeyValue(doc, 'Total Projects', reportData.totalProjects);
    writeKeyValue(doc, 'Active Projects', reportData.activeProjects);
    writeKeyValue(doc, 'Completed Projects', reportData.completedProjects);
    writeKeyValue(doc, 'Average Completion', `${reportData.averageCompletion}%`);
    writeKeyValue(doc, 'On-Time Delivery', `${reportData.onTimeDelivery}%`);
    writeKeyValue(doc, 'Quality Score', `${reportData.qualityScore}%`);
    writeKeyValue(doc, 'Budget Efficiency', `${reportData.budgetEfficiency}%`);
    doc.end();
  });
}

export { formatDate, formatCurrency, formatLabel };
