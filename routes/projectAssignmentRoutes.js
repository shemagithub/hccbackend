import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as projectAssignmentController from '../controllers/projectAssignmentController.js';

const router = express.Router();

router.get('/', authenticate, projectAssignmentController.getProjectAssignments);
router.get('/:id', authenticate, projectAssignmentController.getProjectAssignmentById);
router.post('/', authenticate, projectAssignmentController.createProjectAssignment);
router.put('/:id', authenticate, projectAssignmentController.updateProjectAssignment);
router.delete('/:id', authenticate, projectAssignmentController.deleteProjectAssignment);

export default router;
