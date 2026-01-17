import Milestone from '../models/Milestone.js';
import pool from '../config/db.js';

export class MilestoneController {
  static async createMilestone(req, res) {
    try {
      const {
        milestoneId,
        projectId,
        name,
        description,
        phase,
        targetDate,
        actualDate,
        status,
        progress,
        notes
      } = req.body;

      if (!name || !targetDate) {
        return res.status(400).json({
          success: false,
          message: 'Name and target date are required'
        });
      }

      const staffInfo = req.user?.staffInfo || {};
      const milestone = await Milestone.create({
        milestoneId,
        projectId: projectId || null,
        name,
        description: description || null,
        phase: phase || null,
        targetDate,
        actualDate: actualDate || null,
        status: status || 'pending',
        progress: progress || 0,
        createdBy: staffInfo.id || null,
        createdByName: staffInfo.firstName && staffInfo.lastName 
          ? `${staffInfo.firstName} ${staffInfo.lastName}` 
          : null,
        notes: notes || null
      });

      res.status(201).json({
        success: true,
        message: 'Milestone created successfully',
        data: milestone
      });
    } catch (error) {
      console.error('Error creating milestone:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create milestone'
      });
    }
  }

  static async getMilestones(req, res) {
    try {
      const filters = {
        projectId: req.query.projectId ? parseInt(req.query.projectId) : undefined,
        status: req.query.status,
        search: req.query.search,
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const milestones = await Milestone.findAll(filters);
      const stats = await Milestone.getStats({ projectId: filters.projectId });

      res.json({
        success: true,
        data: milestones,
        stats,
        pagination: {
          total: milestones.length,
          limit: filters.limit,
          offset: filters.offset
        }
      });
    } catch (error) {
      console.error('Error fetching milestones:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch milestones'
      });
    }
  }

  static async getMilestoneById(req, res) {
    try {
      const { id } = req.params;
      const milestone = await Milestone.findById(id);

      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Milestone not found'
        });
      }

      res.json({
        success: true,
        data: milestone
      });
    } catch (error) {
      console.error('Error fetching milestone:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch milestone'
      });
    }
  }

  static async updateMilestone(req, res) {
    try {
      const { id } = req.params;
      const updateData = {};

      const allowedFields = ['projectId', 'name', 'description', 'phase', 'targetDate', 'actualDate', 'status', 'progress', 'notes'];
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      const updated = await Milestone.update(id, updateData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Milestone not found or no changes made'
        });
      }

      const milestone = await Milestone.findById(id);

      res.json({
        success: true,
        message: 'Milestone updated successfully',
        data: milestone
      });
    } catch (error) {
      console.error('Error updating milestone:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update milestone'
      });
    }
  }

  static async deleteMilestone(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Milestone.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Milestone not found'
        });
      }

      res.json({
        success: true,
        message: 'Milestone deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting milestone:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete milestone'
      });
    }
  }
}
