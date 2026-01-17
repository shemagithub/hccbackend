import pool from '../config/db.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Expense from '../models/Expense.js';
import FuelLog from '../models/FuelLog.js';
import Vehicle from '../models/Vehicle.js';
import Trip from '../models/Trip.js';
import Budget from '../models/Budget.js';
import Staff from '../models/Staff.js';

export class DashboardController {
  // Get comprehensive dashboard data
  static async getDashboard(req, res) {
    try {
      console.log('📊 Fetching dashboard data...');
      const staff = await Staff.findById(req.staffId);
      
      // Build filters based on user role
      const projectFilters = { limit: 100 };
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        if (staff.departmentId) {
          projectFilters.departmentId = staff.departmentId;
        }
        if (staff.email) {
          projectFilters.userEmail = staff.email;
        }
      }

      // Fetch all data in parallel
      const [
        projects,
        tasks,
        expenses,
        fuelLogs,
        vehicles,
        trips,
        budgets,
        staffCount
      ] = await Promise.all([
        Project.findAll(projectFilters).catch(() => []),
        Task.findAll({ limit: 100 }).catch(() => []),
        Expense.findAll({ limit: 100 }).catch(() => []),
        FuelLog.findAll({ limit: 100 }).catch(() => []),
        Vehicle.findAll({ limit: 100 }).catch(() => []),
        Trip.findAll({ limit: 50 }).catch(() => []),
        Budget.findAll({ limit: 100 }).catch(() => []),
        Staff.getStats().catch(() => ({ total: 0, active: 0 }))
      ]);

      // Calculate KPIs
      const totalProjects = projects.length;
      const ongoingProjects = projects.filter(p => p.status === 'ongoing').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const overdueTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return due < today && t.status !== 'completed';
      }).length;

      // Calculate fuel consumption (this month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthFuel = fuelLogs
        .filter(log => {
          const logDate = new Date(log.fuelDate || log.createdAt);
          return logDate >= startOfMonth;
        })
        .reduce((sum, log) => sum + parseFloat(log.amount || 0), 0);

      // Active vehicles
      const activeVehicles = vehicles.filter(v => v.status === 'active').length;
      const inUseVehicles = vehicles.filter(v => v.status === 'active' && v.currentLocation).length;
      const idleVehicles = activeVehicles - inUseVehicles;

      // Calculate expenses (this month)
      const thisMonthExpenses = expenses
        .filter(exp => {
          const expDate = new Date(exp.expenseDate || exp.createdAt);
          return expDate >= startOfMonth;
        })
        .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

      // Calculate budget utilization
      const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0) +
        projects.reduce((sum, p) => sum + parseFloat(p.budget || 0), 0);
      const totalSpent = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0) +
        projects.reduce((sum, p) => sum + parseFloat(p.spent || 0), 0);
      const budgetUtilization = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(0) : 0;

      // Project progress data
      const projectProgress = projects.slice(0, 10).map(project => {
        const progress = parseFloat(project.progress || 0);
        const budget = parseFloat(project.budget || 0);
        const spent = parseFloat(project.spent || 0);
        
        return {
          id: project.id || project.dbId,
          name: project.name,
          progress: progress,
          status: project.status,
          deadline: project.endDate,
          budget: budget,
          spent: spent,
          team: project.teamSize || 0
        };
      });

      // Upcoming tasks (due in next 7 days)
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      const upcomingTasks = tasks
        .filter(task => {
          if (!task.dueDate) return false;
          const due = new Date(task.dueDate);
          return due >= today && due <= nextWeek && task.status !== 'completed';
        })
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 10)
        .map(task => ({
          id: task.id || task.dbId,
          title: task.title,
          project: task.projectName || 'N/A',
          dueDate: task.dueDate,
          priority: task.priority,
          assignee: task.assigneeName || 'Unassigned',
          status: task.status
        }));

      // Fuel consumption data (last 12 months)
      const fuelConsumptionData = [];
      const fuelCategories = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const monthFuel = fuelLogs
          .filter(log => {
            const logDate = new Date(log.fuelDate || log.createdAt);
            return logDate >= monthStart && logDate <= monthEnd;
          })
          .reduce((sum, log) => sum + parseFloat(log.amount || 0), 0);
        
        fuelConsumptionData.push(Math.round(monthFuel));
        fuelCategories.push(date.toLocaleDateString('en-US', { month: 'short' }));
      }

      // Recent trips
      const recentTrips = trips
        .sort((a, b) => new Date(b.tripDate || b.createdAt) - new Date(a.tripDate || a.createdAt))
        .slice(0, 10)
        .map(trip => ({
          id: trip.id || trip.dbId,
          vehicle: trip.vehicleName || trip.vehicleId || 'N/A',
          driver: trip.driverName || 'N/A',
          route: trip.origin && trip.destination 
            ? `${trip.origin} → ${trip.destination}`
            : trip.route || 'N/A',
          distance: trip.distance ? `${trip.distance} km` : 'N/A',
          fuelUsed: trip.fuelConsumed ? `${trip.fuelConsumed}L` : 'N/A',
          date: trip.tripDate || trip.createdAt
        }));

      // Budget vs Actual (last 12 months)
      const budgetData = {
        planned: [],
        actual: [],
        categories: []
      };

      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const monthBudget = budgets
          .filter(b => {
            const budgetDate = new Date(b.createdAt || b.startDate);
            return budgetDate >= monthStart && budgetDate <= monthEnd;
          })
          .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
        
        const monthActual = expenses
          .filter(exp => {
            const expDate = new Date(exp.expenseDate || exp.createdAt);
            return expDate >= monthStart && expDate <= monthEnd;
          })
          .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        
        budgetData.planned.push(Math.round(monthBudget / 1000)); // Convert to thousands
        budgetData.actual.push(Math.round(monthActual / 1000));
        budgetData.categories.push(date.toLocaleDateString('en-US', { month: 'short' }));
      }

      // Recent expenses
      const recentExpenses = expenses
        .sort((a, b) => new Date(b.expenseDate || b.createdAt) - new Date(a.expenseDate || a.createdAt))
        .slice(0, 10)
        .map(exp => ({
          id: exp.id || exp.dbId,
          category: exp.category || 'Other',
          amount: parseFloat(exp.amount || 0),
          project: exp.projectName || 'N/A',
          date: exp.expenseDate || exp.createdAt
        }));

      // Notifications/Alerts
      const notifications = [];
      
      // Budget overrun alerts
      projects.forEach(project => {
        const budget = parseFloat(project.budget || 0);
        const spent = parseFloat(project.spent || 0);
        if (budget > 0 && spent > budget * 1.1) {
          const overrunPercent = ((spent - budget) / budget * 100).toFixed(0);
          notifications.push({
            type: 'warning',
            title: 'Budget Overrun Alert',
            message: `${project.name} is ${overrunPercent}% over budget`,
            time: new Date(project.updatedAt || project.createdAt)
          });
        }
      });

      // Overdue tasks
      const overdueTaskCount = overdueTasks;
      if (overdueTaskCount > 0) {
        notifications.push({
          type: 'error',
          title: 'Overdue Tasks',
          message: `${overdueTaskCount} task${overdueTaskCount > 1 ? 's' : ''} ${overdueTaskCount > 1 ? 'are' : 'is'} overdue`,
          time: new Date()
        });
      }

      // Project milestones
      projects.forEach(project => {
        const progress = parseFloat(project.progress || 0);
        if (progress >= 90 && progress < 100) {
          notifications.push({
            type: 'success',
            title: 'Project Milestone',
            message: `${project.name} is ${progress}% complete`,
            time: new Date(project.updatedAt || project.createdAt)
          });
        }
      });

      // Sort notifications by time (most recent first)
      notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

      res.json({
        success: true,
        data: {
          kpis: {
            totalProjects: {
              value: totalProjects,
              subValue: `${ongoingProjects} Ongoing, ${completedProjects} Completed`,
              percent: 0
            },
            tasksStatus: {
              value: totalTasks,
              subValue: `${completedTasks} Completed, ${inProgressTasks} In-progress, ${overdueTasks} Overdue`,
              percent: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0
            },
            fuelConsumed: {
              value: `${Math.round(thisMonthFuel)}L`,
              subValue: 'This Month',
              percent: 0
            },
            activeVehicles: {
              value: activeVehicles,
              subValue: `${inUseVehicles} In Use, ${idleVehicles} Idle`,
              percent: 0
            },
            totalExpenses: {
              value: thisMonthExpenses,
              subValue: 'This Month',
              percent: 0
            },
            budgetUtilization: {
              value: `${budgetUtilization}%`,
              subValue: 'Used vs Planned',
              percent: 0
            }
          },
          projectProgress: projectProgress,
          upcomingTasks: upcomingTasks,
          fuelConsumption: {
            series: [{ name: 'Fuel Used (L)', data: fuelConsumptionData }],
            categories: fuelCategories
          },
          recentTrips: recentTrips,
          budgetData: {
            series: [
              { name: 'Planned Budget', data: budgetData.planned },
              { name: 'Actual Cost', data: budgetData.actual }
            ],
            categories: budgetData.categories
          },
          recentExpenses: recentExpenses,
          notifications: notifications.slice(0, 10)
        }
      });
    } catch (error) {
      console.error('❌ Get dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data.',
        error: error.message
      });
    }
  }
}
