import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as fuelLogController from '../controllers/fuelLogController.js';

const router = express.Router();

router.get('/', authenticate, fuelLogController.getFuelLogs);
router.get('/stats', authenticate, fuelLogController.getFuelStats);
router.get('/:id', authenticate, fuelLogController.getFuelLogById);
router.post('/', authenticate, fuelLogController.createFuelLog);
router.put('/:id', authenticate, fuelLogController.updateFuelLog);
router.delete('/:id', authenticate, fuelLogController.deleteFuelLog);

export default router;
