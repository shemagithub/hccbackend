import FundRequest from '../models/FundRequest.js';
import Project from '../models/Project.js';
import Staff from '../models/Staff.js';

export const getFundRequests = async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.requestedBy) filters.requestedBy = parseInt(req.query.requestedBy);
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const requests = await FundRequest.findAll(filters);
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get fund requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fund requests', error: error.message });
  }
};

export const getFundRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    let request = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      request = await FundRequest.findById(numericId);
    }

    // If not found by numeric ID, try to find by requestId (e.g., "FR-2026-0001")
    if (!request && id) {
      request = await FundRequest.findByRequestId(id);
    }

    if (!request) {
      return res.status(404).json({ success: false, message: 'Fund request not found' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Get fund request error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fund request', error: error.message });
  }
};

export const createFundRequest = async (req, res) => {
  try {
    const {
      projectId, title, requestedAmount, approvedAmount, currency,
      status, priority, purpose, justification, requestDate,
      attachments, notes
    } = req.body;

    if (!req.staffId) {
      return res.status(401).json({ success: false, message: 'Staff ID not found in request. Authentication failed.' });
    }

    if (!projectId || !title || !requestedAmount || !purpose || !justification) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: projectId, title, requestedAmount, purpose, and justification are required'
      });
    }

    // Verify project exists
    const project = await Project.findById(parseInt(projectId));
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Get requester info
    const requester = await Staff.findById(parseInt(req.staffId));
    const requestedByName = requester ? `${requester.firstName} ${requester.lastName}`.trim() : null;

    // Ensure amounts are numbers
    const requestedAmountNum = parseFloat(requestedAmount);
    const approvedAmountNum = approvedAmount ? parseFloat(approvedAmount) : 0;

    if (isNaN(requestedAmountNum) || requestedAmountNum <= 0) {
      return res.status(400).json({ success: false, message: 'Requested amount must be a positive number' });
    }

    const request = await FundRequest.create({
      projectId: parseInt(projectId),
      title: title.trim(),
      requestedAmount: requestedAmountNum,
      approvedAmount: approvedAmountNum,
      currency: currency && currency.trim() ? currency.trim() : 'USD',
      status: status || 'pending',
      priority: priority || 'medium',
      purpose: purpose.trim(),
      justification: justification.trim(),
      requestedBy: parseInt(req.staffId),
      requestedByName,
      requestDate: requestDate && requestDate.trim() ? requestDate.trim() : null,
      attachments: attachments || null,
      notes: notes && notes.trim() ? notes.trim() : null
    });

    res.status(201).json({ success: true, data: request, message: 'Fund request created successfully' });
  } catch (error) {
    console.error('Create fund request error:', error);
    res.status(500).json({ success: false, message: 'Failed to create fund request', error: error.message });
  }
};

export const updateFundRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get approver info if provided
    if (req.body.approvedBy && req.staffId) {
      const approver = await Staff.findById(parseInt(req.staffId));
      if (approver) {
        req.body.approvedByName = `${approver.firstName} ${approver.lastName}`.trim();
      }
    }

    // Parse numeric fields
    if (req.body.requestedAmount) {
      req.body.requestedAmount = parseFloat(req.body.requestedAmount);
    }
    if (req.body.approvedAmount !== undefined) {
      req.body.approvedAmount = parseFloat(req.body.approvedAmount || 0);
    }

    // Try to find by numeric ID first
    let numericId = parseInt(id);
    if (isNaN(numericId)) {
      const request = await FundRequest.findByRequestId(id);
      if (request) {
        numericId = request.dbId;
      } else {
        return res.status(404).json({ success: false, message: 'Fund request not found' });
      }
    }

    const updated = await FundRequest.update(numericId, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const request = await FundRequest.findById(numericId);
    res.json({ success: true, data: request, message: 'Fund request updated successfully' });
  } catch (error) {
    console.error('Update fund request error:', error);
    res.status(500).json({ success: false, message: 'Failed to update fund request', error: error.message });
  }
};

export const deleteFundRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by numeric ID first
    let numericId = parseInt(id);
    if (isNaN(numericId)) {
      const request = await FundRequest.findByRequestId(id);
      if (request) {
        numericId = request.dbId;
      } else {
        return res.status(404).json({ success: false, message: 'Fund request not found' });
      }
    }

    const deleted = await FundRequest.delete(numericId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Fund request not found' });
    }

    res.json({ success: true, message: 'Fund request deleted successfully' });
  } catch (error) {
    console.error('Delete fund request error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete fund request', error: error.message });
  }
};
