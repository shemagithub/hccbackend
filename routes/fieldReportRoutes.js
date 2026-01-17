import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as fieldReportController from '../controllers/fieldReportController.js';

const router = express.Router();

router.get('/', authenticate, fieldReportController.getFieldReports);
router.get('/:id', authenticate, fieldReportController.getFieldReportById);
router.post('/', authenticate, fieldReportController.createFieldReport);
router.put('/:id', authenticate, fieldReportController.updateFieldReport);
router.delete('/:id', authenticate, fieldReportController.deleteFieldReport);

export default router;
