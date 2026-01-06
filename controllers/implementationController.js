import Implementation from '../models/Implementation.js';

export class ImplementationController {
  // Create a new implementation
  static async createImplementation(req, res) {
    try {
      const {
        projectId,
        title,
        client,
        description,
        startDate,
        endDate,
        status = 'planning',
        progress = 0,
        budget = 0,
        spent = 0,
        assignedTo,
        teamSize = 0,
        priority = 'medium'
      } = req.body;

      // Validation
      if (!title || !client || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Title, client, start date, and end date are required'
        });
      }

      if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      const implementation = await Implementation.create({
        projectId: projectId || null,
        title,
        client,
        description: description || null,
        startDate,
        endDate,
        status,
        progress: parseInt(progress) || 0,
        budget: parseFloat(budget) || 0,
        spent: parseFloat(spent) || 0,
        assignedTo: assignedTo || null,
        teamSize: parseInt(teamSize) || 0,
        priority,
        createdBy: req.staffId || null
      });

      res.status(201).json({
        success: true,
        message: 'Implementation created successfully',
        data: implementation
      });
    } catch (error) {
      console.error('Create implementation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create implementation',
        error: error.message
      });
    }
  }

  // Get all implementations
  static async getImplementations(req, res) {
    try {
      const {
        status,
        priority,
        client,
        projectId,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        status,
        priority,
        client,
        projectId: projectId ? parseInt(projectId) : undefined,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const implementations = await Implementation.findAll(filters);
      const stats = await Implementation.getStats();

      res.json({
        success: true,
        data: implementations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats
      });
    } catch (error) {
      console.error('Get implementations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch implementations',
        error: error.message
      });
    }
  }

  // Get implementation by ID
  static async getImplementationById(req, res) {
    try {
      const { id } = req.params;
      
      const implementation = await Implementation.findById(parseInt(id)) || 
                             await Implementation.findByImplementationId(id);

      if (!implementation) {
        return res.status(404).json({
          success: false,
          message: 'Implementation not found'
        });
      }

      res.json({
        success: true,
        data: implementation
      });
    } catch (error) {
      console.error('Get implementation by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch implementation',
        error: error.message
      });
    }
  }

  // Update implementation
  static async updateImplementation(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Implementation ID is required'
        });
      }

      const implementation = await Implementation.findById(parseInt(id)) || 
                             await Implementation.findByImplementationId(id);

      if (!implementation) {
        return res.status(404).json({
          success: false,
          message: 'Implementation not found'
        });
      }

      const dbId = implementation.dbId || parseInt(id);
      const updated = await Implementation.update(dbId, updateData);

      if (updated) {
        res.json({
          success: true,
          message: 'Implementation updated successfully',
          data: updated
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update implementation'
        });
      }
    } catch (error) {
      console.error('Update implementation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update implementation',
        error: error.message
      });
    }
  }

  // Delete implementation
  static async deleteImplementation(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Implementation ID is required'
        });
      }

      const implementation = await Implementation.findById(parseInt(id)) || 
                             await Implementation.findByImplementationId(id);

      if (!implementation) {
        return res.status(404).json({
          success: false,
          message: 'Implementation not found'
        });
      }

      const dbId = implementation.dbId || parseInt(id);
      const success = await Implementation.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Implementation deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete implementation'
        });
      }
    } catch (error) {
      console.error('Delete implementation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete implementation',
        error: error.message
      });
    }
  }
}

