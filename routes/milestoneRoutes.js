import express from 'express';
import { MilestoneController } from '../controllers/milestoneController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Milestone routes
router.post('/', authenticate, MilestoneController.createMilestone);
router.get('/', authenticate, MilestoneController.getMilestones);
router.get('/:id', authenticate, MilestoneController.getMilestoneById);
router.put('/:id', authenticate, MilestoneController.updateMilestone);
router.delete('/:id', authenticate, MilestoneController.deleteMilestone);

export default router;
