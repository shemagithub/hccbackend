import EmployeeRequest from '../models/EmployeeRequest.js';
import Staff from '../models/Staff.js';

export const getEmployeeRequests = async (req, res) => {
  try {
    const filters = {};
    
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance' && staff.role !== 'admin') {
        filters.staffEmail = staff.email;
      }
    }

    if (req.query.staffId) filters.staffId = parseInt(req.query.staffId);
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.requestType) filters.requestType = req.query.requestType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const requests = await EmployeeRequest.findAll(filters);
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get employee requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employee requests', error: error.message });
  }
};

export const getEmployeeRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    let request = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      request = await EmployeeRequest.findById(numericId);
    }

    // If not found by numeric ID, try to find by requestId (e.g., "ER-2026-0001")
    if (!request && id) {
      request = await EmployeeRequest.findByRequestId(id);
    }

    if (!request) {
      return res.status(404).json({ success: false, message: 'Employee request not found' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Get employee request error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employee request', error: error.message });
  }
};

export const createEmployeeRequest = async (req, res) => {
  try {
    const {
      projectId, requestType, title, description, amount, currency, priority,
      status, requiredDate, attachments, notes
    } = req.body;

    if (!req.staffId) {
      return res.status(401).json({ success: false, message: 'Staff ID not found in request. Authentication failed.' });
    }

    if (!requestType || !title || !description) {
      return res.status(400).json({ success: false, message: 'Missing required fields: requestType, title, and description are required' });
    }

    // Validate request type
    const validTypes = ['resource', 'expense', 'equipment', 'support', 'other'];
    if (!validTypes.includes(requestType)) {
      return res.status(400).json({ success: false, message: 'Invalid request type' });
    }

    // Ensure projectId is a number or null
    const projectIdNum = projectId && !isNaN(parseInt(projectId)) ? parseInt(projectId) : null;

    // Ensure amount is a number or null
    const amountNum = amount && !isNaN(parseFloat(amount)) ? parseFloat(amount) : null;

    const request = await EmployeeRequest.create({
      staffId: parseInt(req.staffId), // Ensure staffId is a number
      projectId: projectIdNum,
      requestType: requestType.trim(),
      title: title.trim(),
      description: description.trim(),
      amount: amountNum,
      currency: currency && currency.trim() ? currency.trim() : 'USD',
      priority: priority || 'medium',
      status: status || 'pending',
      requiredDate: requiredDate && requiredDate.trim() ? requiredDate.trim() : null,
      attachments: attachments || null,
      notes: notes && notes.trim() ? notes.trim() : null
    });

    res.status(201).json({ success: true, data: request, message: 'Employee request created successfully' });
  } catch (error) {
    console.error('Create employee request error:', error);
    res.status(500).json({ success: false, message: 'Failed to create employee request', error: error.message });
  }
};

export const updateEmployeeRequest = async (req, res) => {
  try {
    const updated = await EmployeeRequest.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const request = await EmployeeRequest.findById(parseInt(req.params.id));
    res.json({ success: true, data: request, message: 'Employee request updated successfully' });
  } catch (error) {
    console.error('Update employee request error:', error);
    res.status(500).json({ success: false, message: 'Failed to update employee request', error: error.message });
  }
};

export const deleteEmployeeRequest = async (req, res) => {
  try {
    const deleted = await EmployeeRequest.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Employee request not found' });
    }
    res.json({ success: true, message: 'Employee request deleted successfully' });
  } catch (error) {
    console.error('Delete employee request error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete employee request', error: error.message });
  }
};
