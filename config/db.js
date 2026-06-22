import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/** 256MB server default is sufficient for large uploads (350mb express limit uses session override). */
const MIN_RECOMMENDED_PACKET_BYTES = 256 * 1024 * 1024;
const SESSION_PACKET_BYTES = 268435456; // 256MB — matches typical shared-hosting GLOBAL limit

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'hcc',
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

/** Server connection config (no database — used to create DB if missing). */
const serverConfig = {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  connectTimeout: dbConfig.connectTimeout,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

let packetWarningLogged = false;

/**
 * Create the application database if it does not exist.
 * Connects to MySQL without selecting a database first.
 */
const ensureDatabase = async () => {
  let connection;
  try {
    connection = await mysql.createConnection(serverConfig);
    const dbName = dbConfig.database;
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Database '${dbName}' created/verified`);
    return true;
  } catch (error) {
    console.error('❌ Failed to ensure database exists:', error.message);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ MySQL Pool Error:', err.code, '-', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('   Connection lost. Pool will attempt to reconnect.');
  } else if (err.code === 'ECONNREFUSED') {
    console.error('   Connection refused. Please check if MySQL server is running.');
  }
});

// Set SESSION packet size once per new pool connection (quiet if GLOBAL is already 256MB)
pool.on('connection', (connection) => {
  connection.promise()
    .execute(`SET SESSION max_allowed_packet = ${SESSION_PACKET_BYTES}`)
    .catch(() => {});
});

// Test database connection with retry logic
const testConnection = async (retries = 3, delay = 2000) => {
  let ensuredDatabase = false;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const connection = await pool.getConnection();
      console.log('✅ MySQL database connected successfully');
      console.log(`📊 Connected to database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);

      try {
        await connection.execute(`SET SESSION max_allowed_packet = ${SESSION_PACKET_BYTES}`);
      } catch {
        // Ignore if hosting disallows SESSION override
      }

      try {
        const [rows] = await connection.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
        if (rows.length > 0) {
          const packetSize = parseInt(rows[0].Value, 10);
          const packetSizeMB = (packetSize / 1024 / 1024).toFixed(2);
          console.log(`📦 max_allowed_packet: ${packetSizeMB} MB`);
          if (packetSize < MIN_RECOMMENDED_PACKET_BYTES && !packetWarningLogged) {
            packetWarningLogged = true;
            console.warn(
              `⚠️  max_allowed_packet is ${packetSizeMB}MB (< 256MB). Large file uploads may fail. Ask host to raise GLOBAL max_allowed_packet or run: npm run set-max-allowed-packet`,
            );
          }
        }
      } catch {
        // Ignore if we can't check
      }

      connection.release();
      return true;
    } catch (error) {
      const errorCode = error.code || 'UNKNOWN';
      const errorMessage = error.message || 'Unknown error';

      if (errorCode === 'ER_BAD_DB_ERROR' && !ensuredDatabase) {
        console.log(`📦 Database "${dbConfig.database}" not found — creating it...`);
        ensuredDatabase = await ensureDatabase();
        if (ensuredDatabase) {
          console.log('🔄 Retrying connection...');
          continue;
        }
      }

      if (attempt < retries) {
        console.warn(`⚠️  Database connection attempt ${attempt}/${retries} failed: ${errorCode} - ${errorMessage}`);
        console.log(`🔄 Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        console.error('❌ Database connection failed after all retries');
        console.error(`   Error Code: ${errorCode}`);
        console.error(`   Error Message: ${errorMessage}`);
        console.error(`   Host: ${dbConfig.host}:${dbConfig.port}`);
        console.error(`   Database: ${dbConfig.database}`);
        console.error(`   User: ${dbConfig.user}`);

        if (errorCode === 'ECONNREFUSED') {
          console.error('\n💡 Troubleshooting tips:');
          console.error('   1. Make sure MySQL server is running');
          console.error('   2. Check if MySQL is listening on port', dbConfig.port);
          console.error('   3. Verify host and port in .env file');
          console.error('   4. Try: mysql -h ' + dbConfig.host + ' -P ' + dbConfig.port + ' -u ' + dbConfig.user);
        } else if (errorCode === 'ER_ACCESS_DENIED_ERROR' || errorCode === 'ER_DBACCESS_DENIED_ERROR') {
          console.error('\n💡 Troubleshooting tips:');
          console.error('   1. Check database credentials in .env file');
          console.error('   2. Verify user has access to database:', dbConfig.database);
          console.error('   3. Try: mysql -h ' + dbConfig.host + ' -u ' + dbConfig.user + ' -p');
        } else if (errorCode === 'ER_BAD_DB_ERROR') {
          console.error('\n💡 Troubleshooting tips:');
          console.error('   1. Database "' + dbConfig.database + '" does not exist');
          console.error('   2. Ensure the MySQL user can CREATE DATABASE');
        }

        return false;
      }
    }
  }
  return false;
};

export { pool, testConnection, ensureDatabase, dbConfig };
export default pool;
