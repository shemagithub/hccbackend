import express from 'express';
import { TeamSkillsController } from '../controllers/teamSkillsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Team skills management routes
router.get('/team-overview', TeamSkillsController.getTeamOverview);
router.get('/skills-matrix', TeamSkillsController.getSkillsMatrix);
router.get('/skill-gaps', TeamSkillsController.getSkillGaps);
router.get('/employee-workload', TeamSkillsController.getEmployeeWorkload);
router.get('/employee/:staffId', TeamSkillsController.getEmployeeInfo);
router.get('/employee/:staffId/performance', TeamSkillsController.getEmployeePerformance);
router.get('/employee/:staffId/teams', TeamSkillsController.getEmployeeTeams);

// Training routes
router.get('/training', TeamSkillsController.getTrainingRecords);

// Performance routes
router.get('/performance', TeamSkillsController.getPerformanceOverview);

// Project assignments routes
router.get('/project-assignments', TeamSkillsController.getProjectAssignments);
router.post('/project-assignments', TeamSkillsController.createProjectAssignment);

// Tasks and deliverables routes
router.get('/tasks', TeamSkillsController.getTeamTasks);
router.get('/deliverables', TeamSkillsController.getTeamDeliverables);

// Reports route
router.post('/reports/generate', TeamSkillsController.generateReport);

export default router;
