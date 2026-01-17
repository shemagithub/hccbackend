import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createTeam,
  getTeams,
  updateTeam,
  deleteTeam,
  TeamController,
} from '../controllers/teamController.js';

const router = express.Router();

// All team endpoints require an authenticated staff user
router.use(authenticate);

// CRUD for teams
router.get('/', getTeams);
router.post('/', createTeam);
router.put('/:id', updateTeam);
router.delete('/:id', deleteTeam);

// Team skills / resource overview endpoints used by the Team Skills control panel
router.get('/overview', TeamController.getTeamOverview);
router.get('/allocation', TeamController.getResourceAllocation);
router.get('/workload', TeamController.getWorkloadOverview);
router.get('/skills', TeamController.getSkillsMatching);
router.get('/stats', TeamController.getTeamStats);

export default router;
