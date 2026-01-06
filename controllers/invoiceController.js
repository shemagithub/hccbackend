import Invoice from '../models/Invoice.js';
import Staff from '../models/Staff.js';

export class InvoiceController {
  // Create a new invoice
  static async createInvoice(req, res) {
    try {
      const {
        invoiceId,
        clientId,
        projectId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        status = 'draft',
        subtotal = 0,
        taxRate = 0,
        taxAmount = 0,
        discount = 0,
        totalAmount = 0,
        currency = 'USD',
        description,
        items,
        sentDate,
        paidDate,
        paymentMethod,
        notes
      } = req.body;

      // Basic validation
      if (!invoiceNumber || !invoiceDate || !dueDate) {
        return res.status(400).json({
          success: false,
          message: 'Invoice number, invoice date, and due date are required.'
        });
      }

      // Get creator info if staffId is available
      let createdByName = null;
      if (req.staffId) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            createdByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const invoice = await Invoice.create({
        invoiceId,
        clientId: clientId || null,
        projectId: projectId || null,
        invoiceNumber,
        invoiceDate,
        dueDate,
        status,
        subtotal,
        taxRate,
        taxAmount,
        discount,
        totalAmount,
        currency,
        description,
        items,
        createdBy: req.staffId || null,
        createdByName,
        sentDate,
        paidDate,
        paymentMethod,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully.',
        data: invoice
      });
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create invoice.',
        error: error.message
      });
    }
  }

  // Get all invoices
  static async getInvoices(req, res) {
    try {
      const {
        search,
        clientId,
        projectId,
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
        clientId: clientId ? parseInt(clientId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        status,
        startDate,
        endDate,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        departmentName,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const invoices = await Invoice.findAll(filters);
      const stats = await Invoice.getStats();

      res.json({
        success: true,
        data: invoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          paid: stats.paid,
          pending: stats.pending,
          overdue: stats.overdue,
          totalAmount: parseFloat(stats.totalAmount || 0),
          paidAmount: parseFloat(stats.paidAmount || 0)
        }
      });
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoices.',
        error: error.message
      });
    }
  }

  // Get invoice by ID
  static async getInvoiceById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Invoice ID is required.'
        });
      }

      // Try to find by database ID first, then by invoice_id
      let invoice = await Invoice.findById(parseInt(id));
      if (!invoice) {
        invoice = await Invoice.findByInvoiceId(id);
      }

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found.'
        });
      }

      res.json({
        success: true,
        message: 'Invoice retrieved successfully.',
        data: invoice
      });
    } catch (error) {
      console.error('Get invoice by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice.',
        error: error.message
      });
    }
  }

  // Update invoice
  static async updateInvoice(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Invoice ID is required.'
        });
      }

      // Try to find by database ID first, then by invoice_id
      let invoice = await Invoice.findById(parseInt(id));
      if (!invoice) {
        invoice = await Invoice.findByInvoiceId(id);
      }

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found.'
        });
      }

      // Validate status if provided
      if (updateData.status && !['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be: draft, sent, paid, overdue, or cancelled.'
        });
      }

      // Validate payment method if provided
      if (updateData.paymentMethod && !['bank_transfer', 'check', 'cash', 'credit_card', 'other'].includes(updateData.paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment method value.'
        });
      }

      const success = await Invoice.update(invoice.id, updateData);

      if (success) {
        const updatedInvoice = await Invoice.findById(invoice.id);
        res.json({
          success: true,
          message: 'Invoice updated successfully.',
          data: updatedInvoice
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update invoice.'
        });
      }
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update invoice.',
        error: error.message
      });
    }
  }

  // Delete invoice
  static async deleteInvoice(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Invoice ID is required.'
        });
      }

      // Try to find by database ID first, then by invoice_id
      let invoice = await Invoice.findById(parseInt(id));
      if (!invoice) {
        invoice = await Invoice.findByInvoiceId(id);
      }

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found.'
        });
      }

      const success = await Invoice.delete(invoice.id);

      if (success) {
        res.json({
          success: true,
          message: 'Invoice deleted successfully.'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete invoice.'
        });
      }
    } catch (error) {
      console.error('Delete invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete invoice.',
        error: error.message
      });
    }
  }

  // Get invoice statistics
  static async getInvoiceStats(req, res) {
    try {
      const stats = await Invoice.getStats();

      res.json({
        success: true,
        data: {
          total: stats.total,
          paid: stats.paid,
          pending: stats.pending,
          overdue: stats.overdue,
          totalAmount: parseFloat(stats.totalAmount || 0),
          paidAmount: parseFloat(stats.paidAmount || 0)
        }
      });
    } catch (error) {
      console.error('Get invoice stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice statistics.',
        error: error.message
      });
    }
  }
}

