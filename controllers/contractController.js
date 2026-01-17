import Contract from '../models/Contract.js';
import Staff from '../models/Staff.js';

export const getContracts = async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffId);
    const { status, renewalStatus, projectId, expiringBefore } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (renewalStatus) filters.renewalStatus = renewalStatus;
    if (projectId) filters.projectId = Number(projectId);
    if (expiringBefore) filters.expiringBefore = expiringBefore;

    const contracts = await Contract.findAll(filters);

    res.json({
      success: true,
      data: contracts,
      meta: {
        count: contracts.length,
        requestedBy: staff ? `${staff.firstName} ${staff.lastName}` : 'System',
      },
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contracts',
      error: error.message,
    });
  }
};

export const getContractById = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found',
      });
    }

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract',
      error: error.message,
    });
  }
};

export const createContract = async (req, res) => {
  try {
    const staffId = req.staffId;
    const staffName = req.staffName;

    const data = {
      projectId: req.body.projectId,
      clientName: req.body.clientName,
      title: req.body.title,
      totalValue: req.body.totalValue,
      currency: req.body.currency,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      paymentTerms: req.body.paymentTerms,
      status: req.body.status,
      renewalStatus: req.body.renewalStatus,
      createdBy: staffId,
      createdByName: staffName,
    };

    const contract = await Contract.create(data);

    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: contract,
    });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create contract',
      error: error.message,
    });
  }
};

export const updateContract = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Contract.update(id, req.body || {});

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found',
      });
    }

    res.json({
      success: true,
      message: 'Contract updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contract',
      error: error.message,
    });
  }
};

export const deleteContract = async (req, res) => {
  try {
    const { id } = req.params;
    await Contract.delete(id);

    res.json({
      success: true,
      message: 'Contract deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contract',
      error: error.message,
    });
  }
};

