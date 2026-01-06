import Vehicle from '../models/Vehicle.js';

export class VehicleController {
  // Create a new vehicle
  static async createVehicle(req, res) {
    try {
      const {
        vehicleId,
        plateNumber,
        brand,
        model,
        year,
        fuelType = 'gasoline',
        status = 'available',
        assignedDriver,
        assignedProject,
        mileage = 0,
        lastService,
        nextService,
        insuranceExpiry,
        registrationExpiry,
        capacity,
        fuelCapacity,
        avgFuelConsumption,
        notes
      } = req.body;

      // Validation
      if (!plateNumber || !brand || !model || !year) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: plateNumber, brand, model, and year are required'
        });
      }

      // Check if plate number already exists
      const existingVehicle = await Vehicle.findByPlateNumber(plateNumber);
      if (existingVehicle) {
        return res.status(409).json({
          success: false,
          message: 'Plate number already exists'
        });
      }

      // Validate year
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear + 1) {
        return res.status(400).json({
          success: false,
          message: `Year must be between 1900 and ${currentYear + 1}`
        });
      }

      // Validate fuel type
      if (!['gasoline', 'diesel', 'electric', 'hybrid'].includes(fuelType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid fuel type'
        });
      }

      // Validate status
      if (!['in_use', 'available', 'under_maintenance', 'out_of_service'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      const vehicle = await Vehicle.create({
        vehicleId,
        plateNumber,
        brand,
        model,
        year,
        fuelType,
        status,
        assignedDriver,
        assignedProject,
        mileage,
        lastService,
        nextService,
        insuranceExpiry,
        registrationExpiry,
        capacity,
        fuelCapacity,
        avgFuelConsumption,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Vehicle created successfully',
        data: vehicle
      });
    } catch (error) {
      console.error('Create vehicle error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create vehicle',
        error: error.message
      });
    }
  }

  // Get all vehicles
  static async getVehicles(req, res) {
    try {
      const {
        search,
        status,
        fuelType,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        search,
        status,
        fuelType,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const vehicles = await Vehicle.findAll(filters);
      const stats = await Vehicle.getStats();

      res.json({
        success: true,
        data: vehicles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          inUse: stats.inUse,
          available: stats.available,
          underMaintenance: stats.underMaintenance,
          outOfService: stats.outOfService
        }
      });
    } catch (error) {
      console.error('Get vehicles error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch vehicles',
        error: error.message
      });
    }
  }

  // Get vehicle by ID
  static async getVehicleById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
      }

      let vehicle = await Vehicle.findById(parseInt(id));
      if (!vehicle) {
        vehicle = await Vehicle.findByVehicleId(id);
      }
      
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Vehicle not found'
        });
      }

      res.json({
        success: true,
        data: vehicle
      });
    } catch (error) {
      console.error('Get vehicle by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch vehicle',
        error: error.message
      });
    }
  }

  // Update vehicle
  static async updateVehicle(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
      }

      let vehicle = await Vehicle.findById(parseInt(id));
      if (!vehicle) {
        vehicle = await Vehicle.findByVehicleId(id);
      }

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Vehicle not found'
        });
      }

      // Check if plate number already exists (excluding current vehicle)
      if (updateData.plateNumber && updateData.plateNumber !== vehicle.plateNumber) {
        const existingVehicle = await Vehicle.findByPlateNumber(updateData.plateNumber);
        if (existingVehicle && existingVehicle.dbId !== vehicle.dbId) {
          return res.status(409).json({
            success: false,
            message: 'Plate number already exists'
          });
        }
      }

      const dbId = vehicle.dbId || parseInt(id);
      const success = await Vehicle.update(dbId, updateData);

      if (success) {
        const updatedVehicle = await Vehicle.findById(dbId);
        res.json({
          success: true,
          message: 'Vehicle updated successfully',
          data: updatedVehicle
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update vehicle'
        });
      }
    } catch (error) {
      console.error('Update vehicle error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update vehicle',
        error: error.message
      });
    }
  }

  // Delete vehicle
  static async deleteVehicle(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
      }

      let vehicle = await Vehicle.findById(parseInt(id));
      if (!vehicle) {
        vehicle = await Vehicle.findByVehicleId(id);
      }
      
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Vehicle not found'
        });
      }

      const dbId = vehicle.dbId || parseInt(id);
      const success = await Vehicle.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Vehicle deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete vehicle'
        });
      }
    } catch (error) {
      console.error('Delete vehicle error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete vehicle',
        error: error.message
      });
    }
  }

  // Get vehicle statistics
  static async getVehicleStats(req, res) {
    try {
      const stats = await Vehicle.getStats();
      
      res.json({
        success: true,
        data: {
          total: stats.total,
          inUse: stats.inUse,
          available: stats.available,
          underMaintenance: stats.underMaintenance,
          outOfService: stats.outOfService
        }
      });
    } catch (error) {
      console.error('Get vehicle stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch vehicle statistics',
        error: error.message
      });
    }
  }
}

