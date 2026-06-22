import OpportunityProposal from '../models/OpportunityProposal.js';

export async function initializeOpportunityProposals() {
  try {
    console.log('Initializing opportunity proposals table...');
    await OpportunityProposal.createTable();
    console.log('✅ Opportunity proposals table initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing opportunity proposals table:', error);
    throw error;
  }
}
