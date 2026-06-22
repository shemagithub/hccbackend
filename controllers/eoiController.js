import EOI from '../models/EOI.js';
import Implementation from '../models/Implementation.js';

const VALID_DECISIONS = ['pending', 'under_review', 'awarded', 'rejected', 'cancelled'];

function validateAwardedDecision(updateData) {
  if (updateData.decision !== 'awarded') return null;

  if (!updateData.implementationStartDate || !updateData.implementationDueDate) {
    return 'Start date and due date are required when decision is Awarded';
  }

  if (new Date(updateData.implementationStartDate) > new Date(updateData.implementationDueDate)) {
    return 'Due date must be on or after the start date';
  }

  return null;
}

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
        limit = 50,
        excludeImplemented = 'true'
      } = req.query;

      const filters = {
        status,
        search,
        excludeImplemented,
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

      if (updateData.decision !== undefined && !VALID_DECISIONS.includes(updateData.decision)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid decision value',
        });
      }

      const mergedDecisionData = {
        decision: updateData.decision ?? eoi.decision,
        implementationStartDate:
          updateData.implementationStartDate ?? eoi.implementationStartDate,
        implementationDueDate:
          updateData.implementationDueDate ?? eoi.implementationDueDate,
      };
      const awardedError = validateAwardedDecision(mergedDecisionData);
      if (awardedError) {
        return res.status(400).json({ success: false, message: awardedError });
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

  static async startImplementation(req, res) {
    try {
      const { id } = req.params;
      await EOI.ensureAwardedFields();

      let eoi = await EOI.findById(parseInt(id, 10));
      if (!eoi) {
        eoi = await EOI.findByEOIId(id);
      }

      if (!eoi) {
        return res.status(404).json({ success: false, message: 'EOI not found' });
      }

      if (eoi.decision !== 'awarded') {
        return res.status(400).json({
          success: false,
          message: 'Implementation can only be started when the EOI decision is Awarded',
        });
      }

      if (!eoi.implementationStartDate || !eoi.implementationDueDate) {
        return res.status(400).json({
          success: false,
          message: 'Save implementation start date and due date before starting',
        });
      }

      if (eoi.implementationId) {
        const existing = await Implementation.findById(eoi.implementationId);
        if (existing) {
          return res.json({
            success: true,
            message: 'Implementation already started',
            data: { eoi, implementation: existing },
          });
        }
      }

      const implementation = await Implementation.createFromAwarded({
        title: eoi.title,
        client: eoi.organization,
        description: eoi.description,
        startDate: eoi.implementationStartDate,
        endDate: eoi.implementationDueDate,
        budget: eoi.value,
        assignedTo: eoi.assignedTo,
        createdBy: req.staffId || null,
      });

      const updatedEOI = await EOI.update(eoi.dbId, {
        implementationId: implementation.dbId,
        status: 'accepted',
      });

      res.status(201).json({
        success: true,
        message: 'Implementation started successfully',
        data: {
          eoi: updatedEOI,
          implementation,
        },
      });
    } catch (error) {
      console.error('Start EOI implementation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start implementation',
        error: error.message,
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

