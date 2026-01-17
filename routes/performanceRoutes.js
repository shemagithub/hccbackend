import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as performanceController from '../controllers/performanceController.js';

const router = express.Router();

router.get('/', authenticate, performanceController.getPerformances);
router.get('/:id', authenticate, performanceController.getPerformanceById);
router.post('/', authenticate, performanceController.createPerformance);
router.put('/:id', authenticate, performanceController.updatePerformance);
router.delete('/:id', authenticate, performanceController.deletePerformance);

export default router;
