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
  // Note: max_allowed_packet is a server-level setting (GLOBAL)
  // It cannot be set per connection, but new connections will use the GLOBAL value
  // Run: npm run set-max-allowed-packet to set GLOBAL max_allowed_packet to 300MB
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

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

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL database connected successfully');
    console.log(`📊 Connected to database: ${dbConfig.database}`);
    
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
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

export { pool, testConnection };
export default pool;

