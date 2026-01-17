import express from 'express';
import { FinanceProjectController } from '../controllers/financeProjectController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Finance project management routes
router.get('/dashboard', FinanceProjectController.getDashboard);
router.get('/projects', FinanceProjectController.getProjects);
router.get('/budgets', FinanceProjectController.getBudgets);
router.get('/expenses', FinanceProjectController.getExpenses);
router.get('/payments', FinanceProjectController.getPayments);
router.get('/cost-vs-progress', FinanceProjectController.getCostVsProgress);
router.get('/approvals', FinanceProjectController.getApprovals);
router.post('/reports/generate', FinanceProjectController.generateReport);

export default router;
