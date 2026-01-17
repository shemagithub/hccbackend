import TaxManagement from '../models/TaxManagement.js';

export class TaxManagementController {
  static async createTax(req, res) {
    try {
      const {
        taxId, taxType, taxName, taxPeriod, dueDate, amount, percentage, currency,
        status, paymentDate, paymentMethod, referenceNumber, filingForm,
        filingStatus, filingDate, description, notes
      } = req.body;

      const user = req.user || {};
      const processedBy = user.id || req.staffId || null;
      const processedByName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;

      if (!taxType || !taxName || !taxPeriod || !dueDate || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Tax type, name, period, due date, and amount are required'
        });
      }

      const tax = await TaxManagement.create({
        taxId, taxType, taxName, taxPeriod, dueDate, amount, percentage,
        currency: currency || 'USD', status: status || 'pending', paymentDate, paymentMethod,
        referenceNumber, filingForm, filingStatus: filingStatus || 'not_filed', filingDate,
        description, notes, processedBy, processedByName
      });

      res.status(201).json({
        success: true,
        message: 'Tax record created successfully',
        data: tax
      });
    } catch (error) {
      console.error('Create tax error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create tax record',
        error: error.message
      });
    }
  }

  static async getTaxes(req, res) {
    try {
      const { taxType, taxPeriod, status, filingStatus, search, startDate, endDate, page = 1, limit = 50 } = req.query;
      const filters = {
        taxType, taxPeriod, status, filingStatus, search, startDate, endDate,
        limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit)
      };
      const taxes = await TaxManagement.findAll(filters);
      const stats = await TaxManagement.getStats(filters);
      res.json({
        success: true,
        data: taxes,
        stats,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: stats.total || 0 }
      });
    } catch (error) {
      console.error('Get taxes error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch taxes', error: error.message });
    }
  }

  static async getTaxById(req, res) {
    try {
      const { id } = req.params;
      const tax = await TaxManagement.findById(parseInt(id));
      if (!tax) return res.status(404).json({ success: false, message: 'Tax record not found' });
      res.json({ success: true, data: tax });
    } catch (error) {
      console.error('Get tax error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch tax record', error: error.message });
    }
  }

  static async updateTax(req, res) {
    try {
      const { id } = req.params;
      const tax = await TaxManagement.findById(parseInt(id));
      if (!tax) return res.status(404).json({ success: false, message: 'Tax record not found' });
      const updatedTax = await TaxManagement.update(parseInt(id), req.body);
      res.json({ success: true, message: 'Tax record updated successfully', data: updatedTax });
    } catch (error) {
      console.error('Update tax error:', error);
      res.status(500).json({ success: false, message: 'Failed to update tax record', error: error.message });
    }
  }

  static async deleteTax(req, res) {
    try {
      const { id } = req.params;
      const tax = await TaxManagement.findById(parseInt(id));
      if (!tax) return res.status(404).json({ success: false, message: 'Tax record not found' });
      await TaxManagement.delete(parseInt(id));
      res.json({ success: true, message: 'Tax record deleted successfully' });
    } catch (error) {
      console.error('Delete tax error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete tax record', error: error.message });
    }
  }
}
