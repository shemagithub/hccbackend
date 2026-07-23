import express from 'express';
import { RiskController } from '../controllers/riskController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Risk Register routes
router.post('/risks', RiskController.createRisk);
router.get('/risks', RiskController.getRisks);
router.put('/risks/:id', RiskController.updateRisk);
router.delete('/risks/:id', RiskController.deleteRisk);

// Issue Reporting routes
router.post('/issues', RiskController.createIssue);
router.get('/issues', RiskController.getIssues);
router.put('/issues/:id', RiskController.updateIssue);
router.delete('/issues/:id', RiskController.deleteIssue);

// Mitigation Action routes
router.post('/mitigation-actions', RiskController.createMitigationAction);
router.get('/mitigation-actions', RiskController.getMitigationActions);
router.put('/mitigation-actions/:id', RiskController.updateMitigationAction);

// Escalation routes
router.post('/escalations', RiskController.createEscalation);
router.get('/escalations', RiskController.getEscalations);
router.put('/escalations/:id', RiskController.updateEscalation);

// Statistics
router.get('/stats', RiskController.getRiskStats);

// Risk/issue register comments (viewers can comment)
router.get('/register-comments', RiskController.getRegisterComments);
router.post('/register-comments', RiskController.createRegisterComment);

export default router;
