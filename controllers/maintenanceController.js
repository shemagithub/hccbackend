import Maintenance from '../models/Maintenance.js';
import Staff from '../models/Staff.js';

export const getMaintenances = async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.search) filters.search = req.query.search;
    if (req.query.vehicleId) filters.vehicleId = parseInt(req.query.vehicleId);
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.type) filters.type = req.query.type;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const maintenances = await Maintenance.findAll(filters);
    res.json({ success: true, data: maintenances });
  } catch (error) {
    console.error('Get maintenances error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch maintenances', error: error.message });
  }
};

export const getMaintenanceById = async (req, res) => {
  try {
    const maintenance = await Maintenance.findById(parseInt(req.params.id));
    if (!maintenance) {
      return res.status(404).json({ success: false, message: 'Maintenance not found' });
    }
    res.json({ success: true, data: maintenance });
  } catch (error) {
    console.error('Get maintenance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch maintenance', error: error.message });
  }
};

export const createMaintenance = async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffId);
    if (!staff) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      vehicleId, projectId, type, issue, description, status, scheduledDate,
      completedDate, cost, currency, serviceProvider, technician, partsUsed,
      nextServiceDate, mileageAtService, notes
    } = req.body;

    if (!vehicleId || !issue || !scheduledDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const maintenance = await Maintenance.create({
      vehicleId, projectId, type, issue, description, status,
      scheduledDate, completedDate, cost, currency, serviceProvider, technician,
      partsUsed, nextServiceDate, mileageAtService,
      reportedBy: req.staffId, reportedByName: `${staff.firstName} ${staff.lastName}`, notes
    });

    res.status(201).json({ success: true, data: maintenance, message: 'Maintenance request created successfully' });
  } catch (error) {
    console.error('Create maintenance error:', error);
    res.status(500).json({ success: false, message: 'Failed to create maintenance', error: error.message });
  }
};

export const updateMaintenance = async (req, res) => {
  try {
    const updated = await Maintenance.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedMaintenance = await Maintenance.findById(parseInt(req.params.id));
    res.json({ success: true, data: updatedMaintenance, message: 'Maintenance updated successfully' });
  } catch (error) {
    console.error('Update maintenance error:', error);
    res.status(500).json({ success: false, message: 'Failed to update maintenance', error: error.message });
  }
};

export const deleteMaintenance = async (req, res) => {
  try {
    const deleted = await Maintenance.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Maintenance not found' });
    }
    res.json({ success: true, message: 'Maintenance deleted successfully' });
  } catch (error) {
    console.error('Delete maintenance error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete maintenance', error: error.message });
  }
};

export const getMaintenanceStats = async (req, res) => {
  try {
    const vehicleId = req.query.vehicleId ? parseInt(req.query.vehicleId) : null;
    const stats = await Maintenance.getStats(vehicleId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get maintenance stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch maintenance stats', error: error.message });
  }
};
