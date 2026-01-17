import ProjectSupportLog from '../models/ProjectSupportLog.js';
import Staff from '../models/Staff.js';

export const getProjectSupportLogs = async (req, res) => {
  try {
    const filters = {};
    
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        filters.driverEmail = staff.email;
      }
    }

    if (req.query.search) filters.search = req.query.search;
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.vehicleId) filters.vehicleId = parseInt(req.query.vehicleId);
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const logs = await ProjectSupportLog.findAll(filters);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Get project support logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch project support logs', error: error.message });
  }
};

export const getProjectSupportLogById = async (req, res) => {
  try {
    const log = await ProjectSupportLog.findById(parseInt(req.params.id));
    if (!log) {
      return res.status(404).json({ success: false, message: 'Project support log not found' });
    }
    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Get project support log error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch project support log', error: error.message });
  }
};

export const createProjectSupportLog = async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffId);
    if (!staff) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      projectId, vehicleId, tripId, purpose, description, date, time, location,
      deliverablesConfirmed, siteVisitConfirmed, deliveryConfirmed, photos, notes
    } = req.body;

    if (!projectId || !purpose || !date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const log = await ProjectSupportLog.create({
      projectId, driverId: req.staffId, driverName: `${staff.firstName} ${staff.lastName}`,
      vehicleId, tripId, purpose, description, date, time, location,
      deliverablesConfirmed, siteVisitConfirmed, deliveryConfirmed, photos, notes
    });

    res.status(201).json({ success: true, data: log, message: 'Project support log created successfully' });
  } catch (error) {
    console.error('Create project support log error:', error);
    res.status(500).json({ success: false, message: 'Failed to create project support log', error: error.message });
  }
};

export const updateProjectSupportLog = async (req, res) => {
  try {
    const updated = await ProjectSupportLog.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedLog = await ProjectSupportLog.findById(parseInt(req.params.id));
    res.json({ success: true, data: updatedLog, message: 'Project support log updated successfully' });
  } catch (error) {
    console.error('Update project support log error:', error);
    res.status(500).json({ success: false, message: 'Failed to update project support log', error: error.message });
  }
};

export const deleteProjectSupportLog = async (req, res) => {
  try {
    const deleted = await ProjectSupportLog.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Project support log not found' });
    }
    res.json({ success: true, message: 'Project support log deleted successfully' });
  } catch (error) {
    console.error('Delete project support log error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete project support log', error: error.message });
  }
};
