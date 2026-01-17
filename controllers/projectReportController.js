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

export class ProjectReportController {
  // Get Performance Report
  static async getPerformanceReport(req, res) {
    try {
      const { projectId, department, startDate, endDate } = req.query;
      const staff = await Staff.findById(req.staffId);

      // Build filters
      const projectFilters = {};
      if (projectId) projectFilters.projectId = parseInt(projectId);
      if (department) projectFilters.department = department;
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        projectFilters.userEmail = staff.email;
      }

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
      const averageCompletion = totalProjects > 0 
        ? projects.reduce((sum, p) => sum + (parseFloat(p.progress) || 0), 0) / totalProjects 
        : 0;
      
      const onTimeDelivery = totalProjects > 0
        ? (completedProjects / totalProjects) * 100
        : 0;

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
      const staff = await Staff.findById(req.staffId);

      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Department is required.'
        });
      }

      // Build filters
      const projectFilters = { department };
      if (projectId) projectFilters.projectId = parseInt(projectId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        projectFilters.userEmail = staff.email;
      }

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
      const staff = await Staff.findById(req.staffId);

      // Build filters
      const projectFilters = {};
      if (projectId) projectFilters.projectId = parseInt(projectId);
      if (department) projectFilters.department = department;
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        projectFilters.userEmail = staff.email;
      }

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
      const staff = await Staff.findById(req.staffId);

      // Build filters
      const projectFilters = {};
      if (projectId) projectFilters.projectId = parseInt(projectId);
      if (department) projectFilters.department = department;
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        projectFilters.userEmail = staff.email;
      }

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

      if (!type) {
        return res.status(400).json({
          success: false,
          message: 'Report type is required (performance, department, metrics).'
        });
      }

      let reportData = {};

      // Get report data based on type
      if (type === 'performance') {
        const projectFilters = {};
        if (projectId) projectFilters.projectId = parseInt(projectId);
        if (department) projectFilters.department = department;
        if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
          projectFilters.userEmail = staff.email;
        }

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

        const projectFilters = { department };
        if (projectId) projectFilters.projectId = parseInt(projectId);
        if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
          projectFilters.userEmail = staff.email;
        }

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
        const projectFilters = {};
        if (projectId) projectFilters.projectId = parseInt(projectId);
        if (department) projectFilters.department = department;
        if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
          projectFilters.userEmail = staff.email;
        }

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
        let pdfContent = `${reportData.title.toUpperCase()}\n`;
        pdfContent += `Generated by: ${reportData.generatedBy}\n`;
        pdfContent += `Generated at: ${new Date(reportData.generatedAt).toLocaleString()}\n\n`;
        
        if (reportData.period) pdfContent += `Period: ${reportData.period}\n`;
        if (reportData.department) pdfContent += `Department: ${reportData.department}\n`;
        pdfContent += `\n`;

        if (type === 'performance') {
          pdfContent += `Total Projects: ${reportData.totalProjects}\n`;
          pdfContent += `Active Projects: ${reportData.activeProjects}\n`;
          pdfContent += `Completed Projects: ${reportData.completedProjects}\n`;
          pdfContent += `Average Completion: ${reportData.averageCompletion}%\n`;
          pdfContent += `On-Time Delivery: ${reportData.onTimeDelivery}%\n`;
          pdfContent += `Quality Score: ${reportData.qualityScore}%\n`;
          pdfContent += `Budget Efficiency: ${reportData.budgetEfficiency}%\n`;
        } else if (type === 'department') {
          pdfContent += `Total Projects: ${reportData.totalProjects}\n`;
          pdfContent += `Active Projects: ${reportData.activeProjects}\n`;
          pdfContent += `Completed Projects: ${reportData.completedProjects}\n`;
          pdfContent += `Total Budget: $${reportData.totalBudget.toLocaleString()}\n`;
          pdfContent += `Used Budget: $${reportData.usedBudget.toLocaleString()}\n`;
          pdfContent += `Total Tasks: ${reportData.totalTasks}\n`;
          pdfContent += `Completed Tasks: ${reportData.completedTasks}\n`;
        } else if (type === 'metrics') {
          pdfContent += `METRICS\n`;
          pdfContent += `Metric | Target | Actual | Variance\n`;
          pdfContent += `-`.repeat(50) + `\n`;
          reportData.metrics.forEach(m => {
            pdfContent += `${m.metric} | ${m.target}% | ${m.actual}% | ${m.variance > 0 ? '+' : ''}${m.variance}%\n`;
          });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf"`);
        res.send(pdfContent);
      } else if (format === 'excel' || format === 'csv') {
        let csvContent = `${reportData.title}\n`;
        csvContent += `Generated by,${reportData.generatedBy}\n`;
        csvContent += `Generated at,${new Date(reportData.generatedAt).toLocaleString()}\n\n`;

        if (reportData.period) csvContent += `Period,${reportData.period}\n`;
        if (reportData.department) csvContent += `Department,${reportData.department}\n`;
        csvContent += `\n`;

        if (type === 'performance') {
          csvContent += `Metric,Value\n`;
          csvContent += `Total Projects,${reportData.totalProjects}\n`;
          csvContent += `Active Projects,${reportData.activeProjects}\n`;
          csvContent += `Completed Projects,${reportData.completedProjects}\n`;
          csvContent += `Average Completion,${reportData.averageCompletion}%\n`;
          csvContent += `On-Time Delivery,${reportData.onTimeDelivery}%\n`;
          csvContent += `Quality Score,${reportData.qualityScore}%\n`;
          csvContent += `Budget Efficiency,${reportData.budgetEfficiency}%\n`;
        } else if (type === 'department') {
          csvContent += `Metric,Value\n`;
          csvContent += `Total Projects,${reportData.totalProjects}\n`;
          csvContent += `Active Projects,${reportData.activeProjects}\n`;
          csvContent += `Completed Projects,${reportData.completedProjects}\n`;
          csvContent += `Total Budget,$${reportData.totalBudget.toLocaleString()}\n`;
          csvContent += `Used Budget,$${reportData.usedBudget.toLocaleString()}\n`;
        } else if (type === 'metrics') {
          csvContent += `Metric,Target,Actual,Variance\n`;
          reportData.metrics.forEach(m => {
            csvContent += `${m.metric},${m.target}%,${m.actual}%,${m.variance > 0 ? '+' : ''}${m.variance}%\n`;
          });
        }

        const contentType = format === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv';
        const extension = format === 'excel' ? 'xlsx' : 'csv';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${extension}"`);
        res.send(csvContent);
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid format. Use "pdf", "excel", or "csv".'
        });
      }
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
