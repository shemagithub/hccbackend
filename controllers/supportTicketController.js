import SupportTicket from '../models/SupportTicket.js';
import TicketMessage from '../models/TicketMessage.js';
import Staff from '../models/Staff.js';

export const getSupportTickets = async (req, res) => {
  try {
    const filters = {};
    
    // Get logged-in user info
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance' && staff.role !== 'admin') {
        filters.submittedBy = req.staffId;
      }
    }

    if (req.query.search) filters.search = req.query.search;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.submittedBy) filters.submittedBy = parseInt(req.query.submittedBy);
    if (req.query.assignedTo) filters.assignedTo = parseInt(req.query.assignedTo);
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const tickets = await SupportTicket.findAll(filters);
    
    // Get messages for each ticket
    const ticketsWithMessages = await Promise.all(
      tickets.map(async (ticket) => {
        const messages = await TicketMessage.findByTicketId(ticket.dbId);
        return { ...ticket, messages };
      })
    );

    res.json({ success: true, data: ticketsWithMessages });
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch support tickets', error: error.message });
  }
};

export const getSupportTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    let ticket = null;

    // Try to parse as integer first (database ID)
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      ticket = await SupportTicket.findById(numericId);
    }

    // If not found by numeric ID, try to find by ticketId (e.g., "TICKET-0001")
    if (!ticket && id) {
      ticket = await SupportTicket.findByTicketId(id);
    }

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    // Get messages for this ticket
    const messages = await TicketMessage.findByTicketId(ticket.dbId);

    res.json({ success: true, data: { ...ticket, messages } });
  } catch (error) {
    console.error('Get support ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch support ticket', error: error.message });
  }
};

export const createSupportTicket = async (req, res) => {
  try {
    const {
      title, description, category, priority = 'medium',
      submittedByEmail, attachments
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ success: false, message: 'Missing required fields: title, description, and category are required' });
    }

    // Ensure staffId is a number
    const staffId = req.staffId ? parseInt(req.staffId) : null;
    let submittedByName = null;
    let submittedByEmailFinal = submittedByEmail;

    if (staffId) {
      const staff = await Staff.findById(staffId);
      if (staff) {
        submittedByName = `${staff.firstName} ${staff.lastName}`;
        submittedByEmailFinal = staff.email;
      }
    }

    const ticket = await SupportTicket.create({
      title,
      description,
      category,
      priority,
      submittedBy: staffId,
      submittedByName,
      submittedByEmail: submittedByEmailFinal,
      attachments: attachments || null,
      status: 'open'
    });

    // Create initial message
    await TicketMessage.create({
      ticketId: ticket.dbId,
      message: description,
      authorId: staffId,
      authorName: submittedByName || 'Customer',
      authorType: staffId ? 'customer' : 'customer'
    });

    res.status(201).json({ success: true, data: ticket, message: 'Support ticket created successfully' });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create support ticket', 
      error: error.message 
    });
  }
};

export const updateSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If status is being set to resolved, set resolved_at
    if (updates.status === 'resolved' && !updates.resolvedAt) {
      updates.resolved_at = new Date().toISOString();
    }

    const updated = await SupportTicket.update(parseInt(id), updates);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No changes made' });
    }

    const ticket = await SupportTicket.findById(parseInt(id));
    const messages = await TicketMessage.findByTicketId(ticket.dbId);

    res.json({ success: true, data: { ...ticket, messages }, message: 'Support ticket updated successfully' });
  } catch (error) {
    console.error('Update support ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to update support ticket', error: error.message });
  }
};

export const deleteSupportTicket = async (req, res) => {
  try {
    const deleted = await SupportTicket.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }
    res.json({ success: true, message: 'Support ticket deleted successfully' });
  } catch (error) {
    console.error('Delete support ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete support ticket', error: error.message });
  }
};

export const addTicketMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachments } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const ticket = await SupportTicket.findById(parseInt(id));
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    const staffId = req.staffId ? parseInt(req.staffId) : null;
    let authorName = 'Customer';
    let authorType = 'customer';

    if (staffId) {
      const staff = await Staff.findById(staffId);
      if (staff) {
        authorName = `${staff.firstName} ${staff.lastName}`;
        // Check if user is admin/superadmin/finance - they are support agents
        if (['superadmin', 'admin', 'finance'].includes(staff.role)) {
          authorType = 'support_agent';
        }
      }
    }

    const ticketMessage = await TicketMessage.create({
      ticketId: ticket.dbId,
      message,
      authorId: staffId,
      authorName,
      authorType,
      attachments: attachments || null
    });

    // Update ticket's updated_at timestamp
    await SupportTicket.update(parseInt(id), {});

    res.status(201).json({ success: true, data: ticketMessage, message: 'Message added successfully' });
  } catch (error) {
    console.error('Add ticket message error:', error);
    res.status(500).json({ success: false, message: 'Failed to add message', error: error.message });
  }
};

export const getTicketStats = async (req, res) => {
  try {
    const filters = {};
    
    if (req.staffId) {
      const staff = await Staff.findById(req.staffId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'finance' && staff.role !== 'admin') {
        filters.submittedBy = req.staffId;
      }
    }

    const stats = await SupportTicket.getStats(filters);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket stats', error: error.message });
  }
};
