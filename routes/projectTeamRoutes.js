import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ProjectTeamController } from '../controllers/projectTeamController.js';

const router = express.Router();

router.get('/workspace', authenticate, ProjectTeamController.getWorkspace);
router.get('/permissions', authenticate, ProjectTeamController.getPermissions);
router.get('/projects/:projectId/resources', authenticate, ProjectTeamController.getProjectResources);
router.post('/members', authenticate, ProjectTeamController.createTeamMember);
router.post('/projects/:projectId/assign-members', authenticate, ProjectTeamController.assignMembers);

export default router;
