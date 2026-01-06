import Budget from '../models/Budget.js';

export async function initializeBudgets() {
  try {
    console.log('Initializing Budgets table...');
    
    // Create the Budgets table
    await Budget.createTable();
    
    console.log('✅ Budgets table initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Budgets table:', error);
    throw error;
  }
}

