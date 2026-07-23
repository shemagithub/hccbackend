import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getContracts,
  getContractById,
  getContractByOpportunityId,
  getContractApprovals,
  createContract,
  updateContract,
  deleteContract,
  submitContractForApproval,
  approveContractStep,
  approveAllContractSteps,
  rejectContractStep,
} from '../controllers/contractController.js';

const router = express.Router();

router.get('/', authenticate, getContracts);
router.get('/approvals', authenticate, getContractApprovals);
router.get('/by-opportunity/:opportunityId', authenticate, getContractByOpportunityId);
router.get('/:id', authenticate, getContractById);
router.post('/', authenticate, createContract);
router.post('/:id/submit', authenticate, submitContractForApproval);
router.post('/:id/approve', authenticate, approveContractStep);
router.post('/:id/approve-all', authenticate, approveAllContractSteps);
router.post('/:id/reject', authenticate, rejectContractStep);
router.put('/:id', authenticate, updateContract);
router.delete('/:id', authenticate, deleteContract);

export default router;

