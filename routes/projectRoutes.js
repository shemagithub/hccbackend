import express from 'express';
import { ProjectController } from '../controllers/projectController.js';

const router = express.Router();

router.post('/', ProjectController.createProject);
router.get('/stats', ProjectController.getProjectStats);
router.get('/:id', ProjectController.getProjectById);
router.put('/:id', ProjectController.updateProject);
router.delete('/:id', ProjectController.deleteProject);
router.get('/', ProjectController.getProjects);

export default router;

