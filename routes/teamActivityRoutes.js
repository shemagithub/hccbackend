import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { TeamActivityController } from '../controllers/teamActivityController.js';

const router = express.Router();

// Team Activity routes
router.get('/', authenticate, TeamActivityController.getTeamActivity);

export default router;
