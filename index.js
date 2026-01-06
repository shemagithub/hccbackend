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
import meetingRoutes from "./routes/meetingRoutes.js";
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
app.use('/api/meetings', meetingRoutes);
console.log('✅ Meeting routes registered at /api/meetings');

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
      console.error('❌ Failed to connect to database. Server not started.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
