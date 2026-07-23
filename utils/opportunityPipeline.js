import Opportunity from '../models/Opportunity.js';
import OpportunityProposal from '../models/OpportunityProposal.js';

function buildOpportunitySummary(opportunity) {
  return {
    opportunityId: opportunity.id,
    dbId: opportunity.dbId,
    name: opportunity.name,
    client: opportunity.client,
    department: opportunity.department,
    country: opportunity.country,
    legalEntity: opportunity.legalEntity,
    contact: opportunity.contact,
    value: opportunity.value,
    bidCurrency: opportunity.bidCurrency,
    fundAgency: opportunity.fundAgency,
    description: opportunity.description,
    comment: opportunity.comment,
    feedbackDeadline: opportunity.feedbackDeadline,
    expectedCloseDate: opportunity.expectedCloseDate,
    operationDate: opportunity.operationDate,
    winProbability: opportunity.winProbability,
    urgency: opportunity.urgency,
    decision: opportunity.decision,
    assignedTo: opportunity.assignedTo,
    year: opportunity.year,
  };
}

function buildProposalSeedFromOpportunity(opportunity) {
  const summary = buildOpportunitySummary(opportunity);

  return {
    technicalProposal: JSON.stringify(
      {
        opportunity: summary,
        technicalApproach: opportunity.description || '',
        scopeNotes: opportunity.comment || '',
      },
      null,
      2
    ),
    financialProposal: JSON.stringify(
      {
        opportunity: summary,
        estimatedValue: opportunity.value || 0,
        currency: opportunity.bidCurrency || 'USD',
        fundAgency: opportunity.fundAgency || null,
      },
      null,
      2
    ),
    technicalStatus: 'draft',
    financialStatus: 'draft',
    decision: 'pending',
  };
}

export async function ensureProposalForOpportunityDbId(opportunityDbId) {
  await OpportunityProposal.ensureAttachmentFields();

  const opportunity = await Opportunity.findById(opportunityDbId, { excludeDocuments: true });
  if (!opportunity) {
    throw new Error('Linked opportunity not found');
  }

  let proposal = await OpportunityProposal.findByOpportunityDbId(opportunity.dbId);
  let created = false;

  if (!proposal) {
    const seed = buildProposalSeedFromOpportunity(opportunity);
    proposal = await OpportunityProposal.upsert(opportunity.dbId, seed);
    created = true;
  }

  if (opportunity.status !== 'proposal') {
    await Opportunity.update(opportunity.dbId, { status: 'proposal' });
    opportunity.status = 'proposal';
  }

  return {
    proposal,
    opportunity,
    created,
    proposalOpportunityId: opportunity.dbId,
  };
}

/**
 * Ensures every EOI marked Go with a linked opportunity has a proposal record.
 */
export async function syncGoEOIsToProposals() {
  const { default: EOI } = await import('../models/EOI.js');
  await EOI.ensureGoDecisionField();

  const goEOIs = await EOI.findAllGoWithOpportunityLink();
  const results = {
    synced: 0,
    created: 0,
    errors: [],
  };

  for (const eoi of goEOIs) {
    try {
      const outcome = await ensureProposalForOpportunityDbId(eoi.opportunityId);
      results.synced += 1;
      if (outcome.created) {
        results.created += 1;
      }
    } catch (error) {
      console.error(`Failed to sync Go EOI ${eoi.id} to proposal:`, error.message);
      results.errors.push({ eoiId: eoi.id, message: error.message });
    }
  }

  return results;
}
