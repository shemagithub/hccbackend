import EOI from '../models/EOI.js';

export async function initializeEOIs() {
  try {
    console.log('Initializing EOIs table...');
    
    // Create the EOIs table
    await EOI.createTable();
    
    console.log('✅ EOIs table initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing EOIs table:', error);
    throw error;
  }
}

