import Implementation from '../models/Implementation.js';

export async function initializeImplementations() {
  try {
    await Implementation.createTable();
    console.log('✅ Implementations table initialized');
  } catch (error) {
    console.error('❌ Error initializing implementations table:', error);
    throw error;
  }
}
