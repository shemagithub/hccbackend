import Role from '../models/Role.js';
import Staff from '../models/Staff.js';
import UserPermission from '../models/UserPermission.js';
import { getPermissionCatalog, buildStaffAccessPayload } from '../utils/rolePermissions.js';

export class RoleController {
  // Create a new role
  static async createRole(req, res) {
    try {
      const {
        name,
        description,
        permissions = [],
        controlPanel = null,
        isSystem = false,
        status = 'active',
        notes
      } = req.body;

      // Validation
      if (!name || !description) {
        return res.status(400).json({
          success: false,
          message: 'Name and description are required'
        });
      }

      // Check if role name already exists
      const existingRole = await Role.nameExists(name);
      if (existingRole) {
        return res.status(409).json({
          success: false,
          message: 'Role name already exists'
        });
      }


      const roleId = await Role.create({
        name,
        description,
        permissions,
        controlPanel,
        isSystem: Boolean(isSystem),
        status,
        notes
      });

      const newRole = await Role.findById(roleId.id);

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: newRole
      });
    } catch (error) {
      console.error('Create role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create role',
        error: error.message
      });
    }
  }

  // Get all roles
  static async getRoles(req, res) {
    try {
      const {
        search,
        status,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        search,
        status,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const roles = await Role.findAll(filters);
      const stats = await Role.getStats();

      const rolesWithCounts = await Promise.all(
        roles.map(async (role) => ({
          ...role,
          userCount: await Role.countStaffByRoleName(role.name),
        }))
      );

      res.json({
        success: true,
        data: rolesWithCounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          active: stats.active,
          inactive: stats.inactive
        }
      });
    } catch (error) {
      console.error('Get roles error:', error);
      
      // Provide more specific error messages for connection issues
      let errorMessage = 'Failed to fetch roles';
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
        errorMessage = 'Database connection error. Please check if the database server is running.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: error.message,
        code: error.code
      });
    }
  }

  // Get role by ID
  static async getRoleById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID'
        });
      }

      const role = await Role.findById(parseInt(id));
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      const userCount = await Role.countStaffByRoleName(role.name);

      res.json({
        success: true,
        data: { ...role, userCount }
      });
    } catch (error) {
      console.error('Get role by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch role',
        error: error.message
      });
    }
  }

  // Update role
  static async updateRole(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID'
        });
      }

      const role = await Role.findById(parseInt(id));
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Check if role name already exists (excluding current role)
      if (updateData.name && updateData.name !== role.name) {
        const nameExists = await Role.nameExists(updateData.name, parseInt(id));
        if (nameExists) {
          return res.status(409).json({
            success: false,
            message: 'Role name already exists'
          });
        }
      }


      if (role.isSystem && updateData.isSystem === false) {
        return res.status(403).json({
          success: false,
          message: 'System roles cannot be converted to custom roles'
        });
      }

      const success = await Role.update(parseInt(id), updateData);

      if (success) {
        const updatedRole = await Role.findById(parseInt(id));
        res.json({
          success: true,
          message: 'Role updated successfully',
          data: updatedRole
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update role'
        });
      }
    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update role',
        error: error.message
      });
    }
  }

  // Delete role
  static async deleteRole(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID'
        });
      }

      const role = await Role.findById(parseInt(id));
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      if (role.isSystem) {
        return res.status(403).json({
          success: false,
          message: 'System roles cannot be deleted. You can deactivate the role instead.'
        });
      }

      const assignedCount = await Role.countStaffByRoleName(role.name);
      if (assignedCount > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete role assigned to ${assignedCount} staff member(s). Reassign users first or deactivate the role.`
        });
      }

      const success = await Role.delete(parseInt(id));

      if (success) {
        res.json({
          success: true,
          message: 'Role deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete role'
        });
      }
    } catch (error) {
      console.error('Delete role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete role',
        error: error.message
      });
    }
  }

  // Get role statistics
  static async getRoleStats(req, res) {
    try {
      const stats = await Role.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get role stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch role statistics',
        error: error.message
      });
    }
  }

  // Permission catalog for superadmin UI
  static async getPermissionCatalog(req, res) {
    try {
      res.json({
        success: true,
        data: getPermissionCatalog(),
      });
    } catch (error) {
      console.error('Get permission catalog error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch permission catalog',
        error: error.message,
      });
    }
  }

  // Resolve access for current authenticated staff member
  static async getMyAccess(req, res) {
    try {
      if (!req.staffId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const staff = await Staff.findById(req.staffId);
      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      const roleRecord = await Role.findByName(staff.role);
      const userPermissions = await UserPermission.getPermissionsByStaffId(parseInt(req.staffId, 10));
      const access = buildStaffAccessPayload(staff, roleRecord, userPermissions);

      res.json({ success: true, data: access });
    } catch (error) {
      console.error('Get my access error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve access permissions',
        error: error.message,
      });
    }
  }

  // Check if role name exists
  static async checkRoleName(req, res) {
    try {
      const { name } = req.params;
      const { excludeId } = req.query;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Role name is required'
        });
      }

      const exists = await Role.nameExists(name, excludeId);
      
      res.json({
        success: true,
        exists: exists,
        message: exists ? 'Role name already exists' : 'Role name is available'
      });
    } catch (error) {
      console.error('Check role name error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check role name',
        error: error.message
      });
    }
  }
}
