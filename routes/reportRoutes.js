import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as reportController from '../controllers/reportController.js';
import { ProjectReportController } from '../controllers/projectReportController.js';

const router = express.Router();

// Legacy routes
router.get('/progress', authenticate, reportController.exportProjectProgressReport);
router.get('/fuel-transport', authenticate, reportController.exportFuelTransportReport);
router.get('/financial', authenticate, reportController.exportFinancialReport);
router.get('/export', authenticate, reportController.exportDataReport);

// Project Management Report routes
router.get('/project/performance', authenticate, ProjectReportController.getPerformanceReport);
router.get('/project/department', authenticate, ProjectReportController.getDepartmentSummary);
router.get('/project/metrics', authenticate, ProjectReportController.getMetricsReport);
router.get('/project/stats', authenticate, ProjectReportController.getReportStats);
router.get('/project/export', authenticate, ProjectReportController.exportReport);

export default router;
