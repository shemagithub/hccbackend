import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as employeeRequestController from '../controllers/employeeRequestController.js';

const router = express.Router();

router.get('/', authenticate, employeeRequestController.getEmployeeRequests);
router.get('/:id', authenticate, employeeRequestController.getEmployeeRequestById);
router.post('/', authenticate, employeeRequestController.createEmployeeRequest);
router.put('/:id', authenticate, employeeRequestController.updateEmployeeRequest);
router.delete('/:id', authenticate, employeeRequestController.deleteEmployeeRequest);

export default router;
