import Vehicle from '../models/Vehicle.js';

export async function initializeVehicles() {
  try {
    console.log('Initializing vehicles table...');
    
    // Create the vehicles table
    await Vehicle.createTable();
    
    console.log('✅ Vehicles table initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing vehicles table:', error);
    throw error;
  }
}

