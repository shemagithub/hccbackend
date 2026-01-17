import TripReport from '../models/TripReport.js';
import Staff from '../models/Staff.js';

export const getTripReports = async (req, res) => {
  try {
    const filters = {};
    
    // Get logged-in user info
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        filters.driverEmail = staff.email;
      }
    }

    if (req.query.search) filters.search = req.query.search;
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.vehicleId) filters.vehicleId = parseInt(req.query.vehicleId);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const reports = await TripReport.findAll(filters);
    res.json({ success: true, data: reports });
  } catch (error) {
    console.error('Get trip reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trip reports', error: error.message });
  }
};

export const getTripReportById = async (req, res) => {
  try {
    const report = await TripReport.findById(parseInt(req.params.id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Trip report not found' });
    }

    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        // Check if report belongs to this driver
        if (report.driverId !== parseInt(req.staffId)) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Get trip report error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trip report', error: error.message });
  }
};

export const createTripReport = async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffId);
    if (!staff) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      tripId, projectId, vehicleId, purpose, origin, destination,
      startDate, startTime, startOdometer, endDate, endTime, endOdometer,
      distanceKm, fuelConsumed, status, photos, notes, observations
    } = req.body;

    if (!purpose || !origin || !destination || !startDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const report = await TripReport.create({
      tripId, projectId, vehicleId, driverId: req.staffId,
      driverName: `${staff.firstName} ${staff.lastName}`, purpose, origin, destination,
      startDate, startTime, startOdometer, endDate, endTime, endOdometer,
      distanceKm, fuelConsumed, status: status || 'draft', photos, notes, observations
    });

    res.status(201).json({ success: true, data: report, message: 'Trip report created successfully' });
  } catch (error) {
    console.error('Create trip report error:', error);
    res.status(500).json({ success: false, message: 'Failed to create trip report', error: error.message });
  }
};

export const updateTripReport = async (req, res) => {
  try {
    const report = await TripReport.findById(parseInt(req.params.id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Trip report not found' });
    }

    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        // Check if report belongs to this driver
        if (report.driverId !== parseInt(req.staffId)) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    const updated = await TripReport.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedReport = await TripReport.findById(parseInt(req.params.id));
    res.json({ success: true, data: updatedReport, message: 'Trip report updated successfully' });
  } catch (error) {
    console.error('Update trip report error:', error);
    res.status(500).json({ success: false, message: 'Failed to update trip report', error: error.message });
  }
};

export const deleteTripReport = async (req, res) => {
  try {
    const report = await TripReport.findById(parseInt(req.params.id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Trip report not found' });
    }

    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        // Check if report belongs to this driver
        if (report.driverId !== parseInt(req.staffId)) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    const deleted = await TripReport.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(400).json({ success: false, message: 'Failed to delete trip report' });
    }

    res.json({ success: true, message: 'Trip report deleted successfully' });
  } catch (error) {
    console.error('Delete trip report error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete trip report', error: error.message });
  }
};
