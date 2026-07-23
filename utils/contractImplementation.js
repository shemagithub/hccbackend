import Contract from '../models/Contract.js';
import Implementation from '../models/Implementation.js';
import Opportunity from '../models/Opportunity.js';
import OpportunityProposal from '../models/OpportunityProposal.js';
import Project from '../models/Project.js';
import { bootstrapProjectManagementFromApprovedContract } from './bootstrapProjectManagement.js';

function buildImplementationDescription(proposal, opportunity) {
  let description = opportunity?.description || '';

  if (proposal?.financialProposal) {
    try {
      const financial = JSON.parse(proposal.financialProposal);
      if (financial?.summary) {
        description = [description, `Financial: ${financial.summary}`].filter(Boolean).join('\n\n');
      }
    } catch {
      // ignore parse errors
    }
  }

  if (proposal?.technicalProposal) {
    try {
      const technical = JSON.parse(proposal.technicalProposal);
      if (technical?.executiveSummary) {
        description = [description, `Technical: ${technical.executiveSummary}`].filter(Boolean).join('\n\n');
      }
    } catch {
      // ignore parse errors
    }
  }

  return description || null;
}

async function loadProposalContext(contract) {
  let opportunity = null;
  let proposal = null;

  if (contract.opportunityId) {
    opportunity = await Opportunity.findById(contract.opportunityId, { excludeDocuments: true });
    proposal = await OpportunityProposal.findByOpportunityDbId(contract.opportunityId);
  }

  return { opportunity, proposal };
}

async function linkContractAndProposal(contract, proposal, opportunity, implementation) {
  const implementationDbId = implementation.dbId;

  await Contract.update(contract.id, {
    projectId: implementation.projectId || contract.projectId || null,
    implementationId: implementationDbId,
  });

  if (proposal && opportunity?.dbId && !proposal.implementationId) {
    await OpportunityProposal.upsert(opportunity.dbId, {
      implementationId: implementationDbId,
    });
  }
}

async function finalizeApprovedContract(contract, implementation, { staffId } = {}) {
  const fullContract = await Contract.findById(contract.id);
  const { opportunity, proposal } = await loadProposalContext(fullContract);

  await linkContractAndProposal(fullContract, proposal, opportunity, implementation);

  const bootstrap = await bootstrapProjectManagementFromApprovedContract({
    contract: fullContract,
    proposal,
    opportunity,
    implementation,
    staffId,
  });

  const refreshedContract = await Contract.findById(contract.id);

  return {
    implementation: bootstrap.implementation,
    project: bootstrap.project,
    contract: refreshedContract,
    bootstrap,
  };
}

/**
 * When a contract is fully approved, ensure a project implementation record exists
 * and bootstrap the full project-management workflow from proposal data.
 */
export async function ensureImplementationForApprovedContract(contract, { staffId } = {}) {
  if (!contract || contract.approvalStatus !== 'approved') {
    return null;
  }

  await Contract.ensureLinkFields();
  await OpportunityProposal.ensureTable();
  await Project.ensureLinkFields();

  if (contract.implementationId) {
    const existing = await Implementation.findById(contract.implementationId);
    if (existing) {
      return finalizeApprovedContract(contract, existing, { staffId });
    }
  }

  if (contract.projectId) {
    const byProject = await Implementation.findByProjectId(contract.projectId);
    if (byProject) {
      return finalizeApprovedContract(contract, byProject, { staffId });
    }
  }

  const { opportunity, proposal } = await loadProposalContext(contract);

  if (proposal?.implementationId) {
    const fromProposal = await Implementation.findById(proposal.implementationId);
    if (fromProposal) {
      return finalizeApprovedContract(contract, fromProposal, { staffId });
    }
  }

  if (!contract.title || !contract.clientName || !contract.startDate || !contract.endDate) {
    throw new Error(
      'Contract is missing title, client, or dates required to start project implementation'
    );
  }

  const implementation = await Implementation.createFromAwarded({
    title: contract.title,
    client: contract.clientName,
    description: buildImplementationDescription(proposal, opportunity),
    startDate: contract.startDate,
    endDate: contract.endDate,
    budget: contract.totalValue || opportunity?.value || 0,
    assignedTo: opportunity?.assignedTo || null,
    createdBy: staffId || contract.createdBy || null,
    department: opportunity?.department || null,
  });

  return finalizeApprovedContract(contract, implementation, { staffId });
}
