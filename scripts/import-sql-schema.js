import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { dbConfig, ensureDatabase } from '../config/db.js';

dotenv.config();

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Resolve SQL schema file (production dump from cPanel/phpMyAdmin). */
export function resolveSchemaSqlPath() {
  const candidates = [
    process.env.SCHEMA_SQL_PATH,
    path.join(moduleDir, '../sql/guzedeveloper_hcc.sql'),
    path.join(moduleDir, '../sql/schema.sql'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

/** Minimum tables expected from guzedeveloper_hcc.sql (76 CREATE TABLE statements). */
const EXPECTED_MIN_TABLES = Number(process.env.SCHEMA_MIN_TABLES) || 70;

/** Count application tables in the configured database. */
export async function getTableCount(connection) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [dbConfig.database],
  );
  return Number(rows[0]?.count || 0);
}

/** True when the database has the full application schema. */
export async function isSchemaComplete(connection) {
  const count = await getTableCount(connection);
  return count >= EXPECTED_MIN_TABLES;
}

function prepareSqlDump(sql) {
  return sql
    .replace(/^CREATE DATABASE\b.*$/gim, '')
    .replace(/^USE\s+`?[\w-]+`?\s*;?\s*$/gim, '')
    .replace(/\bDEFINER\s*=\s*`[^`]+`@`[^`]+`/gi, '')
    .trim();
}

function stripLeadingComments(sql) {
  return sql
    .replace(/^(\s*--[^\n]*\n)+/g, '')
    .replace(/^(\s*\/\*[\s\S]*?\*\/\s*)+/g, '')
    .trim();
}

/** Replace very large string literals (base64 blobs) with NULL so imports work on 1MB packet limits. */
function shrinkLargeLiterals(sql, maxLiteralChars = 65535) {
  if (Buffer.byteLength(sql, 'utf8') <= 900_000) {
    return sql;
  }

  return sql.replace(/'((?:\\.|[^'\\])*)'/g, (match, inner) => {
    if (inner.length > maxLiteralChars) {
      return 'NULL';
    }
    return match;
  });
}

/** Split a multi-row INSERT into smaller batches (handles large blob fields). */
function splitInsertIntoBatches(sql, maxBytes = 800_000) {
  const shrunk = shrinkLargeLiterals(sql);
  if (Buffer.byteLength(shrunk, 'utf8') <= maxBytes) {
    return [shrunk];
  }

  const headerMatch = shrunk.match(/^(INSERT INTO\s+[`"]?[\w]+[`"]?\s*\([^)]+\)\s*VALUES)\s*/is);
  if (!headerMatch) {
    return [shrunk];
  }

  const header = headerMatch[1];
  let rest = shrunk.slice(headerMatch[0].length).trim().replace(/;\s*$/, '');

  const rows = [];
  let depth = 0;
  let current = '';
  let inString = false;
  let quote = '';

  for (let i = 0; i < rest.length; i++) {
    const char = rest[i];

    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      quote = char;
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      if (char === quote && rest[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    current += char;

    if (depth === 0 && char === ')') {
      rows.push(current.trim());
      current = '';
      while (i + 1 < rest.length && /[\s,]/.test(rest[i + 1])) {
        i += 1;
      }
    }
  }

  if (rows.length <= 1) {
    return [shrunk];
  }

  const batches = [];
  let batchRows = [];
  let batchSize = Buffer.byteLength(header, 'utf8');

  for (const row of rows) {
    const rowSize = Buffer.byteLength(row, 'utf8');
    if (batchRows.length > 0 && batchSize + rowSize + 2 > maxBytes) {
      batches.push(`${header}\n${batchRows.join(',\n')}`);
      batchRows = [];
      batchSize = Buffer.byteLength(header, 'utf8');
    }
    batchRows.push(row);
    batchSize += rowSize + 2;
  }

  if (batchRows.length > 0) {
    batches.push(`${header}\n${batchRows.join(',\n')}`);
  }

  return batches;
}

async function createImportConnection() {
  return mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    connectTimeout: 60000,
    enableKeepAlive: true,
    multipleStatements: false,
  });
}

async function prepareImportConnection(connection) {
  await connection.query('SET NAMES utf8mb4');
  try {
    await connection.query('SET SESSION max_allowed_packet = 268435456');
  } catch {
    // Some hosts disallow SESSION override
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
}

/** Check whether core seed data (users) is still missing. */
export async function needsSeedData(connection) {
  try {
    const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM staff');
    return Number(rows[0]?.count || 0) === 0;
  } catch {
    return true;
  }
}

async function truncateAllTables(connection) {
  const [tables] = await connection.execute(
    `SELECT table_name AS tableName
     FROM information_schema.tables
     WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [dbConfig.database],
  );
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const { tableName } of tables) {
    await connection.query(`TRUNCATE TABLE \`${tableName}\``);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log(`   Cleared ${tables.length} tables before seed import`);
}

/** Split phpMyAdmin dump into executable statements. */
function splitSqlStatements(sql) {
  const cleaned = prepareSqlDump(sql);
  const parts = cleaned.split(/;\s*\r?\n/);

  return parts
    .map((part) => stripLeadingComments(part))
    .filter((part) => part.length > 0);
}

async function executeSqlStatements(initialConnection, sql, { includeData = true, dataOnly = false } = {}) {
  const statements = splitSqlStatements(prepareSqlDump(sql));
  const mode = dataOnly
    ? 'seed data only'
    : includeData
      ? 'schema + data'
      : 'schema only (no INSERTs)';
  console.log(`   Executing ${statements.length} SQL statements (${mode})...`);

  let connection = initialConnection;
  let executed = 0;
  let skipped = 0;

  const runQuery = async (query) => {
    try {
      await connection.query(query);
    } catch (error) {
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
        await connection.end().catch(() => {});
        connection = await createImportConnection();
        await prepareImportConnection(connection);
        await connection.query(query);
        return connection;
      }
      throw error;
    }
    return connection;
  };

  for (const statement of statements) {
    const normalized = statement.trim();
    const upper = normalized.toUpperCase();

    if (
      upper === 'START TRANSACTION' ||
      upper === 'COMMIT' ||
      upper === ';' ||
      upper.startsWith('/*!40101 SET @OLD_') ||
      upper.startsWith('/*!40101 SET CHARACTER_SET') ||
      upper.startsWith('/*!40101 SET COLLATION_CONNECTION')
    ) {
      continue;
    }

    if (dataOnly && !upper.startsWith('INSERT INTO')) {
      continue;
    }

    if (!includeData && !dataOnly && upper.startsWith('INSERT INTO')) {
      skipped += 1;
      continue;
    }

    const chunks = upper.startsWith('INSERT INTO')
      ? splitInsertIntoBatches(shrinkLargeLiterals(normalized))
      : [normalized];

    for (const chunk of chunks) {
      const preview = chunk.replace(/\s+/g, ' ').slice(0, 80);
      try {
        connection = await runQuery(chunk);
        executed += 1;
        if (executed % 50 === 0) {
          console.log(`   ... ${executed} statements done`);
        }
      } catch (error) {
        console.error(`❌ Failed on statement ${executed + 1}: ${preview}...`);
        throw error;
      }
    }
  }

  if (skipped > 0) {
    console.log(`   Skipped ${skipped} INSERT statements (set SCHEMA_INCLUDE_DATA=true to import seed data)`);
  }

  return { executed, connection };
}

/**
 * Import tables, indexes, and seed data from the phpMyAdmin SQL dump.
 * @param {{ force?: boolean, sqlPath?: string, includeData?: boolean }} options
 */
export async function importSqlSchema({ force = false, sqlPath, includeData, dataOnly = false } = {}) {
  let shouldDropTables = force;
  const importData =
    includeData ??
    (process.env.SCHEMA_INCLUDE_DATA !== 'false' && process.env.SCHEMA_INCLUDE_DATA !== '0');
  const resolvedPath = sqlPath ? path.resolve(sqlPath) : resolveSchemaSqlPath();
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(
      'SQL schema file not found. Set SCHEMA_SQL_PATH or place guzedeveloper_hcc.sql in hccbackend/sql/',
    );
  }

  await ensureDatabase();

  let connection = await createImportConnection();

  try {
    const tableCount = await getTableCount(connection);
    const complete = tableCount >= EXPECTED_MIN_TABLES;
    const seedMissing = importData && (await needsSeedData(connection));

    if (complete && seedMissing && !shouldDropTables) {
      console.log(`📥 Tables exist (${tableCount}) but seed data is missing — importing data from SQL dump...`);
      dataOnly = true;
      await truncateAllTables(connection);
    } else if (complete && !seedMissing && !shouldDropTables) {
      console.log(
        `ℹ️  Database "${dbConfig.database}" is up to date (${tableCount} tables, seed data present) — skipping import`,
      );
      console.log('   Use FORCE_SCHEMA_IMPORT=true or npm run import-schema -- --force to re-import');
      return { imported: false, skipped: true, sqlPath: resolvedPath, tableCount };
    } else if (complete && !importData && !shouldDropTables) {
      console.log(
        `ℹ️  Database "${dbConfig.database}" schema is complete (${tableCount} tables) — skipping SQL import`,
      );
      console.log('   Set SCHEMA_INCLUDE_DATA=true to import seed data');
      return { imported: false, skipped: true, sqlPath: resolvedPath, tableCount };
    }

    if (tableCount > 0 && !shouldDropTables && !dataOnly) {
      console.log(
        `⚠️  Incomplete schema (${tableCount}/${EXPECTED_MIN_TABLES}+ tables) — re-importing from SQL dump...`,
      );
      shouldDropTables = true;
    }

    if (tableCount > 0 && shouldDropTables) {
      console.log('⚠️  Dropping existing tables before SQL import...');
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      const [tables] = await connection.execute(
        `SELECT table_name AS tableName
         FROM information_schema.tables
         WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
        [dbConfig.database],
      );
      for (const { tableName } of tables) {
        await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log(`📥 Importing from: ${resolvedPath}`);
    const rawSql = fs.readFileSync(resolvedPath, 'utf8');

    await prepareImportConnection(connection);
    const { executed, connection: activeConnection } = await executeSqlStatements(connection, rawSql, {
      includeData: importData,
      dataOnly,
    });
    connection = activeConnection;
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`   ${executed} statements executed`);

    const [deptRows] = await connection.execute('SELECT COUNT(*) AS count FROM departments');
    const [staffRows] = await connection.execute('SELECT COUNT(*) AS count FROM staff');
    const seedDepartments = Number(deptRows[0]?.count || 0);
    const seedStaff = Number(staffRows[0]?.count || 0);

    const [countRows] = await connection.execute(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [dbConfig.database],
    );
    const finalTableCount = Number(countRows[0]?.count || 0);

    console.log(
      `✅ SQL import complete (${finalTableCount} tables, ${seedDepartments} departments, ${seedStaff} staff)`,
    );
    return {
      imported: true,
      skipped: false,
      tableCount: finalTableCount,
      seedDepartments,
      seedStaff,
      sqlPath: resolvedPath,
      dataOnly,
    };
  } finally {
    await connection.end();
  }
}

/** Import SQL schema only when the database has no tables yet. */
export async function ensureSchemaFromSql() {
  const sqlPath = resolveSchemaSqlPath();
  if (!sqlPath) {
    console.log('ℹ️  No SQL schema file found — skipping automatic table creation');
    return { imported: false, skipped: true, reason: 'no-sql-file' };
  }

  const force = process.env.FORCE_SCHEMA_IMPORT === 'true';
  return importSqlSchema({ force });
}

const isMainModule =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));

if (isMainModule) {
  const force = process.argv.includes('--force') || process.env.FORCE_SCHEMA_IMPORT === 'true';
  importSqlSchema({ force })
    .then((result) => {
      if (!result.imported && !result.skipped) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ SQL schema import failed:', error.message);
      process.exit(1);
    });
}
