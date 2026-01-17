import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as projectSupportLogController from '../controllers/projectSupportLogController.js';

const router = express.Router();

router.get('/', authenticate, projectSupportLogController.getProjectSupportLogs);
router.get('/:id', authenticate, projectSupportLogController.getProjectSupportLogById);
router.post('/', authenticate, projectSupportLogController.createProjectSupportLog);
router.put('/:id', authenticate, projectSupportLogController.updateProjectSupportLog);
router.delete('/:id', authenticate, projectSupportLogController.deleteProjectSupportLog);

export default router;
