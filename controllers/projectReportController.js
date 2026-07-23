import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Deliverable from '../models/Deliverable.js';
import Expense from '../models/Expense.js';
import Review from '../models/Review.js';
import QualityControl from '../models/QualityControl.js';
import Risk from '../models/Risk.js';
import Issue from '../models/Issue.js';
import Staff from '../models/Staff.js';
import pool from '../config/db.js';
import { buildProjectReportFilters } from '../utils/projectReportAccess.js';
import {
  buildImplementationReport,
  renderImplementationPdf,
  renderImplementationCsv,
  renderPerformancePdf,
  renderPerformanceCsv,
} from '../utils/projectImplementationReport.js';

export class ProjectReportController {
  static async resolveProjectFilters(req, { projectId, department } = {}) {
    const staff = await Staff.findById(req.staffId);
    const result = await buildProjectReportFilters(req.staffId, staff, { projectId, department });
    return { staff, ...result };
  }

  // Get comprehensive implementation report for a project
  static async getImplementationReport(req, res) {
    try {
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'projectId is required.',
        });
      }

      const { error, message } = await ProjectReportController.resolveProjectFilters(req, {
        projectId,
      });

      if (error === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message });
      }

      const report = await buildImplementationReport(parseInt(projectId, 10));
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Project not found.',
        });
      }

      res.json({ success: true, data: report });
    } catch (error) {
      console.error('Get implementation report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate implementation report.',
        error: error.message,
      });
    }
  }

  // Get Performance Report
  static async getPerformanceReport(req, res) {
    try {
      const { projectId, department, startDate, endDate } = req.query;
      const { staff, filters, error, message } = await ProjectReportController.resolveProjectFilters(req, {
        projectId,
        department,
      });

      if (error === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message });
      }

      const projectFilters = filters;
      const projects = await Project.findAll(projectFilters);
      const projectStats = await Project.getStats(projectFilters);

      // Get tasks
      const taskFilters = {};
      if (projectId) taskFilters.projectId = parseInt(projectId);
      const tasks = await Task.findAll({ ...taskFilters, limit: 1000 });
      const taskStats = await Task.getStats(parseInt(projectId) || null);

      // Get deliverables
      const deliverables = await Deliverable.findAll({ ...taskFilters, limit: 1000 });
      const deliverableStats = await Deliverable.getStats(parseInt(projectId) || null);

      // Get reviews
      const reviews = await Review.findAll({ ...taskFilters, limit: 1000 });
      const reviewStats = await Review.getStats(parseInt(projectId) || null);

      // Calculate metrics
      const totalProjects = parseInt(projectStats.total || 0);
      const activeProjects = parseInt(projectStats.ongoing || 0);
      const completedProjects = parseInt(projectStats.completed || 0);
      const totalTasks = parseInt(taskStats.total || 0);
      const completedTasks = parseInt(taskStats.completed || 0);
      const totalDeliverables = parseInt(deliverableStats.total || 0);
      const approvedDeliverables = parseInt(deliverableStats.approved || 0);
      const totalReviews = parseInt(reviewStats.total || 0);
      const approvedReviews = parseInt(reviewStats.approved || 0);

      // Calculate averages
      const scopedToSingleProject = Boolean(projectId) && projects.length === 1;
      const averageCompletion = scopedToSingleProject
        ? parseFloat(projects[0].progress) || 0
        : totalProjects > 0
          ? projects.reduce((sum, p) => sum + (parseFloat(p.progress) || 0), 0) / totalProjects
          : 0;

      let onTimeDelivery = totalProjects > 0
        ? (completedProjects / totalProjects) * 100
        : 0;
      if (scopedToSingleProject && completedProjects === 0) {
        onTimeDelivery = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : averageCompletion;
      }

      const qualityScore = totalDeliverables > 0
        ? (approvedDeliverables / totalDeliverables) * 100
        : 0;

      // Calculate budget efficiency
      const totalBudget = parseFloat(projectStats.totalBudget || 0);
      const totalSpent = parseFloat(projectStats.totalSpent || 0);
      const budgetEfficiency = totalBudget > 0
        ? ((totalBudget - totalSpent) / totalBudget) * 100
        : 0;

      const report = {
        period: startDate && endDate 
          ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
          : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalProjects,
        activeProjects,
        completedProjects,
        averageCompletion: Math.round(averageCompletion),
        onTimeDelivery: Math.round(onTimeDelivery),
        qualityScore: Math.round(qualityScore),
        budgetEfficiency: Math.round(budgetEfficiency),
        metrics: {
          totalTasks,
          completedTasks,
          totalDeliverables,
          approvedDeliverables,
          totalReviews,
          approvedReviews,
          totalBudget,
          totalSpent
        }
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Get performance report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate performance report.',
        error: error.message
      });
    }
  }

  // Get Department Summary Report
  static async getDepartmentSummary(req, res) {
    try {
      const { department, projectId } = req.query;

      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Department is required.'
        });
      }

      const { filters, error, message } = await ProjectReportController.resolveProjectFilters(req, {
        projectId,
        department,
      });

      if (error === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message });
      }

      const projectFilters = filters;

      // Get projects
      const projects = await Project.findAll(projectFilters);
      const projectStats = await Project.getStats(projectFilters);

      // Get tasks for all projects in department
      const taskFilters = {};
      if (projectId) taskFilters.projectId = parseInt(projectId);
      const tasks = await Task.findAll({ ...taskFilters, limit: 1000 });
      const taskStats = await Task.getStats(parseInt(projectId) || null);

      // Get deliverables
      const deliverables = await Deliverable.findAll({ ...taskFilters, limit: 1000 });
      const deliverableStats = await Deliverable.getStats(parseInt(projectId) || null);

      // Get team size (count unique staff assigned to projects)
      const teamSizeQuery = `
        SELECT COUNT(DISTINCT pa.staff_id) as team_size
        FROM project_assignments pa
        INNER JOIN projects p ON pa.project_id = p.id
        WHERE p.department = ?
        ${projectId ? 'AND p.id = ?' : ''}
      `;
      const teamSizeParams = projectId ? [department, parseInt(projectId)] : [department];
      const [teamSizeRows] = await pool.execute(teamSizeQuery, teamSizeParams);
      const teamSize = parseInt(teamSizeRows[0]?.team_size || 0);

      // Calculate average quality
      const totalDeliverables = parseInt(deliverableStats.total || 0);
      const approvedDeliverables = parseInt(deliverableStats.approved || 0);
      const averageQuality = totalDeliverables > 0
        ? (approvedDeliverables / totalDeliverables) * 100
        : 0;

      const summary = {
        department,
        totalProjects: parseInt(projectStats.total || 0),
        activeProjects: parseInt(projectStats.ongoing || 0),
        completedProjects: parseInt(projectStats.completed || 0),
        totalBudget: parseFloat(projectStats.totalBudget || 0),
        usedBudget: parseFloat(projectStats.totalSpent || 0),
        teamSize,
        averageQuality: Math.round(averageQuality),
        metrics: {
          totalTasks: parseInt(taskStats.total || 0),
          completedTasks: parseInt(taskStats.completed || 0),
          totalDeliverables,
          approvedDeliverables
        }
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Get department summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate department summary.',
        error: error.message
      });
    }
  }

  // Get Time, Cost, Quality Metrics Report
  static async getMetricsReport(req, res) {
    try {
      const { projectId, department, startDate, endDate } = req.query;
      const { filters, error, message } = await ProjectReportController.resolveProjectFilters(req, {
        projectId,
        department,
      });

      if (error === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message });
      }

      const projectFilters = filters;

      // Get projects
      const projects = await Project.findAll(projectFilters);
      const projectStats = await Project.getStats(projectFilters);

      // Get tasks
      const taskFilters = {};
      if (projectId) taskFilters.projectId = parseInt(projectId);
      const tasks = await Task.findAll({ ...taskFilters, limit: 1000 });
      const taskStats = await Task.getStats(parseInt(projectId) || null);

      // Get deliverables
      const deliverables = await Deliverable.findAll({ ...taskFilters, limit: 1000 });
      const deliverableStats = await Deliverable.getStats(parseInt(projectId) || null);

      // Get expenses
      const expenses = await Expense.findAll({ ...taskFilters, limit: 1000 });
      const expenseStats = await Expense.getStats(parseInt(projectId) || null);

      // Get reviews
      const reviews = await Review.findAll({ ...taskFilters, limit: 1000 });
      const reviewStats = await Review.getStats(parseInt(projectId) || null);

      // Calculate time performance
      const totalTasks = parseInt(taskStats.total || 0);
      const completedTasks = parseInt(taskStats.completed || 0);
      const timePerformance = totalTasks > 0
        ? (completedTasks / totalTasks) * 100
        : 0;

      // Calculate cost performance
      const totalBudget = parseFloat(projectStats.totalBudget || 0);
      const totalSpent = parseFloat(projectStats.totalSpent || 0);
      const costPerformance = totalBudget > 0
        ? ((totalBudget - totalSpent) / totalBudget) * 100
        : 0;

      // Calculate quality performance
      const totalDeliverables = parseInt(deliverableStats.total || 0);
      const approvedDeliverables = parseInt(deliverableStats.approved || 0);
      const qualityPerformance = totalDeliverables > 0
        ? (approvedDeliverables / totalDeliverables) * 100
        : 0;

      // Calculate client satisfaction (based on approved reviews)
      const totalReviews = parseInt(reviewStats.total || 0);
      const approvedReviews = parseInt(reviewStats.approved || 0);
      const clientSatisfaction = totalReviews > 0
        ? (approvedReviews / totalReviews) * 100
        : 0;

      // Define targets
      const targets = {
        timePerformance: 85,
        costPerformance: 80,
        qualityPerformance: 90,
        clientSatisfaction: 85
      };

      // Calculate variances
      const metrics = [
        {
          metric: 'Time Performance',
          target: targets.timePerformance,
          actual: Math.round(timePerformance),
          variance: Math.round(timePerformance - targets.timePerformance),
          status: timePerformance >= targets.timePerformance ? 'On Target' : timePerformance >= targets.timePerformance - 10 ? 'Below Target' : 'Critical'
        },
        {
          metric: 'Cost Performance',
          target: targets.costPerformance,
          actual: Math.round(costPerformance),
          variance: Math.round(costPerformance - targets.costPerformance),
          status: costPerformance >= targets.costPerformance ? 'On Target' : costPerformance >= targets.costPerformance - 10 ? 'Below Target' : 'Critical'
        },
        {
          metric: 'Quality Performance',
          target: targets.qualityPerformance,
          actual: Math.round(qualityPerformance),
          variance: Math.round(qualityPerformance - targets.qualityPerformance),
          status: qualityPerformance >= targets.qualityPerformance ? 'On Target' : qualityPerformance >= targets.qualityPerformance - 10 ? 'Below Target' : 'Critical'
        },
        {
          metric: 'Client Satisfaction',
          target: targets.clientSatisfaction,
          actual: Math.round(clientSatisfaction),
          variance: Math.round(clientSatisfaction - targets.clientSatisfaction),
          status: clientSatisfaction >= targets.clientSatisfaction ? 'On Target' : clientSatisfaction >= targets.clientSatisfaction - 10 ? 'Below Target' : 'Critical'
        }
      ];

      res.json({
        success: true,
        data: {
          metrics,
          summary: {
            totalProjects: parseInt(projectStats.total || 0),
            totalTasks,
            completedTasks,
            totalBudget,
            totalSpent,
            totalDeliverables,
            approvedDeliverables,
            totalReviews,
            approvedReviews
          }
        }
      });
    } catch (error) {
      console.error('Get metrics report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate metrics report.',
        error: error.message
      });
    }
  }

  // Get Report Statistics
  static async getReportStats(req, res) {
    try {
      const { projectId, department } = req.query;
      const { filters, error, message } = await ProjectReportController.resolveProjectFilters(req, {
        projectId,
        department,
      });

      if (error === 'FORBIDDEN') {
        return res.status(403).json({ success: false, message });
      }

      const projectFilters = filters;

      // Get all stats
      const projectStats = await Project.getStats(projectFilters);
      const taskStats = await Task.getStats(parseInt(projectId) || null);
      const deliverableStats = await Deliverable.getStats(parseInt(projectId) || null);
      const expenseStats = await Expense.getStats(parseInt(projectId) || null);
      const reviewStats = await Review.getStats(parseInt(projectId) || null);
      const qualityStats = await QualityControl.getStats(parseInt(projectId) || null);
      const riskStats = await Risk.getStats(parseInt(projectId) || null);
      const issueStats = await Issue.getStats(parseInt(projectId) || null);

      res.json({
        success: true,
        data: {
          projects: projectStats,
          tasks: taskStats,
          deliverables: deliverableStats,
          expenses: expenseStats,
          reviews: reviewStats,
          quality: qualityStats,
          risks: riskStats,
          issues: issueStats
        }
      });
    } catch (error) {
      console.error('Get report stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch report statistics.',
        error: error.message
      });
    }
  }

  // Export Report (PDF/Excel/CSV)
  static async exportReport(req, res) {
    try {
      const { type, format = 'pdf', projectId, department, startDate, endDate } = req.query;
      const staff = await Staff.findById(req.staffId);
      const generatedBy = staff ? `${staff.firstName} ${staff.lastName}` : 'System';

      if (!type) {
        return res.status(400).json({
          success: false,
          message: 'Report type is required (implementation, performance, department, metrics).'
        });
      }

      if (type === 'implementation') {
        if (!projectId) {
          return res.status(400).json({
            success: false,
            message: 'projectId is required for implementation report export.',
          });
        }

        const { error, message } = await ProjectReportController.resolveProjectFilters(req, { projectId });
        if (error === 'FORBIDDEN') {
          return res.status(403).json({ success: false, message });
        }

        const report = await buildImplementationReport(parseInt(projectId, 10));
        if (!report) {
          return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        const safeName = (report.project.name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (format === 'pdf') {
          const pdfBuffer = await renderImplementationPdf(report, generatedBy);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${safeName}-implementation-report-${Date.now()}.pdf"`);
          return res.send(pdfBuffer);
        }

        if (format === 'excel' || format === 'csv') {
          const csvContent = renderImplementationCsv(report, generatedBy);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          const extension = format === 'excel' ? 'csv' : 'csv';
          res.setHeader('Content-Disposition', `attachment; filename="${safeName}-implementation-report-${Date.now()}.${extension}`);
          return res.send('\uFEFF' + csvContent);
        }

        return res.status(400).json({
          success: false,
          message: 'Invalid format. Use "pdf", "excel", or "csv".'
        });
      }

      let reportData = {};

      // Get report data based on type
      if (type === 'performance') {
        const { filters, error, message } = await ProjectReportController.resolveProjectFilters(req, {
          projectId,
          department,
        });

        if (error === 'FORBIDDEN') {
          return res.status(403).json({ success: false, message });
        }

        const projectFilters = filters;
        const projects = await Project.findAll(projectFilters);
        const projectStats = await Project.getStats(projectFilters);
        const taskStats = await Task.getStats(parseInt(projectId) || null);
        const deliverableStats = await Deliverable.getStats(parseInt(projectId) || null);

        reportData = {
          title: 'Performance Report',
          period: startDate && endDate 
            ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
            : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          generatedBy: staff ? `${staff.firstName} ${staff.lastName}` : 'System',
          generatedAt: new Date().toISOString(),
          totalProjects: parseInt(projectStats.total || 0),
          activeProjects: parseInt(projectStats.ongoing || 0),
          completedProjects: parseInt(projectStats.completed || 0),
          averageCompletion: projects.length > 0 
            ? Math.round(projects.reduce((sum, p) => sum + (parseFloat(p.progress) || 0), 0) / projects.length)
            : 0,
          onTimeDelivery: parseInt(projectStats.total || 0) > 0
            ? Math.round((parseInt(projectStats.completed || 0) / parseInt(projectStats.total || 0)) * 100)
            : 0,
          qualityScore: parseInt(deliverableStats.total || 0) > 0
            ? Math.round((parseInt(deliverableStats.approved || 0) / parseInt(deliverableStats.total || 0)) * 100)
            : 0,
          budgetEfficiency: parseFloat(projectStats.totalBudget || 0) > 0
            ? Math.round(((parseFloat(projectStats.totalBudget || 0) - parseFloat(projectStats.totalSpent || 0)) / parseFloat(projectStats.totalBudget || 0)) * 100)
            : 0
        };
      } else if (type === 'department') {
        if (!department) {
          return res.status(400).json({
            success: false,
            message: 'Department is required for department report.'
          });
        }

        const { filters, error, message } = await ProjectReportController.resolveProjectFilters(req, {
          projectId,
          department,
        });

        if (error === 'FORBIDDEN') {
          return res.status(403).json({ success: false, message });
        }

        const projectFilters = filters;
        const projectStats = await Project.getStats(projectFilters);
        const taskStats = await Task.getStats(parseInt(projectId) || null);
        const deliverableStats = await Deliverable.getStats(parseInt(projectId) || null);

        reportData = {
          title: 'Department Summary Report',
          department,
          generatedBy: staff ? `${staff.firstName} ${staff.lastName}` : 'System',
          generatedAt: new Date().toISOString(),
          totalProjects: parseInt(projectStats.total || 0),
          activeProjects: parseInt(projectStats.ongoing || 0),
          completedProjects: parseInt(projectStats.completed || 0),
          totalBudget: parseFloat(projectStats.totalBudget || 0),
          usedBudget: parseFloat(projectStats.totalSpent || 0),
          totalTasks: parseInt(taskStats.total || 0),
          completedTasks: parseInt(taskStats.completed || 0),
          totalDeliverables: parseInt(deliverableStats.total || 0),
          approvedDeliverables: parseInt(deliverableStats.approved || 0)
        };
      } else if (type === 'metrics') {
        const { filters, error, message } = await ProjectReportController.resolveProjectFilters(req, {
          projectId,
          department,
        });

        if (error === 'FORBIDDEN') {
          return res.status(403).json({ success: false, message });
        }

        const projectFilters = filters;
        const projectStats = await Project.getStats(projectFilters);
        const taskStats = await Task.getStats(parseInt(projectId) || null);
        const deliverableStats = await Deliverable.getStats(parseInt(projectId) || null);
        const reviewStats = await Review.getStats(parseInt(projectId) || null);

        const timePerformance = parseInt(taskStats.total || 0) > 0
          ? Math.round((parseInt(taskStats.completed || 0) / parseInt(taskStats.total || 0)) * 100)
          : 0;
        const costPerformance = parseFloat(projectStats.totalBudget || 0) > 0
          ? Math.round(((parseFloat(projectStats.totalBudget || 0) - parseFloat(projectStats.totalSpent || 0)) / parseFloat(projectStats.totalBudget || 0)) * 100)
          : 0;
        const qualityPerformance = parseInt(deliverableStats.total || 0) > 0
          ? Math.round((parseInt(deliverableStats.approved || 0) / parseInt(deliverableStats.total || 0)) * 100)
          : 0;
        const clientSatisfaction = parseInt(reviewStats.total || 0) > 0
          ? Math.round((parseInt(reviewStats.approved || 0) / parseInt(reviewStats.total || 0)) * 100)
          : 0;

        reportData = {
          title: 'Time, Cost, Quality Metrics Report',
          generatedBy: staff ? `${staff.firstName} ${staff.lastName}` : 'System',
          generatedAt: new Date().toISOString(),
          metrics: [
            { metric: 'Time Performance', target: 85, actual: timePerformance, variance: timePerformance - 85 },
            { metric: 'Cost Performance', target: 80, actual: costPerformance, variance: costPerformance - 80 },
            { metric: 'Quality Performance', target: 90, actual: qualityPerformance, variance: qualityPerformance - 90 },
            { metric: 'Client Satisfaction', target: 85, actual: clientSatisfaction, variance: clientSatisfaction - 85 }
          ]
        };
      }

      // Generate export based on format
      if (format === 'pdf') {
        const pdfBuffer = await renderPerformancePdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf"`);
        return res.send(pdfBuffer);
      }

      if (format === 'excel' || format === 'csv') {
        const csvContent = type === 'metrics' && reportData.metrics
          ? ['Metric,Target,Actual,Variance', ...reportData.metrics.map((m) => `${m.metric},${m.target}%,${m.actual}%,${m.variance > 0 ? '+' : ''}${m.variance}%`)].join('\n')
          : renderPerformanceCsv(reportData);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.csv"`);
        return res.send('\uFEFF' + csvContent);
      }

      res.status(400).json({
        success: false,
        message: 'Invalid format. Use "pdf", "excel", or "csv".'
      });
    } catch (error) {
      console.error('Export report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export report.',
        error: error.message
      });
    }
  }
}
