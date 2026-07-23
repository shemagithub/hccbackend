import Contract from '../models/Contract.js';
import Staff from '../models/Staff.js';
import {
  normalizeBase64Document,
  validateBase64DocumentSize,
} from '../constants/opportunityOptions.js';
import {
  canApproveStep,
  canStaffActOnContract,
  getStepLabel,
  isAdminRole,
  isSuperAdminRole,
} from '../utils/contractApproval.js';

function pickAttachmentFields(body = {}) {
  const result = {};

  if (body.contractDocument !== undefined) {
    result.contractDocument = normalizeBase64Document(body.contractDocument);
  }
  if (body.contractDocumentName !== undefined) {
    result.contractDocumentName = body.contractDocumentName;
  }
  if (body.supportingDocument !== undefined) {
    result.supportingDocument = normalizeBase64Document(body.supportingDocument);
  }
  if (body.supportingDocumentName !== undefined) {
    result.supportingDocumentName = body.supportingDocumentName;
  }
  if (body.technicalAttachment !== undefined) {
    result.technicalAttachment = normalizeBase64Document(body.technicalAttachment);
  }
  if (body.technicalAttachmentName !== undefined) {
    result.technicalAttachmentName = body.technicalAttachmentName;
  }
  if (body.financialAttachment !== undefined) {
    result.financialAttachment = normalizeBase64Document(body.financialAttachment);
  }
  if (body.financialAttachmentName !== undefined) {
    result.financialAttachmentName = body.financialAttachmentName;
  }

  return result;
}

function validateAttachmentFields(fields) {
  const checks = [
    ['contractDocument', 'Contract document'],
    ['supportingDocument', 'Supporting document'],
    ['technicalAttachment', 'Technical attachment'],
    ['financialAttachment', 'Financial attachment'],
  ];

  for (const [key, label] of checks) {
    if (fields[key] !== undefined) {
      const error = validateBase64DocumentSize(fields[key], label);
      if (error) return error;
    }
  }

  return null;
}

async function resolveStaffName(staffId) {
  if (!staffId) return 'System';
  const staff = await Staff.findById(staffId);
  return staff ? `${staff.firstName} ${staff.lastName}` : 'System';
}

async function resolveStaffContext(staffId) {
  if (!staffId) return null;
  const staff = await Staff.findById(staffId);
  if (!staff) return null;
  return {
    id: staff.id,
    role: staff.role,
    position: staff.position,
    controlPanel: staff.controlPanel,
    email: staff.email,
    name: `${staff.firstName} ${staff.lastName}`.trim(),
  };
}

function attachPermissions(contract, staff) {
  const permissions = canStaffActOnContract(staff, contract);
  return {
    ...contract,
    permissions,
    currentStepLabel: getStepLabel(contract.currentApprovalStep),
  };
}

export const getContracts = async (req, res) => {
  try {
    const { status, renewalStatus, projectId, opportunityId, expiringBefore, approvalStatus } =
      req.query;

    const filters = {};
    if (status) filters.status = status;
    if (renewalStatus) filters.renewalStatus = renewalStatus;
    if (projectId) filters.projectId = Number(projectId);
    if (opportunityId) filters.opportunityId = Number(opportunityId);
    if (expiringBefore) filters.expiringBefore = expiringBefore;
    if (approvalStatus) filters.approvalStatus = approvalStatus;

    const contracts = await Contract.findAll(filters);
    const staff = await resolveStaffContext(req.staffId);

    res.json({
      success: true,
      data: staff ? contracts.map((contract) => attachPermissions(contract, staff)) : contracts,
      meta: {
        count: contracts.length,
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

export const getContractByOpportunityId = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const contract = await Contract.findByOpportunityId(Number(opportunityId), {
      excludeDocuments: true,
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'No contract found for this opportunity',
      });
    }

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error('Error fetching contract by opportunity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract',
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

    const staff = await resolveStaffContext(req.staffId);

    res.json({
      success: true,
      data: attachPermissions(contract, staff),
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
    const staffName = await resolveStaffName(staffId);
    const attachments = pickAttachmentFields(req.body);
    const attachmentError = validateAttachmentFields(attachments);

    if (attachmentError) {
      return res.status(400).json({ success: false, message: attachmentError });
    }

    const data = {
      projectId: req.body.projectId,
      opportunityId: req.body.opportunityId,
      proposalId: req.body.proposalId,
      clientName: req.body.clientName,
      title: req.body.title,
      totalValue: req.body.totalValue,
      currency: req.body.currency,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      paymentTerms: req.body.paymentTerms,
      status: req.body.status || 'draft',
      renewalStatus: req.body.renewalStatus || 'none',
      createdBy: staffId,
      createdByName: staffName,
      ...attachments,
    };

    if (!data.clientName || !data.title || !data.startDate || !data.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Client name, title, start date, and end date are required',
      });
    }

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
    const attachments = pickAttachmentFields(req.body || {});
    const attachmentError = validateAttachmentFields(attachments);

    if (attachmentError) {
      return res.status(400).json({ success: false, message: attachmentError });
    }

    const updated = await Contract.update(id, {
      title: req.body?.title,
      clientName: req.body?.clientName,
      totalValue: req.body?.totalValue,
      currency: req.body?.currency,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      paymentTerms: req.body?.paymentTerms,
      status: req.body?.status,
      renewalStatus: req.body?.renewalStatus,
      projectId: req.body?.projectId,
      ...attachments,
    });

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

export const getContractApprovals = async (req, res) => {
  try {
    const staff = await resolveStaffContext(req.staffId);
    const { status } = req.query;

    let contracts = await Contract.findAll(
      status && status !== 'all' ? { approvalStatus: status } : {}
    );

    if (!isAdminRole(staff?.role, staff?.position)) {
      contracts = contracts.filter((contract) => {
        const permissions = canStaffActOnContract(staff, contract);
        return (
          permissions.canApprove ||
          permissions.canSubmit ||
          contract.createdBy === staff?.id ||
          contract.approvalStatus !== 'draft'
        );
      });
    }

    const pendingForMe = contracts.filter((contract) => {
      const permissions = canStaffActOnContract(staff, contract);
      return permissions.canApprove;
    });

    const stats = {
      total: contracts.length,
      pending: contracts.filter((c) => c.approvalStatus === 'in_review').length,
      approved: contracts.filter((c) => c.approvalStatus === 'approved').length,
      rejected: contracts.filter((c) => c.approvalStatus === 'rejected').length,
      awaitingMyAction: pendingForMe.length,
    };

    res.json({
      success: true,
      data: contracts.map((contract) => attachPermissions(contract, staff)),
      stats,
    });
  } catch (error) {
    console.error('Error fetching contract approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract approvals',
      error: error.message,
    });
  }
};

export const submitContractForApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await resolveStaffContext(req.staffId);
    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const permissions = canStaffActOnContract(staff, contract);
    if (!permissions.canSubmit && !isAdminRole(staff?.role, staff?.position)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to submit this contract for approval',
      });
    }

    const updated = await Contract.submitForApproval(id, {
      staffId: staff?.id,
      staffName: staff?.name,
    });

    res.json({
      success: true,
      message: 'Contract submitted for approval. Waiting for Project Manager review.',
      data: attachPermissions(updated, staff),
    });
  } catch (error) {
    console.error('Error submitting contract:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit contract for approval',
    });
  }
};

export const approveContractStep = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await resolveStaffContext(req.staffId);
    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const step = contract.currentApprovalStep;
    if (!step || step === 'none' || step === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This contract is not waiting for approval',
      });
    }

    if (!canApproveStep(staff, step) && !isAdminRole(staff?.role, staff?.position)) {
      return res.status(403).json({
        success: false,
        message: `Only ${getStepLabel(step)} approvers can approve this step`,
      });
    }

    const updated = await Contract.approveStep(id, step, {
      staffId: staff?.id,
      staffName: staff?.name,
    });

    let nextMessage =
      updated.approvalStatus === 'approved'
        ? 'Contract fully approved and activated'
        : `Approved. Waiting for ${getStepLabel(updated.currentApprovalStep)} review`;

    if (updated.approvalStatus === 'approved') {
      nextMessage = updated.implementationId
        ? 'Contract approved. Proposal saved to project and project management workflow started.'
        : 'Contract fully approved and activated';
    }

    res.json({
      success: true,
      message: nextMessage,
      data: attachPermissions(updated, staff),
    });
  } catch (error) {
    console.error('Error approving contract step:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to approve contract step',
    });
  }
};

export const approveAllContractSteps = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await resolveStaffContext(req.staffId);

    if (!isSuperAdminRole(staff?.role, staff?.position)) {
      return res.status(403).json({
        success: false,
        message: 'Only SuperAdmin can approve all workflow steps at once',
      });
    }

    let contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    if (contract.approvalStatus === 'draft' || contract.approvalStatus === 'rejected') {
      contract = await Contract.submitForApproval(id, {
        staffId: staff?.id,
        staffName: staff?.name,
      });
    }

    let stepsApproved = 0;
    const maxSteps = 3;

    while (
      contract.approvalStatus === 'in_review' &&
      contract.currentApprovalStep &&
      contract.currentApprovalStep !== 'none' &&
      contract.currentApprovalStep !== 'completed' &&
      stepsApproved < maxSteps
    ) {
      const step = contract.currentApprovalStep;
      contract = await Contract.approveStep(id, step, {
        staffId: staff?.id,
        staffName: staff?.name,
      });
      stepsApproved += 1;
    }

    const message =
      contract.approvalStatus === 'approved'
        ? 'Contract approved through all workflow steps. Project management started.'
        : `Approved ${stepsApproved} step(s). Waiting for ${getStepLabel(contract.currentApprovalStep)} review.`;

    res.json({
      success: true,
      message,
      data: attachPermissions(contract, staff),
      meta: { stepsApproved },
    });
  } catch (error) {
    console.error('Error approving all contract steps:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to approve all contract steps',
    });
  }
};

export const rejectContractStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const staff = await resolveStaffContext(req.staffId);
    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const step = contract.currentApprovalStep;
    if (!step || step === 'none' || step === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This contract is not waiting for approval',
      });
    }

    if (!canApproveStep(staff, step) && !isAdminRole(staff?.role, staff?.position)) {
      return res.status(403).json({
        success: false,
        message: `Only ${getStepLabel(step)} approvers can reject this step`,
      });
    }

    if (!reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const updated = await Contract.rejectStep(id, step, {
      staffId: staff?.id,
      staffName: staff?.name,
      reason: reason.trim(),
    });

    res.json({
      success: true,
      message: 'Contract rejected. Creator can revise and resubmit.',
      data: attachPermissions(updated, staff),
    });
  } catch (error) {
    console.error('Error rejecting contract step:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reject contract step',
    });
  }
};
