import Project from '../models/Project.js';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import Invoice from '../models/Invoice.js';
import VendorPayment from '../models/VendorPayment.js';
import Staff from '../models/Staff.js';

function projectKey(project) {
  return project?.dbId || project?.id;
}

function matchesProject(recordProjectId, projectId) {
  if (!recordProjectId || !projectId) return false;
  return Number(recordProjectId) === Number(projectId);
}

function resolveApprovedBudget(project, budget) {
  if (budget) {
    return parseFloat(budget.revisedBudget ?? budget.approvedBudget) || 0;
  }
  return parseFloat(project?.budget) || 0;
}

function resolveHealth(spentPercent) {
  if (spentPercent > 100) return 'Critical';
  if (spentPercent > 90) return 'Warning';
  return 'On Track';
}

function monthKey(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthlySeries(items, amountField, dateField, months = 6) {
  const now = new Date();
  const buckets = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'short' }),
      value: 0,
    });
  }

  const bucketMap = new Map(buckets.map((b) => [b.key, b]));
  items.forEach((item) => {
    const key = monthKey(item[dateField] || item.createdAt);
    if (!key || !bucketMap.has(key)) return;
    bucketMap.get(key).value += parseFloat(item[amountField]) || 0;
  });

  return buckets.map(({ label, value }) => ({ label, value: Math.round(value * 100) / 100 }));
}

export async function resolveFinanceScope(staffId) {
  const staff = staffId ? await Staff.findById(staffId) : null;
  const role = (staff?.role || '').toLowerCase();
  const panel = String(staff?.controlPanel || '').toLowerCase().replace(/_/g, '-');

  const isOrgWide =
    ['superadmin', 'admin', 'administrator', 'finance'].includes(role.replace(/\s+/g, '')) ||
    panel === 'finance' ||
    panel === 'dashboard';

  const departmentId =
    !isOrgWide && (panel === 'finance-department' || staff?.departmentId)
      ? staff.departmentId
      : null;

  return { staff, isOrgWide, departmentId };
}

export async function buildFinanceOverview({ staffId, departmentId: queryDepartmentId } = {}) {
  const scope = await resolveFinanceScope(staffId);
  const departmentId = queryDepartmentId || scope.departmentId || null;

  const projectFilters = { limit: 10000 };
  if (departmentId) projectFilters.departmentId = departmentId;

  const [projects, budgets, expenses, invoices, payments] = await Promise.all([
    Project.findAll(projectFilters),
    Budget.findAll({ limit: 10000 }),
    Expense.findAll({ limit: 10000 }),
    Invoice.findAll({ limit: 10000 }),
    VendorPayment.findAll({ limit: 10000 }),
  ]);

  const visibleProjectIds = new Set(projects.map((p) => projectKey(p)).filter(Boolean));
  const budgetByProject = new Map();
  budgets.forEach((budget) => {
    if (visibleProjectIds.has(budget.projectId)) {
      budgetByProject.set(budget.projectId, budget);
    }
  });

  // Include projects referenced by financial records even if not in initial list
  [...expenses, ...invoices, ...budgets].forEach((record) => {
    const pid = record.projectId || record.projectDbId;
    if (pid && !visibleProjectIds.has(pid)) {
      const match = projects.find((p) => projectKey(p) === pid);
      if (match) visibleProjectIds.add(pid);
    }
  });

  const scopedExpenses = expenses.filter((e) =>
    visibleProjectIds.has(e.projectId || e.projectDbId)
  );
  const scopedInvoices = invoices.filter((i) =>
    visibleProjectIds.has(i.projectId || i.projectDbId)
  );
  const scopedPayments = payments.filter((p) =>
    visibleProjectIds.has(p.projectId || p.projectDbId)
  );

  const projectRows = projects.map((project) => {
    const pid = projectKey(project);
    const budget = budgetByProject.get(pid);
    const projectExpenses = scopedExpenses.filter((e) => matchesProject(e.projectId || e.projectDbId, pid));
    const projectInvoices = scopedInvoices.filter((i) => matchesProject(i.projectId || i.projectDbId, pid));
    const approvedBudget = resolveApprovedBudget(project, budget);
    const actualCosts = projectExpenses
      .filter((e) => e.status === 'approved')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const revenue = projectInvoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0);
    const profit = revenue - actualCosts;
    const spentPercent = approvedBudget > 0 ? (actualCosts / approvedBudget) * 100 : 0;

    return {
      id: pid,
      name: project.name || 'Unnamed Project',
      client: project.client || 'N/A',
      department: project.department || 'N/A',
      status: project.status || 'active',
      progress: project.progress || 0,
      budget: Math.round(approvedBudget * 100) / 100,
      actual: Math.round(actualCosts * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      remaining: Math.round((approvedBudget - actualCosts) * 100) / 100,
      spentPercent: Math.round(spentPercent * 10) / 10,
      health: resolveHealth(spentPercent),
    };
  });

  projectRows.sort((a, b) => b.budget - a.budget || a.name.localeCompare(b.name));

  const approvedExpenses = scopedExpenses.filter((e) => e.status === 'approved');
  const pendingExpenses = scopedExpenses.filter((e) => e.status === 'pending');
  const paidInvoices = scopedInvoices.filter((i) => i.status === 'paid');
  const pendingInvoices = scopedInvoices.filter((i) =>
    ['sent', 'draft', 'overdue'].includes(i.status)
  );

  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0);
  const totalExpenses = approvedExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalBudget = projectRows.reduce((sum, p) => sum + p.budget, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const pendingPayments = pendingInvoices.reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0);

  const expenseCategories = {};
  approvedExpenses.forEach((expense) => {
    const category = expense.category || 'Other';
    if (!expenseCategories[category]) expenseCategories[category] = { amount: 0, count: 0 };
    expenseCategories[category].amount += parseFloat(expense.amount) || 0;
    expenseCategories[category].count += 1;
  });

  const categoryRows = Object.entries(expenseCategories)
    .map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
      percentage: totalExpenses > 0 ? Math.round((data.amount / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const projectNameById = new Map(projectRows.map((p) => [p.id, p.name]));

  const recentExpenses = [...scopedExpenses]
    .sort((a, b) => new Date(b.expenseDate || b.createdAt) - new Date(a.expenseDate || a.createdAt))
    .slice(0, 10)
    .map((e) => ({
      id: e.id || e.dbId || e.expenseId,
      projectId: e.projectId || e.projectDbId,
      project: projectNameById.get(e.projectId || e.projectDbId) || 'Unknown',
      description: e.description,
      category: e.category,
      amount: parseFloat(e.amount) || 0,
      status: e.status,
      date: e.expenseDate || e.createdAt,
    }));

  const recentInvoices = [...scopedInvoices]
    .sort((a, b) => new Date(b.invoiceDate || b.createdAt) - new Date(a.invoiceDate || a.createdAt))
    .slice(0, 10)
    .map((i) => ({
      id: i.id || i.dbId || i.invoiceId,
      projectId: i.projectId || i.projectDbId,
      project: projectNameById.get(i.projectId || i.projectDbId) || i.clientName || 'Unknown',
      invoiceNumber: i.invoiceNumber || i.invoiceId,
      clientName: i.clientName || i.clientCompany,
      amount: parseFloat(i.totalAmount) || 0,
      status: i.status,
      date: i.invoiceDate || i.createdAt,
    }));

  const pendingVendorPayments = scopedPayments
    .filter((p) => p.status === 'pending_approval' || p.status === 'approved')
    .slice(0, 10)
    .map((p) => ({
      id: p.id || p.dbId,
      project: projectNameById.get(p.projectId || p.projectDbId) || 'Unknown',
      supplier: p.vendorName || 'Unknown',
      amount: parseFloat(p.amount) || 0,
      status: p.status,
      dueDate: p.dueDate,
    }));

  const monthlyRevenue = buildMonthlySeries(paidInvoices, 'totalAmount', 'paidDate');
  const monthlyExpenses = buildMonthlySeries(approvedExpenses, 'amount', 'expenseDate');

  const activeProjects = projectRows.filter((p) =>
    ['active', 'in_progress', 'planning', 'implementation'].includes(String(p.status).toLowerCase())
  ).length;

  return {
    scope: {
      isOrgWide: scope.isOrgWide,
      departmentId,
    },
    stats: {
      totalProjects: projectRows.length,
      activeProjects,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(totalProfit * 100) / 100,
      profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0,
      pendingPayments: Math.round(pendingPayments * 100) / 100,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices: scopedInvoices.filter((i) => i.status === 'overdue').length,
      paidInvoices: paidInvoices.length,
      pendingExpenses: pendingExpenses.length,
      costVariance: Math.round((totalExpenses - totalBudget) * 100) / 100,
      budgetUtilization: totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 1000) / 10 : 0,
    },
    projects: projectRows,
    expenseCategories: categoryRows,
    recentExpenses,
    recentInvoices,
    pendingVendorPayments,
    monthlyRevenue,
    monthlyExpenses,
  };
}
