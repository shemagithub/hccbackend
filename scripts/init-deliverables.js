import Deliverable from '../models/Deliverable.js';
import { testConnection } from '../config/db.js';

async function initializeDeliverables() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Cannot initialize deliverables table: Database not connected.');
    return;
  }

  try {
    console.log('Initializing deliverables table...');
    await Deliverable.createTable();
    console.log('✅ Deliverables table initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize deliverables table:', error);
  }
}

export { initializeDeliverables };
