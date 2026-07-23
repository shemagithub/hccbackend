import pool from '../config/db.js';

/** Add missing columns to an existing table (MySQL-safe, no IF NOT EXISTS). */
export async function ensureTableColumns(tableName, columns) {
  for (const column of columns) {
    const [rows] = await pool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, column.name]
    );

    if (rows.length === 0) {
      await pool.execute(`ALTER TABLE \`${tableName}\` ${column.ddl}`);
      console.log(`Added ${tableName}.${column.name}`);
    }
  }
}
