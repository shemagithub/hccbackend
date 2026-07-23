import express from 'express';
import { BudgetController } from '../controllers/budgetController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All budget routes require authentication
router.use(authenticate);

// Get profit/loss report (must be before /:id)
router.get('/profit-loss', BudgetController.getProfitLossReport);

// Get all budgets
router.get('/', BudgetController.getBudgets);

// Get budget by ID
router.get('/:id', BudgetController.getBudgetById);

// Get budget by project ID
router.get('/project/:projectId', BudgetController.getBudgetByProjectId);

// Create a new budget
router.post('/', BudgetController.createBudget);

// Update budget
router.put('/:id', BudgetController.updateBudget);

// Delete budget
router.delete('/:id', BudgetController.deleteBudget);

export default router;

