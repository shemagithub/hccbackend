import Driver from '../models/Driver.js';
import Staff from '../models/Staff.js';
import Vehicle from '../models/Vehicle.js';
import Project from '../models/Project.js';
import pool from '../config/db.js';

export class DriverController {
  // Create a new driver
  static async createDriver(req, res) {
    try {
      const {
        staffId,
        licenseNumber,
        licenseExpiry,
        assignedVehicleId,
        assignedProjectId,
        joinDate,
        status = 'active',
        notes
      } = req.body;

      // Validation
      if (!staffId || !licenseNumber || !joinDate) {
        return res.status(400).json({
          success: false,
          message: 'Staff ID, license number, and join date are required'
        });
      }

      // Verify staff exists
      const staff = await Staff.findById(staffId);
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }

      // Check if driver already exists for this staff
      const existingDriver = await Driver.findByStaffId(staffId);
      if (existingDriver) {
        return res.status(409).json({
          success: false,
          message: 'Driver record already exists for this staff member'
        });
      }

      // Check if license number already exists
      const [licenseCheck] = await pool.execute(
        'SELECT id FROM drivers WHERE license_number = ?',
        [licenseNumber]
      );
      if (licenseCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'License number already exists'
        });
      }

      // Verify vehicle exists if assigned
      if (assignedVehicleId) {
        const vehicle = await Vehicle.findById(assignedVehicleId);
        if (!vehicle) {
          return res.status(404).json({
            success: false,
            message: 'Vehicle not found'
          });
        }
      }

      // Verify project exists if assigned
      if (assignedProjectId) {
        const project = await Project.findById(assignedProjectId);
        if (!project) {
          return res.status(404).json({
            success: false,
            message: 'Project not found'
          });
        }
      }

      const driver = await Driver.create({
        staffId: parseInt(staffId),
        licenseNumber,
        licenseExpiry: licenseExpiry || null,
        assignedVehicleId: assignedVehicleId ? parseInt(assignedVehicleId) : null,
        assignedProjectId: assignedProjectId ? parseInt(assignedProjectId) : null,
        joinDate,
        status,
        notes: notes || null
      });

      res.status(201).json({
        success: true,
        message: 'Driver created successfully',
        data: driver
      });
    } catch (error) {
      console.error('Create driver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create driver',
        error: error.message
      });
    }
  }

  // Get all drivers
  static async getDrivers(req, res) {
    try {
      const {
        search,
        status,
        assignedVehicleId,
        assignedProjectId,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        status: status && status !== 'all' ? status : undefined,
        assignedVehicleId: assignedVehicleId ? parseInt(assignedVehicleId) : undefined,
        assignedProjectId: assignedProjectId ? parseInt(assignedProjectId) : undefined,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const drivers = await Driver.findAll(filters);
      const stats = await Driver.getStats();

      res.json({
        success: true,
        data: drivers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats
      });
    } catch (error) {
      console.error('Get drivers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch drivers',
        error: error.message
      });
    }
  }

  // Get driver by ID
  static async getDriverById(req, res) {
    try {
      const { id } = req.params;
      
      const driver = await Driver.findById(parseInt(id)) || 
                     await Driver.findByDriverId(id);

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      res.json({
        success: true,
        data: driver
      });
    } catch (error) {
      console.error('Get driver by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch driver',
        error: error.message
      });
    }
  }

  // Update driver
  static async updateDriver(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Driver ID is required'
        });
      }

      const driver = await Driver.findById(parseInt(id)) || 
                     await Driver.findByDriverId(id);

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      // Verify vehicle exists if being assigned
      if (updateData.assignedVehicleId) {
        const vehicle = await Vehicle.findById(updateData.assignedVehicleId);
        if (!vehicle) {
          return res.status(404).json({
            success: false,
            message: 'Vehicle not found'
          });
        }
      }

      // Verify project exists if being assigned
      if (updateData.assignedProjectId) {
        const project = await Project.findById(updateData.assignedProjectId);
        if (!project) {
          return res.status(404).json({
            success: false,
            message: 'Project not found'
          });
        }
      }

      const dbId = driver.dbId || parseInt(id);
      const updated = await Driver.update(dbId, updateData);

      if (updated) {
        res.json({
          success: true,
          message: 'Driver updated successfully',
          data: updated
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update driver'
        });
      }
    } catch (error) {
      console.error('Update driver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update driver',
        error: error.message
      });
    }
  }

  // Delete driver
  static async deleteDriver(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Driver ID is required'
        });
      }

      const driver = await Driver.findById(parseInt(id)) || 
                     await Driver.findByDriverId(id);

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      const dbId = driver.dbId || parseInt(id);
      const success = await Driver.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Driver deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete driver'
        });
      }
    } catch (error) {
      console.error('Delete driver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete driver',
        error: error.message
      });
    }
  }
}
