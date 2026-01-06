import Task from '../models/Task.js';
import Deliverable from '../models/Deliverable.js';
import Expense from '../models/Expense.js';
import Payment from '../models/Payment.js';
import Trip from '../models/Trip.js';
import FuelLog from '../models/FuelLog.js';
import Maintenance from '../models/Maintenance.js';
import Budget from '../models/Budget.js';
import Approval from '../models/Approval.js';
import FieldTask from '../models/FieldTask.js';
import Meeting from '../models/Meeting.js';
import Document from '../models/Document.js';
import Discussion from '../models/Discussion.js';
import Implementation from '../models/Implementation.js';
import { addMessageTypesToDiscussions } from './add-message-types-to-discussions.js';
import { testConnection } from '../config/db.js';

async function initializeAllTables() {
  try {
    console.log('🔍 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Cannot initialize tables: Database not connected.');
      process.exit(1);
    }

    console.log('✅ Database connected. Initializing all tables...\n');

    // Initialize all tables
    console.log('📋 Creating Tasks table...');
    await Task.createTable();
    console.log('✅ Tasks table ready\n');

    console.log('📋 Creating Deliverables table...');
    await Deliverable.createTable();
    console.log('✅ Deliverables table ready\n');

    console.log('📋 Creating Expenses table...');
    await Expense.createTable();
    console.log('✅ Expenses table ready\n');

    console.log('📋 Creating Payments table...');
    await Payment.createTable();
    console.log('✅ Payments table ready\n');

    console.log('📋 Creating Trips table...');
    await Trip.createTable();
    console.log('✅ Trips table ready\n');

    console.log('📋 Creating Fuel Logs table...');
    await FuelLog.createTable();
    console.log('✅ Fuel Logs table ready\n');

    console.log('📋 Creating Maintenance table...');
    await Maintenance.createTable();
    console.log('✅ Maintenance table ready\n');

    console.log('📋 Creating Budgets table...');
    await Budget.createTable();
    console.log('✅ Budgets table ready\n');

    console.log('📋 Creating Approvals table...');
    await Approval.createTable();
    console.log('✅ Approvals table ready\n');

    console.log('📋 Creating Field Tasks table...');
    await FieldTask.createTable();
    console.log('✅ Field Tasks table ready\n');

    console.log('📋 Creating Meetings table...');
    await Meeting.createTable();
    console.log('✅ Meetings table ready\n');

    console.log('📋 Creating Documents table...');
    await Document.createTable();
    console.log('✅ Documents table ready\n');

    console.log('📋 Creating Discussions table...');
    await Discussion.createTable();
    console.log('✅ Discussions table ready\n');

    console.log('📋 Updating Discussions table with message types...');
    await addMessageTypesToDiscussions();
    console.log('✅ Discussions table updated\n');

    console.log('✅ All tables initialized successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Tasks');
    console.log('   - Deliverables');
    console.log('   - Expenses');
    console.log('   - Payments');
    console.log('   - Trips');
    console.log('   - Fuel Logs');
    console.log('   - Maintenance');
    console.log('   - Budgets');
    console.log('   - Approvals');
    console.log('   - Field Tasks');
    console.log('   - Meetings');
    console.log('   - Documents');
    console.log('   - Discussions');
    console.log('   - Implementations');

  } catch (error) {
    console.error('❌ Error initializing tables:', error);
    console.error('   Details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    try {
      await initializeAllTables();
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  })();
}

export { initializeAllTables };

