import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as workReportController from '../controllers/workReportController.js';

const router = express.Router();

router.get('/', authenticate, workReportController.getWorkReports);
router.get('/:id', authenticate, workReportController.getWorkReportById);
router.post('/', authenticate, workReportController.createWorkReport);
router.put('/:id', authenticate, workReportController.updateWorkReport);
router.post('/:id/review', authenticate, workReportController.reviewWorkReport);
router.delete('/:id', authenticate, workReportController.deleteWorkReport);

export default router;
