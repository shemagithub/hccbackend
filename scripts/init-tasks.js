import Task from '../models/Task.js';
import { testConnection } from '../config/db.js';

async function initializeTasks() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Cannot initialize tasks table: Database not connected.');
    return;
  }

  try {
    console.log('Initializing tasks table...');
    await Task.createTable();
    console.log('✅ Tasks table initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize tasks table:', error);
  }
}

export { initializeTasks };
