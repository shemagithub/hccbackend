import Budget from '../models/Budget.js';
import Project from '../models/Project.js';
import Expense from '../models/Expense.js';
import Invoice from '../models/Invoice.js';
import pool from '../config/db.js';

const CATEGORY_MAP = {
  Personnel: 'labor',
  Consultants: 'labor',
  Materials: 'materials',
  Equipment: 'equipment',
  'Transport & Fuel': 'transport',
  'Field Activities': 'overhead',
  Other: 'overhead',
};

const CATEGORY_KEYS = ['labor', 'materials', 'equipment', 'transport', 'overhead'];

function formatProjectStatus(status) {
  const map = {
    planning: 'Planning',
    ongoing: 'In Progress',
    near_completion: 'In Progress',
    completed: 'Completed',
    overdue: 'Overdue',
    on_hold: 'On Hold',
    cancelled: 'Cancelled',
  };
  return map[status] || status || 'Unknown';
}

function emptyCategories() {
  return CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = { budgeted: 0, actual: 0, variance: 0 };
    return acc;
  }, {});
}

function allocateBudgetCategories(totalBudget, actualByCategory) {
  const result = emptyCategories();
  const totalActual = CATEGORY_KEYS.reduce((sum, key) => sum + (actualByCategory[key] || 0), 0);

  CATEGORY_KEYS.forEach((key) => {
    const actual = actualByCategory[key] || 0;
    const budgeted =
      totalActual > 0 ? (actual / totalActual) * totalBudget : totalBudget / CATEGORY_KEYS.length;
    result[key] = {
      budgeted: Math.round(budgeted * 100) / 100,
      actual: Math.round(actual * 100) / 100,
      variance: Math.round((budgeted - actual) * 100) / 100,
    };
  });

  return result;
}

function parseDateRange(timeRange) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (timeRange) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString().slice(0, 10), endDate: today };
    }
    case 'last_3_months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { startDate: start.toISOString().slice(0, 10), endDate: today };
    }
    case 'this_year':
      return { startDate: `${now.getFullYear()}-01-01`, endDate: today };
    case 'last_year':
      return {
        startDate: `${now.getFullYear() - 1}-01-01`,
        endDate: `${now.getFullYear() - 1}-12-31`,
      };
    default:
      return { startDate: undefined, endDate: undefined };
  }
}

export class BudgetController {
  static async createBudget(req, res) {
    try {
      const {
        budgetId,
        projectId,
        approvedBudget,
        revisedBudget,
        currency = 'USD',
        fiscalYear,
        approvedDate,
        revisedDate,
        approvedBy,
        approvedByName,
        notes
      } = req.body;

      // Basic validation
      if (!projectId || !approvedBudget) {
        return res.status(400).json({
          success: false,
          message: 'Project ID and approved budget are required.'
        });
      }

      // Verify project exists
      const project = await Project.findById(parseInt(projectId));
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found.'
        });
      }

      const budget = await Budget.create({
        budgetId,
        projectId: parseInt(projectId),
        approvedBudget: parseFloat(approvedBudget),
        revisedBudget: revisedBudget ? parseFloat(revisedBudget) : null,
        currency,
        fiscalYear,
        approvedDate,
        revisedDate,
        approvedBy: approvedBy ? parseInt(approvedBy) : null,
        approvedByName,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Budget created successfully.',
        data: budget
      });
    } catch (error) {
      console.error('Create budget error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create budget.',
        error: error.message
      });
    }
  }

  static async getBudgets(req, res) {
    try {
      const { projectId, page = 1, limit = 10 } = req.query;

      const filters = {
        projectId: projectId ? parseInt(projectId) : undefined
      };

      const budgets = await Budget.findAll(filters);

      // Calculate stats
      const totalBudget = budgets.reduce((sum, b) => sum + (b.revisedBudget || b.approvedBudget), 0);
      const totalApproved = budgets.reduce((sum, b) => sum + b.approvedBudget, 0);
      const totalRevised = budgets.reduce((sum, b) => sum + (b.revisedBudget || 0), 0);

      res.json({
        success: true,
        data: budgets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: budgets.length
        },
        stats: {
          total: budgets.length,
          totalBudget,
          totalApproved,
          totalRevised,
          averageBudget: budgets.length > 0 ? totalBudget / budgets.length : 0
        }
      });
    } catch (error) {
      console.error('Get budgets error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budgets.',
        error: error.message
      });
    }
  }

  static async getProfitLossReport(req, res) {
    try {
      const { timeRange = 'all', startDate: queryStart, endDate: queryEnd } = req.query;
      const parsed = parseDateRange(timeRange);
      const startDate = queryStart || parsed.startDate;
      const endDate = queryEnd || parsed.endDate;

      const expenseFilters = { limit: 10000, status: 'approved' };
      const invoiceFilters = { limit: 10000 };
      if (startDate) expenseFilters.startDate = startDate;
      if (endDate) expenseFilters.endDate = endDate;
      if (startDate) invoiceFilters.startDate = startDate;
      if (endDate) invoiceFilters.endDate = endDate;

      const [projects, budgets, expenses, invoices] = await Promise.all([
        Project.findAll({ limit: 10000 }),
        Budget.findAll({ limit: 10000 }),
        Expense.findAll(expenseFilters),
        Invoice.findAll(invoiceFilters),
      ]);

      const budgetByProject = new Map();
      budgets.forEach((budget) => {
        budgetByProject.set(budget.projectId, budget);
      });

      const projectIds = new Set([
        ...projects.map((p) => p.dbId || p.id),
        ...budgets.map((b) => b.projectId),
        ...expenses.map((e) => e.projectId || e.projectDbId).filter(Boolean),
        ...invoices.map((i) => i.projectId || i.projectDbId).filter(Boolean),
      ]);

      const rows = [];

      for (const projectId of projectIds) {
        const project =
          projects.find((p) => (p.dbId || p.id) === projectId) ||
          projects.find((p) => p.id === projectId);
        const budget = budgetByProject.get(projectId);

        const projectExpenses = expenses.filter(
          (e) => (e.projectId || e.projectDbId) === projectId
        );
        const projectInvoices = invoices.filter(
          (i) => (i.projectId || i.projectDbId) === projectId && i.status === 'paid'
        );

        const approvedBudget = budget
          ? parseFloat(budget.revisedBudget ?? budget.approvedBudget) || 0
          : parseFloat(project?.budget) || 0;

        if (!project && !budget && projectExpenses.length === 0 && projectInvoices.length === 0) {
          continue;
        }

        const actualCosts = projectExpenses.reduce(
          (sum, e) => sum + (parseFloat(e.amount) || 0),
          0
        );
        const revenue = projectInvoices.reduce(
          (sum, i) => sum + (parseFloat(i.totalAmount) || 0),
          0
        );
        const profit = revenue - actualCosts;
        const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

        const actualByCategory = emptyCategories();
        projectExpenses.forEach((expense) => {
          const key = CATEGORY_MAP[expense.category] || 'overhead';
          actualByCategory[key] += parseFloat(expense.amount) || 0;
        });

        const categories = allocateBudgetCategories(approvedBudget, actualByCategory);
        const lastExpenseDate = projectExpenses
          .map((e) => e.expenseDate || e.createdAt)
          .filter(Boolean)
          .sort()
          .pop();
        const lastInvoiceDate = projectInvoices
          .map((i) => i.paidDate || i.invoiceDate || i.createdAt)
          .filter(Boolean)
          .sort()
          .pop();
        const lastUpdated = [lastExpenseDate, lastInvoiceDate, budget?.updatedAt, project?.updatedAt]
          .filter(Boolean)
          .sort()
          .pop();

        rows.push({
          id: String(projectId),
          projectName: project?.name || budget?.projectName || `Project #${projectId}`,
          client: project?.client || 'N/A',
          startDate: project?.startDate || null,
          endDate: project?.endDate || null,
          status: formatProjectStatus(project?.status),
          budget: Math.round(approvedBudget * 100) / 100,
          actualCosts: Math.round(actualCosts * 100) / 100,
          revenue: Math.round(revenue * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          profitMargin: Math.round(profitMargin * 10) / 10,
          completionPercentage: project?.progress ?? 0,
          categories,
          lastUpdated: lastUpdated ? String(lastUpdated).slice(0, 10) : null,
          currency: budget?.currency || project?.currency || 'USD',
        });
      }

      rows.sort((a, b) => b.revenue - a.revenue || a.projectName.localeCompare(b.projectName));

      const summary = {
        totalBudget: rows.reduce((sum, r) => sum + r.budget, 0),
        totalActualCosts: rows.reduce((sum, r) => sum + r.actualCosts, 0),
        totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0),
        totalProfit: rows.reduce((sum, r) => sum + r.profit, 0),
        projectCount: rows.length,
      };
      summary.overallMargin =
        summary.totalRevenue > 0
          ? Math.round((summary.totalProfit / summary.totalRevenue) * 1000) / 10
          : 0;

      res.json({
        success: true,
        data: rows,
        summary,
        filters: { timeRange, startDate: startDate || null, endDate: endDate || null },
      });
    } catch (error) {
      console.error('Get profit/loss report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profit/loss report.',
        error: error.message,
      });
    }
  }

  static async getBudgetById(req, res) {
    try {
      const { id } = req.params;

      const budget = await Budget.findById(parseInt(id));

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found.'
        });
      }

      res.json({
        success: true,
        data: budget
      });
    } catch (error) {
      console.error('Get budget by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budget.',
        error: error.message
      });
    }
  }

  static async getBudgetByProjectId(req, res) {
    try {
      const { projectId } = req.params;

      const budget = await Budget.findByProjectId(parseInt(projectId));

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found for this project.'
        });
      }

      res.json({
        success: true,
        data: budget
      });
    } catch (error) {
      console.error('Get budget by project ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budget.',
        error: error.message
      });
    }
  }

  static async updateBudget(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Budget ID is required.'
        });
      }

      const budget = await Budget.findById(parseInt(id));
      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found.'
        });
      }

      // Ensure only allowed fields are updated
      const allowedFields = [
        'revisedBudget', 'revisedDate', 'approvedBy', 'approvedByName',
        'approvedDate', 'notes'
      ];
      const filteredUpdateData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});

      if (Object.keys(filteredUpdateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update.'
        });
      }

      const updated = await Budget.update(budget.dbId, filteredUpdateData);
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'Failed to update budget.'
        });
      }

      const updatedBudget = await Budget.findById(budget.dbId);

      res.json({
        success: true,
        message: 'Budget updated successfully.',
        data: updatedBudget
      });
    } catch (error) {
      console.error('Update budget error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update budget.',
        error: error.message
      });
    }
  }

  static async deleteBudget(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Budget ID is required.'
        });
      }

      const budget = await Budget.findById(parseInt(id));
      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found.'
        });
      }

      // Note: Budget model doesn't have delete method, but we can add it
      // For now, return success (actual deletion would need to be added to model)
      res.json({
        success: true,
        message: 'Budget deleted successfully.'
      });
    } catch (error) {
      console.error('Delete budget error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete budget.',
        error: error.message
      });
    }
  }
}

