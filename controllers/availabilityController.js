import Availability from '../models/Availability.js';
import Staff from '../models/Staff.js';

export const getAvailabilities = async (req, res) => {
  try {
    const filters = {};
    
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance' && staff.role !== 'admin') {
        filters.staffEmail = staff.email;
      }
    }

    if (req.query.staffId) filters.staffId = parseInt(req.query.staffId);
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.workType) filters.workType = req.query.workType;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const availabilities = await Availability.findAll(filters);
    res.json({ success: true, data: availabilities });
  } catch (error) {
    console.error('Get availabilities error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch availabilities', error: error.message });
  }
};

export const getAvailabilityById = async (req, res) => {
  try {
    const availability = await Availability.findById(parseInt(req.params.id));
    if (!availability) {
      return res.status(404).json({ success: false, message: 'Availability not found' });
    }
    res.json({ success: true, data: availability });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch availability', error: error.message });
  }
};

export const createAvailability = async (req, res) => {
  try {
    const { staffId, date, capacityPercentage, workType, projectAllocations, notes } = req.body;

    if (!staffId || !date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const availability = await Availability.create({
      staffId, date, capacityPercentage, workType, projectAllocations, notes
    });

    res.status(201).json({ success: true, data: availability, message: 'Availability created successfully' });
  } catch (error) {
    console.error('Create availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to create availability', error: error.message });
  }
};

export const updateAvailability = async (req, res) => {
  try {
    const updated = await Availability.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const availability = await Availability.findById(parseInt(req.params.id));
    res.json({ success: true, data: availability, message: 'Availability updated successfully' });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to update availability', error: error.message });
  }
};

export const deleteAvailability = async (req, res) => {
  try {
    const deleted = await Availability.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Availability not found' });
    }
    res.json({ success: true, message: 'Availability deleted successfully' });
  } catch (error) {
    console.error('Delete availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete availability', error: error.message });
  }
};
