import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hcc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Note: max_allowed_packet is a server-level setting (GLOBAL)
  // It cannot be set per connection, but new connections will use the GLOBAL value
  // Run: npm run set-max-allowed-packet to set GLOBAL max_allowed_packet to 300MB
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ MySQL Pool Error:', err.code, '-', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('   Connection lost. Pool will attempt to reconnect.');
  } else if (err.code === 'ECONNREFUSED') {
    console.error('   Connection refused. Please check if MySQL server is running.');
  }
});

// Add a hook to verify max_allowed_packet on connection (for debugging)
pool.on('connection', async (connection) => {
  try {
    const [rows] = await connection.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
    if (rows.length > 0) {
      const packetSize = parseInt(rows[0].Value);
      const packetSizeMB = (packetSize / 1024 / 1024).toFixed(2);
      if (packetSize < 314572800) { // Less than 300MB
        console.warn(`⚠️  Connection max_allowed_packet is ${packetSizeMB}MB (should be 300MB). Run: npm run set-max-allowed-packet`);
      }
    }
  } catch (err) {
    // Ignore if we can't check
  }
});

// Note: max_allowed_packet is set at MySQL server level (GLOBAL)
// Run: npm run set-max-allowed-packet to set it to 300MB (to support 200MB files)
// New connections will automatically use the GLOBAL setting

// Test database connection with retry logic
const testConnection = async (retries = 3, delay = 2000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const connection = await pool.getConnection();
      console.log('✅ MySQL database connected successfully');
      console.log(`📊 Connected to database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
      
      // Set SESSION max_allowed_packet for this connection (300MB = 314572800 bytes)
      try {
        await connection.execute("SET SESSION max_allowed_packet = 314572800");
      } catch (err) {
        // Ignore if we can't set it
      }
      
      // Verify max_allowed_packet setting
      try {
        const [rows] = await connection.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
        if (rows.length > 0) {
          const packetSize = parseInt(rows[0].Value);
          const packetSizeMB = (packetSize / 1024 / 1024).toFixed(2);
          console.log(`📦 max_allowed_packet: ${packetSizeMB} MB`);
          if (packetSize < 314572800) {
            console.warn('⚠️  max_allowed_packet is less than 300MB. Run: npm run set-max-allowed-packet');
          }
        }
      } catch (err) {
        // Ignore if we can't check
      }
      
      connection.release();
      return true;
    } catch (error) {
      const errorCode = error.code || 'UNKNOWN';
      const errorMessage = error.message || 'Unknown error';
      
      if (attempt < retries) {
        console.warn(`⚠️  Database connection attempt ${attempt}/${retries} failed: ${errorCode} - ${errorMessage}`);
        console.log(`🔄 Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        console.error('❌ Database connection failed after all retries');
        console.error(`   Error Code: ${errorCode}`);
        console.error(`   Error Message: ${errorMessage}`);
        console.error(`   Host: ${dbConfig.host}:${dbConfig.port}`);
        console.error(`   Database: ${dbConfig.database}`);
        console.error(`   User: ${dbConfig.user}`);
        
        // Provide helpful error messages based on error code
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
          console.error('   2. Create the database: CREATE DATABASE ' + dbConfig.database + ';');
        }
        
        return false;
      }
    }
  }
  return false;
};

export { pool, testConnection };
export default pool;

