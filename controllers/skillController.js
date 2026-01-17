import Skill from '../models/Skill.js';

export const getSkills = async (req, res) => {
  try {
    const filters = {};
    if (req.query.search) filters.search = req.query.search;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const skills = await Skill.findAll(filters);
    res.json({ success: true, data: skills });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch skills', error: error.message });
  }
};

export const getSkillById = async (req, res) => {
  try {
    const skill = await Skill.findById(parseInt(req.params.id));
    if (!skill) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }
    res.json({ success: true, data: skill });
  } catch (error) {
    console.error('Get skill error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch skill', error: error.message });
  }
};

export const createSkill = async (req, res) => {
  try {
    const { name, category, description, levelType } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const skill = await Skill.create({ name, category, description, levelType });
    res.status(201).json({ success: true, data: skill, message: 'Skill created successfully' });
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({ success: false, message: 'Failed to create skill', error: error.message });
  }
};

export const updateSkill = async (req, res) => {
  try {
    const updated = await Skill.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const skill = await Skill.findById(parseInt(req.params.id));
    res.json({ success: true, data: skill, message: 'Skill updated successfully' });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({ success: false, message: 'Failed to update skill', error: error.message });
  }
};

export const deleteSkill = async (req, res) => {
  try {
    const deleted = await Skill.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }
    res.json({ success: true, message: 'Skill deleted successfully' });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete skill', error: error.message });
  }
};
