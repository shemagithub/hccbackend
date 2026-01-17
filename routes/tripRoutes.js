import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as tripController from '../controllers/tripController.js';

const router = express.Router();

router.get('/', authenticate, tripController.getTrips);
router.get('/stats', authenticate, tripController.getTripStats);
router.get('/:id', authenticate, tripController.getTripById);
router.post('/', authenticate, tripController.createTrip);
router.put('/:id', authenticate, tripController.updateTrip);
router.delete('/:id', authenticate, tripController.deleteTrip);

export default router;
