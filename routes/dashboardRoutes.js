import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { DashboardController } from '../controllers/dashboardController.js';

const router = express.Router();

// Dashboard routes
router.get('/', authenticate, DashboardController.getDashboard);

export default router;
