import Client from '../models/Client.js';

export class ClientController {
  // Create a new client
  static async createClient(req, res) {
    try {
      const {
        clientId,
        name,
        company,
        email,
        phone,
        address,
        status = 'pending',
        projectsAssigned = 0,
        lastContact,
        accessLevel = 'no_access',
        canViewReports = false,
        canViewTimelines = false,
        canViewInvoices = false,
        canDownloadFiles = false,
        notes
      } = req.body;

      // Validation
      if (!name || !company || !email) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, company, and email are required'
        });
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Check if email already exists
      const existingClient = await Client.findByEmail(email);
      if (existingClient) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }

      // Validate status
      if (!['active', 'inactive', 'pending'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      // Validate access level
      if (!['no_access', 'limited_access', 'full_access'].includes(accessLevel)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid access level value'
        });
      }

      const client = await Client.create({
        clientId,
        name,
        company,
        email,
        phone,
        address,
        status,
        projectsAssigned,
        lastContact,
        accessLevel,
        canViewReports,
        canViewTimelines,
        canViewInvoices,
        canDownloadFiles,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: client
      });
    } catch (error) {
      console.error('Create client error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create client',
        error: error.message
      });
    }
  }

  // Get all clients
  static async getClients(req, res) {
    try {
      const {
        search,
        status,
        accessLevel,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        search,
        status,
        accessLevel,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const clients = await Client.findAll(filters);
      const stats = await Client.getStats();

      res.json({
        success: true,
        data: clients,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          active: stats.active,
          inactive: stats.inactive,
          pending: stats.pending,
          totalProjects: stats.totalProjects
        }
      });
    } catch (error) {
      console.error('Get clients error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clients',
        error: error.message
      });
    }
  }

  // Get client by ID
  static async getClientById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Client ID is required'
        });
      }

      let client = await Client.findById(parseInt(id));
      if (!client) {
        client = await Client.findByClientId(id);
      }
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      res.json({
        success: true,
        data: client
      });
    } catch (error) {
      console.error('Get client by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client',
        error: error.message
      });
    }
  }

  // Update client
  static async updateClient(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Client ID is required'
        });
      }

      let client = await Client.findById(parseInt(id));
      if (!client) {
        client = await Client.findByClientId(id);
      }

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Validate email if provided
      if (updateData.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid email format'
          });
        }

        // Check if email already exists (excluding current client)
        const existingClient = await Client.findByEmail(updateData.email);
        if (existingClient && existingClient.dbId !== client.dbId) {
          return res.status(409).json({
            success: false,
            message: 'Email already exists'
          });
        }
      }

      const dbId = client.dbId || parseInt(id);
      const success = await Client.update(dbId, updateData);

      if (success) {
        const updatedClient = await Client.findById(dbId);
        res.json({
          success: true,
          message: 'Client updated successfully',
          data: updatedClient
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update client'
        });
      }
    } catch (error) {
      console.error('Update client error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update client',
        error: error.message
      });
    }
  }

  // Delete client
  static async deleteClient(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Client ID is required'
        });
      }

      let client = await Client.findById(parseInt(id));
      if (!client) {
        client = await Client.findByClientId(id);
      }
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      const dbId = client.dbId || parseInt(id);
      const success = await Client.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Client deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete client'
        });
      }
    } catch (error) {
      console.error('Delete client error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete client',
        error: error.message
      });
    }
  }

  // Get client statistics
  static async getClientStats(req, res) {
    try {
      const stats = await Client.getStats();
      
      res.json({
        success: true,
        data: {
          total: stats.total,
          active: stats.active,
          inactive: stats.inactive,
          pending: stats.pending,
          totalProjects: stats.totalProjects
        }
      });
    } catch (error) {
      console.error('Get client stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client statistics',
        error: error.message
      });
    }
  }
}

