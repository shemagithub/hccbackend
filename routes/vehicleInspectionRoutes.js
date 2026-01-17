import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as vehicleInspectionController from '../controllers/vehicleInspectionController.js';

const router = express.Router();

router.get('/', authenticate, vehicleInspectionController.getVehicleInspections);
router.get('/:id', authenticate, vehicleInspectionController.getVehicleInspectionById);
router.post('/', authenticate, vehicleInspectionController.createVehicleInspection);
router.put('/:id', authenticate, vehicleInspectionController.updateVehicleInspection);
router.delete('/:id', authenticate, vehicleInspectionController.deleteVehicleInspection);

export default router;
