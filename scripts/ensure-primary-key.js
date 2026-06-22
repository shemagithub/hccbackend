import { pool } from '../config/db.js';

async function tableExists(tableName) {
  const [rows] = await pool.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function hasPrimaryKey(tableName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'PRIMARY KEY'`,
    [tableName]
  );
  return Number(rows[0].count) > 0;
}

async function hasIdColumn(tableName, idColumn = 'id') {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, idColumn]
  );
  return rows.length > 0;
}

async function deduplicateIds(tableName, idColumn = 'id') {
  const [duplicateIds] = await pool.execute(
    `SELECT \`${idColumn}\` AS id FROM \`${tableName}\`
     GROUP BY \`${idColumn}\` HAVING COUNT(*) > 1`
  );

  for (const { id } of duplicateIds) {
    const [[{ cnt }]] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM \`${tableName}\` WHERE \`${idColumn}\` = ?`,
      [id]
    );
    const excess = Number(cnt) - 1;
    if (excess > 0) {
      await pool.execute(
        `DELETE FROM \`${tableName}\` WHERE \`${idColumn}\` = ? LIMIT ${excess}`,
        [id]
      );
    }
  }
}

/**
 * Ensure a table has an auto-increment primary key on `id`.
 * Repairs legacy tables imported or created without PRIMARY KEY.
 */
export async function ensurePrimaryKey(tableName, idColumn = 'id') {
  if (!(await tableExists(tableName))) {
    return false;
  }

  if (!(await hasIdColumn(tableName, idColumn))) {
    return false;
  }

  if (await hasPrimaryKey(tableName)) {
    return false;
  }

  console.log(`🔧 Repairing ${tableName} table schema (adding primary key)...`);

  await deduplicateIds(tableName, idColumn);
  await pool.execute(
    `ALTER TABLE \`${tableName}\` MODIFY \`${idColumn}\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY`
  );

  console.log(`✅ ${tableName} primary key ready`);
  return true;
}

/**
 * Scan the current database and repair every base table missing a primary key.
 */
export async function repairAllMissingPrimaryKeys() {
  const [tables] = await pool.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`
  );

  let repaired = 0;
  for (const { TABLE_NAME: tableName } of tables) {
    const fixed = await ensurePrimaryKey(tableName);
    if (fixed) repaired += 1;
  }

  if (repaired > 0) {
    console.log(`✅ Repaired primary keys on ${repaired} table(s)\n`);
  }

  return repaired;
}
