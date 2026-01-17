import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { SuperAdminDashboardController } from '../controllers/superadminDashboardController.js';

const router = express.Router();

// SuperAdmin Dashboard routes
router.get('/dashboard/stats', authenticate, SuperAdminDashboardController.getDashboardStats);

export default router;
