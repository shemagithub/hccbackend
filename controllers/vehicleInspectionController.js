import VehicleInspection from '../models/VehicleInspection.js';
import Staff from '../models/Staff.js';

export const getVehicleInspections = async (req, res) => {
  try {
    const filters = {};
    
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        filters.driverEmail = staff.email;
      }
    }

    if (req.query.search) filters.search = req.query.search;
    if (req.query.vehicleId) filters.vehicleId = parseInt(req.query.vehicleId);
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.inspectionType) filters.inspectionType = req.query.inspectionType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const inspections = await VehicleInspection.findAll(filters);
    res.json({ success: true, data: inspections });
  } catch (error) {
    console.error('Get vehicle inspections error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicle inspections', error: error.message });
  }
};

export const getVehicleInspectionById = async (req, res) => {
  try {
    const inspection = await VehicleInspection.findById(parseInt(req.params.id));
    if (!inspection) {
      return res.status(404).json({ success: false, message: 'Vehicle inspection not found' });
    }
    res.json({ success: true, data: inspection });
  } catch (error) {
    console.error('Get vehicle inspection error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicle inspection', error: error.message });
  }
};

export const createVehicleInspection = async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffId);
    if (!staff) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      vehicleId, projectId, inspectionType, inspectionDate, inspectionTime,
      odometerReading, fuelLevel, status, damageReported, issuesFound, photos, notes
    } = req.body;

    if (!vehicleId || !inspectionDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const inspection = await VehicleInspection.create({
      vehicleId, projectId, driverId: req.staffId,
      driverName: `${staff.firstName} ${staff.lastName}`, inspectionType,
      inspectionDate, inspectionTime, odometerReading, fuelLevel, status,
      damageReported, issuesFound, photos, notes,
      inspectedBy: req.staffId, inspectedByName: `${staff.firstName} ${staff.lastName}`
    });

    res.status(201).json({ success: true, data: inspection, message: 'Vehicle inspection created successfully' });
  } catch (error) {
    console.error('Create vehicle inspection error:', error);
    res.status(500).json({ success: false, message: 'Failed to create vehicle inspection', error: error.message });
  }
};

export const updateVehicleInspection = async (req, res) => {
  try {
    const updated = await VehicleInspection.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedInspection = await VehicleInspection.findById(parseInt(req.params.id));
    res.json({ success: true, data: updatedInspection, message: 'Vehicle inspection updated successfully' });
  } catch (error) {
    console.error('Update vehicle inspection error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vehicle inspection', error: error.message });
  }
};

export const deleteVehicleInspection = async (req, res) => {
  try {
    const deleted = await VehicleInspection.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Vehicle inspection not found' });
    }
    res.json({ success: true, message: 'Vehicle inspection deleted successfully' });
  } catch (error) {
    console.error('Delete vehicle inspection error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete vehicle inspection', error: error.message });
  }
};
