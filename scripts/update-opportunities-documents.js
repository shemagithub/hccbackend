import pool, { testConnection } from '../config/db.js';

export async function updateOpportunitiesDocuments() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Cannot update opportunities table: Database not connected.');
    return false;
  }

  try {
    console.log('Updating opportunities table document columns to LONGTEXT...');

    // Update win_probability_document column
    await pool.execute(`
      ALTER TABLE opportunities 
      MODIFY COLUMN win_probability_document LONGTEXT NULL
    `);
    console.log('✅ Updated win_probability_document column to LONGTEXT');

    // Update supporting_document column
    await pool.execute(`
      ALTER TABLE opportunities 
      MODIFY COLUMN supporting_document LONGTEXT NULL
    `);
    console.log('✅ Updated supporting_document column to LONGTEXT');

    console.log('✅ Opportunities table document columns updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Error updating opportunities table:', error);
    return false;
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('update-opportunities-documents.js');

if (isMainModule) {
  updateOpportunitiesDocuments()
    .then((success) => {
      if (success) {
        console.log('✅ Script completed successfully');
        process.exit(0);
      } else {
        console.error('❌ Script failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

export default updateOpportunitiesDocuments;

