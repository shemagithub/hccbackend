import FieldReport from '../models/FieldReport.js';
import Staff from '../models/Staff.js';

export const getFieldReports = async (req, res) => {
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
    if (req.query.status) filters.status = req.query.status;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const reports = await FieldReport.findAll(filters);
    res.json({ success: true, data: reports });
  } catch (error) {
    console.error('Get field reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch field reports', error: error.message });
  }
};

export const getFieldReportById = async (req, res) => {
  try {
    const { id } = req.params;
    let report = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      report = await FieldReport.findById(numericId);
    }

    // If not found by numeric ID, try to find by reportId (e.g., "FR-2026-0001")
    if (!report && id) {
      report = await FieldReport.findByReportId(id);
    }

    if (!report) {
      return res.status(404).json({ success: false, message: 'Field report not found' });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Get field report error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch field report', error: error.message });
  }
};

export const createFieldReport = async (req, res) => {
  try {
    const {
      projectId, siteLocation, reportDate, reportTime, weatherConditions, siteConditions,
      workPerformed, observations, issuesEncountered, photos, gpsCoordinates,
      attendanceList, equipmentUsed, safetyIncidents, recommendations, status, notes
    } = req.body;

    if (!req.staffId) {
      return res.status(401).json({ success: false, message: 'Staff ID not found in request. Authentication failed.' });
    }

    if (!projectId || !siteLocation || !workPerformed || !reportDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields: projectId, siteLocation, workPerformed, and reportDate are required' });
    }

    // Ensure projectId is a number
    const projectIdNum = parseInt(projectId);
    if (isNaN(projectIdNum) || projectIdNum <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }

    const report = await FieldReport.create({
      staffId: parseInt(req.staffId), // Ensure staffId is a number
      projectId: projectIdNum,
      siteLocation: siteLocation.trim(),
      reportDate,
      reportTime: reportTime && reportTime.trim() ? reportTime.trim() : null,
      weatherConditions: weatherConditions && weatherConditions.trim() ? weatherConditions.trim() : null,
      siteConditions: siteConditions && siteConditions.trim() ? siteConditions.trim() : null,
      workPerformed: workPerformed.trim(),
      observations: observations && observations.trim() ? observations.trim() : null,
      issuesEncountered: issuesEncountered && issuesEncountered.trim() ? issuesEncountered.trim() : null,
      photos: photos || null,
      gpsCoordinates: gpsCoordinates && gpsCoordinates.trim() ? gpsCoordinates.trim() : null,
      attendanceList: attendanceList || null,
      equipmentUsed: equipmentUsed || null,
      safetyIncidents: safetyIncidents && safetyIncidents.trim() ? safetyIncidents.trim() : null,
      recommendations: recommendations && recommendations.trim() ? recommendations.trim() : null,
      status: status || 'submitted',
      notes: notes && notes.trim() ? notes.trim() : null
    });

    res.status(201).json({ success: true, data: report, message: 'Field report created successfully' });
  } catch (error) {
    console.error('Create field report error:', error);
    res.status(500).json({ success: false, message: 'Failed to create field report', error: error.message });
  }
};

export const updateFieldReport = async (req, res) => {
  try {
    const { id } = req.params;
    let report = null;
    let reportId = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      report = await FieldReport.findById(numericId);
      if (report) {
        reportId = report.dbId;
      }
    }

    // If not found by numeric ID, try to find by reportId (e.g., "FR-2026-0001")
    if (!report && id) {
      report = await FieldReport.findByReportId(id);
      if (report) {
        reportId = report.dbId;
      }
    }

    if (!report || !reportId) {
      return res.status(404).json({ success: false, message: 'Field report not found' });
    }

    const updated = await FieldReport.update(reportId, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedReport = await FieldReport.findById(reportId);
    res.json({ success: true, data: updatedReport, message: 'Field report updated successfully' });
  } catch (error) {
    console.error('Update field report error:', error);
    res.status(500).json({ success: false, message: 'Failed to update field report', error: error.message });
  }
};

export const deleteFieldReport = async (req, res) => {
  try {
    const { id } = req.params;
    let report = null;
    let reportId = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      report = await FieldReport.findById(numericId);
      if (report) {
        reportId = report.dbId;
      }
    }

    // If not found by numeric ID, try to find by reportId (e.g., "FR-2026-0001")
    if (!report && id) {
      report = await FieldReport.findByReportId(id);
      if (report) {
        reportId = report.dbId;
      }
    }

    if (!report || !reportId) {
      return res.status(404).json({ success: false, message: 'Field report not found' });
    }

    const deleted = await FieldReport.delete(reportId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Field report not found' });
    }
    res.json({ success: true, message: 'Field report deleted successfully' });
  } catch (error) {
    console.error('Delete field report error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete field report', error: error.message });
  }
};
