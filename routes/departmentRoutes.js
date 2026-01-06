import express from 'express';
import { DepartmentController } from '../controllers/departmentController.js';

const router = express.Router();

// Department routes
router.post('/', DepartmentController.createDepartment);
router.get('/', DepartmentController.getDepartments);
router.get('/stats', DepartmentController.getDepartmentStats);
router.get('/check-code/:code', DepartmentController.checkDepartmentCode);
router.get('/:id', DepartmentController.getDepartmentById);
router.put('/:id', DepartmentController.updateDepartment);
router.delete('/:id', DepartmentController.deleteDepartment);

export default router;
