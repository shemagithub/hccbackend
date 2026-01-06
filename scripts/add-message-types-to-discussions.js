import pool from '../config/db.js';
import Discussion from '../models/Discussion.js';

async function addMessageTypesToDiscussions() {
  try {
    console.log('🔍 Checking discussions table structure...');

    // First, ensure the table exists
    await Discussion.createTable();
    console.log('✅ Discussions table ensured');

    // Check if message_type column exists
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'message_type'
    `);

    if (columns.length === 0) {
      console.log('📋 Adding message_type column...');
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN message_type ENUM('text', 'image', 'voice', 'file') DEFAULT 'text' AFTER content
      `);
      console.log('✅ message_type column added');
    } else {
      console.log('✅ message_type column already exists');
    }

    // Check if file_data column exists
    const [fileDataColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'file_data'
    `);

    if (fileDataColumns.length === 0) {
      console.log('📋 Adding file_data column...');
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN file_data LONGTEXT NULL AFTER message_type
      `);
      console.log('✅ file_data column added');
    } else {
      console.log('✅ file_data column already exists');
    }

    // Check if file_name column exists
    const [fileNameColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'file_name'
    `);

    if (fileNameColumns.length === 0) {
      console.log('📋 Adding file_name column...');
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN file_name VARCHAR(500) NULL AFTER file_data
      `);
      console.log('✅ file_name column added');
    } else {
      console.log('✅ file_name column already exists');
    }

    // Check if file_size column exists
    const [fileSizeColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'file_size'
    `);

    if (fileSizeColumns.length === 0) {
      console.log('📋 Adding file_size column...');
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN file_size INT NULL AFTER file_name
      `);
      console.log('✅ file_size column added');
    } else {
      console.log('✅ file_size column already exists');
    }

    // Check if file_type column exists
    const [fileTypeColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'file_type'
    `);

    if (fileTypeColumns.length === 0) {
      console.log('📋 Adding file_type column...');
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN file_type VARCHAR(100) NULL AFTER file_size
      `);
      console.log('✅ file_type column added');
    } else {
      console.log('✅ file_type column already exists');
    }

    // Check if voice_duration column exists
    const [voiceDurationColumns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'voice_duration'
    `);

    if (voiceDurationColumns.length === 0) {
      console.log('📋 Adding voice_duration column...');
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN voice_duration INT NULL AFTER file_type
      `);
      console.log('✅ voice_duration column added');
    } else {
      console.log('✅ voice_duration column already exists');
    }

    // Add index for message_type if it doesn't exist
    const [indexes] = await pool.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND INDEX_NAME = 'idx_message_type'
    `);

    if (indexes.length === 0) {
      console.log('📋 Adding index for message_type...');
      await pool.execute(`
        CREATE INDEX idx_message_type ON discussions (message_type)
      `);
      console.log('✅ Index added');
    } else {
      console.log('✅ Index already exists');
    }

    console.log('✅ All columns and indexes are up to date!');
  } catch (error) {
    console.error('❌ Error updating discussions table:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    try {
      await addMessageTypesToDiscussions();
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  })();
}

export { addMessageTypesToDiscussions };

