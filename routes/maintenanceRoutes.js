import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as maintenanceController from '../controllers/maintenanceController.js';

const router = express.Router();

router.get('/', authenticate, maintenanceController.getMaintenances);
router.get('/stats', authenticate, maintenanceController.getMaintenanceStats);
router.get('/:id', authenticate, maintenanceController.getMaintenanceById);
router.post('/', authenticate, maintenanceController.createMaintenance);
router.put('/:id', authenticate, maintenanceController.updateMaintenance);
router.delete('/:id', authenticate, maintenanceController.deleteMaintenance);

export default router;
