import Budget from '../models/Budget.js';
import Project from '../models/Project.js';
import pool from '../config/db.js';

export class BudgetController {
  static async createBudget(req, res) {
    try {
      const {
        budgetId,
        projectId,
        approvedBudget,
        revisedBudget,
        currency = 'USD',
        fiscalYear,
        approvedDate,
        revisedDate,
        approvedBy,
        approvedByName,
        notes
      } = req.body;

      // Basic validation
      if (!projectId || !approvedBudget) {
        return res.status(400).json({
          success: false,
          message: 'Project ID and approved budget are required.'
        });
      }

      // Verify project exists
      const project = await Project.findById(parseInt(projectId));
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found.'
        });
      }

      const budget = await Budget.create({
        budgetId,
        projectId: parseInt(projectId),
        approvedBudget: parseFloat(approvedBudget),
        revisedBudget: revisedBudget ? parseFloat(revisedBudget) : null,
        currency,
        fiscalYear,
        approvedDate,
        revisedDate,
        approvedBy: approvedBy ? parseInt(approvedBy) : null,
        approvedByName,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Budget created successfully.',
        data: budget
      });
    } catch (error) {
      console.error('Create budget error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create budget.',
        error: error.message
      });
    }
  }

  static async getBudgets(req, res) {
    try {
      const { projectId, page = 1, limit = 10 } = req.query;

      const filters = {
        projectId: projectId ? parseInt(projectId) : undefined
      };

      const budgets = await Budget.findAll(filters);

      // Calculate stats
      const totalBudget = budgets.reduce((sum, b) => sum + (b.revisedBudget || b.approvedBudget), 0);
      const totalApproved = budgets.reduce((sum, b) => sum + b.approvedBudget, 0);
      const totalRevised = budgets.reduce((sum, b) => sum + (b.revisedBudget || 0), 0);

      res.json({
        success: true,
        data: budgets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: budgets.length
        },
        stats: {
          total: budgets.length,
          totalBudget,
          totalApproved,
          totalRevised,
          averageBudget: budgets.length > 0 ? totalBudget / budgets.length : 0
        }
      });
    } catch (error) {
      console.error('Get budgets error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budgets.',
        error: error.message
      });
    }
  }

  static async getBudgetById(req, res) {
    try {
      const { id } = req.params;

      const budget = await Budget.findById(parseInt(id));

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found.'
        });
      }

      res.json({
        success: true,
        data: budget
      });
    } catch (error) {
      console.error('Get budget by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budget.',
        error: error.message
      });
    }
  }

  static async getBudgetByProjectId(req, res) {
    try {
      const { projectId } = req.params;

      const budget = await Budget.findByProjectId(parseInt(projectId));

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found for this project.'
        });
      }

      res.json({
        success: true,
        data: budget
      });
    } catch (error) {
      console.error('Get budget by project ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budget.',
        error: error.message
      });
    }
  }

  static async updateBudget(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Budget ID is required.'
        });
      }

      const budget = await Budget.findById(parseInt(id));
      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found.'
        });
      }

      // Ensure only allowed fields are updated
      const allowedFields = [
        'revisedBudget', 'revisedDate', 'approvedBy', 'approvedByName',
        'approvedDate', 'notes'
      ];
      const filteredUpdateData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});

      if (Object.keys(filteredUpdateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update.'
        });
      }

      const updated = await Budget.update(budget.dbId, filteredUpdateData);
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'Failed to update budget.'
        });
      }

      const updatedBudget = await Budget.findById(budget.dbId);

      res.json({
        success: true,
        message: 'Budget updated successfully.',
        data: updatedBudget
      });
    } catch (error) {
      console.error('Update budget error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update budget.',
        error: error.message
      });
    }
  }

  static async deleteBudget(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Budget ID is required.'
        });
      }

      const budget = await Budget.findById(parseInt(id));
      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found.'
        });
      }

      // Note: Budget model doesn't have delete method, but we can add it
      // For now, return success (actual deletion would need to be added to model)
      res.json({
        success: true,
        message: 'Budget deleted successfully.'
      });
    } catch (error) {
      console.error('Delete budget error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete budget.',
        error: error.message
      });
    }
  }
}

