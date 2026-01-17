import SalaryPayment from '../models/SalaryPayment.js';

export class SalaryPaymentController {
  static async createSalaryPayment(req, res) {
    try {
      const {
        paymentId, staffId, paymentPeriod, paymentDate, baseSalary, bonuses, deductions,
        taxes, netSalary, currency, status, paymentMethod, referenceNumber, notes
      } = req.body;

      const user = req.user || {};
      const processedBy = user.id || req.staffId || null;
      const processedByName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;

      if (!staffId || !paymentPeriod || !paymentDate || !baseSalary) {
        return res.status(400).json({
          success: false,
          message: 'Staff ID, payment period, payment date, and base salary are required'
        });
      }

      const payment = await SalaryPayment.create({
        paymentId, staffId, paymentPeriod, paymentDate, baseSalary, bonuses, deductions,
        taxes, netSalary, currency: currency || 'USD', status: status || 'pending',
        paymentMethod, referenceNumber, notes, processedBy, processedByName
      });

      res.status(201).json({
        success: true,
        message: 'Salary payment created successfully',
        data: payment
      });
    } catch (error) {
      console.error('Create salary payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create salary payment',
        error: error.message
      });
    }
  }

  static async getSalaryPayments(req, res) {
    try {
      const { staffId, paymentPeriod, status, search, startDate, endDate, page = 1, limit = 50 } = req.query;
      const filters = {
        staffId: staffId ? parseInt(staffId) : undefined, paymentPeriod, status, search, startDate, endDate,
        limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit)
      };
      const payments = await SalaryPayment.findAll(filters);
      const stats = await SalaryPayment.getStats(filters);
      res.json({
        success: true,
        data: payments,
        stats: {
          total: stats.total || 0,
          totalPaid: parseFloat(stats.totalPaid || 0),
          totalPending: parseFloat(stats.totalPending || 0),
          totalNetSalary: parseFloat(stats.totalNetSalary || 0),
          totalBaseSalary: parseFloat(stats.totalBaseSalary || 0),
          totalBonuses: parseFloat(stats.totalBonuses || 0),
          totalDeductions: parseFloat(stats.totalDeductions || 0),
          totalTaxes: parseFloat(stats.totalTaxes || 0)
        },
        pagination: { page: parseInt(page), limit: parseInt(limit), total: stats.total || 0 }
      });
    } catch (error) {
      console.error('Get salary payments error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch salary payments', error: error.message });
    }
  }

  static async getSalaryPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await SalaryPayment.findById(parseInt(id));
      if (!payment) return res.status(404).json({ success: false, message: 'Salary payment not found' });
      res.json({ success: true, data: payment });
    } catch (error) {
      console.error('Get salary payment error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch salary payment', error: error.message });
    }
  }

  static async updateSalaryPayment(req, res) {
    try {
      const { id } = req.params;
      const payment = await SalaryPayment.findById(parseInt(id));
      if (!payment) return res.status(404).json({ success: false, message: 'Salary payment not found' });
      const updatedPayment = await SalaryPayment.update(parseInt(id), req.body);
      res.json({ success: true, message: 'Salary payment updated successfully', data: updatedPayment });
    } catch (error) {
      console.error('Update salary payment error:', error);
      res.status(500).json({ success: false, message: 'Failed to update salary payment', error: error.message });
    }
  }

  static async deleteSalaryPayment(req, res) {
    try {
      const { id } = req.params;
      const payment = await SalaryPayment.findById(parseInt(id));
      if (!payment) return res.status(404).json({ success: false, message: 'Salary payment not found' });
      await SalaryPayment.delete(parseInt(id));
      res.json({ success: true, message: 'Salary payment deleted successfully' });
    } catch (error) {
      console.error('Delete salary payment error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete salary payment', error: error.message });
    }
  }
}
