import pool from '../config/db.js';

async function addColumnIfMissing(tableName, columnName, definition) {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  if (rows.length === 0) {
    await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    console.log(`✅ Added ${tableName}.${columnName}`);
  } else {
    console.log(`ℹ️  ${tableName}.${columnName} already exists`);
  }
}

let awardedDecisionFieldsReady = false;

export async function addAwardedDecisionFields() {
  if (awardedDecisionFieldsReady) return;

  console.log('🔄 Adding awarded decision fields to EOIs and opportunity proposals...');

  await addColumnIfMissing(
    'eois',
    'decision',
    "ENUM('pending', 'under_review', 'awarded', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending' AFTER status"
  );
  await addColumnIfMissing('eois', 'implementation_start_date', 'DATE NULL AFTER decision');
  await addColumnIfMissing('eois', 'implementation_due_date', 'DATE NULL AFTER implementation_start_date');
  await addColumnIfMissing('eois', 'implementation_id', 'INT NULL AFTER implementation_due_date');

  await addColumnIfMissing(
    'opportunity_proposals',
    'decision',
    "ENUM('pending', 'under_review', 'awarded', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending' AFTER financial_status"
  );
  await addColumnIfMissing(
    'opportunity_proposals',
    'implementation_start_date',
    'DATE NULL AFTER decision'
  );
  await addColumnIfMissing(
    'opportunity_proposals',
    'implementation_due_date',
    'DATE NULL AFTER implementation_start_date'
  );
  await addColumnIfMissing(
    'opportunity_proposals',
    'implementation_id',
    'INT NULL AFTER implementation_due_date'
  );

  console.log('✅ Awarded decision fields migration complete');
  awardedDecisionFieldsReady = true;
}
