import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { RoleController } from '../controllers/roleController.js';

const {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
  getRoleStats,
  checkRoleName,
  getPermissionCatalog,
  getMyAccess,
} = RoleController;

const router = express.Router();

router.post('/', createRole);
router.get('/', getRoles);
router.get('/stats', getRoleStats);
router.get('/catalog', getPermissionCatalog);
router.get('/my-access', authenticate, getMyAccess);
router.get('/check-name/:name', checkRoleName);
router.get('/:id', getRoleById);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;
