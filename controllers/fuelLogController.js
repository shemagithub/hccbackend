import FuelLog from '../models/FuelLog.js';
import Staff from '../models/Staff.js';

export const getFuelLogs = async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.search) filters.search = req.query.search;
    if (req.query.vehicleId) filters.vehicleId = parseInt(req.query.vehicleId);
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const logs = await FuelLog.findAll(filters);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Get fuel logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fuel logs', error: error.message });
  }
};

export const getFuelLogById = async (req, res) => {
  try {
    const log = await FuelLog.findById(parseInt(req.params.id));
    if (!log) {
      return res.status(404).json({ success: false, message: 'Fuel log not found' });
    }
    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Get fuel log error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fuel log', error: error.message });
  }
};

export const createFuelLog = async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffId);
    if (!staff) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      vehicleId, projectId, fuelType, amount, unit, cost, currency,
      fuelDate, odometerReading, location, supplier, receiptPath, notes
    } = req.body;

    if (!vehicleId || !amount || !cost || !fuelDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const log = await FuelLog.create({
      vehicleId, projectId, fuelType, amount, unit, cost, currency,
      fuelDate, odometerReading, location, supplier, receiptPath,
      loggedBy: req.staffId, loggedByName: `${staff.firstName} ${staff.lastName}`, notes
    });

    res.status(201).json({ success: true, data: log, message: 'Fuel log created successfully' });
  } catch (error) {
    console.error('Create fuel log error:', error);
    res.status(500).json({ success: false, message: 'Failed to create fuel log', error: error.message });
  }
};

export const updateFuelLog = async (req, res) => {
  try {
    const log = await FuelLog.findById(parseInt(req.params.id));
    if (!log) {
      return res.status(404).json({ success: false, message: 'Fuel log not found' });
    }

    const updated = await FuelLog.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedLog = await FuelLog.findById(parseInt(req.params.id));
    res.json({ success: true, data: updatedLog, message: 'Fuel log updated successfully' });
  } catch (error) {
    console.error('Update fuel log error:', error);
    res.status(500).json({ success: false, message: 'Failed to update fuel log', error: error.message });
  }
};

export const deleteFuelLog = async (req, res) => {
  try {
    const deleted = await FuelLog.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Fuel log not found' });
    }
    res.json({ success: true, message: 'Fuel log deleted successfully' });
  } catch (error) {
    console.error('Delete fuel log error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete fuel log', error: error.message });
  }
};

export const getFuelStats = async (req, res) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId) : null;
    const vehicleId = req.query.vehicleId ? parseInt(req.query.vehicleId) : null;
    const stats = await FuelLog.getStats(projectId, vehicleId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get fuel stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fuel stats', error: error.message });
  }
};
