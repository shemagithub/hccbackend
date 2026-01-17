import TimeAttendance from '../models/TimeAttendance.js';
import Staff from '../models/Staff.js';

export const getTimeAttendances = async (req, res) => {
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
    if (req.query.status) filters.status = req.query.status;
    if (req.query.workType) filters.workType = req.query.workType;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const attendances = await TimeAttendance.findAll(filters);
    res.json({ success: true, data: attendances });
  } catch (error) {
    console.error('Get time attendances error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch time attendances', error: error.message });
  }
};

export const getTimeAttendanceById = async (req, res) => {
  try {
    const attendance = await TimeAttendance.findById(parseInt(req.params.id));
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Time attendance not found' });
    }
    res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Get time attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch time attendance', error: error.message });
  }
};

export const createTimeAttendance = async (req, res) => {
  try {
    const {
      projectId, vehicleId, date, checkInTime, checkOutTime,
      drivingHours, waitingHours, overtimeHours, totalHours, workType, status, notes
    } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const attendance = await TimeAttendance.create({
      driverId: req.staffId, projectId, vehicleId, date, checkInTime, checkOutTime,
      drivingHours, waitingHours, overtimeHours, totalHours, workType, status, notes
    });

    res.status(201).json({ success: true, data: attendance, message: 'Time attendance created successfully' });
  } catch (error) {
    console.error('Create time attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to create time attendance', error: error.message });
  }
};

export const updateTimeAttendance = async (req, res) => {
  try {
    const updated = await TimeAttendance.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedAttendance = await TimeAttendance.findById(parseInt(req.params.id));
    res.json({ success: true, data: updatedAttendance, message: 'Time attendance updated successfully' });
  } catch (error) {
    console.error('Update time attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to update time attendance', error: error.message });
  }
};

export const deleteTimeAttendance = async (req, res) => {
  try {
    const deleted = await TimeAttendance.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Time attendance not found' });
    }
    res.json({ success: true, message: 'Time attendance deleted successfully' });
  } catch (error) {
    console.error('Delete time attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete time attendance', error: error.message });
  }
};
