import express from 'express';
import { DriverController } from '../controllers/driverController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Driver routes
router.post('/', DriverController.createDriver);
router.get('/', DriverController.getDrivers);
router.get('/:id', DriverController.getDriverById);
router.put('/:id', DriverController.updateDriver);
router.delete('/:id', DriverController.deleteDriver);

export default router;
