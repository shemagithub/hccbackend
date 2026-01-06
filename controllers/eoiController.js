import EOI from '../models/EOI.js';

export class EOIController {
  // Create a new EOI
  static async createEOI(req, res) {
    try {
      const {
        title,
        organization,
        submissionDate,
        deadline,
        status = 'draft',
        value = 0,
        assignedTo,
        description,
        requirements
      } = req.body;

      // Validation
      if (!title || !organization || !submissionDate || !deadline || !description) {
        return res.status(400).json({
          success: false,
          message: 'Title, organization, submission date, deadline, and description are required'
        });
      }

      if (new Date(submissionDate) > new Date(deadline)) {
        return res.status(400).json({
          success: false,
          message: 'Deadline must be after submission date'
        });
      }

      const eoi = await EOI.create({
        title,
        organization,
        submissionDate,
        deadline,
        status,
        value: parseFloat(value) || 0,
        assignedTo: assignedTo || null,
        description,
        requirements: requirements || []
      });

      res.status(201).json({
        success: true,
        message: 'EOI created successfully',
        data: eoi
      });
    } catch (error) {
      console.error('Create EOI error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create EOI',
        error: error.message
      });
    }
  }

  // Get all EOIs
  static async getEOIs(req, res) {
    try {
      const {
        status,
        search,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        status,
        search,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const eois = await EOI.findAll(filters);
      const stats = await EOI.getStats();

      res.json({
        success: true,
        data: eois,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats
      });
    } catch (error) {
      console.error('Get EOIs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch EOIs',
        error: error.message
      });
    }
  }

  // Get EOI by ID
  static async getEOIById(req, res) {
    try {
      const { id } = req.params;
      
      const eoi = await EOI.findById(parseInt(id)) || 
                 await EOI.findByEOIId(id);

      if (!eoi) {
        return res.status(404).json({
          success: false,
          message: 'EOI not found'
        });
      }

      res.json({
        success: true,
        data: eoi
      });
    } catch (error) {
      console.error('Get EOI by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch EOI',
        error: error.message
      });
    }
  }

  // Update EOI
  static async updateEOI(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'EOI ID is required'
        });
      }

      let eoi = await EOI.findById(parseInt(id));
      if (!eoi) {
        eoi = await EOI.findByEOIId(id);
      }

      if (!eoi) {
        return res.status(404).json({
          success: false,
          message: 'EOI not found'
        });
      }

      const updatedEOI = await EOI.update(eoi.dbId, updateData);

      res.json({
        success: true,
        message: 'EOI updated successfully',
        data: updatedEOI
      });
    } catch (error) {
      console.error('Update EOI error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update EOI',
        error: error.message
      });
    }
  }

  // Delete EOI
  static async deleteEOI(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'EOI ID is required'
        });
      }

      let eoi = await EOI.findById(parseInt(id));
      if (!eoi) {
        eoi = await EOI.findByEOIId(id);
      }

      if (!eoi) {
        return res.status(404).json({
          success: false,
          message: 'EOI not found'
        });
      }

      await EOI.delete(eoi.dbId);

      res.json({
        success: true,
        message: 'EOI deleted successfully'
      });
    } catch (error) {
      console.error('Delete EOI error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete EOI',
        error: error.message
      });
    }
  }
}

