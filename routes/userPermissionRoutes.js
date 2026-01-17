import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as userPermissionController from '../controllers/userPermissionController.js';

const router = express.Router();

router.get('/', authenticate, userPermissionController.getUserPermissions);
router.get('/stats', authenticate, userPermissionController.getPermissionStats);
router.get('/check/:staffId/:permissionKey', authenticate, userPermissionController.checkPermission);
router.get('/staff/:staffId', authenticate, userPermissionController.getStaffPermissions);
router.post('/staff/:staffId', authenticate, userPermissionController.setStaffPermission);
router.put('/staff/:staffId', authenticate, userPermissionController.setStaffPermissions);
router.delete('/staff/:staffId/:permissionKey', authenticate, userPermissionController.deleteStaffPermission);
router.delete('/staff/:staffId', authenticate, userPermissionController.deleteAllStaffPermissions);

export default router;
