import ProjectAssignment from '../models/ProjectAssignment.js';
import Staff from '../models/Staff.js';
import { rebuildProjectTeamFromAssignments } from '../utils/projectTeam.js';

export const getProjectAssignments = async (req, res) => {
  try {
    const filters = {};
    const hasProjectScope = Boolean(req.query.projectId);
    
    if (!hasProjectScope && req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance' && staff.role !== 'admin') {
        filters.staffEmail = staff.email;
      }
    }

    if (req.query.staffId) filters.staffId = parseInt(req.query.staffId);
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const assignments = await ProjectAssignment.findAll(filters);
    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error('Get project assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch project assignments', error: error.message });
  }
};

export const getProjectAssignmentById = async (req, res) => {
  try {
    const assignment = await ProjectAssignment.findById(parseInt(req.params.id));
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Project assignment not found' });
    }
    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Get project assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch project assignment', error: error.message });
  }
};

export const createProjectAssignment = async (req, res) => {
  try {
    const {
      projectId, staffId, role, allocationPercentage, startDate, endDate,
      status, skillsRequired, skillsAssigned, notes
    } = req.body;

    if (!projectId || !staffId || !startDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const assignment = await ProjectAssignment.create({
      projectId, staffId, role, allocationPercentage, startDate, endDate,
      status, skillsRequired, skillsAssigned, notes, createdBy: req.staffId
    });

    await rebuildProjectTeamFromAssignments(projectId);

    res.status(201).json({ success: true, data: assignment, message: 'Project assignment created successfully' });
  } catch (error) {
    console.error('Create project assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to create project assignment', error: error.message });
  }
};

export const updateProjectAssignment = async (req, res) => {
  try {
    const existing = await ProjectAssignment.findById(parseInt(req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project assignment not found' });
    }

    const updated = await ProjectAssignment.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    await rebuildProjectTeamFromAssignments(existing.projectId);

    const assignment = await ProjectAssignment.findById(parseInt(req.params.id));
    res.json({ success: true, data: assignment, message: 'Project assignment updated successfully' });
  } catch (error) {
    console.error('Update project assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to update project assignment', error: error.message });
  }
};

export const deleteProjectAssignment = async (req, res) => {
  try {
    const existing = await ProjectAssignment.findById(parseInt(req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project assignment not found' });
    }

    const deleted = await ProjectAssignment.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Project assignment not found' });
    }

    await rebuildProjectTeamFromAssignments(existing.projectId);

    res.json({ success: true, message: 'Project assignment deleted successfully' });
  } catch (error) {
    console.error('Delete project assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete project assignment', error: error.message });
  }
};
