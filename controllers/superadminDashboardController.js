import Staff from '../models/Staff.js';
import Department from '../models/Department.js';
import Role from '../models/Role.js';
import Project from '../models/Project.js';
import Opportunity from '../models/Opportunity.js';
import Task from '../models/Task.js';
import Deliverable from '../models/Deliverable.js';
import Expense from '../models/Expense.js';
import Review from '../models/Review.js';
import QualityControl from '../models/QualityControl.js';
import Risk from '../models/Risk.js';
import Issue from '../models/Issue.js';
import Invoice from '../models/Invoice.js';
import ClientBilling from '../models/ClientBilling.js';
import VendorPayment from '../models/VendorPayment.js';
import SupplierInvoice from '../models/SupplierInvoice.js';
import SalaryPayment from '../models/SalaryPayment.js';
import Vehicle from '../models/Vehicle.js';
import Trip from '../models/Trip.js';
import Document from '../models/Document.js';
import Client from '../models/Client.js';
import EOI from '../models/EOI.js';
import Implementation from '../models/Implementation.js';
import Budget from '../models/Budget.js';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import Team from '../models/Team.js';
import Skill from '../models/Skill.js';
import Training from '../models/Training.js';
import Performance from '../models/Performance.js';
import WorkReport from '../models/WorkReport.js';
import LeaveRequest from '../models/LeaveRequest.js';
import FundRequest from '../models/FundRequest.js';
import Driver from '../models/Driver.js';
import Milestone from '../models/Milestone.js';
import MeetingMinutes from '../models/MeetingMinutes.js';
import { calculateSystemHealth } from '../utils/systemHealth.js';

export class SuperAdminDashboardController {
  // Get comprehensive dashboard statistics from all control panels
  static async getDashboardStats(req, res) {
    try {
      console.log('📊 Fetching SuperAdmin dashboard statistics...');

      // Fetch all statistics in parallel for better performance
      const [
        staffStats,
        departmentStats,
        roleStats,
        projectStats,
        opportunityStats,
        taskStats,
        deliverableStats,
        expenseStats,
        reviewStats,
        qualityStats,
        riskStats,
        issueStats,
        invoiceStats,
        clientBillingStats,
        vendorPaymentStats,
        supplierInvoiceStats,
        salaryPaymentStats,
        vehicleStats,
        tripStats,
        documentStats,
        clientStats,
        eoiStats,
        implementationStats,
        budgetStats,
        supportTicketStats,
        notificationStats,
        teamStats,
        skillStats,
        trainingStats,
        performanceStats,
        workReportStats,
        leaveRequestStats,
        fundRequestStats,
        driverStats,
        milestoneStats,
        meetingStats
      ] = await Promise.all([
        Staff.getStats().catch(e => ({ total: 0, active: 0, pending: 0, inactive: 0 })),
        Department.findAll({ limit: 10000 }).then(depts => ({ total: depts.length })).catch(() => ({ total: 0 })),
        Role.getStats().catch(() => ({ total: 0 })),
        Project.getStats().catch(() => ({ total: 0, totalBudget: 0, totalSpent: 0, ongoing: 0, completed: 0 })),
        Opportunity.getStats(null).catch(() => ({ total: 0, totalValue: 0, open: 0, won: 0 })),
        Task.getStats(null).catch(() => ({ total: 0, pending: 0, inProgress: 0, completed: 0 })),
        Deliverable.getStats(null).catch(() => ({ total: 0, pending: 0, submitted: 0, approved: 0 })),
        Expense.getStats(null).catch(() => ({ total: 0, totalAmount: 0, pending: 0, approved: 0 })),
        Review.getStats(null).catch(() => ({ total: 0, pending: 0, approved: 0 })),
        QualityControl.getStats(null).catch(() => ({ total: 0, passed: 0, failed: 0 })),
        Risk.getStats(null).catch(() => ({ total: 0, active: 0, critical: 0, mitigated: 0 })),
        Issue.getStats(null).catch(() => ({ total: 0, open: 0, resolved: 0 })),
        Invoice.getStats().catch(() => ({ total: 0, totalAmount: 0, pending: 0, paid: 0 })),
        ClientBilling.getStats({}).catch(() => ({ total: 0, totalAmount: 0, pending: 0, paid: 0 })),
        VendorPayment.getStats({}).catch(() => ({ total: 0, totalAmount: 0, pending: 0, paid: 0 })),
        SupplierInvoice.getStats({}).catch(() => ({ total: 0, totalAmount: 0, pending: 0, paid: 0 })),
        SalaryPayment.getStats({}).catch(() => ({ total: 0, totalAmount: 0, pending: 0, paid: 0 })),
        Vehicle.getStats().catch(() => ({ total: 0, active: 0 })),
        Trip.getStats(null).catch(() => ({ total: 0, completed: 0, inProgress: 0 })),
        Document.getStats(null).catch(() => ({ total: 0 })),
        Client.findAll({ limit: 10000 }).then(clients => ({ total: clients.length })).catch(() => ({ total: 0 })),
        EOI.getStats().catch(() => ({ total: 0, submitted: 0, approved: 0 })),
        Implementation.getStats().catch(() => ({ total: 0, active: 0, completed: 0 })),
        Budget.findAll({ limit: 10000 }).then(budgets => {
          const total = budgets.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
          return { total: budgets.length, totalAmount: total };
        }).catch(() => ({ total: 0, totalAmount: 0 })),
        SupportTicket.getStats({}).catch(() => ({ total: 0, open: 0, resolved: 0 })),
        Notification.getStats(null).catch(() => ({ total: 0, unread: 0 })),
        Team.findAll({ limit: 10000 }).then(teams => ({ total: teams.length })).catch(() => ({ total: 0 })),
        Skill.findAll({ limit: 10000 }).then(skills => ({ total: skills.length })).catch(() => ({ total: 0 })),
        Training.findAll({ limit: 10000 }).then(trainings => ({ total: trainings.length, active: trainings.filter(t => t.status === 'active' || t.status === 'ongoing').length })).catch(() => ({ total: 0, active: 0 })),
        Performance.findAll({ limit: 10000 }).then(perfs => ({ total: perfs.length })).catch(() => ({ total: 0 })),
        WorkReport.findAll({ limit: 10000 }).then(reports => ({ total: reports.length })).catch(() => ({ total: 0 })),
        LeaveRequest.findAll({ limit: 10000 }).then(leaves => ({ total: leaves.length, pending: leaves.filter(l => l.status === 'pending').length })).catch(() => ({ total: 0, pending: 0 })),
        FundRequest.findAll({ limit: 10000 }).then(funds => ({ total: funds.length, pending: funds.filter(f => f.status === 'pending').length })).catch(() => ({ total: 0, pending: 0 })),
        Driver.getStats().catch(() => ({ total: 0, active: 0 })),
        Milestone.getStats({}).catch(() => ({ total: 0, completed: 0, pending: 0 })),
        MeetingMinutes.findAll({ limit: 10000 }).then(meetings => ({ total: meetings.length })).catch(() => ({ total: 0 }))
      ]);

      // Calculate financial totals
      const totalBudget = parseFloat(projectStats.totalBudget || 0) + parseFloat(budgetStats.totalAmount || 0);
      const totalSpent = parseFloat(projectStats.totalSpent || 0) + parseFloat(expenseStats.totalAmount || 0);
      const totalRevenue = parseFloat(clientBillingStats.totalAmount || 0) + parseFloat(invoiceStats.totalAmount || 0);
      const totalPayments = parseFloat(vendorPaymentStats.totalAmount || 0) + parseFloat(supplierInvoiceStats.totalAmount || 0) + parseFloat(salaryPaymentStats.totalAmount || 0);
      const totalOpportunityValue = parseFloat(opportunityStats.totalValue || 0);

      // Calculate pending items
      const pendingItems = {
        expenses: expenseStats.pending || 0,
        reviews: reviewStats.pending || 0,
        invoices: invoiceStats.pending || 0,
        payments: (vendorPaymentStats.pending || 0) + (supplierInvoiceStats.pending || 0) + (salaryPaymentStats.pending || 0),
        leaveRequests: leaveRequestStats.pending || 0,
        fundRequests: fundRequestStats.pending || 0,
        supportTickets: supportTicketStats.open || 0
      };

      const totalPendingItems = Object.values(pendingItems).reduce((sum, val) => sum + val, 0);

      const { healthFactors, systemHealthScore, systemHealth } = calculateSystemHealth({
        staffStats,
        projectStats,
        taskStats,
        riskStats,
        issueStats,
        totalPendingItems,
      });

      res.json({
        success: true,
        data: {
          // Staff Management
          staff: {
            total: staffStats.total || 0,
            active: staffStats.active || 0,
            pending: staffStats.pending || 0,
            inactive: staffStats.inactive || 0
          },
          departments: {
            total: departmentStats.total || 0
          },
          roles: {
            total: roleStats.total || 0
          },

          // Project Management
          projects: {
            total: projectStats.total || 0,
            totalBudget: parseFloat(projectStats.totalBudget || 0),
            totalSpent: parseFloat(projectStats.totalSpent || 0),
            ongoing: projectStats.ongoing || 0,
            completed: projectStats.completed || 0,
            planning: projectStats.planning || 0,
            onHold: projectStats.onHold || 0,
            overdue: projectStats.overdue || 0
          },
          opportunities: {
            total: opportunityStats.total || 0,
            totalValue: totalOpportunityValue,
            open: opportunityStats.open || 0,
            won: opportunityStats.won || 0,
            lost: opportunityStats.lost || 0
          },
          tasks: {
            total: taskStats.total || 0,
            pending: taskStats.pending || 0,
            inProgress: taskStats.inProgress || 0,
            completed: taskStats.completed || 0
          },
          deliverables: {
            total: deliverableStats.total || 0,
            pending: deliverableStats.pending || 0,
            submitted: deliverableStats.submitted || 0,
            approved: deliverableStats.approved || 0
          },
          milestones: {
            total: milestoneStats.total || 0,
            completed: milestoneStats.completed || 0,
            pending: milestoneStats.pending || 0
          },

          // Finance
          finance: {
            totalBudget,
            totalSpent,
            totalRevenue,
            totalPayments,
            budgetRemaining: totalBudget - totalSpent,
            netIncome: totalRevenue - totalPayments
          },
          expenses: {
            total: expenseStats.total || 0,
            totalAmount: parseFloat(expenseStats.totalAmount || 0),
            pending: expenseStats.pending || 0,
            approved: expenseStats.approved || 0
          },
          invoices: {
            total: invoiceStats.total || 0,
            totalAmount: parseFloat(invoiceStats.totalAmount || 0),
            pending: invoiceStats.pending || 0,
            paid: invoiceStats.paid || 0
          },
          clientBillings: {
            total: clientBillingStats.total || 0,
            totalAmount: parseFloat(clientBillingStats.totalAmount || 0),
            pending: clientBillingStats.pending || 0,
            paid: clientBillingStats.paid || 0
          },
          vendorPayments: {
            total: vendorPaymentStats.total || 0,
            totalAmount: parseFloat(vendorPaymentStats.totalAmount || 0),
            pending: vendorPaymentStats.pending || 0,
            paid: vendorPaymentStats.paid || 0
          },
          supplierInvoices: {
            total: supplierInvoiceStats.total || 0,
            totalAmount: parseFloat(supplierInvoiceStats.totalAmount || 0),
            pending: supplierInvoiceStats.pending || 0,
            paid: supplierInvoiceStats.paid || 0
          },
          salaryPayments: {
            total: salaryPaymentStats.total || 0,
            totalAmount: parseFloat(salaryPaymentStats.totalAmount || 0),
            pending: salaryPaymentStats.pending || 0,
            paid: salaryPaymentStats.paid || 0
          },
          budgets: {
            total: budgetStats.total || 0,
            totalAmount: parseFloat(budgetStats.totalAmount || 0)
          },

          // Quality & Risk
          quality: {
            total: qualityStats.total || 0,
            passed: qualityStats.passed || 0,
            failed: qualityStats.failed || 0
          },
          risks: {
            total: riskStats.total || 0,
            active: riskStats.active || 0,
            critical: riskStats.critical || 0,
            mitigated: riskStats.mitigated || 0
          },
          issues: {
            total: issueStats.total || 0,
            open: issueStats.open || 0,
            resolved: issueStats.resolved || 0
          },
          reviews: {
            total: reviewStats.total || 0,
            pending: reviewStats.pending || 0,
            approved: reviewStats.approved || 0
          },

          // Logistics & Vehicles
          vehicles: {
            total: vehicleStats.total || 0,
            active: vehicleStats.active || 0
          },
          trips: {
            total: tripStats.total || 0,
            completed: tripStats.completed || 0,
            inProgress: tripStats.inProgress || 0
          },
          drivers: {
            total: driverStats.total || 0,
            active: driverStats.active || 0
          },

          // Team & Skills
          teams: {
            total: teamStats.total || 0
          },
          skills: {
            total: skillStats.total || 0
          },
          training: {
            total: trainingStats.total || 0,
            active: trainingStats.active || 0
          },
          performance: {
            total: performanceStats.total || 0
          },
          workReports: {
            total: workReportStats.total || 0
          },

          // Employee Management
          leaveRequests: {
            total: leaveRequestStats.total || 0,
            pending: leaveRequestStats.pending || 0
          },
          fundRequests: {
            total: fundRequestStats.total || 0,
            pending: fundRequestStats.pending || 0
          },

          // Other
          clients: {
            total: clientStats.total || 0
          },
          eois: {
            total: eoiStats.total || 0,
            submitted: eoiStats.submitted || 0,
            approved: eoiStats.approved || 0
          },
          implementations: {
            total: implementationStats.total || 0,
            active: implementationStats.active || 0,
            completed: implementationStats.completed || 0
          },
          documents: {
            total: documentStats.total || 0
          },
          supportTickets: {
            total: supportTicketStats.total || 0,
            open: supportTicketStats.open || 0,
            resolved: supportTicketStats.resolved || 0
          },
          notifications: {
            total: notificationStats.total || 0,
            unread: notificationStats.unread || 0
          },
          meetings: {
            total: meetingStats.total || 0
          },

          // Summary
          summary: {
            totalPendingItems,
            pendingItems,
            systemHealth,
            systemHealthScore,
            healthFactors,
            totalBudget,
            totalSpent,
            totalRevenue,
            budgetUtilization: totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0
          }
        }
      });
    } catch (error) {
      console.error('❌ Get SuperAdmin dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SuperAdmin dashboard statistics.',
        error: error.message
      });
    }
  }
}
