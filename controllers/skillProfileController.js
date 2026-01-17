import SkillProfile from '../models/SkillProfile.js';
import Staff from '../models/Staff.js';

export const getSkillProfiles = async (req, res) => {
  try {
    const filters = {};
    
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance' && staff.role !== 'admin') {
        filters.staffEmail = staff.email;
      }
    }

    if (req.query.staffId) filters.staffId = parseInt(req.query.staffId);
    if (req.query.skillId) filters.skillId = parseInt(req.query.skillId);
    if (req.query.category) filters.category = req.query.category;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const profiles = await SkillProfile.findAll(filters);
    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error('Get skill profiles error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch skill profiles', error: error.message });
  }
};

export const getSkillProfileById = async (req, res) => {
  try {
    const profile = await SkillProfile.findById(parseInt(req.params.id));
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Skill profile not found' });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Get skill profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch skill profile', error: error.message });
  }
};

export const createSkillProfile = async (req, res) => {
  try {
    const {
      staffId, skillId, skillName, skillCategory, level, levelLabel,
      yearsExperience, certifications, pastProjects, notes
    } = req.body;

    if (!staffId || !skillId || !skillName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const profile = await SkillProfile.create({
      staffId, skillId, skillName, skillCategory, level, levelLabel,
      yearsExperience, certifications, pastProjects, notes
    });

    res.status(201).json({ success: true, data: profile, message: 'Skill profile created successfully' });
  } catch (error) {
    console.error('Create skill profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to create skill profile', error: error.message });
  }
};

export const updateSkillProfile = async (req, res) => {
  try {
    const updated = await SkillProfile.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const profile = await SkillProfile.findById(parseInt(req.params.id));
    res.json({ success: true, data: profile, message: 'Skill profile updated successfully' });
  } catch (error) {
    console.error('Update skill profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update skill profile', error: error.message });
  }
};

export const deleteSkillProfile = async (req, res) => {
  try {
    const deleted = await SkillProfile.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Skill profile not found' });
    }
    res.json({ success: true, message: 'Skill profile deleted successfully' });
  } catch (error) {
    console.error('Delete skill profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete skill profile', error: error.message });
  }
};
