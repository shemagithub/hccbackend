import express from 'express';
import { StaffController } from '../controllers/staffController.js';

const router = express.Router();

// Authentication (register before /:id to avoid param conflicts)
router.post('/authenticate', StaffController.authenticate);

// Staff routes
router.post('/', StaffController.createStaff);
router.get('/', StaffController.getStaff);
router.get('/stats', StaffController.getStaffStats);
router.get('/check-email/:email', StaffController.checkEmail);
router.get('/:id', StaffController.getStaffById);
router.put('/:id', StaffController.updateStaff);
router.delete('/:id', StaffController.deleteStaff);

// Password reset route
router.post('/:id/reset-password', StaffController.resetPassword);

export default router;
