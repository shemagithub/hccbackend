import LeaveRequest from '../models/LeaveRequest.js';
import Staff from '../models/Staff.js';

export const getLeaveRequests = async (req, res) => {
  try {
    const filters = {};
    
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance' && staff.role !== 'admin') {
        filters.staffEmail = staff.email;
      }
    }

    if (req.query.staffId) filters.staffId = parseInt(req.query.staffId);
    if (req.query.leaveType) filters.leaveType = req.query.leaveType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const requests = await LeaveRequest.findAll(filters);
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leave requests', error: error.message });
  }
};

export const getLeaveRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    let request = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      request = await LeaveRequest.findById(numericId);
    }

    // If not found by numeric ID, try to find by leaveId (e.g., "LR-2026-0001")
    if (!request && id) {
      request = await LeaveRequest.findByLeaveId(id);
    }

    if (!request) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Get leave request error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leave request', error: error.message });
  }
};

export const createLeaveRequest = async (req, res) => {
  try {
    const {
      leaveType, startDate, endDate, totalDays, reason, status, attachments, notes
    } = req.body;

    if (!req.staffId) {
      return res.status(401).json({ success: false, message: 'Staff ID not found in request. Authentication failed.' });
    }

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields: leaveType, startDate, endDate, and reason are required' });
    }

    // Validate leave type
    const validTypes = ['annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other'];
    if (!validTypes.includes(leaveType)) {
      return res.status(400).json({ success: false, message: 'Invalid leave type' });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    if (end < start) {
      return res.status(400).json({ success: false, message: 'End date cannot be before start date' });
    }

    // Ensure totalDays is a number or null (will be auto-calculated)
    const totalDaysNum = totalDays && !isNaN(parseFloat(totalDays)) ? parseFloat(totalDays) : null;

    const request = await LeaveRequest.create({
      staffId: parseInt(req.staffId), // Ensure staffId is a number
      leaveType: leaveType.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      totalDays: totalDaysNum,
      reason: reason.trim(),
      status: status || 'pending',
      attachments: attachments || null,
      notes: notes && notes.trim() ? notes.trim() : null
    });

    res.status(201).json({ success: true, data: request, message: 'Leave request created successfully' });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({ success: false, message: 'Failed to create leave request', error: error.message });
  }
};

export const updateLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    let request = null;
    let requestId = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      request = await LeaveRequest.findById(numericId);
      if (request) {
        requestId = request.dbId;
      }
    }

    // If not found by numeric ID, try to find by leaveId (e.g., "LR-2026-0001")
    if (!request && id) {
      request = await LeaveRequest.findByLeaveId(id);
      if (request) {
        requestId = request.dbId;
      }
    }

    if (!request || !requestId) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const updated = await LeaveRequest.update(requestId, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedRequest = await LeaveRequest.findById(requestId);
    res.json({ success: true, data: updatedRequest, message: 'Leave request updated successfully' });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({ success: false, message: 'Failed to update leave request', error: error.message });
  }
};

export const deleteLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    let request = null;
    let requestId = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      request = await LeaveRequest.findById(numericId);
      if (request) {
        requestId = request.dbId;
      }
    }

    // If not found by numeric ID, try to find by leaveId (e.g., "LR-2026-0001")
    if (!request && id) {
      request = await LeaveRequest.findByLeaveId(id);
      if (request) {
        requestId = request.dbId;
      }
    }

    if (!request || !requestId) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const deleted = await LeaveRequest.delete(requestId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    res.json({ success: true, message: 'Leave request deleted successfully' });
  } catch (error) {
    console.error('Delete leave request error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete leave request', error: error.message });
  }
};
