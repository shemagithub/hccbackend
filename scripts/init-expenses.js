import Expense from '../models/Expense.js';
import { testConnection } from '../config/db.js';

async function initializeExpenses() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Cannot initialize expenses table: Database not connected.');
    return;
  }

  try {
    console.log('Initializing expenses table...');
    await Expense.createTable();
    console.log('✅ Expenses table initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize expenses table:', error);
  }
}

export { initializeExpenses };
