import Department from '../models/Department.js';

export class DepartmentController {
  // Create a new department
  static async createDepartment(req, res) {
    try {
      const {
        name,
        description,
        departmentCode,
        location,
        budget,
        phone,
        email,
        website,
        status = 'active',
        notes
      } = req.body;

      // Validation
      if (!name || !description || !departmentCode || !location) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, description, departmentCode, and location are required'
        });
      }

      // Check if department code already exists
      const existingDepartment = await Department.codeExists(departmentCode);
      if (existingDepartment) {
        return res.status(409).json({
          success: false,
          message: 'Department code already exists'
        });
      }

      // Validate department code format
      if (!/^[A-Z0-9-]+$/.test(departmentCode)) {
        return res.status(400).json({
          success: false,
          message: 'Department code must contain only uppercase letters, numbers, and hyphens'
        });
      }

      // Validate email format if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate website URL if provided
      if (website && !/^https?:\/\/.+/.test(website)) {
        return res.status(400).json({
          success: false,
          message: 'Website URL must start with http:// or https://'
        });
      }

      // Validate budget if provided
      if (budget && !/^\d+(\.\d{2})?$/.test(budget)) {
        return res.status(400).json({
          success: false,
          message: 'Budget must be a valid number'
        });
      }

      const newDepartment = await Department.create({
        name,
        description,
        departmentCode,
        location,
        budget: budget ? parseFloat(budget) : null,
        phone,
        email,
        website,
        status,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Department created successfully',
        data: newDepartment
      });
    } catch (error) {
      console.error('Create department error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create department',
        error: error.message
      });
    }
  }

  // Get all departments
  static async getDepartments(req, res) {
    try {
      const {
        search,
        status,
        location,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        search,
        status,
        location,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const departments = await Department.findAll(filters);
      const stats = await Department.getStats();

      res.json({
        success: true,
        data: departments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          active: stats.active,
          inactive: stats.inactive,
          totalBudget: stats.totalBudget
        }
      });
    } catch (error) {
      console.error('Get departments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch departments',
        error: error.message
      });
    }
  }

  // Get department by ID
  static async getDepartmentById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department ID'
        });
      }

      const department = await Department.findById(parseInt(id));
      
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      res.json({
        success: true,
        data: department
      });
    } catch (error) {
      console.error('Get department by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch department',
        error: error.message
      });
    }
  }

  // Update department
  static async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department ID'
        });
      }

      const department = await Department.findById(parseInt(id));
      
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      // Validate department code if being updated
      if (updateData.departmentCode) {
        if (!/^[A-Z0-9-]+$/.test(updateData.departmentCode)) {
          return res.status(400).json({
            success: false,
            message: 'Department code must contain only uppercase letters, numbers, and hyphens'
          });
        }

        const codeExists = await Department.codeExists(updateData.departmentCode, parseInt(id));
        if (codeExists) {
          return res.status(409).json({
            success: false,
            message: 'Department code already exists'
          });
        }
      }

      // Validate email format if provided
      if (updateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate website URL if provided
      if (updateData.website && !/^https?:\/\/.+/.test(updateData.website)) {
        return res.status(400).json({
          success: false,
          message: 'Website URL must start with http:// or https://'
        });
      }

      // Validate budget if provided
      if (updateData.budget && !/^\d+(\.\d{2})?$/.test(updateData.budget)) {
        return res.status(400).json({
          success: false,
          message: 'Budget must be a valid number'
        });
      }

      const success = await Department.update(parseInt(id), {
        ...updateData,
        budget: updateData.budget ? parseFloat(updateData.budget) : null
      });

      if (success) {
        const updatedDepartment = await Department.findById(parseInt(id));
        res.json({
          success: true,
          message: 'Department updated successfully',
          data: updatedDepartment
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update department'
        });
      }
    } catch (error) {
      console.error('Update department error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update department',
        error: error.message
      });
    }
  }

  // Delete department
  static async deleteDepartment(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department ID'
        });
      }

      const department = await Department.findById(parseInt(id));
      
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      const success = await Department.delete(parseInt(id));

      if (success) {
        res.json({
          success: true,
          message: 'Department deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete department'
        });
      }
    } catch (error) {
      console.error('Delete department error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete department',
        error: error.message
      });
    }
  }

  // Get department statistics
  static async getDepartmentStats(req, res) {
    try {
      const stats = await Department.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get department stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch department statistics',
        error: error.message
      });
    }
  }

  // Check if department code exists
  static async checkDepartmentCode(req, res) {
    try {
      const { code } = req.params;
      const { excludeId } = req.query;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Department code is required'
        });
      }

      const exists = await Department.codeExists(code, excludeId);
      
      res.json({
        success: true,
        exists: exists,
        message: exists ? 'Department code already exists' : 'Department code is available'
      });
    } catch (error) {
      console.error('Check department code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check department code',
        error: error.message
      });
    }
  }
}
