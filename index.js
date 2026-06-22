import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { testConnection, ensureDatabase } from "./config/db.js";
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
import receptionRoutes from "./routes/receptionRoutes.js";
import { initializeDatabaseSchema } from "./scripts/init-database-schema.js";

dotenv.config();
const app = express();

// Middleware
// Increase body size limit to 350MB to handle 200MB files with Base64 encoding overhead
app.use(express.json({
  limit: '350mb',
  strict: false,
  type: (req) => {
    const contentType = req.headers['content-type'] || '';
    return contentType.includes('application/json');
  },
}));
app.use(express.urlencoded({ limit: '350mb', extended: true }));

// Invalid JSON body (e.g. malformed login POST from redirects/proxies)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.warn(`[JSON] Invalid request body on ${req.method} ${req.originalUrl}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body. Use Content-Type: application/json.',
    });
  }
  next(err);
});
const corsAllowList = new Set([
  'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://hcc.guzekustomz.com',
  'https://hcc.guzekustomz.com',
  'http://test.guzekustomz.com',
  'https://test.guzekustomz.com',
  'https://test.wildjourneysrwanda.com',
  'http://test.wildjourneysrwanda.com',
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()) : []),
]);

const isAllowedCorsOrigin = (origin) => {
  if (!origin) return true;
  if (corsAllowList.has(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return true;
    }
    return hostname === 'guzekustomz.com' || hostname.endsWith('.guzekustomz.com');
  } catch {
    return false;
  }
};

app.use(cors({
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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
app.use('/api/reception', receptionRoutes);
console.log('✅ Reception desk routes registered at /api/reception');
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

const PORT = process.env.PORT || 5000;
const API_BASE_URL = process.env.API_BASE_URL || `https://hcc.guzekustomz.com`;
console.log('Starting server on port:', PORT);

// Start server
const startServer = async () => {
  try {
    await ensureDatabase();
    const dbConnected = await testConnection();

    if (dbConnected) {
      await initializeDatabaseSchema();
    } else {
      console.error('\n❌ Failed to connect to database.');
      console.error('   The API server will still start, but endpoints may fail until MySQL is reachable.\n');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API available at: ${API_BASE_URL}`);
      console.log(`📊 Database: hcc`);
      console.log(`🏢 Departments API: ${API_BASE_URL}/api/departments`);
      console.log(`👥 Roles API: ${API_BASE_URL}/api/roles`);
      console.log(`👤 Staff API: ${API_BASE_URL}/api/staff`);
      console.log(`💬 Messages API: ${API_BASE_URL}/api/messages`);
      console.log(`🎯 Opportunities API: ${API_BASE_URL}/api/opportunities`);
      console.log(`📋 Projects API: ${API_BASE_URL}/api/projects`);
      console.log(`👔 Clients API: ${API_BASE_URL}/api/clients`);
      console.log(`🚗 Vehicles API: ${API_BASE_URL}/api/vehicles`);
      console.log(`📝 Tasks API: ${API_BASE_URL}/api/tasks`);
      console.log(`📄 Documents API: ${API_BASE_URL}/api/documents`);
      console.log(`💭 Discussions API: ${API_BASE_URL}/api/discussions`);
      console.log(`📝 EOIs API: ${API_BASE_URL}/api/eois`);
      console.log(`💰 Budgets API: ${API_BASE_URL}/api/budgets`);
      console.log(`📄 Invoices API: ${API_BASE_URL}/api/invoices`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
