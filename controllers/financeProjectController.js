import Project from '../models/Project.js';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import VendorPayment from '../models/VendorPayment.js';
import SupplierInvoice from '../models/SupplierInvoice.js';
import FundRequest from '../models/FundRequest.js';
import Staff from '../models/Staff.js';
import pool from '../config/db.js';

export class FinanceProjectController {
  // Get dashboard overview with financial summaries
  static async getDashboard(req, res) {
    try {
      const staff = await Staff.findById(req.staffId);
      
      // Get projects assigned to user or department
      const projectFilters = { limit: 10000 };
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.departmentId) {
        projectFilters.departmentId = staff.departmentId;
      }

      const projects = await Project.findAll(projectFilters);
      
      // Get budgets for all projects
      const budgets = await Budget.findAll({ limit: 10000 });
      
      // Get expenses for all projects
      const expenses = await Expense.findAll({ limit: 10000 });
      
      // Get vendor payments
      const payments = await VendorPayment.findAll({ limit: 10000 });
      
      // Get supplier invoices
      const invoices = await SupplierInvoice.findAll({ limit: 10000 });

      // Calculate financial data per project
      const projectFinancials = projects.map(project => {
        const projectBudgets = budgets.filter(b => b.projectId === project.id || b.projectId === project.dbId);
        const projectExpenses = expenses.filter(e => e.projectId === project.id || e.projectId === project.dbId);
        const projectPayments = payments.filter(p => p.projectId === project.id || p.projectId === project.dbId);
        
        const approvedBudget = projectBudgets.length > 0 
          ? (projectBudgets[0].revisedBudget || projectBudgets[0].approvedBudget || 0)
          : (project.budget || 0);
        const actualSpend = projectExpenses
          .filter(e => e.status === 'approved')
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const remaining = approvedBudget - actualSpend;
        const spentPercent = approvedBudget > 0 ? (actualSpend / approvedBudget) * 100 : 0;
        
        // Determine health status
        let health = "On Track";
        if (spentPercent > 90) health = "Warning";
        if (spentPercent > 100) health = "Critical";
        if (spentPercent < 50 && project.progress > 60) health = "Under Budget";

        return {
          id: project.id || project.dbId,
          name: project.name || 'Unnamed Project',
          client: project.client || 'N/A',
          department: project.department || 'N/A',
          budget: approvedBudget,
          actual: actualSpend,
          remaining: remaining,
          health: health,
          progress: project.progress || 0
        };
      });

      // Calculate expense categories
      const expenseCategories = {};
      expenses.filter(e => e.status === 'approved').forEach(expense => {
        const category = expense.category || 'Other';
        if (!expenseCategories[category]) {
          expenseCategories[category] = { amount: 0, count: 0 };
        }
        expenseCategories[category].amount += parseFloat(expense.amount) || 0;
        expenseCategories[category].count += 1;
      });

      // Get recent expenses
      const recentExpenses = expenses
        .filter(e => e.status === 'approved' || e.status === 'pending')
        .sort((a, b) => new Date(b.expenseDate || b.createdAt) - new Date(a.expenseDate || a.createdAt))
        .slice(0, 10)
        .map(e => ({
          id: e.id,
          project: projects.find(p => (p.id || p.dbId) === (e.projectId || e.projectDbId))?.name || 'Unknown',
          category: e.category,
          amount: parseFloat(e.amount) || 0,
          date: e.expenseDate || e.createdAt,
          status: e.status,
          approvedBy: e.approvedByName || null
        }));

      // Get pending payments
      const pendingPayments = payments
        .filter(p => p.status === 'pending_approval' || p.status === 'approved')
        .map(p => ({
          id: p.id,
          project: projects.find(proj => (proj.id || proj.dbId) === (p.projectId || p.projectDbId))?.name || 'Unknown',
          supplier: p.vendorName || 'Unknown',
          amount: parseFloat(p.amount) || 0,
          dueDate: p.dueDate,
          status: p.status === 'approved' ? 'Approved' : 'Pending Approval',
          invoice: p.invoiceNumber || 'N/A'
        }));

      // Calculate totals
      const totalProjects = projectFinancials.length;
      const totalBudget = projectFinancials.reduce((sum, p) => sum + p.budget, 0);
      const totalActual = projectFinancials.reduce((sum, p) => sum + p.actual, 0);
      const costVariance = totalActual - totalBudget;
      const costVariancePercent = totalBudget > 0 ? ((costVariance / totalBudget) * 100).toFixed(1) : 0;
      const pendingPaymentsCount = pendingPayments.filter(p => p.status === 'Pending Approval').length;
      const unapprovedExpenses = expenses.filter(e => e.status === 'pending').length;

      // Cost by phase (simplified - can be enhanced with milestone data)
      const costByPhase = [
        { phase: 'Feasibility', budget: totalBudget * 0.1, actual: totalActual * 0.12, variance: totalActual * 0.12 - totalBudget * 0.1 },
        { phase: 'Design', budget: totalBudget * 0.3, actual: totalActual * 0.35, variance: totalActual * 0.35 - totalBudget * 0.3 },
        { phase: 'ESIA', budget: totalBudget * 0.25, actual: totalActual * 0.28, variance: totalActual * 0.28 - totalBudget * 0.25 },
        { phase: 'Supervision', budget: totalBudget * 0.35, actual: totalActual * 0.25, variance: totalActual * 0.25 - totalBudget * 0.35 }
      ];

      res.json({
        success: true,
        data: {
          projects: projectFinancials,
          expenseCategories: Object.entries(expenseCategories).map(([category, data]) => ({
            category,
            amount: data.amount,
            percentage: totalActual > 0 ? (data.amount / totalActual) * 100 : 0,
            count: data.count
          })),
          recentExpenses,
          pendingPayments,
          costByPhase,
          stats: {
            totalProjects,
            totalBudget,
            totalActual,
            costVariance,
            costVariancePercent,
            pendingPaymentsCount,
            unapprovedExpenses,
            transportFuelCost: expenseCategories['Transport & Fuel']?.amount || 0
          }
        }
      });
    } catch (error) {
      console.error('Get finance project dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data.',
        error: error.message
      });
    }
  }

  // Get project financial status
  static async getProjects(req, res) {
    try {
      const { search, client, status } = req.query;
      const staff = await Staff.findById(req.staffId);

      const projectFilters = { limit: 10000 };
      // For non-admin users, restrict to projects explicitly assigned to their email
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.email) {
        projectFilters.userEmail = staff.email;
      }
      if (client) projectFilters.client = client;
      if (status) projectFilters.status = status;

      const projects = await Project.findAll(projectFilters);
      const budgets = await Budget.findAll({ limit: 10000 });
      const expenses = await Expense.findAll({ limit: 10000 });

      const projectFinancials = projects.map(project => {
        const projectBudgets = budgets.filter(b => b.projectId === project.id || b.projectId === project.dbId);
        const projectExpenses = expenses.filter(e => e.projectId === project.id || e.projectId === project.dbId);
        
        const approvedBudget = projectBudgets.length > 0 
          ? (projectBudgets[0].revisedBudget || projectBudgets[0].approvedBudget || 0)
          : (project.budget || 0);
        const actualSpend = projectExpenses
          .filter(e => e.status === 'approved')
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const remaining = approvedBudget - actualSpend;
        const spentPercent = approvedBudget > 0 ? (actualSpend / approvedBudget) * 100 : 0;
        
        let health = "On Track";
        if (spentPercent > 90) health = "Warning";
        if (spentPercent > 100) health = "Critical";

        return {
          id: project.id || project.dbId,
          name: project.name || 'Unnamed Project',
          client: project.client || 'N/A',
          department: project.department || 'N/A',
          budget: approvedBudget,
          actual: actualSpend,
          remaining: remaining,
          health: health,
          progress: project.progress || 0,
          status: project.status
        };
      });

      // Filter by search
      let filteredProjects = projectFinancials;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredProjects = projectFinancials.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.client.toLowerCase().includes(searchLower) ||
          p.department.toLowerCase().includes(searchLower)
        );
      }

      res.json({
        success: true,
        data: filteredProjects
      });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch projects.',
        error: error.message
      });
    }
  }

  // Get budget overview with requests
  static async getBudgets(req, res) {
    try {
      const { projectId } = req.query;
      const staff = await Staff.findById(req.staffId);

      // Build project filters so non-admin users only see budgets
      // for projects they are explicitly assigned to (by email)
      const projectFilters = { limit: 10000 };
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.email) {
        projectFilters.userEmail = staff.email;
      }

      const budgetFilters = { limit: 10000 };
      if (projectId) budgetFilters.projectId = parseInt(projectId);

      const budgets = await Budget.findAll(budgetFilters);
      const projects = await Project.findAll(projectFilters);
      const expenses = await Expense.findAll({ limit: 10000 });
      const fundRequests = await FundRequest.findAll({ limit: 10000 });

      // Only consider budgets for projects the current user can see
      const visibleProjectIds = new Set(
        projects.map(project => project.id || project.dbId)
      );
      const visibleBudgets = budgets.filter(budget =>
        visibleProjectIds.has(budget.projectId)
      );

      // Get budget requests (from fund requests)
      const budgetRequests = fundRequests
        .filter(fr => fr.requestType === 'budget_increase' || fr.requestType === 'budget_revision')
        .map(fr => ({
          id: fr.id,
          project: projects.find(p => (p.id || p.dbId) === (fr.projectId || fr.projectDbId))?.name || 'Unknown',
          requestType: fr.requestType === 'budget_increase' ? 'Budget Increase' : 'Budget Revision',
          amount: parseFloat(fr.amount) || 0,
          requestedBy: fr.requestedByName || 'Unknown',
          date: fr.requestDate || fr.createdAt,
          status: fr.status === 'approved' ? 'Approved' : fr.status === 'rejected' ? 'Rejected' : 'Pending',
          reason: fr.description || fr.reason || null,
          approvedBy: fr.approvedByName || null,
          decisionDate: fr.approvalDate || null
        }))
        // Only include requests for projects the user can see
        .filter(request => projects.some(project => project.name === request.project));

      // Calculate budget overview
      const budgetOverview = visibleBudgets.map(budget => {
        const project = projects.find(p => (p.id || p.dbId) === budget.projectId);
        const projectExpenses = expenses.filter(e => 
          (e.projectId || e.projectDbId) === budget.projectId && e.status === 'approved'
        );
        
        const actual = projectExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const variance = actual - (budget.revisedBudget || budget.approvedBudget);
        
        let status = "On Track";
        const variancePercent = budget.revisedBudget || budget.approvedBudget > 0
          ? (variance / (budget.revisedBudget || budget.approvedBudget)) * 100
          : 0;
        if (variancePercent > 10) status = "Warning";
        if (variancePercent > 20) status = "Critical";

        return {
          id: budget.id,
          project: project?.name || 'Unknown Project',
          projectId: budget.projectId,
          approvedBudget: parseFloat(budget.approvedBudget || 0),
          revisedBudget: parseFloat(budget.revisedBudget || budget.approvedBudget || 0),
          actual: actual,
          variance: variance,
          status: status
        };
      });

      res.json({
        success: true,
        data: {
          budgets: budgetOverview,
          budgetRequests
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

  // Get expenses by project
  static async getExpenses(req, res) {
    try {
      const { projectId, status, category, search } = req.query;
      const staff = await Staff.findById(req.staffId);

      // Determine which projects this user can see
      const projectFilters = { limit: 10000 };
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.email) {
        projectFilters.userEmail = staff.email;
      }
      const projects = await Project.findAll(projectFilters);
      const visibleProjectIds = new Set(
        projects.map(project => project.id || project.dbId)
      );

      const expenseFilters = { limit: 10000 };
      if (projectId) expenseFilters.projectId = parseInt(projectId);
      if (status) expenseFilters.status = status;
      if (category) expenseFilters.category = category;
      if (search) expenseFilters.search = search;

      const allExpenses = await Expense.findAll(expenseFilters);
      // Only include expenses for projects the user can see
      const expenses = allExpenses.filter(e =>
        visibleProjectIds.has(e.projectId || e.projectDbId)
      );

      // Group expenses by category
      const expenseCategories = {};
      expenses.filter(e => e.status === 'approved').forEach(expense => {
        const category = expense.category || 'Other';
        if (!expenseCategories[category]) {
          expenseCategories[category] = { total: 0, count: 0 };
        }
        expenseCategories[category].total += parseFloat(expense.amount) || 0;
        expenseCategories[category].count += 1;
      });

      const expenseData = expenses.map(e => ({
        id: e.id,
        expenseId: e.expenseId,
        project: projects.find(p => (p.id || p.dbId) === (e.projectId || e.projectDbId))?.name || 'Unknown',
        projectId: e.projectId,
        category: e.category,
        amount: parseFloat(e.amount) || 0,
        date: e.expenseDate || e.createdAt,
        status: e.status,
        approvedBy: e.approvedByName || null,
        description: e.description
      }));

      res.json({
        success: true,
        data: expenseData,
        categories: Object.entries(expenseCategories).map(([category, data]) => ({
          category,
          total: data.total,
          count: data.count
        })),
        stats: {
          total: expenseData.length,
          totalAmount: expenseData.reduce((sum, e) => sum + e.amount, 0),
          pending: expenseData.filter(e => e.status === 'pending').length,
          approved: expenseData.filter(e => e.status === 'approved').length,
          rejected: expenseData.filter(e => e.status === 'rejected').length
        }
      });
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expenses.',
        error: error.message
      });
    }
  }

  // Get payments and invoices
  static async getPayments(req, res) {
    try {
      const { projectId, status } = req.query;
      const staff = await Staff.findById(req.staffId);

      // Determine which projects this user can see
      const projectFilters = { limit: 10000 };
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.email) {
        projectFilters.userEmail = staff.email;
      }
      const projects = await Project.findAll(projectFilters);
      const visibleProjectIds = new Set(
        projects.map(project => project.id || project.dbId)
      );

      const paymentFilters = { limit: 10000 };
      if (projectId) paymentFilters.projectId = parseInt(projectId);
      if (status) paymentFilters.status = status;

      const allPayments = await VendorPayment.findAll(paymentFilters);
      const invoices = await SupplierInvoice.findAll({ limit: 10000 });

      // Only include payments for projects the user can see
      const payments = allPayments.filter(p =>
        visibleProjectIds.has(p.projectId || p.projectDbId)
      );

      const paymentData = payments.map(p => ({
        id: p.id,
        paymentId: p.paymentId,
        project: projects.find(proj => (proj.id || proj.dbId) === (p.projectId || p.projectDbId))?.name || 'Unknown',
        projectId: p.projectId,
        supplier: p.vendorName || 'Unknown',
        amount: parseFloat(p.amount) || 0,
        invoice: p.invoiceNumber || 'N/A',
        dueDate: p.dueDate,
        status: p.status === 'paid' ? 'Paid' : p.status === 'approved' ? 'Approved' : 'Pending Approval',
        paymentDate: p.paymentDate || null
      }));

      // Get advance payments (from fund requests with advance type)
      const allFundRequests = await FundRequest.findAll({ limit: 10000 });
      const advancePayments = allFundRequests.filter(fr => fr.requestType === 'advance_payment');

      const advancePaymentData = advancePayments.map(ap => ({
        id: ap.id,
        project: projects.find(p => (p.id || p.dbId) === (ap.projectId || ap.projectDbId))?.name || 'Unknown',
        recipient: ap.requestedByName || 'Unknown',
        amount: parseFloat(ap.amount) || 0,
        date: ap.requestDate || ap.createdAt,
        status: ap.status === 'approved' ? 'Issued' : ap.status === 'rejected' ? 'Rejected' : 'Pending'
      }));

      res.json({
        success: true,
        data: {
          payments: paymentData,
          advancePayments: advancePaymentData,
          stats: {
            pending: paymentData.filter(p => p.status === 'Pending Approval' || p.status === 'Approved').length,
            paid: paymentData.filter(p => p.status === 'Paid').length,
            totalAmount: paymentData.reduce((sum, p) => sum + p.amount, 0),
            advancePaymentsCount: advancePaymentData.length
          }
        }
      });
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payments.',
        error: error.message
      });
    }
  }

  // Get cost vs progress analysis
  static async getCostVsProgress(req, res) {
    try {
      const { projectId } = req.query;
      const staff = await Staff.findById(req.staffId);

      const projectFilters = { limit: 10000 };
      if (projectId) projectFilters.id = parseInt(projectId);
      // For non-admin users, restrict to projects explicitly assigned to their email
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.email) {
        projectFilters.userEmail = staff.email;
      }

      const projects = await Project.findAll(projectFilters);
      const budgets = await Budget.findAll({ limit: 10000 });
      const expenses = await Expense.findAll({ limit: 10000 });

      const costVsProgressData = projects.map(project => {
        const projectBudgets = budgets.filter(b => b.projectId === project.id || b.projectId === project.dbId);
        const projectExpenses = expenses.filter(e => 
          (e.projectId || e.projectDbId) === (project.id || project.dbId) && e.status === 'approved'
        );
        
        const budget = projectBudgets.length > 0 
          ? (projectBudgets[0].revisedBudget || projectBudgets[0].approvedBudget || 0)
          : (project.budget || 0);
        const actualSpend = projectExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const progress = project.progress || 0;
        const costPercent = budget > 0 ? (actualSpend / budget) * 100 : 0;
        const variance = costPercent - progress;
        
        let status = "On Track";
        if (variance > 15) status = "Alert";
        if (variance > 25) status = "Critical";
        if (variance < -10) status = "Under Budget";

        // Simplified phase breakdown (can be enhanced with milestone data)
        const phases = [
          { phase: 'Feasibility', progress: progress > 0 ? Math.min(100, progress * 0.2) : 0, costPercent: costPercent > 0 ? Math.min(100, costPercent * 0.15) : 0 },
          { phase: 'Design', progress: progress > 20 ? Math.min(100, (progress - 20) * 0.3) : 0, costPercent: costPercent > 15 ? Math.min(100, (costPercent - 15) * 0.4) : 0 },
          { phase: 'ESIA', progress: progress > 50 ? Math.min(100, (progress - 50) * 0.3) : 0, costPercent: costPercent > 55 ? Math.min(100, (costPercent - 55) * 0.3) : 0 },
          { phase: 'Supervision', progress: progress > 80 ? Math.min(100, (progress - 80) * 0.2) : 0, costPercent: costPercent > 85 ? Math.min(100, (costPercent - 85) * 0.15) : 0 }
        ].map(p => ({
          ...p,
          variance: p.costPercent - p.progress
        }));

        return {
          project: project.name || 'Unknown Project',
          projectId: project.id || project.dbId,
          progress: progress,
          costPercent: costPercent,
          variance: variance,
          status: status,
          phases: phases
        };
      });

      res.json({
        success: true,
        data: costVsProgressData
      });
    } catch (error) {
      console.error('Get cost vs progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch cost vs progress data.',
        error: error.message
      });
    }
  }

  // Get approval requests
  static async getApprovals(req, res) {
    try {
      const { status, type } = req.query;
      const staff = await Staff.findById(req.staffId);

      // Determine which projects this user can see
      const projectFilters = { limit: 10000 };
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.email) {
        projectFilters.userEmail = staff.email;
      }
      const projects = await Project.findAll(projectFilters);
      const visibleProjectIds = new Set(
        projects.map(project => project.id || project.dbId)
      );

      // Get fund requests (budget and advance payments)
      const fundRequestFilters = { limit: 10000 };
      if (status) fundRequestFilters.status = status;

      const allFundRequests = await FundRequest.findAll(fundRequestFilters);
      // Only include fund requests for projects the user can see
      const fundRequests = allFundRequests.filter(fr =>
        visibleProjectIds.has(fr.projectId || fr.projectDbId)
      );
      
      // Filter by type if specified
      let filteredFundRequests = fundRequests;
      if (type === 'budget') {
        filteredFundRequests = fundRequests.filter(fr => fr.requestType === 'budget_increase' || fr.requestType === 'budget_revision');
      } else if (type === 'payment') {
        filteredFundRequests = fundRequests.filter(fr => fr.requestType === 'advance_payment');
      }
      
      // Get expense approvals
      const expenseFilters = { limit: 10000, status: 'pending' };
      if (status === 'approved') expenseFilters.status = 'approved';
      if (status === 'rejected') expenseFilters.status = 'rejected';
      const allExpenses = await Expense.findAll(expenseFilters);
      const expenses = allExpenses.filter(exp =>
        visibleProjectIds.has(exp.projectId || exp.projectDbId)
      );
      
      // Get payment approvals
      const paymentFilters = { limit: 10000, status: 'pending_approval' };
      if (status === 'approved') paymentFilters.status = 'approved';
      const allPayments = await VendorPayment.findAll(paymentFilters);
      const payments = allPayments.filter(pay =>
        visibleProjectIds.has(pay.projectId || pay.projectDbId)
      );

      // Combine all approval requests
      const approvalRequests = [];

      // Budget requests
      filteredFundRequests
        .filter(fr => fr.requestType === 'budget_increase' || fr.requestType === 'budget_revision')
        .forEach(fr => {
          approvalRequests.push({
            id: `budget-${fr.id}`,
            type: fr.requestType === 'budget_increase' ? 'Budget Increase' : 'Budget Revision',
            project: projects.find(p => (p.id || p.dbId) === (fr.projectId || fr.projectDbId))?.name || 'Unknown',
            amount: parseFloat(fr.amount) || 0,
            requestedBy: fr.requestedByName || 'Unknown',
            date: fr.requestDate || fr.createdAt,
            status: fr.status === 'approved' ? 'Approved' : fr.status === 'rejected' ? 'Rejected' : 'Pending',
            approvedBy: fr.approvedByName || null,
            decisionDate: fr.approvalDate || null,
            reason: fr.description || fr.reason || null
          });
        });

      // Expense approvals
      expenses.forEach(exp => {
        approvalRequests.push({
          id: `expense-${exp.id}`,
          type: 'Expense Approval',
          project: projects.find(p => (p.id || p.dbId) === (exp.projectId || exp.projectDbId))?.name || 'Unknown',
          amount: parseFloat(exp.amount) || 0,
          requestedBy: exp.submittedByName || 'Unknown',
          date: exp.expenseDate || exp.createdAt,
          status: exp.status === 'approved' ? 'Approved' : exp.status === 'rejected' ? 'Rejected' : 'Pending',
          approvedBy: exp.approvedByName || null,
          decisionDate: exp.approvalDate || null,
          reason: exp.description || null
        });
      });

      // Payment approvals
      payments.forEach(pay => {
        approvalRequests.push({
          id: `payment-${pay.id}`,
          type: 'Payment Approval',
          project: projects.find(p => (p.id || p.dbId) === (pay.projectId || pay.projectDbId))?.name || 'Unknown',
          amount: parseFloat(pay.amount) || 0,
          requestedBy: pay.requestedByName || 'Unknown',
          date: pay.dueDate || pay.createdAt,
          status: pay.status === 'approved' ? 'Approved' : pay.status === 'paid' ? 'Paid' : 'Pending',
          approvedBy: pay.approvedByName || null,
          decisionDate: pay.approvalDate || null,
          reason: pay.description || null
        });
      });

      // Sort by date (newest first)
      approvalRequests.sort((a, b) => new Date(b.date) - new Date(a.date));

      const stats = {
        total: approvalRequests.length,
        pending: approvalRequests.filter(r => r.status === 'Pending').length,
        approved: approvalRequests.filter(r => r.status === 'Approved').length,
        rejected: approvalRequests.filter(r => r.status === 'Rejected').length,
        totalAmount: approvalRequests
          .filter(r => r.status === 'Pending')
          .reduce((sum, r) => sum + r.amount, 0)
      };

      res.json({
        success: true,
        data: approvalRequests,
        stats
      });
    } catch (error) {
      console.error('Get approvals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch approval requests.',
        error: error.message
      });
    }
  }

  // Generate financial reports
  static async generateReport(req, res) {
    try {
      const { reportType, format = 'pdf', filters = {} } = req.body;

      if (!reportType) {
        return res.status(400).json({
          success: false,
          message: 'Report type is required.'
        });
      }

      // Note: Actual report generation would use libraries like pdfkit, exceljs, etc.
      // For now, return success with report type info
      const reportTypes = {
        'project-financial': 'Project Financial Summary Report',
        'department-budget': 'Department Budget Summary Report',
        'monthly-cost': 'Monthly Cost Report',
        'quarterly': 'Quarterly Financial Summary Report'
      };

      res.json({
        success: true,
        message: `${reportTypes[reportType] || 'Report'} data prepared successfully for ${format.toUpperCase()} format.`,
        reportType,
        format,
        filters,
        generatedAt: new Date().toISOString(),
        note: 'Use the corresponding GET endpoints to fetch the actual data for report generation.'
      });
    } catch (error) {
      console.error('Generate report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate report.',
        error: error.message
      });
    }
  }
}
