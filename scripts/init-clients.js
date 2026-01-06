import Client from '../models/Client.js';

export async function initializeClients() {
  try {
    console.log('Initializing clients table...');
    
    // Create the clients table
    await Client.createTable();
    
    console.log('✅ Clients table initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing clients table:', error);
    throw error;
  }
}

