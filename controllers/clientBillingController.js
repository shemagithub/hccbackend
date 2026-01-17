import ClientBilling from '../models/ClientBilling.js';

export class ClientBillingController {
  // Create a new client billing
  static async createClientBilling(req, res) {
    try {
      const {
        billingId,
        clientId,
        projectId,
        billingDate,
        dueDate,
        amount,
        currency,
        status,
        invoiceId,
        description,
        paymentDate,
        paymentMethod,
        referenceNumber,
        notes
      } = req.body;

      // Get user info from request (set by auth middleware)
      const user = req.user || {};
      const createdBy = user.id || null;
      const createdByName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;

      if (!clientId || !billingDate || !dueDate || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Client ID, billing date, due date, and amount are required'
        });
      }

      const billing = await ClientBilling.create({
        billingId,
        clientId,
        projectId,
        billingDate,
        dueDate,
        amount,
        currency: currency || 'USD',
        status: status || 'draft',
        invoiceId,
        description,
        paymentDate,
        paymentMethod,
        referenceNumber,
        notes,
        createdBy,
        createdByName
      });

      res.status(201).json({
        success: true,
        message: 'Client billing created successfully',
        data: billing
      });
    } catch (error) {
      console.error('Create client billing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create client billing',
        error: error.message
      });
    }
  }

  // Get all client billings
  static async getClientBillings(req, res) {
    try {
      const {
        clientId,
        projectId,
        status,
        search,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        clientId: clientId ? parseInt(clientId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        status,
        search,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const billings = await ClientBilling.findAll(filters);
      const stats = await ClientBilling.getStats(filters);

      res.json({
        success: true,
        data: billings,
        stats: {
          total: stats.total || 0,
          totalPaid: parseFloat(stats.totalPaid || 0),
          totalOverdue: parseFloat(stats.totalOverdue || 0),
          totalPending: parseFloat(stats.totalPending || 0),
          totalAmount: parseFloat(stats.totalAmount || 0)
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        }
      });
    } catch (error) {
      console.error('Get client billings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client billings',
        error: error.message
      });
    }
  }

  // Get client billing by ID
  static async getClientBillingById(req, res) {
    try {
      const { id } = req.params;
      const billing = await ClientBilling.findById(parseInt(id));

      if (!billing) {
        return res.status(404).json({
          success: false,
          message: 'Client billing not found'
        });
      }

      res.json({
        success: true,
        data: billing
      });
    } catch (error) {
      console.error('Get client billing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client billing',
        error: error.message
      });
    }
  }

  // Update client billing
  static async updateClientBilling(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const billing = await ClientBilling.findById(parseInt(id));
      if (!billing) {
        return res.status(404).json({
          success: false,
          message: 'Client billing not found'
        });
      }

      const updatedBilling = await ClientBilling.update(parseInt(id), updates);

      res.json({
        success: true,
        message: 'Client billing updated successfully',
        data: updatedBilling
      });
    } catch (error) {
      console.error('Update client billing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update client billing',
        error: error.message
      });
    }
  }

  // Delete client billing
  static async deleteClientBilling(req, res) {
    try {
      const { id } = req.params;
      const billing = await ClientBilling.findById(parseInt(id));

      if (!billing) {
        return res.status(404).json({
          success: false,
          message: 'Client billing not found'
        });
      }

      await ClientBilling.delete(parseInt(id));

      res.json({
        success: true,
        message: 'Client billing deleted successfully'
      });
    } catch (error) {
      console.error('Delete client billing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete client billing',
        error: error.message
      });
    }
  }

  // Get client billing statistics
  static async getClientBillingStats(req, res) {
    try {
      const {
        clientId,
        projectId,
        startDate,
        endDate
      } = req.query;

      const filters = {
        clientId: clientId ? parseInt(clientId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        startDate,
        endDate
      };

      const stats = await ClientBilling.getStats(filters);

      res.json({
        success: true,
        data: {
          total: stats.total || 0,
          totalPaid: parseFloat(stats.totalPaid || 0),
          totalOverdue: parseFloat(stats.totalOverdue || 0),
          totalPending: parseFloat(stats.totalPending || 0),
          totalAmount: parseFloat(stats.totalAmount || 0)
        }
      });
    } catch (error) {
      console.error('Get client billing stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client billing statistics',
        error: error.message
      });
    }
  }
}
