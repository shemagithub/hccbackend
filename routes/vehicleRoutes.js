import express from 'express';
import { VehicleController } from '../controllers/vehicleController.js';

const router = express.Router();

router.post('/', VehicleController.createVehicle);
router.get('/stats', VehicleController.getVehicleStats);
router.get('/:id', VehicleController.getVehicleById);
router.put('/:id', VehicleController.updateVehicle);
router.delete('/:id', VehicleController.deleteVehicle);
router.get('/', VehicleController.getVehicles);

export default router;

