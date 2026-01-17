import Deduction from '../models/Deduction.js';

export class DeductionController {
  static async createDeduction(req, res) {
    try {
      const {
        deductionId, staffId, deductionType, name, amount, percentage, currency,
        paymentPeriod, effectiveDate, endDate, status, description, notes
      } = req.body;

      const user = req.user || {};
      const createdBy = user.id || req.staffId || null;
      const createdByName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;

      if (!staffId || !deductionType || !name || !amount || !effectiveDate) {
        return res.status(400).json({
          success: false,
          message: 'Staff ID, deduction type, name, amount, and effective date are required'
        });
      }

      const deduction = await Deduction.create({
        deductionId, staffId, deductionType, name, amount, percentage,
        currency: currency || 'USD', paymentPeriod, effectiveDate, endDate,
        status: status || 'active', description, notes, createdBy, createdByName
      });

      res.status(201).json({
        success: true,
        message: 'Deduction created successfully',
        data: deduction
      });
    } catch (error) {
      console.error('Create deduction error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create deduction',
        error: error.message
      });
    }
  }

  static async getDeductions(req, res) {
    try {
      const { staffId, deductionType, status, paymentPeriod, search, page = 1, limit = 50 } = req.query;
      const filters = {
        staffId: staffId ? parseInt(staffId) : undefined, deductionType, status, paymentPeriod, search,
        limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit)
      };
      const deductions = await Deduction.findAll(filters);
      const stats = await Deduction.getStats(filters);
      res.json({
        success: true,
        data: deductions,
        stats,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: stats.total || 0 }
      });
    } catch (error) {
      console.error('Get deductions error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch deductions', error: error.message });
    }
  }

  static async getDeductionById(req, res) {
    try {
      const { id } = req.params;
      const deduction = await Deduction.findById(parseInt(id));
      if (!deduction) return res.status(404).json({ success: false, message: 'Deduction not found' });
      res.json({ success: true, data: deduction });
    } catch (error) {
      console.error('Get deduction error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch deduction', error: error.message });
    }
  }

  static async updateDeduction(req, res) {
    try {
      const { id } = req.params;
      const deduction = await Deduction.findById(parseInt(id));
      if (!deduction) return res.status(404).json({ success: false, message: 'Deduction not found' });
      const updatedDeduction = await Deduction.update(parseInt(id), req.body);
      res.json({ success: true, message: 'Deduction updated successfully', data: updatedDeduction });
    } catch (error) {
      console.error('Update deduction error:', error);
      res.status(500).json({ success: false, message: 'Failed to update deduction', error: error.message });
    }
  }

  static async deleteDeduction(req, res) {
    try {
      const { id } = req.params;
      const deduction = await Deduction.findById(parseInt(id));
      if (!deduction) return res.status(404).json({ success: false, message: 'Deduction not found' });
      await Deduction.delete(parseInt(id));
      res.json({ success: true, message: 'Deduction deleted successfully' });
    } catch (error) {
      console.error('Delete deduction error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete deduction', error: error.message });
    }
  }
}
