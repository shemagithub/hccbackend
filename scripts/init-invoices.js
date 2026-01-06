import Invoice from '../models/Invoice.js';
import pool from '../config/db.js';

async function initializeInvoices() {
  try {
    console.log('Initializing invoices table...');
    await Invoice.createTable();
    console.log('Invoices table initialized successfully.');
  } catch (error) {
    console.error('Error initializing invoices table:', error);
    throw error;
  }
}

export default initializeInvoices;

