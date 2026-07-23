import express from 'express';
import { ImplementationController } from '../controllers/implementationController.js';
import { OpportunityController } from '../controllers/opportunityController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/start-from-proposal/:opportunityId', (req, res) => {
  req.params.id = req.params.opportunityId;
  return OpportunityController.startProposalImplementation(req, res);
});

router.get('/', ImplementationController.getImplementations);

router.get('/by-project/:projectId/workspace', ImplementationController.getWorkspaceByProject);
router.post('/by-project/:projectId/start-workflow', ImplementationController.startWorkflowForProject);
router.get('/:id/workspace', ImplementationController.getWorkspace);
router.post('/:id/ensure-project', ImplementationController.ensureProject);
router.get('/:id', ImplementationController.getImplementationById);
router.put('/:id', ImplementationController.updateImplementation);
router.delete('/:id', ImplementationController.deleteImplementation);

export default router;
