import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as availabilityController from '../controllers/availabilityController.js';

const router = express.Router();

router.get('/', authenticate, availabilityController.getAvailabilities);
router.get('/:id', authenticate, availabilityController.getAvailabilityById);
router.post('/', authenticate, availabilityController.createAvailability);
router.put('/:id', authenticate, availabilityController.updateAvailability);
router.delete('/:id', authenticate, availabilityController.deleteAvailability);

export default router;
