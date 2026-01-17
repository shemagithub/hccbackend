import Training from '../models/Training.js';
import Staff from '../models/Staff.js';

export const getTrainings = async (req, res) => {
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
    if (req.query.status) filters.status = req.query.status;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const trainings = await Training.findAll(filters);
    res.json({ success: true, data: trainings });
  } catch (error) {
    console.error('Get trainings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trainings', error: error.message });
  }
};

export const getTrainingById = async (req, res) => {
  try {
    const training = await Training.findById(parseInt(req.params.id));
    if (!training) {
      return res.status(404).json({ success: false, message: 'Training not found' });
    }
    res.json({ success: true, data: training });
  } catch (error) {
    console.error('Get training error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch training', error: error.message });
  }
};

export const createTraining = async (req, res) => {
  try {
    const {
      staffId, skillId, skillName, trainingType, title, description, provider,
      startDate, endDate, status, completionPercentage, certificationIssued,
      certificationExpiry, cost, currency, notes
    } = req.body;

    if (!trainingType || !title) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const training = await Training.create({
      staffId, skillId, skillName, trainingType, title, description, provider,
      startDate, endDate, status, completionPercentage, certificationIssued,
      certificationExpiry, cost, currency, notes, createdBy: req.staffId
    });

    res.status(201).json({ success: true, data: training, message: 'Training created successfully' });
  } catch (error) {
    console.error('Create training error:', error);
    res.status(500).json({ success: false, message: 'Failed to create training', error: error.message });
  }
};

export const updateTraining = async (req, res) => {
  try {
    const updated = await Training.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const training = await Training.findById(parseInt(req.params.id));
    res.json({ success: true, data: training, message: 'Training updated successfully' });
  } catch (error) {
    console.error('Update training error:', error);
    res.status(500).json({ success: false, message: 'Failed to update training', error: error.message });
  }
};

export const deleteTraining = async (req, res) => {
  try {
    const deleted = await Training.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Training not found' });
    }
    res.json({ success: true, message: 'Training deleted successfully' });
  } catch (error) {
    console.error('Delete training error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete training', error: error.message });
  }
};
