import express from 'express';
import { ImplementationController } from '../controllers/implementationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all implementations
router.get('/', ImplementationController.getImplementations);

// Get implementation by ID
router.get('/:id', ImplementationController.getImplementationById);

// Create a new implementation
router.post('/', ImplementationController.createImplementation);

// Update implementation
router.put('/:id', ImplementationController.updateImplementation);

// Delete implementation
router.delete('/:id', ImplementationController.deleteImplementation);

export default router;

