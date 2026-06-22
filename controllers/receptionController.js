import Staff from '../models/Staff.js';
import {
  ReceptionVisitor,
  ReceptionAppointment,
  ReceptionCall,
  getReceptionStats,
} from '../models/Reception.js';

async function staffMeta(req) {
  if (!req.staffId) return { createdBy: null, createdByName: null };
  const staff = await Staff.findById(req.staffId);
  if (!staff) return { createdBy: req.staffId, createdByName: null };
  return {
    createdBy: staff.dbId || staff.id,
    createdByName: `${staff.firstName || ''} ${staff.lastName || ''}`.trim(),
  };
}

export const getStats = async (req, res) => {
  try {
    const stats = await getReceptionStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Visitors ---
export const listVisitors = async (req, res) => {
  try {
    const data = await ReceptionVisitor.findAll({
      status: req.query.status,
      search: req.query.search,
      date: req.query.date,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 500,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getVisitor = async (req, res) => {
  try {
    const item = await ReceptionVisitor.findById(parseInt(req.params.id, 10));
    if (!item) return res.status(404).json({ success: false, message: 'Visitor not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createVisitor = async (req, res) => {
  try {
    const { name, company, hostName, purpose, phone, badgeNumber } = req.body;
    if (!name || !hostName || !purpose) {
      return res.status(400).json({ success: false, message: 'Name, host, and purpose are required' });
    }
    const meta = await staffMeta(req);
    const item = await ReceptionVisitor.create({
      name,
      company,
      hostName,
      purpose,
      phone,
      badgeNumber,
      checkInAt: new Date(),
      status: 'checked_in',
      ...meta,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateVisitor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await ReceptionVisitor.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Visitor not found' });

    const payload = { ...req.body };
    if (payload.status === 'checked_out' && !payload.checkOutAt) {
      payload.checkOutAt = new Date();
    }
    const item = await ReceptionVisitor.update(id, payload);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteVisitor = async (req, res) => {
  try {
    await ReceptionVisitor.delete(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Visitor deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Appointments ---
export const listAppointments = async (req, res) => {
  try {
    const data = await ReceptionAppointment.findAll({
      status: req.query.status,
      search: req.query.search,
      date: req.query.date,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 500,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAppointment = async (req, res) => {
  try {
    const item = await ReceptionAppointment.findById(parseInt(req.params.id, 10));
    if (!item) return res.status(404).json({ success: false, message: 'Appointment not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAppointment = async (req, res) => {
  try {
    const { visitorName, hostName, purpose, date, time, phone, notes } = req.body;
    if (!visitorName || !hostName || !date || !time) {
      return res.status(400).json({ success: false, message: 'Visitor, host, date, and time are required' });
    }
    const meta = await staffMeta(req);
    const item = await ReceptionAppointment.create({
      visitorName,
      hostName,
      purpose,
      date,
      time,
      phone,
      notes,
      status: 'scheduled',
      ...meta,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAppointment = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await ReceptionAppointment.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Appointment not found' });
    const item = await ReceptionAppointment.update(id, req.body);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAppointment = async (req, res) => {
  try {
    await ReceptionAppointment.delete(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Calls ---
export const listCalls = async (req, res) => {
  try {
    const data = await ReceptionCall.findAll({
      direction: req.query.direction,
      search: req.query.search,
      date: req.query.date,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 500,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCall = async (req, res) => {
  try {
    const item = await ReceptionCall.findById(parseInt(req.params.id, 10));
    if (!item) return res.status(404).json({ success: false, message: 'Call log not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCall = async (req, res) => {
  try {
    const { callerName, phone, direction, purpose, notes } = req.body;
    if (!callerName || !phone || !purpose) {
      return res.status(400).json({ success: false, message: 'Caller name, phone, and purpose are required' });
    }
    const meta = await staffMeta(req);
    const item = await ReceptionCall.create({
      callerName,
      phone,
      direction,
      purpose,
      notes,
      handledBy: meta.createdByName,
      loggedAt: new Date(),
      ...meta,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCall = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await ReceptionCall.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Call log not found' });
    const item = await ReceptionCall.update(id, req.body);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCall = async (req, res) => {
  try {
    await ReceptionCall.delete(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Call log deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
