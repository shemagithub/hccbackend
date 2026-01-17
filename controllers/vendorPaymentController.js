import VendorPayment from '../models/VendorPayment.js';

export class VendorPaymentController {
  static async createVendorPayment(req, res) {
    try {
      const {
        paymentId, vendorName, vendorId, projectId, invoiceNumber, invoiceDate,
        amount, currency, dueDate, paymentDate, status, paymentMethod,
        referenceNumber, description, category, approvedBy, approvedByName, approvalDate, notes
      } = req.body;

      const user = req.user || {};
      const requestedBy = user.id || req.staffId || null;
      const requestedByName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;

      if (!vendorName || !amount || !dueDate) {
        return res.status(400).json({
          success: false,
          message: 'Vendor name, amount, and due date are required'
        });
      }

      const payment = await VendorPayment.create({
        paymentId, vendorName, vendorId, projectId, invoiceNumber, invoiceDate,
        amount, currency: currency || 'USD', dueDate, paymentDate,
        status: status || 'pending_approval', paymentMethod, referenceNumber,
        description, category, requestedBy, requestedByName,
        approvedBy, approvedByName, approvalDate, notes
      });

      res.status(201).json({
        success: true,
        message: 'Vendor payment created successfully',
        data: payment
      });
    } catch (error) {
      console.error('Create vendor payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create vendor payment',
        error: error.message
      });
    }
  }

  static async getVendorPayments(req, res) {
    try {
      const { vendorName, vendorId, projectId, status, category, search, startDate, endDate, page = 1, limit = 50 } = req.query;
      const filters = {
        vendorName, vendorId: vendorId ? parseInt(vendorId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined, status, category, search, startDate, endDate,
        limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit)
      };
      const payments = await VendorPayment.findAll(filters);
      const stats = await VendorPayment.getStats(filters);
      res.json({
        success: true,
        data: payments,
        stats: {
          total: stats.total || 0,
          totalPaid: parseFloat(stats.totalPaid || 0),
          totalOverdue: parseFloat(stats.totalOverdue || 0),
          totalPending: parseFloat(stats.totalPending || 0),
          totalAmount: parseFloat(stats.totalAmount || 0)
        },
        pagination: { page: parseInt(page), limit: parseInt(limit), total: stats.total || 0 }
      });
    } catch (error) {
      console.error('Get vendor payments error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch vendor payments', error: error.message });
    }
  }

  static async getVendorPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await VendorPayment.findById(parseInt(id));
      if (!payment) return res.status(404).json({ success: false, message: 'Vendor payment not found' });
      res.json({ success: true, data: payment });
    } catch (error) {
      console.error('Get vendor payment error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch vendor payment', error: error.message });
    }
  }

  static async updateVendorPayment(req, res) {
    try {
      const { id } = req.params;
      const payment = await VendorPayment.findById(parseInt(id));
      if (!payment) return res.status(404).json({ success: false, message: 'Vendor payment not found' });
      const updatedPayment = await VendorPayment.update(parseInt(id), req.body);
      res.json({ success: true, message: 'Vendor payment updated successfully', data: updatedPayment });
    } catch (error) {
      console.error('Update vendor payment error:', error);
      res.status(500).json({ success: false, message: 'Failed to update vendor payment', error: error.message });
    }
  }

  static async deleteVendorPayment(req, res) {
    try {
      const { id } = req.params;
      const payment = await VendorPayment.findById(parseInt(id));
      if (!payment) return res.status(404).json({ success: false, message: 'Vendor payment not found' });
      await VendorPayment.delete(parseInt(id));
      res.json({ success: true, message: 'Vendor payment deleted successfully' });
    } catch (error) {
      console.error('Delete vendor payment error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete vendor payment', error: error.message });
    }
  }
}
