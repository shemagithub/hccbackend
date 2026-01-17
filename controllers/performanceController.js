import Performance from '../models/Performance.js';
import Staff from '../models/Staff.js';

export const getPerformances = async (req, res) => {
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

    const performances = await Performance.findAll(filters);
    res.json({ success: true, data: performances });
  } catch (error) {
    console.error('Get performances error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch performances', error: error.message });
  }
};

export const getPerformanceById = async (req, res) => {
  try {
    const performance = await Performance.findById(parseInt(req.params.id));
    if (!performance) {
      return res.status(404).json({ success: false, message: 'Performance not found' });
    }
    res.json({ success: true, data: performance });
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch performance', error: error.message });
  }
};

export const createPerformance = async (req, res) => {
  try {
    const {
      staffId, projectId, reviewPeriodStart, reviewPeriodEnd, overallRating,
      performanceScore, feedback, strengths, areasForImprovement, lessonsLearned,
      reviewedBy, reviewedByName, reviewDate, status, notes
    } = req.body;

    if (!staffId || !reviewPeriodStart || !reviewPeriodEnd) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const performance = await Performance.create({
      staffId, projectId, reviewPeriodStart, reviewPeriodEnd, overallRating,
      performanceScore, feedback, strengths, areasForImprovement, lessonsLearned,
      reviewedBy, reviewedByName, reviewDate, status, notes
    });

    res.status(201).json({ success: true, data: performance, message: 'Performance created successfully' });
  } catch (error) {
    console.error('Create performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to create performance', error: error.message });
  }
};

export const updatePerformance = async (req, res) => {
  try {
    const updated = await Performance.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const performance = await Performance.findById(parseInt(req.params.id));
    res.json({ success: true, data: performance, message: 'Performance updated successfully' });
  } catch (error) {
    console.error('Update performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to update performance', error: error.message });
  }
};

export const deletePerformance = async (req, res) => {
  try {
    const deleted = await Performance.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Performance not found' });
    }
    res.json({ success: true, message: 'Performance deleted successfully' });
  } catch (error) {
    console.error('Delete performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete performance', error: error.message });
  }
};
