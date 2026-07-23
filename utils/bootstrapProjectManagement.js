import pool from '../config/db.js';
import Project from '../models/Project.js';
import Implementation from '../models/Implementation.js';
import Milestone from '../models/Milestone.js';
import Task from '../models/Task.js';
import Deliverable from '../models/Deliverable.js';
import Document from '../models/Document.js';
import OpportunityProposal from '../models/OpportunityProposal.js';
import Opportunity from '../models/Opportunity.js';

const PROJECT_PHASES = [
  {
    value: 'initiation',
    label: 'Project Initiation',
    taskTitle: 'Complete project kickoff and mobilization',
    taskDescription: 'Confirm scope, team, and mobilization plan from the approved proposal and contract.',
  },
  {
    value: 'planning',
    label: 'Project Planning',
    taskTitle: 'Finalize work plan and resource schedule',
    taskDescription: 'Translate proposal methodology and timeline into the execution plan.',
  },
  {
    value: 'execution',
    label: 'Project Execution',
    taskTitle: 'Execute core project deliverables',
    taskDescription: 'Deliver the technical scope defined in the won proposal.',
  },
  {
    value: 'monitoring',
    label: 'Monitoring & Control',
    taskTitle: 'Track progress, budget, and quality',
    taskDescription: 'Monitor schedule, spend, risks, and quality against contract targets.',
  },
  {
    value: 'review',
    label: 'Client Review & Approval',
    taskTitle: 'Submit deliverables for client review',
    taskDescription: 'Package outputs for client review and approval.',
  },
  {
    value: 'closure',
    label: 'Project Closure',
    taskTitle: 'Complete handover and project closure',
    taskDescription: 'Close out deliverables, documentation, and lessons learned.',
  },
];

/** When a project enters implementation: initiation + planning done, execution active. */
export const IMPLEMENTATION_START_PHASE_INDEX = 2;

export { PROJECT_PHASES };

export function getPhaseStatusOnImplementationStart(phaseIndex) {
  if (phaseIndex < IMPLEMENTATION_START_PHASE_INDEX) {
    return { status: 'completed', progress: 100 };
  }
  if (phaseIndex === IMPLEMENTATION_START_PHASE_INDEX) {
    return { status: 'in_progress', progress: 10 };
  }
  return { status: 'pending', progress: 0 };
}

function mapPhaseStatusToTaskStatus(phaseStatus) {
  if (phaseStatus === 'completed') return 'completed';
  if (phaseStatus === 'in_progress') return 'in_progress';
  return 'pending';
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function splitDeliverableItems(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
}

export function buildProposalContext(proposal, opportunity, contract) {
  const technical = parseJson(proposal?.technicalProposal);
  const financial = parseJson(proposal?.financialProposal);

  const sections = [];

  if (opportunity?.description) {
    sections.push(`Opportunity overview:\n${opportunity.description}`);
  }

  if (technical) {
    if (technical.executiveSummary) sections.push(`Executive summary:\n${technical.executiveSummary}`);
    if (technical.methodology) sections.push(`Methodology:\n${technical.methodology}`);
    if (technical.technicalApproach) sections.push(`Technical approach:\n${technical.technicalApproach}`);
    if (technical.teamComposition) sections.push(`Team composition:\n${technical.teamComposition}`);
    if (technical.timeline) sections.push(`Proposed timeline:\n${technical.timeline}`);
    if (technical.deliverables) sections.push(`Proposed deliverables:\n${technical.deliverables}`);
  }

  if (financial) {
    if (financial.summary) sections.push(`Financial summary:\n${financial.summary}`);
    if (financial.paymentTerms) sections.push(`Payment terms:\n${financial.paymentTerms}`);
    if (financial.notes) sections.push(`Financial notes:\n${financial.notes}`);
    if (Array.isArray(financial.lineItems) && financial.lineItems.length > 0) {
      const lines = financial.lineItems
        .map((item) => `- ${item.description || 'Line item'}: ${item.amount ?? 0}`)
        .join('\n');
      sections.push(`Financial line items:\n${lines}`);
    }
  }

  if (contract?.contractId) {
    sections.push(`Linked contract: ${contract.contractId}`);
  }
  if (contract?.paymentTerms) {
    sections.push(`Contract payment terms: ${contract.paymentTerms}`);
  }

  const metadata = {
    opportunityId: opportunity?.dbId || contract?.opportunityId || null,
    opportunityCode: opportunity?.id || null,
    contractId: contract?.id || null,
    contractCode: contract?.contractId || null,
    proposalId: proposal?.id || contract?.proposalId || null,
    clientContact: opportunity?.contact || null,
    country: opportunity?.country || null,
    department: opportunity?.department || null,
    legalEntity: opportunity?.legalEntity || null,
    currency: financial?.currency || contract?.currency || opportunity?.bidCurrency || 'USD',
    budget: contract?.totalValue ?? financial?.totalAmount ?? opportunity?.value ?? 0,
    implementationStartDate: proposal?.implementationStartDate || contract?.startDate || null,
    implementationDueDate: proposal?.implementationDueDate || contract?.endDate || null,
  };

  return {
    technical,
    financial,
    description: sections.filter(Boolean).join('\n\n'),
    deliverableItems: splitDeliverableItems(technical?.deliverables),
    metadata,
  };
}

function phaseTargetDate(startDate, endDate, phaseIndex, totalPhases) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return endDate || startDate;
  }
  const ratio = (phaseIndex + 1) / totalPhases;
  return new Date(start + (end - start) * ratio).toISOString().split('T')[0];
}

async function hasWorkflowStarted(projectId) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS count FROM milestones WHERE project_id = ?',
    [projectId]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function saveProjectDocument({
  projectId,
  name,
  description,
  fileData,
  fileName,
  staffId,
}) {
  if (!fileData || !projectId) return null;

  const existing = await Document.findAll({ projectId, limit: 500 });
  if (existing.some((doc) => doc.name === name)) {
    return null;
  }

  return Document.create({
    projectId,
    name,
    description,
    fileType: fileName?.split('.').pop() || 'file',
    fileData,
    uploadedBy: staffId || null,
    status: 'active',
  });
}

async function saveProposalDeliverable({
  projectId,
  title,
  description,
  staffId,
  submissionDate,
}) {
  const existing = await Deliverable.findAll({ projectId, limit: 500 });
  if (existing.some((item) => item.title === title)) {
    return null;
  }

  return Deliverable.create({
    projectId,
    type: 'Proposal',
    category: 'Document',
    title,
    description,
    submissionDate: submissionDate || new Date().toISOString().split('T')[0],
    status: 'approved',
    submittedBy: staffId || null,
    priority: 'medium',
  });
}

/**
 * Copy proposal + contract information into the linked project and seed the
 * standard project-management workflow (phases, milestones, tasks, deliverables).
 */
export async function bootstrapProjectManagementFromApprovedContract({
  contract,
  proposal,
  opportunity,
  implementation,
  staffId,
}) {
  const projectId = implementation?.projectId;
  if (!projectId) {
    throw new Error('Implementation is not linked to a project');
  }

  await Promise.all([
    Project.ensureLinkFields(),
    Milestone.createTable(),
    Task.createTable(),
    Deliverable.createTable(),
    Document.createTable(),
  ]);

  const context = buildProposalContext(proposal, opportunity, contract);
  const startDate = contract?.startDate || proposal?.implementationStartDate || implementation.startDate;
  const endDate = contract?.endDate || proposal?.implementationDueDate || implementation.endDate;
  const teamSize = opportunity?.assignedTo
    ? opportunity.assignedTo.split(',').map((item) => item.trim()).filter(Boolean).length
    : implementation.teamSize || 0;

  await Project.update(projectId, {
    name: contract?.title || opportunity?.name || implementation.title,
    client: contract?.clientName || opportunity?.client || implementation.client,
    department: opportunity?.department || null,
    status: 'ongoing',
    startDate,
    endDate,
    budget: context.metadata.budget,
    teamSize,
    priority: implementation.priority || 'medium',
    description: context.description || implementation.description || null,
    location: opportunity?.country || null,
    assignedTo: opportunity?.assignedTo || implementation.assignedTo || null,
    opportunityId: context.metadata.opportunityId,
    contractId: context.metadata.contractId,
  });

  const implementationDbId = implementation.dbId;
  if (!implementationDbId) {
    throw new Error('Implementation database id is required');
  }

  await Implementation.update(implementationDbId, {
    title: contract?.title || implementation.title,
    client: contract?.clientName || implementation.client,
    description: context.description || implementation.description || null,
    startDate,
    endDate,
    budget: context.metadata.budget,
    status: 'in_progress',
    assignedTo: opportunity?.assignedTo || implementation.assignedTo || null,
    teamSize,
    progress: implementation.progress || 0,
  });

  if (proposal && opportunity?.dbId) {
    await OpportunityProposal.upsert(opportunity.dbId, {
      decision: 'won',
      implementationId: implementationDbId,
      implementationStartDate: startDate,
      implementationDueDate: endDate,
    });
    await Opportunity.update(opportunity.dbId, { status: 'won' });
  }

  const workflowAlreadyStarted = await hasWorkflowStarted(projectId);
  const created = { milestones: 0, tasks: 0, deliverables: 0, documents: 0 };

  if (!workflowAlreadyStarted) {
    for (let index = 0; index < PROJECT_PHASES.length; index += 1) {
      const phase = PROJECT_PHASES[index];
      const targetDate = phaseTargetDate(startDate, endDate, index, PROJECT_PHASES.length);
      const { status, progress } = getPhaseStatusOnImplementationStart(index);
      const taskStatus = mapPhaseStatusToTaskStatus(status);
      const today = new Date().toISOString().split('T')[0];

      await Milestone.create({
        projectId,
        name: phase.label,
        description: phase.taskDescription,
        phase: phase.value,
        targetDate,
        status,
        progress,
        actualDate: status === 'completed' ? today : null,
        createdBy: staffId || null,
      });
      created.milestones += 1;

      await Task.create({
        projectId,
        title: phase.taskTitle,
        description: phase.taskDescription,
        status: taskStatus,
        priority: index <= IMPLEMENTATION_START_PHASE_INDEX ? 'high' : 'medium',
        startDate,
        dueDate: targetDate,
        progress,
        tags: [phase.value, 'contract-approved'],
        createdBy: staffId || null,
      });
      created.tasks += 1;
    }
  } else {
    const milestones = await Milestone.findAll({ projectId, limit: 100 });
    const execution = milestones.find((row) => row.phase === 'execution');
    if (!execution || execution.status === 'pending') {
      await syncImplementationStartPhases(projectId);
    }
  }

  for (const item of context.deliverableItems) {
    const existing = await Deliverable.findAll({ projectId, limit: 500 });
    if (existing.some((row) => row.title === item)) continue;

    const saved = await Deliverable.create({
      projectId,
      type: 'Scope Deliverable',
      category: 'Document',
      title: item,
      description: 'Imported from won proposal deliverables list.',
      submissionDate: endDate,
      status: 'draft',
      submittedBy: staffId || null,
      priority: 'medium',
    });
    if (saved) created.deliverables += 1;
  }

  const attachmentSources = [
    {
      title: 'Technical Proposal Attachment',
      fileData: proposal?.technicalAttachment || contract?.technicalAttachment,
      fileName: proposal?.technicalAttachmentName || contract?.technicalAttachmentName,
    },
    {
      title: 'Financial Proposal Attachment',
      fileData: proposal?.financialAttachment || contract?.financialAttachment,
      fileName: proposal?.financialAttachmentName || contract?.financialAttachmentName,
    },
    {
      title: 'Contract Document',
      fileData: contract?.contractDocument,
      fileName: contract?.contractDocumentName,
    },
    {
      title: 'Contract Supporting Document',
      fileData: contract?.supportingDocument,
      fileName: contract?.supportingDocumentName,
    },
  ];

  for (const attachment of attachmentSources) {
    if (!attachment.fileData) continue;

    const deliverable = await saveProposalDeliverable({
      projectId,
      title: attachment.title,
      description: attachment.fileName || attachment.title,
      staffId,
      submissionDate: startDate,
    });
    if (deliverable) created.deliverables += 1;

    const document = await saveProjectDocument({
      projectId,
      name: attachment.fileName || attachment.title,
      description: attachment.title,
      fileData: attachment.fileData,
      fileName: attachment.fileName,
      staffId,
    });
    if (document) created.documents += 1;
  }

  const project = await Project.findById(projectId);
  const refreshedImplementation =
    (await Implementation.findById(implementation.dbId || implementation.id)) || implementation;

  return {
    project,
    implementation: refreshedImplementation,
    workflowStarted: !workflowAlreadyStarted,
    created,
  };
}

async function seedImplementationPhases(projectId, { staffId, startDate, endDate } = {}) {
  const project = await Project.findById(projectId);
  if (!project) return { milestones: 0, tasks: 0 };

  const start = startDate || project.startDate;
  const end = endDate || project.endDate;
  const today = new Date().toISOString().split('T')[0];
  let milestones = 0;
  let tasks = 0;

  const existingMilestones = await Milestone.findAll({ projectId, limit: 100 });
  const existingTasks = await Task.findAll({ projectId, limit: 500 });

  for (let index = 0; index < PROJECT_PHASES.length; index += 1) {
    const phase = PROJECT_PHASES[index];
    const targetDate = phaseTargetDate(start, end, index, PROJECT_PHASES.length);
    const { status, progress } = getPhaseStatusOnImplementationStart(index);
    const taskStatus = mapPhaseStatusToTaskStatus(status);

    const hasMilestone = existingMilestones.some((row) => row.phase === phase.value);
    if (!hasMilestone) {
      await Milestone.create({
        projectId,
        name: phase.label,
        description: phase.taskDescription,
        phase: phase.value,
        targetDate,
        status,
        progress,
        actualDate: status === 'completed' ? today : null,
        createdBy: staffId || null,
      });
      milestones += 1;
    }

    const hasTask = existingTasks.some(
      (row) =>
        (Array.isArray(row.tags) && row.tags.includes(phase.value)) ||
        row.title === phase.taskTitle,
    );
    if (!hasTask) {
      await Task.create({
        projectId,
        title: phase.taskTitle,
        description: phase.taskDescription,
        status: taskStatus,
        priority: index <= IMPLEMENTATION_START_PHASE_INDEX ? 'high' : 'medium',
        startDate: start,
        dueDate: targetDate,
        progress,
        tags: [phase.value, 'implementation-phase'],
        createdBy: staffId || null,
      });
      tasks += 1;
    }
  }

  return { milestones, tasks };
}

export async function syncImplementationStartPhases(projectId) {
  const today = new Date().toISOString().split('T')[0];
  const milestones = await Milestone.findAll({ projectId, limit: 100 });
  const tasks = await Task.findAll({ projectId, limit: 500 });

  for (let index = 0; index < PROJECT_PHASES.length; index += 1) {
    const phase = PROJECT_PHASES[index];
    const { status, progress } = getPhaseStatusOnImplementationStart(index);
    const taskStatus = mapPhaseStatusToTaskStatus(status);

    const milestone = milestones.find((row) => row.phase === phase.value);
    const milestoneId = milestone?.id || milestone?.dbId;
    if (milestoneId) {
      await Milestone.update(milestoneId, {
        status,
        progress,
        actualDate: status === 'completed' ? today : milestone.actualDate,
      });
    }

    const task = tasks.find(
      (row) =>
        (Array.isArray(row.tags) && row.tags.includes(phase.value)) ||
        row.title === phase.taskTitle,
    );
    if (task?.dbId || task?.id) {
      await Task.update(task.dbId || task.id, {
        status: taskStatus,
        progress,
      });
    }
  }
}

/**
 * SuperAdmin / PM: when a project moves into implementation, mark initiation & planning
 * complete and set execution in progress.
 */
export async function startImplementationWorkflow(projectId, { staffId, startDate, endDate } = {}) {
  if (!projectId) {
    return { started: false, reason: 'missing_project' };
  }

  const project = await Project.findById(projectId);
  if (!project) {
    return { started: false, reason: 'project_not_found' };
  }

  const workflowExists = await hasWorkflowStarted(projectId);
  if (!workflowExists) {
    await seedImplementationPhases(projectId, {
      staffId,
      startDate: startDate || project.startDate,
      endDate: endDate || project.endDate,
    });
  } else {
    await seedImplementationPhases(projectId, {
      staffId,
      startDate: startDate || project.startDate,
      endDate: endDate || project.endDate,
    });
    const milestones = await Milestone.findAll({ projectId, limit: 100 });
    const execution = milestones.find((row) => row.phase === 'execution');
    if (!execution || execution.status === 'pending') {
      await syncImplementationStartPhases(projectId);
    }
  }

  await Project.update(projectId, { status: 'ongoing' });

  const implementation = await Implementation.findByProjectId(projectId);
  if (implementation?.dbId) {
    await Implementation.update(implementation.dbId, {
      status: 'in_progress',
      progress: Math.max(parseInt(implementation.progress, 10) || 0, 15),
    });
  }

  return { started: true, projectId };
}
