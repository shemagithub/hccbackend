import express from 'express';
import { DeliverableController } from '../controllers/deliverableController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new deliverable
router.post('/', DeliverableController.createDeliverable);

// Get all deliverables
router.get('/', DeliverableController.getDeliverables);

// Get deliverable by ID
router.get('/:id', DeliverableController.getDeliverableById);

// Update deliverable
router.put('/:id', DeliverableController.updateDeliverable);

// Delete deliverable
router.delete('/:id', DeliverableController.deleteDeliverable);

export default router;
