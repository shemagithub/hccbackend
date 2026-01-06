import express from 'express';
import { ExpenseController } from '../controllers/expenseController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Expense routes - all require authentication
router.use(authenticate);

router.post('/', ExpenseController.createExpense);
router.get('/', ExpenseController.getExpenses);
router.get('/stats', ExpenseController.getExpenseStats);
router.get('/:id', ExpenseController.getExpenseById);
router.put('/:id', ExpenseController.updateExpense);
router.delete('/:id', ExpenseController.deleteExpense);

export default router;
