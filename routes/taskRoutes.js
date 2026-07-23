import express from 'express';
import { TaskController } from '../controllers/taskController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Task routes
router.post('/', TaskController.createTask);
router.get('/', TaskController.getTasks);
router.get('/stats', TaskController.getTaskStats);
router.get('/:id', TaskController.getTaskById);
router.put('/:id', TaskController.updateTask);
router.post('/:id/review', TaskController.reviewTask);
router.delete('/:id', TaskController.deleteTask);

export default router;

