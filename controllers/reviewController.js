import Review from '../models/Review.js';
import Deliverable from '../models/Deliverable.js';
import Expense from '../models/Expense.js';
import Staff from '../models/Staff.js';

export class ReviewController {
  // Create a new review (usually auto-created when item is submitted)
  static async createReview(req, res) {
    try {
      const {
        reviewId,
        itemType,
        itemId,
        itemReference,
        projectId,
        title,
        description,
        submissionDate,
        status = 'pending_review',
        priority = 'medium',
        version = '1.0'
      } = req.body;

      // Basic validation
      if (!itemType || !itemId || !title || !submissionDate) {
        return res.status(400).json({
          success: false,
          message: 'Item type, item ID, title, and submission date are required.'
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

      const review = await Review.create({
        reviewId,
        itemType,
        itemId,
        itemReference,
        projectId: projectId || null,
        title,
        description,
        submittedBy: req.staffId || null,
        submittedByName,
        submissionDate,
        status,
        priority,
        version
      });

      res.status(201).json({
        success: true,
        message: 'Review created successfully.',
        data: review
      });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create review.',
        error: error.message
      });
    }
  }

  // Get all reviews
  static async getReviews(req, res) {
    try {
      const {
        search,
        itemType,
        itemId,
        projectId,
        status,
        pendingOnly,
        submittedBy,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        itemType,
        itemId: itemId ? parseInt(itemId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        status,
        pendingOnly: pendingOnly === 'true' || pendingOnly === true,
        submittedBy: submittedBy ? parseInt(submittedBy) : undefined,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const reviews = await Review.findAll(filters);
      const stats = await Review.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          pending: stats.pendingReview || 0,
          underReview: stats.underReview || 0,
          approved: stats.approved || 0,
          rejected: stats.rejected || 0,
          revisionRequested: stats.revisionRequested || 0
        }
      });
    } catch (error) {
      console.error('Get reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reviews.',
        error: error.message
      });
    }
  }

  // Get review by ID
  static async getReviewById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Review ID is required.'
        });
      }

      // Try to find by database ID first
      let review = await Review.findById(parseInt(id));
      
      // If not found by database ID, try to find by review_id
      if (!review && isNaN(id)) {
        review = await Review.findByReviewId(id);
      }

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found.'
        });
      }

      res.json({
        success: true,
        message: 'Review retrieved successfully.',
        data: review
      });
    } catch (error) {
      console.error('Get review by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch review.',
        error: error.message
      });
    }
  }

  // Update review (approve/reject/revision request)
  static async updateReview(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Review ID is required.'
        });
      }

      // Try to find by database ID first
      let review = await Review.findById(parseInt(id));
      
      // If not found by database ID, try to find by review_id
      if (!review && isNaN(id)) {
        review = await Review.findByReviewId(id);
      }

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found.'
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
      } else if (req.staffId && !updateData.reviewedBy) {
        // Use current user as reviewer
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            updateData.reviewedBy = req.staffId;
            updateData.reviewedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      // Set review date if status is being changed
      if (updateData.status && !updateData.reviewDate) {
        updateData.reviewDate = new Date().toISOString().split('T')[0];
      }

      // Set approval date if approved
      if (updateData.status === 'approved' && !updateData.approvalDate) {
        updateData.approvalDate = new Date().toISOString().split('T')[0];
      }

      const dbId = review.dbId || parseInt(id);
      const success = await Review.update(dbId, updateData);

      if (success) {
        // Update the original item status if needed
        if (updateData.status === 'approved' || updateData.status === 'rejected' || updateData.status === 'revision_requested') {
          try {
            if (review.itemType === 'deliverable') {
              await Deliverable.update(review.itemId, {
                status: updateData.status,
                reviewedBy: updateData.reviewedBy,
                reviewedByName: updateData.reviewedByName,
                reviewDate: updateData.reviewDate,
                reviewComments: updateData.reviewComments || updateData.revisionComments,
                approvalDate: updateData.approvalDate
              });
            } else if (review.itemType === 'expense') {
              await Expense.update(review.itemId, {
                status: updateData.status === 'approved' ? 'approved' : updateData.status === 'rejected' ? 'rejected' : 'pending',
                approvedBy: updateData.reviewedBy,
                approvedByName: updateData.reviewedByName,
                approvalDate: updateData.approvalDate,
                approvalComments: updateData.reviewComments || updateData.revisionComments
              });
            }
          } catch (itemError) {
            console.error('Error updating item status:', itemError);
            // Continue even if item update fails
          }
        }

        const updatedReview = await Review.findById(dbId);
        res.json({
          success: true,
          message: 'Review updated successfully.',
          data: updatedReview
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update review.'
        });
      }
    } catch (error) {
      console.error('Update review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update review.',
        error: error.message
      });
    }
  }

  // Delete review
  static async deleteReview(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Review ID is required.'
        });
      }

      // Try to find by database ID first
      let review = await Review.findById(parseInt(id));
      
      // If not found by database ID, try to find by review_id
      if (!review && isNaN(id)) {
        review = await Review.findByReviewId(id);
      }

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found.'
        });
      }

      const dbId = review.dbId || parseInt(id);
      const success = await Review.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Review deleted successfully.'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete review.'
        });
      }
    } catch (error) {
      console.error('Delete review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete review.',
        error: error.message
      });
    }
  }

  // Get review statistics
  static async getReviewStats(req, res) {
    try {
      const { projectId } = req.query;
      const stats = await Review.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: {
          total: stats.total || 0,
          pending: stats.pendingReview || 0,
          underReview: stats.underReview || 0,
          approved: stats.approved || 0,
          rejected: stats.rejected || 0,
          revisionRequested: stats.revisionRequested || 0
        }
      });
    } catch (error) {
      console.error('Get review stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch review statistics.',
        error: error.message
      });
    }
  }

  // Get reviews by item
  static async getReviewsByItem(req, res) {
    try {
      const { itemType, itemId } = req.params;

      if (!itemType || !itemId) {
        return res.status(400).json({
          success: false,
          message: 'Item type and item ID are required.'
        });
      }

      const reviews = await Review.findByItem(itemType, parseInt(itemId));

      res.json({
        success: true,
        data: reviews
      });
    } catch (error) {
      console.error('Get reviews by item error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reviews.',
        error: error.message
      });
    }
  }
}
