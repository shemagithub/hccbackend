import WorkBreakdown from '../models/WorkBreakdown.js';
import Project from '../models/Project.js';
import Staff from '../models/Staff.js';

export const getWorkBreakdowns = async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.parentId !== undefined) {
      filters.parentId = req.query.parentId === 'null' ? null : parseInt(req.query.parentId);
    }
    if (req.query.level) filters.level = parseInt(req.query.level);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.assigneeId) filters.assigneeId = parseInt(req.query.assigneeId);
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const items = await WorkBreakdown.findAll(filters);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get work breakdowns error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch work breakdown items', error: error.message });
  }
};

export const getWorkBreakdownById = async (req, res) => {
  try {
    const { id } = req.params;
    let item = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      item = await WorkBreakdown.findById(numericId);
    }

    // If not found by numeric ID, try to find by wbsId (e.g., "WBS-2026-0001")
    if (!item && id) {
      item = await WorkBreakdown.findByWBSId(id);
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Work breakdown item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Get work breakdown error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch work breakdown item', error: error.message });
  }
};

export const createWorkBreakdown = async (req, res) => {
  try {
    const {
      projectId, parentId, level, task, assigneeId, assigneeName,
      durationDays, durationDisplay, status, progress, description,
      startDate, endDate, notes
    } = req.body;

    if (!req.staffId) {
      return res.status(401).json({ success: false, message: 'Staff ID not found in request. Authentication failed.' });
    }

    if (!projectId || !task) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: projectId and task are required'
      });
    }

    // Verify project exists
    const project = await Project.findById(parseInt(projectId));
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Get creator info
    const creator = await Staff.findById(parseInt(req.staffId));
    const createdByName = creator ? `${creator.firstName} ${creator.lastName}`.trim() : null;

    // Get assignee info if provided
    let assigneeNameValue = assigneeName;
    if (assigneeId && !assigneeName) {
      const assignee = await Staff.findById(parseInt(assigneeId));
      assigneeNameValue = assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : null;
    }

    // Validate status
    const validStatuses = ['Pending', 'In Progress', 'Completed', 'On Hold'];
    const cleanStatus = status && validStatuses.includes(status) ? status : 'Pending';

    // Validate progress
    const cleanProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : 0;

    // Validate level
    const cleanLevel = typeof level === 'number' && level > 0 ? level : 1;

    const item = await WorkBreakdown.create({
      projectId: parseInt(projectId),
      parentId: parentId ? parseInt(parentId) : null,
      level: cleanLevel,
      task: task.trim(),
      assigneeId: assigneeId ? parseInt(assigneeId) : null,
      assigneeName: assigneeNameValue,
      durationDays: durationDays ? parseInt(durationDays) : null,
      durationDisplay: durationDisplay ? durationDisplay.trim() : null,
      status: cleanStatus,
      progress: cleanProgress,
      description: description ? description.trim() : null,
      startDate: startDate && startDate.trim() ? startDate.trim() : null,
      endDate: endDate && endDate.trim() ? endDate.trim() : null,
      createdBy: parseInt(req.staffId),
      createdByName,
      notes: notes ? notes.trim() : null
    });

    res.status(201).json({ success: true, data: item, message: 'Work breakdown item created successfully' });
  } catch (error) {
    console.error('Create work breakdown error:', error);
    res.status(500).json({ success: false, message: 'Failed to create work breakdown item', error: error.message });
  }
};

export const updateWorkBreakdown = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get assignee info if provided
    if (req.body.assigneeId && !req.body.assigneeName) {
      const assignee = await Staff.findById(parseInt(req.body.assigneeId));
      if (assignee) {
        req.body.assigneeName = `${assignee.firstName} ${assignee.lastName}`.trim();
      }
    }

    // Parse numeric fields
    if (req.body.level !== undefined) {
      req.body.level = parseInt(req.body.level);
    }
    if (req.body.progress !== undefined) {
      req.body.progress = Math.max(0, Math.min(100, Math.round(parseFloat(req.body.progress))));
    }
    if (req.body.durationDays !== undefined) {
      req.body.durationDays = req.body.durationDays ? parseInt(req.body.durationDays) : null;
    }
    if (req.body.parentId !== undefined) {
      req.body.parentId = req.body.parentId ? parseInt(req.body.parentId) : null;
    }
    if (req.body.assigneeId !== undefined) {
      req.body.assigneeId = req.body.assigneeId ? parseInt(req.body.assigneeId) : null;
    }

    // Try to find by numeric ID first
    let numericId = parseInt(id);
    if (isNaN(numericId)) {
      const item = await WorkBreakdown.findByWBSId(id);
      if (item) {
        numericId = item.dbId;
      } else {
        return res.status(404).json({ success: false, message: 'Work breakdown item not found' });
      }
    }

    const updated = await WorkBreakdown.update(numericId, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const item = await WorkBreakdown.findById(numericId);
    res.json({ success: true, data: item, message: 'Work breakdown item updated successfully' });
  } catch (error) {
    console.error('Update work breakdown error:', error);
    res.status(500).json({ success: false, message: 'Failed to update work breakdown item', error: error.message });
  }
};

export const deleteWorkBreakdown = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by numeric ID first
    let numericId = parseInt(id);
    if (isNaN(numericId)) {
      const item = await WorkBreakdown.findByWBSId(id);
      if (item) {
        numericId = item.dbId;
      } else {
        return res.status(404).json({ success: false, message: 'Work breakdown item not found' });
      }
    }

    const deleted = await WorkBreakdown.delete(numericId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Work breakdown item not found' });
    }

    res.json({ success: true, message: 'Work breakdown item deleted successfully' });
  } catch (error) {
    console.error('Delete work breakdown error:', error);
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to delete work breakdown item', error: error.message });
  }
};
