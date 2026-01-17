import express from 'express';
import { QualityController } from '../controllers/qualityController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Quality Control routes
router.post('/quality-controls', QualityController.createQualityControl);
router.get('/quality-controls', QualityController.getQualityControls);
router.put('/quality-controls/:id', QualityController.updateQualityControl);

// Compliance Check routes
router.post('/compliance-checks', QualityController.createComplianceCheck);
router.get('/compliance-checks', QualityController.getComplianceChecks);
router.put('/compliance-checks/:id', QualityController.updateComplianceCheck);

// ESIA Standards routes
router.post('/esia-standards', QualityController.createESIAStandard);
router.get('/esia-standards', QualityController.getESIAStandards);
router.put('/esia-standards/:id', QualityController.updateESIAStandard);

// Non-Conformance Report routes
router.post('/ncrs', QualityController.createNCR);
router.get('/ncrs', QualityController.getNCRs);
router.put('/ncrs/:id', QualityController.updateNCR);

// Statistics
router.get('/stats', QualityController.getQualityStats);

export default router;
