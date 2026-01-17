import UserPermission from '../models/UserPermission.js';
import Staff from '../models/Staff.js';

export const getUserPermissions = async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.staffId) filters.staffId = parseInt(req.query.staffId);
    if (req.query.permissionKey) filters.permissionKey = req.query.permissionKey;
    if (req.query.permissionValue) filters.permissionValue = req.query.permissionValue;
    if (req.query.includeExpired === 'true') filters.includeExpired = true;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const permissions = await UserPermission.getAllPermissions(filters);
    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user permissions', error: error.message });
  }
};

export const getStaffPermissions = async (req, res) => {
  try {
    const { staffId } = req.params;
    const includeExpired = req.query.includeExpired === 'true';

    const permissions = await UserPermission.getPermissionsByStaffId(parseInt(staffId), includeExpired);
    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Get staff permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch staff permissions', error: error.message });
  }
};

export const setStaffPermission = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { permissionKey, permissionValue = 'allow', expiresAt = null, notes = null } = req.body;

    if (!permissionKey) {
      return res.status(400).json({ success: false, message: 'Permission key is required' });
    }

    // Verify staff exists
    const staff = await Staff.findById(parseInt(staffId));
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const result = await UserPermission.setPermission({
      staffId: parseInt(staffId),
      permissionKey,
      permissionValue,
      grantedBy: req.staffId || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes
    });

    res.json({ success: true, message: 'Permission set successfully', data: result });
  } catch (error) {
    console.error('Set staff permission error:', error);
    res.status(500).json({ success: false, message: 'Failed to set permission', error: error.message });
  }
};

export const setStaffPermissions = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'Permissions array is required' });
    }

    // Verify staff exists
    const staff = await Staff.findById(parseInt(staffId));
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // Process permissions with dates
    const processedPermissions = permissions.map(perm => ({
      ...perm,
      expiresAt: perm.expiresAt ? new Date(perm.expiresAt) : null
    }));

    await UserPermission.setMultiplePermissions({
      staffId: parseInt(staffId),
      permissions: processedPermissions,
      grantedBy: req.staffId || null
    });

    const updatedPermissions = await UserPermission.getPermissionsByStaffId(parseInt(staffId));
    res.json({ success: true, message: 'Permissions updated successfully', data: updatedPermissions });
  } catch (error) {
    console.error('Set staff permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to set permissions', error: error.message });
  }
};

export const deleteStaffPermission = async (req, res) => {
  try {
    const { staffId, permissionKey } = req.params;

    const deleted = await UserPermission.deletePermission(parseInt(staffId), permissionKey);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    res.json({ success: true, message: 'Permission deleted successfully' });
  } catch (error) {
    console.error('Delete staff permission error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete permission', error: error.message });
  }
};

export const deleteAllStaffPermissions = async (req, res) => {
  try {
    const { staffId } = req.params;

    const deletedCount = await UserPermission.deleteAllPermissionsForStaff(parseInt(staffId));
    res.json({ success: true, message: `Deleted ${deletedCount} permissions`, data: { deletedCount } });
  } catch (error) {
    console.error('Delete all staff permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete permissions', error: error.message });
  }
};

export const checkPermission = async (req, res) => {
  try {
    const { staffId, permissionKey } = req.params;

    const hasPermission = await UserPermission.checkPermission(parseInt(staffId), permissionKey);
    res.json({ success: true, data: { hasPermission, permissionKey } });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({ success: false, message: 'Failed to check permission', error: error.message });
  }
};

export const getPermissionStats = async (req, res) => {
  try {
    const stats = await UserPermission.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get permission stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch permission stats', error: error.message });
  }
};
