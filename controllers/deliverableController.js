import Deliverable from '../models/Deliverable.js';
import Staff from '../models/Staff.js';
import Review from '../models/Review.js';

export class DeliverableController {
  // Create a new deliverable
  static async createDeliverable(req, res) {
    try {
      const {
        deliverableId,
        projectId,
        type,
        category = 'Document',
        title,
        description,
        submissionDate,
        status = 'draft',
        filePath,
        fileData,
        fileName,
        fileType,
        fileSize,
        version = '1.0',
        priority = 'medium'
      } = req.body;

      // Basic validation
      if (!type || !title || !submissionDate) {
        return res.status(400).json({
          success: false,
          message: 'Type, title, and submission date are required.'
        });
      }

      // Get submitter info if staffId is available
      let submittedByName = null;
      if (req.staffId) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            submittedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const deliverable = await Deliverable.create({
        deliverableId,
        projectId: projectId || null,
        type,
        category,
        title,
        description,
        submittedBy: req.staffId || null,
        submittedByName,
        submissionDate,
        status,
        filePath: filePath || null,
        fileData: fileData || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize || null,
        version,
        priority
      });

      // Auto-create review when deliverable is submitted for review
      if (status === 'pending_review' || status === 'under_review') {
        try {
          await Review.create({
            itemType: 'deliverable',
            itemId: deliverable.dbId,
            itemReference: deliverable.id,
            projectId: deliverable.projectId,
            title: title,
            description: description,
            submittedBy: req.staffId || null,
            submittedByName: submittedByName,
            submissionDate: submissionDate || new Date().toISOString().split('T')[0],
            status: status,
            priority: priority
          });
        } catch (reviewError) {
          console.error('Error creating review for deliverable:', reviewError);
          // Continue even if review creation fails
        }
      }

      res.status(201).json({
        success: true,
        message: 'Deliverable created successfully.',
        data: deliverable
      });
    } catch (error) {
      console.error('Create deliverable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create deliverable.',
        error: error.message
      });
    }
  }

  // Get all deliverables
  static async getDeliverables(req, res) {
    try {
      const {
        search,
        projectId,
        category,
        status,
        startDate,
        endDate,
        departmentId,
        departmentName,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : undefined,
        category,
        status,
        startDate,
        endDate,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        departmentName,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const deliverables = await Deliverable.findAll(filters);
      const stats = await Deliverable.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: deliverables,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total || 0,
          pending: stats.pendingReview || 0,
          approved: stats.approved || 0,
          rejected: stats.rejected || 0,
          underReview: stats.underReview || 0,
          revisionRequested: stats.revisionRequested || 0
        }
      });
    } catch (error) {
      console.error('Get deliverables error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deliverables.',
        error: error.message
      });
    }
  }

  // Get deliverable by ID
  static async getDeliverableById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Deliverable ID is required.'
        });
      }

      // Try to find by database ID first
      let deliverable = await Deliverable.findById(parseInt(id));
      
      // If not found by database ID, try to find by deliverable_id
      if (!deliverable && isNaN(id)) {
        deliverable = await Deliverable.findByDeliverableId(id);
      }

      if (!deliverable) {
        return res.status(404).json({
          success: false,
          message: 'Deliverable not found.'
        });
      }

      res.json({
        success: true,
        message: 'Deliverable retrieved successfully.',
        data: deliverable
      });
    } catch (error) {
      console.error('Get deliverable by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deliverable.',
        error: error.message
      });
    }
  }

  // Update deliverable
  static async updateDeliverable(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Deliverable ID is required.'
        });
      }

      // Try to find by database ID first
      let deliverable = await Deliverable.findById(parseInt(id));
      
      // If not found by database ID, try to find by deliverable_id
      if (!deliverable && isNaN(id)) {
        deliverable = await Deliverable.findByDeliverableId(id);
      }

      if (!deliverable) {
        return res.status(404).json({
          success: false,
          message: 'Deliverable not found.'
        });
      }

      // Get reviewer info if provided
      if (updateData.reviewedBy && !updateData.reviewedByName) {
        try {
          const staff = await Staff.findById(updateData.reviewedBy);
          if (staff) {
            updateData.reviewedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = deliverable.dbId || parseInt(id);
      const success = await Deliverable.update(dbId, updateData);

      if (success) {
        const updatedDeliverable = await Deliverable.findById(dbId);
        res.json({
          success: true,
          message: 'Deliverable updated successfully.',
          data: updatedDeliverable
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update deliverable.'
        });
      }
    } catch (error) {
      console.error('Update deliverable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update deliverable.',
        error: error.message
      });
    }
  }

  // Delete deliverable
  static async deleteDeliverable(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Deliverable ID is required.'
        });
      }

      // Try to find by database ID first
      let deliverable = await Deliverable.findById(parseInt(id));
      
      // If not found by database ID, try to find by deliverable_id
      if (!deliverable && isNaN(id)) {
        deliverable = await Deliverable.findByDeliverableId(id);
      }

      if (!deliverable) {
        return res.status(404).json({
          success: false,
          message: 'Deliverable not found.'
        });
      }

      const dbId = deliverable.dbId || parseInt(id);
      const success = await Deliverable.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Deliverable deleted successfully.'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete deliverable.'
        });
      }
    } catch (error) {
      console.error('Delete deliverable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete deliverable.',
        error: error.message
      });
    }
  }

  // Get deliverable statistics
  static async getDeliverableStats(req, res) {
    try {
      const { projectId } = req.query;
      const stats = await Deliverable.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: {
          total: stats.total || 0,
          pending: stats.pendingReview || 0,
          approved: stats.approved || 0,
          rejected: stats.rejected || 0,
          underReview: stats.underReview || 0,
          revisionRequested: stats.revisionRequested || 0
        }
      });
    } catch (error) {
      console.error('Get deliverable stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deliverable statistics.',
        error: error.message
      });
    }
  }
}
