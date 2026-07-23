import Expense from '../models/Expense.js';
import Staff from '../models/Staff.js';
import { resolveStaffProjectPermissions } from '../utils/projectTeam.js';

async function resolveExpenseByParamId(id) {
  if (!id) return null;

  if (!Number.isNaN(Number(id))) {
    const byDbId = await Expense.findById(parseInt(id, 10));
    if (byDbId) return byDbId;
  }

  return Expense.findByExpenseId(String(id));
}

export class ExpenseController {
  // Create a new expense
  static async createExpense(req, res) {
    try {
      const {
        expenseId,
        projectId,
        category,
        description,
        amount,
        currency = 'USD',
        expenseDate,
        status = 'pending',
        receiptPath,
        receiptData,
        receiptName,
        receiptType,
        receiptSize,
        vendor,
        invoiceNumber
      } = req.body;

      // Basic validation
      if (!category || !description || !amount || !expenseDate) {
        return res.status(400).json({
          success: false,
          message: 'Category, description, amount, and expense date are required.'
        });
      }

      const permissions = await resolveStaffProjectPermissions(req.staffId, projectId ? parseInt(projectId, 10) : null);
      if (!permissions.canRequestExpenses) {
        return res.status(403).json({
          success: false,
          message: 'Viewers cannot request expenses',
        });
      }

      // Validate category
      const validCategories = ['Personnel', 'Transport & Fuel', 'Field Activities', 'Consultants', 'Materials', 'Equipment', 'Other'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category. Must be one of: Personnel, Transport & Fuel, Field Activities, Consultants, Materials, Equipment, Other.'
        });
      }

      // Validate status
      const validStatuses = ['draft', 'pending', 'approved', 'rejected'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: draft, pending, approved, rejected.'
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

      console.log('Creating expense with data:', {
        category,
        description,
        amount: parseFloat(amount),
        currency,
        expenseDate,
        projectId: projectId || null,
        status,
        hasReceiptData: !!receiptData,
        receiptName,
        receiptType,
        receiptSize,
        vendor,
        invoiceNumber
      });

      const expense = await Expense.create({
        expenseId,
        projectId: projectId || null,
        category,
        description,
        amount: parseFloat(amount),
        currency,
        expenseDate,
        submittedBy: req.staffId || null,
        submittedByName,
        status,
        receiptPath: receiptPath || null,
        receiptData: receiptData || null,
        receiptName: receiptName || null,
        receiptType: receiptType || null,
        receiptSize: receiptSize || null,
        vendor: vendor || null,
        invoiceNumber: invoiceNumber || null
      });

      if (expense?.projectId) {
        await Expense.syncProjectSpentFromExpenses(expense.projectId);
      }

      res.status(201).json({
        success: true,
        message: 'Expense created successfully.',
        data: expense
      });
    } catch (error) {
      console.error('Create expense error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage,
        sqlState: error.sqlState
      });
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create expense.';
      if (error.code === 'ER_NET_PACKET_TOO_LARGE' || error.message?.includes('max_allowed_packet')) {
        errorMessage = error.message || 'Receipt file is too large. Maximum file size is 200MB. Please upload a smaller file or contact your administrator.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && {
          details: {
            sqlMessage: error.sqlMessage,
            sqlState: error.sqlState,
            code: error.code
          }
        })
      });
    }
  }

  // Get all expenses
  static async getExpenses(req, res) {
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

      const expenses = await Expense.findAll(filters);
      const stats = await Expense.getStats();

      res.json({
        success: true,
        data: expenses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          totalAmount: parseFloat(stats.totalAmount || 0),
          pending: stats.pending,
          rejected: stats.rejected,
          approvedAmount: parseFloat(stats.approvedAmount || 0),
          personnelAmount: parseFloat(stats.personnelAmount || 0),
          transportAmount: parseFloat(stats.transportAmount || 0),
          fieldAmount: parseFloat(stats.fieldAmount || 0),
          consultantsAmount: parseFloat(stats.consultantsAmount || 0),
          materialsAmount: parseFloat(stats.materialsAmount || 0)
        }
      });
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expenses.',
        error: error.message
      });
    }
  }

  // Get expense by ID
  static async getExpenseById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Expense ID is required.'
        });
      }

      let expense = await resolveExpenseByParamId(id);

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found.'
        });
      }

      res.json({
        success: true,
        message: 'Expense retrieved successfully.',
        data: expense
      });
    } catch (error) {
      console.error('Get expense by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expense.',
        error: error.message
      });
    }
  }

  // Update expense
  static async updateExpense(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Expense ID is required.'
        });
      }

      const expense = await resolveExpenseByParamId(id);

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found.'
        });
      }

      // Validate category if provided
      if (updateData.category) {
        const validCategories = ['Personnel', 'Transport & Fuel', 'Field Activities', 'Consultants', 'Materials', 'Equipment', 'Other'];
        if (!validCategories.includes(updateData.category)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid category value.'
          });
        }
      }

      // Validate status if provided
      if (updateData.status && !['draft', 'pending', 'approved', 'rejected'].includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be: draft, pending, approved, or rejected.'
        });
      }

      // Get approver info if approvedBy is provided and staffId matches
      if (updateData.approvedBy && req.staffId) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            updateData.approvedByName = `${staff.firstName} ${staff.lastName}`;
            if (!updateData.approvalDate && updateData.status === 'approved') {
              updateData.approvalDate = new Date().toISOString().split('T')[0];
            }
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      // Use dbId for update
      const success = await Expense.update(expense.dbId, updateData);

      if (success) {
        const updatedExpense = await Expense.findById(expense.dbId);
        const projectRef = updatedExpense?.projectId || expense.projectId;
        if (projectRef) {
          await Expense.syncProjectSpentFromExpenses(projectRef);
        }
        if (updateData.projectId && updateData.projectId !== expense.projectId) {
          await Expense.syncProjectSpentFromExpenses(expense.projectId);
        }
        res.json({
          success: true,
          message: 'Expense updated successfully.',
          data: updatedExpense
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update expense.'
        });
      }
    } catch (error) {
      console.error('Update expense error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update expense.',
        error: error.message
      });
    }
  }

  // Delete expense
  static async deleteExpense(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Expense ID is required.'
        });
      }

      const expense = await resolveExpenseByParamId(id);

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found.'
        });
      }

      // Use dbId for delete
      const projectRef = expense.projectId;
      const success = await Expense.delete(expense.dbId);

      if (success) {
        if (projectRef) {
          await Expense.syncProjectSpentFromExpenses(projectRef);
        }
        res.json({
          success: true,
          message: 'Expense deleted successfully.'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete expense.'
        });
      }
    } catch (error) {
      console.error('Delete expense error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete expense.',
        error: error.message
      });
    }
  }

  // Get expense statistics
  static async getExpenseStats(req, res) {
    try {
      const { projectId } = req.query;
      const stats = await Expense.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: {
          total: stats.total,
          totalAmount: parseFloat(stats.totalAmount || 0),
          pending: stats.pending,
          rejected: stats.rejected,
          approvedAmount: parseFloat(stats.approvedAmount || 0),
          personnelAmount: parseFloat(stats.personnelAmount || 0),
          transportAmount: parseFloat(stats.transportAmount || 0),
          fieldAmount: parseFloat(stats.fieldAmount || 0),
          consultantsAmount: parseFloat(stats.consultantsAmount || 0),
          materialsAmount: parseFloat(stats.materialsAmount || 0)
        }
      });
    } catch (error) {
      console.error('Get expense stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expense statistics.',
        error: error.message
      });
    }
  }
}
