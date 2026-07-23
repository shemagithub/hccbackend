import express from 'express';
import { FinanceController } from '../controllers/financeController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/dashboard', FinanceController.getDashboard);
router.get('/projects-overview', FinanceController.getProjectsOverview);

export default router;
