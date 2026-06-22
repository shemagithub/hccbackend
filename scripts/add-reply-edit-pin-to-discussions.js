import pool from '../config/db.js';
import Discussion from '../models/Discussion.js';

async function addReplyEditPinToDiscussions() {
  try {
    console.log('🔄 Starting migration: Add reply, edit, pin features to discussions...');
    
    // Ensure table exists
    await Discussion.createTable();
    
    // Check and add reply_to_id column (for replies)
    const [replyColumn] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'reply_to_id'
    `);
    
    if (replyColumn.length === 0) {
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN reply_to_id INT NULL,
        ADD CONSTRAINT fk_reply_to 
        FOREIGN KEY (reply_to_id) REFERENCES discussions(id) ON DELETE CASCADE
      `);
      console.log('✅ Added reply_to_id column');
    } else {
      console.log('ℹ️  reply_to_id column already exists');
    }
    
    // Check and add edited_at column
    const [editedColumn] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'edited_at'
    `);
    
    if (editedColumn.length === 0) {
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN edited_at TIMESTAMP NULL
      `);
      console.log('✅ Added edited_at column');
    } else {
      console.log('ℹ️  edited_at column already exists');
    }
    
    // Check and add is_deleted column
    const [deletedColumn] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'is_deleted'
    `);
    
    if (deletedColumn.length === 0) {
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN deleted_at TIMESTAMP NULL,
        ADD COLUMN deleted_by INT NULL
      `);
      console.log('✅ Added is_deleted, deleted_at, deleted_by columns');
    } else {
      console.log('ℹ️  is_deleted column already exists');
    }
    
    // Check and add is_pinned column
    const [pinnedColumn] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discussions' 
      AND COLUMN_NAME = 'is_pinned'
    `);
    
    if (pinnedColumn.length === 0) {
      await pool.execute(`
        ALTER TABLE discussions 
        ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE,
        ADD COLUMN pinned_at TIMESTAMP NULL,
        ADD COLUMN pinned_by INT NULL,
        ADD INDEX idx_pinned (is_pinned, pinned_at)
      `);
      console.log('✅ Added is_pinned, pinned_at, pinned_by columns');
    } else {
      console.log('ℹ️  is_pinned column already exists');
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addReplyEditPinToDiscussions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default addReplyEditPinToDiscussions;

