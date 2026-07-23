import Opportunity from '../models/Opportunity.js';
import { migrateOpportunityStatusFields } from './migrate-opportunity-status-fields.js';

export async function initializeOpportunities() {
  try {
    console.log('Initializing opportunities table...');
    
    // Create the opportunities table
    await Opportunity.createTable();
    await migrateOpportunityStatusFields();
    
    console.log('✅ Opportunities table initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing opportunities table:', error);
    throw error;
  }
}

