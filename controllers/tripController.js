import Trip from '../models/Trip.js';
import Staff from '../models/Staff.js';

export const getTrips = async (req, res) => {
  try {
    const filters = {};
    
    // Get logged-in user info
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        // Filter by driver email if user is a driver
        filters.driverEmail = staff.email;
      }
    }

    // Apply query filters
    if (req.query.search) filters.search = req.query.search;
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.vehicleId) filters.vehicleId = parseInt(req.query.vehicleId);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const trips = await Trip.findAll(filters);
    res.json({ success: true, data: trips });
  } catch (error) {
    console.error('Get trips error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trips', error: error.message });
  }
};

export const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(parseInt(req.params.id));
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Check access permission
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        if (trip.driverEmail !== staff.email) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    res.json({ success: true, data: trip });
  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trip', error: error.message });
  }
};

export const createTrip = async (req, res) => {
  try {
    const {
      tripId, projectId, vehicleId, driverId, driverName, purpose, origin, destination,
      startDate, startTime, endDate, endTime, status, estimatedDuration, actualDuration,
      distanceKm, fuelUsed, notes
    } = req.body;

    if (!purpose || !origin || !destination || !startDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const trip = await Trip.create({
      tripId, projectId, vehicleId, driverId, driverName, purpose, origin, destination,
      startDate, startTime, endDate, endTime, status, estimatedDuration, actualDuration,
      distanceKm, fuelUsed, notes, createdBy: req.staffId
    });

    res.status(201).json({ success: true, data: trip, message: 'Trip created successfully' });
  } catch (error) {
    console.error('Create trip error:', error);
    res.status(500).json({ success: false, message: 'Failed to create trip', error: error.message });
  }
};

export const updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(parseInt(req.params.id));
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Check access permission
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        // Check if trip belongs to this driver
        const tripDriver = await Staff.findById(trip.driverId);
        if (!tripDriver || tripDriver.email !== staff.email) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    const updated = await Trip.update(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const updatedTrip = await Trip.findById(parseInt(req.params.id));
    res.json({ success: true, data: updatedTrip, message: 'Trip updated successfully' });
  } catch (error) {
    console.error('Update trip error:', error);
    res.status(500).json({ success: false, message: 'Failed to update trip', error: error.message });
  }
};

export const deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(parseInt(req.params.id));
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Check access permission
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance') {
        // Check if trip belongs to this driver
        const tripDriver = await Staff.findById(trip.driverId);
        if (!tripDriver || tripDriver.email !== staff.email) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    const deleted = await Trip.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(400).json({ success: false, message: 'Failed to delete trip' });
    }

    res.json({ success: true, message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete trip', error: error.message });
  }
};

export const getTripStats = async (req, res) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId) : null;
    const stats = await Trip.getStats(projectId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get trip stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trip stats', error: error.message });
  }
};
