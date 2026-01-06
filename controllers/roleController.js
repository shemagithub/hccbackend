import Role from '../models/Role.js';

export class RoleController {
  // Create a new role
  static async createRole(req, res) {
    try {
      const {
        name,
        description,
        permissions = [],
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

      res.json({
        success: true,
        data: roles,
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
      res.status(500).json({
        success: false,
        message: 'Failed to fetch roles',
        error: error.message
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

      res.json({
        success: true,
        data: role
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
