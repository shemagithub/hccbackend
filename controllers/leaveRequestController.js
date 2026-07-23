import LeaveRequest from '../models/LeaveRequest.js';
import Staff from '../models/Staff.js';
import Availability from '../models/Availability.js';
import {
  buildLeaveRequestFilters,
  canAccessLeaveRequest,
  canManageLeaveRequest,
  canModifyOwnLeaveRequest,
  isLeaveManager,
} from '../utils/leaveAccess.js';

async function resolveLeaveRequest(id) {
  const numericId = parseInt(id, 10);
  if (!Number.isNaN(numericId)) {
    const byId = await LeaveRequest.findById(numericId);
    if (byId) return byId;
  }
  if (id) {
    return LeaveRequest.findByLeaveId(id);
  }
  return null;
}

async function syncAvailabilityForApprovedLeave(leaveRequest) {
  if (!leaveRequest?.staffId || !leaveRequest.startDate || !leaveRequest.endDate) return null;
  try {
    return await Availability.upsertLeaveRange({
      staffId: leaveRequest.staffId,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      notes: `Leave ${leaveRequest.id || leaveRequest.leaveId || ''}`.trim(),
    });
  } catch (error) {
    console.warn('Failed to sync availability for approved leave:', error.message);
    return null;
  }
}

export const getLeaveRequests = async (req, res) => {
  try {
    const result = await buildLeaveRequestFilters(req);
    const requests = await LeaveRequest.findAll(result.filters);
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leave requests', error: error.message });
  }
};

export const getLeaveRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await resolveLeaveRequest(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    if (req.staffId) {
      const allowed = await canAccessLeaveRequest(req.staffId, request);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'You do not have access to this leave request' });
      }
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

    const validTypes = ['annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other'];
    if (!validTypes.includes(leaveType)) {
      return res.status(400).json({ success: false, message: 'Invalid leave type' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    if (end < start) {
      return res.status(400).json({ success: false, message: 'End date cannot be before start date' });
    }

    const totalDaysNum = totalDays && !Number.isNaN(parseFloat(totalDays)) ? parseFloat(totalDays) : null;

    const request = await LeaveRequest.create({
      staffId: parseInt(req.staffId, 10),
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
    const request = await resolveLeaveRequest(id);

    if (!request || !request.dbId) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const staff = req.staffId ? await Staff.findById(req.staffId) : null;
    const isOwner = await canModifyOwnLeaveRequest(req.staffId, request);
    const canManage = await canManageLeaveRequest(req.staffId, request);

    if (!isOwner && !canManage) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this leave request' });
    }

    const updateData = { ...req.body };

    if (isOwner && !canManage) {
      if (request.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Only pending leave requests can be updated' });
      }
      if (updateData.status && updateData.status !== 'cancelled') {
        return res.status(403).json({ success: false, message: 'Employees can only cancel pending leave requests' });
      }
      delete updateData.approvedBy;
      delete updateData.approvedByName;
      delete updateData.approvalDate;
      delete updateData.rejectionReason;
    }

    if (canManage && updateData.status === 'approved') {
      updateData.approvedBy = parseInt(req.staffId, 10);
      updateData.approvedByName = staff ? `${staff.firstName} ${staff.lastName}`.trim() : null;
      updateData.approvalDate = new Date().toISOString().split('T')[0];
      updateData.rejectionReason = null;
    }

    if (canManage && updateData.status === 'rejected') {
      updateData.approvedBy = parseInt(req.staffId, 10);
      updateData.approvedByName = staff ? `${staff.firstName} ${staff.lastName}`.trim() : null;
      updateData.approvalDate = new Date().toISOString().split('T')[0];
    }

    const updated = await LeaveRequest.update(request.dbId, updateData);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedRequest = await LeaveRequest.findById(request.dbId);
    if (updatedRequest?.status === 'approved' && request.status !== 'approved') {
      await syncAvailabilityForApprovedLeave(updatedRequest);
    }
    res.json({ success: true, data: updatedRequest, message: 'Leave request updated successfully' });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({ success: false, message: 'Failed to update leave request', error: error.message });
  }
};

export const approveLeaveRequest = async (req, res) => {
  try {
    const request = await resolveLeaveRequest(req.params.id);
    if (!request || !request.dbId) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const canManage = await canManageLeaveRequest(req.staffId, request);
    if (!canManage) {
      return res.status(403).json({ success: false, message: 'You do not have permission to approve this leave request' });
    }

    const staff = await Staff.findById(req.staffId);
    const notes = req.body.notes?.trim() || undefined;

    await LeaveRequest.update(request.dbId, {
      status: 'approved',
      approvedBy: parseInt(req.staffId, 10),
      approvedByName: staff ? `${staff.firstName} ${staff.lastName}`.trim() : null,
      approvalDate: new Date().toISOString().split('T')[0],
      rejectionReason: null,
      notes: notes !== undefined ? notes : request.notes,
    });

    const updatedRequest = await LeaveRequest.findById(request.dbId);
    await syncAvailabilityForApprovedLeave(updatedRequest || request);
    res.json({ success: true, data: updatedRequest, message: 'Leave request approved successfully' });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve leave request', error: error.message });
  }
};

export const rejectLeaveRequest = async (req, res) => {
  try {
    const request = await resolveLeaveRequest(req.params.id);
    if (!request || !request.dbId) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const canManage = await canManageLeaveRequest(req.staffId, request);
    if (!canManage) {
      return res.status(403).json({ success: false, message: 'You do not have permission to reject this leave request' });
    }

    const rejectionReason = req.body.rejectionReason?.trim();
    if (!rejectionReason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const staff = await Staff.findById(req.staffId);

    await LeaveRequest.update(request.dbId, {
      status: 'rejected',
      approvedBy: parseInt(req.staffId, 10),
      approvedByName: staff ? `${staff.firstName} ${staff.lastName}`.trim() : null,
      approvalDate: new Date().toISOString().split('T')[0],
      rejectionReason,
    });

    const updatedRequest = await LeaveRequest.findById(request.dbId);
    res.json({ success: true, data: updatedRequest, message: 'Leave request rejected successfully' });
  } catch (error) {
    console.error('Reject leave request error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject leave request', error: error.message });
  }
};

export const deleteLeaveRequest = async (req, res) => {
  try {
    const request = await resolveLeaveRequest(req.params.id);

    if (!request || !request.dbId) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const isOwner = await canModifyOwnLeaveRequest(req.staffId, request);
    const staff = req.staffId ? await Staff.findById(req.staffId) : null;
    const canManage = staff && isLeaveManager(staff);

    if (!isOwner && !canManage) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this leave request' });
    }

    if (isOwner && request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending leave requests can be deleted' });
    }

    const deleted = await LeaveRequest.delete(request.dbId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    res.json({ success: true, message: 'Leave request deleted successfully' });
  } catch (error) {
    console.error('Delete leave request error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete leave request', error: error.message });
  }
};
