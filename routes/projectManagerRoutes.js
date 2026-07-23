import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ProjectManagerDashboardController } from '../controllers/projectManagerDashboardController.js';

const router = express.Router();

router.get('/dashboard', authenticate, ProjectManagerDashboardController.getDashboard);

export default router;
