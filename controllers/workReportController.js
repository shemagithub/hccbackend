import WorkReport from '../models/WorkReport.js';
import Staff from '../models/Staff.js';
import { buildWorkFieldReportFilters } from '../utils/projectReportAccess.js';

export const getWorkReports = async (req, res) => {
  try {
    const { filters, error, message } = await buildWorkFieldReportFilters(req);
    if (error === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message });
    }

    const reports = await WorkReport.findAll(filters);
    res.json({ success: true, data: reports });
  } catch (error) {
    console.error('Get work reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch work reports', error: error.message });
  }
};

export const getWorkReportById = async (req, res) => {
  try {
    const { id } = req.params;
    let report = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      report = await WorkReport.findById(numericId);
    }

    // If not found by numeric ID, try to find by reportId (e.g., "WR-2026-0001")
    if (!report && id) {
      report = await WorkReport.findByReportId(id);
    }

    if (!report) {
      return res.status(404).json({ success: false, message: 'Work report not found' });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Get work report error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch work report', error: error.message });
  }
};

export const createWorkReport = async (req, res) => {
  try {
    const {
      projectId, reportType, reportDate, periodStart, periodEnd, progressSummary,
      tasksCompleted, tasksInProgress, challenges, recommendations, nextSteps,
      attachments, status, notes
    } = req.body;

    if (!progressSummary || !reportDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields: progressSummary and reportDate are required' });
    }

    // Ensure staffId is a number
    const staffId = req.staffId ? parseInt(req.staffId) : null;
    if (!staffId) {
      return res.status(401).json({ success: false, message: 'Staff ID not found. Please sign in again.' });
    }

    // Ensure projectId is a number or null
    const projectIdNum = projectId ? parseInt(projectId) : null;

    console.log('Creating work report with data:', {
      staffId,
      projectId: projectIdNum,
      reportType,
      reportDate,
      progressSummary: progressSummary.substring(0, 50) + '...',
      tasksCompleted: tasksCompleted?.length || 0,
      tasksInProgress: tasksInProgress?.length || 0,
    });

    const report = await WorkReport.create({
      staffId, 
      projectId: projectIdNum, 
      reportType, 
      reportDate, 
      periodStart: periodStart || null, 
      periodEnd: periodEnd || null,
      progressSummary, 
      tasksCompleted: tasksCompleted && Array.isArray(tasksCompleted) && tasksCompleted.length > 0 ? tasksCompleted : null, 
      tasksInProgress: tasksInProgress && Array.isArray(tasksInProgress) && tasksInProgress.length > 0 ? tasksInProgress : null, 
      challenges: challenges || null, 
      recommendations: recommendations || null,
      nextSteps: nextSteps || null, 
      attachments: attachments || null, 
      status: status || 'submitted', 
      notes: notes || null
    });

    res.status(201).json({ success: true, data: report, message: 'Work report created successfully' });
  } catch (error) {
    console.error('Create work report error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create work report', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const updateWorkReport = async (req, res) => {
  try {
    const updated = await WorkReport.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const report = await WorkReport.findById(parseInt(req.params.id));
    res.json({ success: true, data: report, message: 'Work report updated successfully' });
  } catch (error) {
    console.error('Update work report error:', error);
    res.status(500).json({ success: false, message: 'Failed to update work report', error: error.message });
  }
};

export const deleteWorkReport = async (req, res) => {
  try {
    const deleted = await WorkReport.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Work report not found' });
    }
    res.json({ success: true, message: 'Work report deleted successfully' });
  } catch (error) {
    console.error('Delete work report error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete work report', error: error.message });
  }
};

// Review work report (approve/reject)
export const reviewWorkReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !['reviewed', 'approved'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status must be "reviewed" or "approved"' 
      });
    }

    const staff = await Staff.findById(req.staffId);
    const reviewerName = staff ? `${staff.firstName} ${staff.lastName}` : null;

    const updateData = {
      status,
      reviewedBy: req.staffId,
      reviewedByName: reviewerName,
      reviewDate: new Date().toISOString().split('T')[0],
      notes: notes || null
    };

    const updated = await WorkReport.update(parseInt(id), updateData);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Work report not found' });
    }

    const report = await WorkReport.findById(parseInt(id));
    res.json({ 
      success: true, 
      data: report, 
      message: `Work report ${status} successfully` 
    });
  } catch (error) {
    console.error('Review work report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to review work report', 
      error: error.message 
    });
  }
};
