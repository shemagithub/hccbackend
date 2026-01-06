import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateOpportunitiesTable() {
  let connection;
  
  try {
    console.log('🔍 Connecting to database...');
    connection = await pool.getConnection();
    console.log('✅ Connected to database');

    // Manually add indexes with checks
    console.log('\n📊 Adding indexes with existence checks...');
    
    const indexesToAdd = [
      { name: 'idx_assigned_to', sql: 'ALTER TABLE opportunities ADD INDEX idx_assigned_to (assigned_to(255))' },
      { name: 'idx_decision', sql: 'ALTER TABLE opportunities ADD INDEX idx_decision (decision)' },
      { name: 'idx_value', sql: 'ALTER TABLE opportunities ADD INDEX idx_value (value)' },
      { name: 'idx_expected_close_date', sql: 'ALTER TABLE opportunities ADD INDEX idx_expected_close_date (expected_close_date)' }
    ];
    
    for (const indexInfo of indexesToAdd) {
      try {
        // Check if index exists
        const [indexes] = await connection.execute(
          `SELECT COUNT(*) as count 
           FROM information_schema.statistics 
           WHERE table_schema = DATABASE() 
           AND table_name = 'opportunities' 
           AND index_name = ?`,
          [indexInfo.name]
        );
        
        if (indexes[0].count === 0) {
          console.log(`  ✅ Adding index: ${indexInfo.name}`);
          await connection.execute(indexInfo.sql);
        } else {
          console.log(`  ⏭️  Index ${indexInfo.name} already exists`);
        }
      } catch (error) {
        if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
          console.log(`  ⏭️  Index ${indexInfo.name} already exists`);
        } else {
          console.error(`  ❌ Error adding index ${indexInfo.name}: ${error.message}`);
        }
      }
    }
    
    // Show current table structure
    console.log('\n📋 Current opportunities table structure:');
    const [columns] = await connection.execute('DESCRIBE opportunities');
    console.table(columns);
    
    // Show current indexes
    console.log('\n🔍 Current opportunities table indexes:');
    const [indexes] = await connection.execute('SHOW INDEXES FROM opportunities');
    console.table(indexes.map(idx => ({
      Key_name: idx.Key_name,
      Column_name: idx.Column_name,
      Non_unique: idx.Non_unique,
      Seq_in_index: idx.Seq_in_index
    })));
    
    console.log('\n✅ Opportunities table update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating opportunities table:', error);
    console.error('   Details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
      console.log('🔌 Database connection released');
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    try {
      await updateOpportunitiesTable();
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  })();
}

export { updateOpportunitiesTable };

