import Project from '../models/Project.js';

export async function initializeProjects() {
  try {
    console.log('Initializing projects table...');
    
    // Create the projects table
    await Project.createTable();
    
    console.log('✅ Projects table initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing projects table:', error);
    throw error;
  }
}

