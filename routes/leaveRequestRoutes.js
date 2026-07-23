import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as leaveRequestController from '../controllers/leaveRequestController.js';

const router = express.Router();

router.get('/', authenticate, leaveRequestController.getLeaveRequests);
router.get('/:id', authenticate, leaveRequestController.getLeaveRequestById);
router.post('/', authenticate, leaveRequestController.createLeaveRequest);
router.put('/:id', authenticate, leaveRequestController.updateLeaveRequest);
router.post('/:id/approve', authenticate, leaveRequestController.approveLeaveRequest);
router.post('/:id/reject', authenticate, leaveRequestController.rejectLeaveRequest);
router.delete('/:id', authenticate, leaveRequestController.deleteLeaveRequest);

export default router;
