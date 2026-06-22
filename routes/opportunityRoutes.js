import express from 'express';
import { OpportunityController } from '../controllers/opportunityController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Opportunity routes - all require authentication
// This ensures all signed-in users can access opportunities
router.post('/', authenticate, OpportunityController.createOpportunity);
router.get('/', authenticate, OpportunityController.getOpportunities);
router.get('/stats', authenticate, OpportunityController.getOpportunityStats);
router.get('/:id/proposal', authenticate, OpportunityController.getOpportunityProposal);
router.put('/:id/proposal', authenticate, OpportunityController.upsertOpportunityProposal);
router.post('/:id/proposal/start-implementation', authenticate, OpportunityController.startProposalImplementation);
router.get('/:id', authenticate, OpportunityController.getOpportunityById);
router.put('/:id', authenticate, OpportunityController.updateOpportunity);
router.delete('/:id', authenticate, OpportunityController.deleteOpportunity);

export default router;

