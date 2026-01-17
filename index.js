import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { testConnection } from "./config/db.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import opportunityRoutes from "./routes/opportunityRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import discussionRoutes from "./routes/discussionRoutes.js";
import implementationRoutes from "./routes/implementationRoutes.js";
import eoiRoutes from "./routes/eoiRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import deliverableRoutes from "./routes/deliverableRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import qualityRoutes from "./routes/qualityRoutes.js";
import riskRoutes from "./routes/riskRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import teamSkillsRoutes from "./routes/teamSkillsRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import clientBillingRoutes from "./routes/clientBillingRoutes.js";
import vendorPaymentRoutes from "./routes/vendorPaymentRoutes.js";
import supplierInvoiceRoutes from "./routes/supplierInvoiceRoutes.js";
import salaryPaymentRoutes from "./routes/salaryPaymentRoutes.js";
import deductionRoutes from "./routes/deductionRoutes.js";
import bonusRoutes from "./routes/bonusRoutes.js";
import taxManagementRoutes from "./routes/taxManagementRoutes.js";
import milestoneRoutes from "./routes/milestoneRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import tripReportRoutes from "./routes/tripReportRoutes.js";
import fuelLogRoutes from "./routes/fuelLogRoutes.js";
import vehicleInspectionRoutes from "./routes/vehicleInspectionRoutes.js";
import maintenanceRoutes from "./routes/maintenanceRoutes.js";
import timeAttendanceRoutes from "./routes/timeAttendanceRoutes.js";
import projectSupportLogRoutes from "./routes/projectSupportLogRoutes.js";
import skillRoutes from "./routes/skillRoutes.js";
import skillProfileRoutes from "./routes/skillProfileRoutes.js";
import projectAssignmentRoutes from "./routes/projectAssignmentRoutes.js";
import availabilityRoutes from "./routes/availabilityRoutes.js";
import skillGapRoutes from "./routes/skillGapRoutes.js";
import trainingRoutes from "./routes/trainingRoutes.js";
import performanceRoutes from "./routes/performanceRoutes.js";
import workReportRoutes from "./routes/workReportRoutes.js";
import fieldReportRoutes from "./routes/fieldReportRoutes.js";
import employeeRequestRoutes from "./routes/employeeRequestRoutes.js";
import leaveRequestRoutes from "./routes/leaveRequestRoutes.js";
import fundRequestRoutes from "./routes/fundRequestRoutes.js";
import workBreakdownRoutes from "./routes/workBreakdownRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import supportTicketRoutes from "./routes/supportTicketRoutes.js";
import userPermissionRoutes from "./routes/userPermissionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import financeProjectRoutes from "./routes/financeProjectRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
import teamActivityRoutes from "./routes/teamActivityRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import { initializeDepartments } from "./scripts/init-departments.js";
import { initializeRoles } from "./scripts/init-roles.js";
import { initializeStaff } from "./scripts/init-staff.js";
import { initializeMessagesTable } from "./scripts/init-messages.js";
import { initializeOpportunities } from "./scripts/init-opportunities.js";
import { initializeProjects } from "./scripts/init-projects.js";
import { initializeClients } from "./scripts/init-clients.js";
import { initializeVehicles } from "./scripts/init-vehicles.js";
import { initializeEOIs } from "./scripts/init-eois.js";
import { initializeBudgets } from "./scripts/init-budgets.js";
import initializeInvoices from "./scripts/init-invoices.js";
import { initializeImplementations } from "./scripts/init-implementations.js";
import { initializeTasks } from "./scripts/init-tasks.js";
import { initializeDeliverables } from "./scripts/init-deliverables.js";
import { initializeExpenses } from "./scripts/init-expenses.js";
import ClientBilling from "./models/ClientBilling.js";
import Contract from "./models/Contract.js";
import Team from "./models/Team.js";
import TeamMember from "./models/TeamMember.js";
import VendorPayment from "./models/VendorPayment.js";
import SupplierInvoice from "./models/SupplierInvoice.js";
import SalaryPayment from "./models/SalaryPayment.js";
import Deduction from "./models/Deduction.js";
import Bonus from "./models/Bonus.js";
import TaxManagement from "./models/TaxManagement.js";
import Milestone from "./models/Milestone.js";
import Trip from "./models/Trip.js";
import TripReport from "./models/TripReport.js";
import FuelLog from "./models/FuelLog.js";
import VehicleInspection from "./models/VehicleInspection.js";
import Maintenance from "./models/Maintenance.js";
import TimeAttendance from "./models/TimeAttendance.js";
import ProjectSupportLog from "./models/ProjectSupportLog.js";
import Skill from "./models/Skill.js";
import SkillProfile from "./models/SkillProfile.js";
import ProjectAssignment from "./models/ProjectAssignment.js";
import Availability from "./models/Availability.js";
import SkillGap from "./models/SkillGap.js";
import Training from "./models/Training.js";
import Performance from "./models/Performance.js";
import WorkReport from "./models/WorkReport.js";
import FieldReport from "./models/FieldReport.js";
import EmployeeRequest from "./models/EmployeeRequest.js";
import LeaveRequest from "./models/LeaveRequest.js";
import FundRequest from "./models/FundRequest.js";
import WorkBreakdown from "./models/WorkBreakdown.js";
import Document from "./models/Document.js";
import Driver from "./models/Driver.js";
import SupportTicket from "./models/SupportTicket.js";
import TicketMessage from "./models/TicketMessage.js";
import UserPermission from "./models/UserPermission.js";
import Review from "./models/Review.js";
import QualityControl from "./models/QualityControl.js";
import ComplianceCheck from "./models/ComplianceCheck.js";
import ESIAStandard from "./models/ESIAStandard.js";
import NonConformanceReport from "./models/NonConformanceReport.js";
import Risk from "./models/Risk.js";
import Issue from "./models/Issue.js";
import MitigationAction from "./models/MitigationAction.js";
import Escalation from "./models/Escalation.js";
import MeetingMinutes from "./models/MeetingMinutes.js";
import ActionItem from "./models/ActionItem.js";
import Responsibility from "./models/Responsibility.js";
import Notification from "./models/Notification.js";

dotenv.config();
const app = express();

// Middleware
// Increase body size limit to 350MB to handle 200MB files with Base64 encoding overhead
app.use(express.json({ limit: '350mb' }));
app.use(express.urlencoded({ limit: '350mb', extended: true }));
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:5173'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(helmet());
app.use(morgan("dev"));

// API Routes
app.use('/api/departments', departmentRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/discussions', discussionRoutes);
console.log('✅ Discussion routes registered at /api/discussions');
app.use('/api/implementations', implementationRoutes);
console.log('✅ Implementation routes registered at /api/implementations');
app.use('/api/eois', eoiRoutes);
console.log('✅ EOI routes registered at /api/eois');
app.use('/api/budgets', budgetRoutes);
console.log('✅ Budget routes registered at /api/budgets');
app.use('/api/invoices', invoiceRoutes);
console.log('✅ Invoice routes registered at /api/invoices');
app.use('/api/expenses', expenseRoutes);
console.log('✅ Expense routes registered at /api/expenses');
app.use('/api/deliverables', deliverableRoutes);
console.log('✅ Deliverable routes registered at /api/deliverables');
app.use('/api/reviews', reviewRoutes);
console.log('✅ Review routes registered at /api/reviews');
app.use('/api/quality', qualityRoutes);
console.log('✅ Quality routes registered at /api/quality');
app.use('/api/reviews', reviewRoutes);
console.log('✅ Review routes registered at /api/reviews');
app.use('/api/risks', riskRoutes);
console.log('✅ Risk routes registered at /api/risks');
app.use('/api/team', teamRoutes);
console.log('✅ Team routes registered at /api/team');
app.use('/api/team-skills', teamSkillsRoutes);
console.log('✅ Team skills routes registered at /api/team-skills');
app.use('/api/meetings', meetingRoutes);
console.log('✅ Meeting routes registered at /api/meetings');
app.use('/api/client-billings', clientBillingRoutes);
console.log('✅ Client billing routes registered at /api/client-billings');
app.use('/api/vendor-payments', vendorPaymentRoutes);
console.log('✅ Vendor payment routes registered at /api/vendor-payments');
app.use('/api/supplier-invoices', supplierInvoiceRoutes);
console.log('✅ Supplier invoice routes registered at /api/supplier-invoices');
app.use('/api/salary-payments', salaryPaymentRoutes);
console.log('✅ Salary payment routes registered at /api/salary-payments');
app.use('/api/deductions', deductionRoutes);
console.log('✅ Deduction routes registered at /api/deductions');
app.use('/api/bonuses', bonusRoutes);
console.log('✅ Bonus routes registered at /api/bonuses');
app.use('/api/taxes', taxManagementRoutes);
console.log('✅ Tax management routes registered at /api/taxes');
app.use('/api/milestones', milestoneRoutes);
console.log('✅ Milestone routes registered at /api/milestones');
app.use('/api/trips', tripRoutes);
console.log('✅ Trip routes registered at /api/trips');
app.use('/api/trip-reports', tripReportRoutes);
console.log('✅ Trip report routes registered at /api/trip-reports');
app.use('/api/fuel-logs', fuelLogRoutes);
console.log('✅ Fuel log routes registered at /api/fuel-logs');
app.use('/api/vehicle-inspections', vehicleInspectionRoutes);
console.log('✅ Vehicle inspection routes registered at /api/vehicle-inspections');
app.use('/api/maintenance', maintenanceRoutes);
console.log('✅ Maintenance routes registered at /api/maintenance');
app.use('/api/time-attendance', timeAttendanceRoutes);
console.log('✅ Time attendance routes registered at /api/time-attendance');
app.use('/api/project-support-logs', projectSupportLogRoutes);
console.log('✅ Project support log routes registered at /api/project-support-logs');
app.use('/api/skills', skillRoutes);
console.log('✅ Skill routes registered at /api/skills');
app.use('/api/skill-profiles', skillProfileRoutes);
console.log('✅ Skill profile routes registered at /api/skill-profiles');
app.use('/api/project-assignments', projectAssignmentRoutes);
console.log('✅ Project assignment routes registered at /api/project-assignments');
app.use('/api/availability', availabilityRoutes);
console.log('✅ Availability routes registered at /api/availability');
app.use('/api/skill-gaps', skillGapRoutes);
console.log('✅ Skill gap routes registered at /api/skill-gaps');
app.use('/api/contracts', contractRoutes);
console.log('✅ Contract routes registered at /api/contracts');
app.use('/api/training', trainingRoutes);
console.log('✅ Training routes registered at /api/training');
app.use('/api/performance', performanceRoutes);
console.log('✅ Performance routes registered at /api/performance');
app.use('/api/work-reports', workReportRoutes);
console.log('✅ Work report routes registered at /api/work-reports');
app.use('/api/field-reports', fieldReportRoutes);
console.log('✅ Field report routes registered at /api/field-reports');
app.use('/api/employee-requests', employeeRequestRoutes);
console.log('✅ Employee request routes registered at /api/employee-requests');
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/fund-requests', fundRequestRoutes);
console.log('✅ Fund request routes registered at /api/fund-requests');
app.use('/api/work-breakdown', workBreakdownRoutes);
app.use('/api/drivers', driverRoutes);
console.log('✅ Driver routes registered at /api/drivers');
console.log('✅ Work breakdown routes registered at /api/work-breakdown');
app.use('/api/reports', reportRoutes);
console.log('✅ Report routes registered at /api/reports');
app.use('/api/support-tickets', supportTicketRoutes);
console.log('✅ Support ticket routes registered at /api/support-tickets');
app.use('/api/user-permissions', userPermissionRoutes);
console.log('✅ User permission routes registered at /api/user-permissions');
app.use('/api/notifications', notificationRoutes);
console.log('✅ Notification routes registered at /api/notifications');
app.use('/api/finance-project', financeProjectRoutes);
console.log('✅ Finance project routes registered at /api/finance-project');
app.use('/api/superadmin', superadminRoutes);
console.log('✅ SuperAdmin routes registered at /api/superadmin');
app.use('/api/team-activity', teamActivityRoutes);
console.log('✅ Team activity routes registered at /api/team-activity');
app.use('/api/dashboard', dashboardRoutes);
console.log('✅ Dashboard routes registered at /api/dashboard');
console.log('✅ Leave request routes registered at /api/leave-requests');

// Basic routes
app.get('/', (req, res) => {
  res.json({
    message: 'HCC Backend API is running!',
    timestamp: new Date().toISOString(),
    database: 'hcc',
      endpoints: {
      departments: '/api/departments',
      roles: '/api/roles',
      staff: '/api/staff',
      messages: '/api/messages',
      opportunities: '/api/opportunities',
      projects: '/api/projects',
      clients: '/api/clients',
      vehicles: '/api/vehicles',
      tasks: '/api/tasks',
      documents: '/api/documents',
      discussions: '/api/discussions',
      implementations: '/api/implementations',
      eois: '/api/eois',
      budgets: '/api/budgets',
      invoices: '/api/invoices',
      expenses: '/api/expenses',
      deliverables: '/api/deliverables',
      meetings: '/api/meetings',
      clientBillings: '/api/client-billings',
      vendorPayments: '/api/vendor-payments',
      supplierInvoices: '/api/supplier-invoices',
      salaryPayments: '/api/salary-payments',
      deductions: '/api/deductions',
      bonuses: '/api/bonuses',
      taxes: '/api/taxes',
      milestones: '/api/milestones',
      trips: '/api/trips',
      tripReports: '/api/trip-reports',
      fuelLogs: '/api/fuel-logs',
      vehicleInspections: '/api/vehicle-inspections',
      maintenance: '/api/maintenance',
      timeAttendance: '/api/time-attendance',
      projectSupportLogs: '/api/project-support-logs',
      skills: '/api/skills',
      skillProfiles: '/api/skill-profiles',
      projectAssignments: '/api/project-assignments',
      availability: '/api/availability',
      skillGaps: '/api/skill-gaps',
      training: '/api/training',
      performance: '/api/performance',
      workReports: '/api/work-reports',
      fieldReports: '/api/field-reports',
      employeeRequests: '/api/employee-requests',
      leaveRequests: '/api/leave-requests',
      supportTickets: '/api/support-tickets',
      userPermissions: '/api/user-permissions',
      reviews: '/api/reviews',
      quality: '/api/quality',
      risks: '/api/risks',
      team: '/api/team',
      health: '/health'
    }
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      message: 'HCC Backend is healthy'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

const PORT = 5000; // Force port 5000
console.log('Starting server on port:', PORT);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (dbConnected) {
      // Initialize modules
      await initializeDepartments();
      await initializeRoles();
      await initializeStaff();
      await initializeMessagesTable();
      await initializeOpportunities();
      await initializeProjects();
      await initializeClients();
      await initializeVehicles();
      await initializeEOIs();
      await initializeBudgets();
      await initializeInvoices();
      await initializeImplementations();
      await initializeTasks();
      await initializeDeliverables();
      await initializeExpenses();
      
      // Initialize Documents table
      console.log('📋 Creating Documents table...');
      await Document.createTable();
      console.log('✅ Documents table ready');
      
      // Initialize new finance headquarter tables
      console.log('📋 Creating Client Billings table...');
      await ClientBilling.createTable();
      console.log('✅ Client Billings table ready');
      
      console.log('📋 Creating Vendor Payments table...');
      await VendorPayment.createTable();
      console.log('✅ Vendor Payments table ready');
      
      console.log('📋 Creating Supplier Invoices table...');
      await SupplierInvoice.createTable();
      console.log('✅ Supplier Invoices table ready');
      
      console.log('📋 Creating Salary Payments table...');
      await SalaryPayment.createTable();
      console.log('✅ Salary Payments table ready');
      
      console.log('📋 Creating Deductions table...');
      await Deduction.createTable();
      console.log('✅ Deductions table ready');
      
      console.log('📋 Creating Bonuses table...');
      await Bonus.createTable();
      console.log('✅ Bonuses table ready');
      
      console.log('📋 Creating Tax Management table...');
      await TaxManagement.createTable();
      console.log('✅ Tax Management table ready');

      console.log('📋 Creating Contracts table...');
      await Contract.createTable();
      console.log('✅ Contracts table ready');
      
      console.log('📋 Creating Teams table...');
      await Team.createTable();
      console.log('✅ Teams table ready');

      console.log('📋 Creating Team Members table...');
      await TeamMember.createTable();
      console.log('✅ Team Members table ready');
      
      console.log('📋 Creating Milestones table...');
      await Milestone.createTable();
      console.log('✅ Milestones table ready');
      
      // Initialize Driver Control Panel tables
      console.log('📋 Creating Trips table...');
      await Trip.createTable();
      console.log('✅ Trips table ready');
      
      console.log('📋 Creating Trip Reports table...');
      await TripReport.createTable();
      console.log('✅ Trip Reports table ready');
      
      console.log('📋 Creating Fuel Logs table...');
      await FuelLog.createTable();
      console.log('✅ Fuel Logs table ready');
      
      console.log('📋 Creating Vehicle Inspections table...');
      await VehicleInspection.createTable();
      console.log('✅ Vehicle Inspections table ready');
      
      console.log('📋 Creating Maintenance table...');
      await Maintenance.createTable();
      console.log('✅ Maintenance table ready');
      
      console.log('📋 Creating Time Attendance table...');
      await TimeAttendance.createTable();
      console.log('✅ Time Attendance table ready');
      
      console.log('📋 Creating Project Support Logs table...');
      await ProjectSupportLog.createTable();
      console.log('✅ Project Support Logs table ready');
      
      // Initialize Team Skills Control Panel tables
      console.log('📋 Creating Skills table...');
      await Skill.createTable();
      console.log('✅ Skills table ready');
      
      console.log('📋 Creating Skill Profiles table...');
      await SkillProfile.createTable();
      console.log('✅ Skill Profiles table ready');
      
      console.log('📋 Creating Project Assignments table...');
      await ProjectAssignment.createTable();
      console.log('✅ Project Assignments table ready');
      
      console.log('📋 Creating Availability table...');
      await Availability.createTable();
      console.log('✅ Availability table ready');
      
      console.log('📋 Creating Skill Gaps table...');
      await SkillGap.createTable();
      console.log('✅ Skill Gaps table ready');
      
      console.log('📋 Creating Training table...');
      await Training.createTable();
      console.log('✅ Training table ready');
      
      console.log('📋 Creating Performance table...');
      await Performance.createTable();
      console.log('✅ Performance table ready');
      
      // Initialize Employee Control Panel tables
      console.log('📋 Creating Work Reports table...');
      await WorkReport.createTable();
      console.log('✅ Work Reports table ready');
      
      console.log('📋 Creating Field Reports table...');
      await FieldReport.createTable();
      console.log('✅ Field Reports table ready');
      
      console.log('📋 Creating Employee Requests table...');
      await EmployeeRequest.createTable();
      console.log('✅ Employee Requests table ready');
      
      console.log('📋 Creating Leave Requests table...');
      await LeaveRequest.createTable();
      console.log('✅ Leave Requests table ready');
      
      console.log('📋 Creating Fund Requests table...');
      await FundRequest.createTable();
      console.log('✅ Fund Requests table ready');
      
      console.log('📋 Creating Work Breakdown table...');
      await WorkBreakdown.createTable();
      console.log('✅ Work Breakdown table ready');
      
      console.log('📋 Creating Drivers table...');
      await Driver.createTable();
      console.log('✅ Drivers table ready');
      
      console.log('📋 Creating Support Tickets table...');
      await SupportTicket.createTable();
      console.log('✅ Support Tickets table ready');
      
      console.log('📋 Creating Ticket Messages table...');
      await TicketMessage.createTable();
      console.log('✅ Ticket Messages table ready');
      
      console.log('📋 Creating User Permissions table...');
      await UserPermission.createTable();
      console.log('✅ User Permissions table ready');
      
      console.log('📋 Creating Reviews table...');
      await Review.createTable();
      console.log('✅ Reviews table ready');
      
      console.log('📋 Creating Notifications table...');
      await Notification.createTable();
      console.log('✅ Notifications table ready');
      
      console.log('📋 Creating Quality Control table...');
      await QualityControl.createTable();
      console.log('✅ Quality Control table ready');
      
      console.log('📋 Creating Compliance Checks table...');
      await ComplianceCheck.createTable();
      console.log('✅ Compliance Checks table ready');
      
      console.log('📋 Creating ESIA Standards table...');
      await ESIAStandard.createTable();
      console.log('✅ ESIA Standards table ready');
      
      console.log('📋 Creating Non-Conformance Reports table...');
      await NonConformanceReport.createTable();
      console.log('✅ Non-Conformance Reports table ready');
      
      console.log('📋 Creating Risks table...');
      await Risk.createTable();
      console.log('✅ Risks table ready');
      
      console.log('📋 Creating Issues table...');
      await Issue.createTable();
      console.log('✅ Issues table ready');
      
      console.log('📋 Creating Mitigation Actions table...');
      await MitigationAction.createTable();
      console.log('✅ Mitigation Actions table ready');
      
      console.log('📋 Creating Escalations table...');
      await Escalation.createTable();
      console.log('✅ Escalations table ready');
      
      console.log('📋 Creating Meeting Minutes table...');
      await MeetingMinutes.createTable();
      console.log('✅ Meeting Minutes table ready');
      
      console.log('📋 Creating Action Items table...');
      await ActionItem.createTable();
      console.log('✅ Action Items table ready');
      
      console.log('📋 Creating Responsibilities table...');
      await Responsibility.createTable();
      console.log('✅ Responsibilities table ready');
      console.log('✅ Drivers table ready');
      
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🌐 API available at: http://localhost:${PORT}`);
        console.log(`📊 Database: hcc`);
        console.log(`🏢 Departments API: http://localhost:${PORT}/api/departments`);
        console.log(`👥 Roles API: http://localhost:${PORT}/api/roles`);
        console.log(`👤 Staff API: http://localhost:${PORT}/api/staff`);
        console.log(`💬 Messages API: http://localhost:${PORT}/api/messages`);
        console.log(`🎯 Opportunities API: http://localhost:${PORT}/api/opportunities`);
        console.log(`📋 Projects API: http://localhost:${PORT}/api/projects`);
        console.log(`👔 Clients API: http://localhost:${PORT}/api/clients`);
        console.log(`🚗 Vehicles API: http://localhost:${PORT}/api/vehicles`);
        console.log(`📝 Tasks API: http://localhost:${PORT}/api/tasks`);
        console.log(`📄 Documents API: http://localhost:${PORT}/api/documents`);
        console.log(`💭 Discussions API: http://localhost:${PORT}/api/discussions`);
        console.log(`📝 EOIs API: http://localhost:${PORT}/api/eois`);
        console.log(`💰 Budgets API: http://localhost:${PORT}/api/budgets`);
        console.log(`📄 Invoices API: http://localhost:${PORT}/api/invoices`);
      });
    } else {
      console.error('\n❌ Failed to connect to database. Server startup aborted.');
      console.error('   Please ensure MySQL server is running and try again.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
