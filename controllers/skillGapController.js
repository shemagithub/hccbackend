import SkillGap from '../models/SkillGap.js';

export const getSkillGaps = async (req, res) => {
  try {
    const filters = {};
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.departmentId) filters.departmentId = parseInt(req.query.departmentId);
    if (req.query.gapType) filters.gapType = req.query.gapType;
    if (req.query.gapSeverity) filters.gapSeverity = req.query.gapSeverity;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const gaps = await SkillGap.findAll(filters);
    res.json({ success: true, data: gaps });
  } catch (error) {
    console.error('Get skill gaps error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch skill gaps', error: error.message });
  }
};

export const getSkillGapById = async (req, res) => {
  try {
    const gap = await SkillGap.findById(parseInt(req.params.id));
    if (!gap) {
      return res.status(404).json({ success: false, message: 'Skill gap not found' });
    }
    res.json({ success: true, data: gap });
  } catch (error) {
    console.error('Get skill gap error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch skill gap', error: error.message });
  }
};

export const createSkillGap = async (req, res) => {
  try {
    const {
      projectId, departmentId, skillName, skillCategory, requiredLevel,
      currentLevel, gapSeverity, gapType, recommendedAction, status, assignedTo, notes
    } = req.body;

    if (!skillName || !requiredLevel) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const gap = await SkillGap.create({
      projectId, departmentId, skillName, skillCategory, requiredLevel,
      currentLevel, gapSeverity, gapType, recommendedAction, status, assignedTo, notes
    });

    res.status(201).json({ success: true, data: gap, message: 'Skill gap created successfully' });
  } catch (error) {
    console.error('Create skill gap error:', error);
    res.status(500).json({ success: false, message: 'Failed to create skill gap', error: error.message });
  }
};

export const updateSkillGap = async (req, res) => {
  try {
    const updated = await SkillGap.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const gap = await SkillGap.findById(parseInt(req.params.id));
    res.json({ success: true, data: gap, message: 'Skill gap updated successfully' });
  } catch (error) {
    console.error('Update skill gap error:', error);
    res.status(500).json({ success: false, message: 'Failed to update skill gap', error: error.message });
  }
};

export const deleteSkillGap = async (req, res) => {
  try {
    const deleted = await SkillGap.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Skill gap not found' });
    }
    res.json({ success: true, message: 'Skill gap deleted successfully' });
  } catch (error) {
    console.error('Delete skill gap error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete skill gap', error: error.message });
  }
};
