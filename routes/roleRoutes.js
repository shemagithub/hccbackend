import express from 'express';
import { RoleController } from '../controllers/roleController.js';

const {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
  getRoleStats,
  checkRoleName
} = RoleController;

const router = express.Router();

// Role routes
router.post('/', createRole);
router.get('/', getRoles);
router.get('/stats', getRoleStats);
router.get('/check-name/:name', checkRoleName);
router.get('/:id', getRoleById);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;
