import SupplierInvoice from '../models/SupplierInvoice.js';

export class SupplierInvoiceController {
  static async createSupplierInvoice(req, res) {
    try {
      const {
        invoiceId, supplierName, supplierId, projectId, invoiceNumber, invoiceDate,
        receivedDate, dueDate, amount, currency, taxAmount, totalAmount, status,
        paymentId, paymentDate, paymentMethod, description, items, category,
        approvedBy, approvedByName, approvalDate, notes
      } = req.body;

      const user = req.user || {};
      const receivedBy = user.id || req.staffId || null;
      const receivedByName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;

      if (!supplierName || !invoiceNumber || !invoiceDate || !receivedDate || !dueDate || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Supplier name, invoice number, dates, and amount are required'
        });
      }

      const invoice = await SupplierInvoice.create({
        invoiceId, supplierName, supplierId, projectId, invoiceNumber, invoiceDate,
        receivedDate, dueDate, amount, currency: currency || 'USD', taxAmount, totalAmount,
        status: status || 'pending', paymentId, paymentDate, paymentMethod,
        description, items, category, receivedBy, receivedByName,
        approvedBy, approvedByName, approvalDate, notes
      });

      res.status(201).json({
        success: true,
        message: 'Supplier invoice created successfully',
        data: invoice
      });
    } catch (error) {
      console.error('Create supplier invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create supplier invoice',
        error: error.message
      });
    }
  }

  static async getSupplierInvoices(req, res) {
    try {
      const { supplierName, supplierId, projectId, status, category, search, startDate, endDate, page = 1, limit = 50 } = req.query;
      const filters = {
        supplierName, supplierId: supplierId ? parseInt(supplierId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined, status, category, search, startDate, endDate,
        limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit)
      };
      const invoices = await SupplierInvoice.findAll(filters);
      const stats = await SupplierInvoice.getStats(filters);
      res.json({
        success: true,
        data: invoices,
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
      console.error('Get supplier invoices error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch supplier invoices', error: error.message });
    }
  }

  static async getSupplierInvoiceById(req, res) {
    try {
      const { id } = req.params;
      const invoice = await SupplierInvoice.findById(parseInt(id));
      if (!invoice) return res.status(404).json({ success: false, message: 'Supplier invoice not found' });
      res.json({ success: true, data: invoice });
    } catch (error) {
      console.error('Get supplier invoice error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch supplier invoice', error: error.message });
    }
  }

  static async updateSupplierInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await SupplierInvoice.findById(parseInt(id));
      if (!invoice) return res.status(404).json({ success: false, message: 'Supplier invoice not found' });
      const updatedInvoice = await SupplierInvoice.update(parseInt(id), req.body);
      res.json({ success: true, message: 'Supplier invoice updated successfully', data: updatedInvoice });
    } catch (error) {
      console.error('Update supplier invoice error:', error);
      res.status(500).json({ success: false, message: 'Failed to update supplier invoice', error: error.message });
    }
  }

  static async deleteSupplierInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await SupplierInvoice.findById(parseInt(id));
      if (!invoice) return res.status(404).json({ success: false, message: 'Supplier invoice not found' });
      await SupplierInvoice.delete(parseInt(id));
      res.json({ success: true, message: 'Supplier invoice deleted successfully' });
    } catch (error) {
      console.error('Delete supplier invoice error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete supplier invoice', error: error.message });
    }
  }
}
