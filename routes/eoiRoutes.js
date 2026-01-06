import express from 'express';
import { EOIController } from '../controllers/eoiController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all EOIs
router.get('/', EOIController.getEOIs);

// Get EOI by ID
router.get('/:id', EOIController.getEOIById);

// Create a new EOI
router.post('/', EOIController.createEOI);

// Update EOI
router.put('/:id', EOIController.updateEOI);

// Delete EOI
router.delete('/:id', EOIController.deleteEOI);

export default router;

