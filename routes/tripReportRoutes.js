import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as tripReportController from '../controllers/tripReportController.js';

const router = express.Router();

router.get('/', authenticate, tripReportController.getTripReports);
router.get('/:id', authenticate, tripReportController.getTripReportById);
router.post('/', authenticate, tripReportController.createTripReport);
router.put('/:id', authenticate, tripReportController.updateTripReport);
router.delete('/:id', authenticate, tripReportController.deleteTripReport);

export default router;
