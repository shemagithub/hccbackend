import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function setMaxAllowedPacket() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hcc',
    });

    console.log('🔗 Connected to MySQL server');

    // Set max_allowed_packet to 300MB to support 200MB files (Base64 encoding increases size by ~33%)
    // 300MB = 314572800 bytes
    const maxPacketSize = 314572800; // 300MB
    
    // Try to set GLOBAL max_allowed_packet (requires SUPER privilege)
    try {
      await connection.execute(`SET GLOBAL max_allowed_packet = ${maxPacketSize}`);
      console.log('✅ Set GLOBAL max_allowed_packet to 300MB');
    } catch (error) {
      console.warn('⚠️  Could not set GLOBAL max_allowed_packet (requires SUPER privilege):', error.message);
      console.log('💡 You can set it manually in MySQL config file or run as root user');
    }

    // Set SESSION max_allowed_packet (works for current session)
    try {
      await connection.execute(`SET SESSION max_allowed_packet = ${maxPacketSize}`);
      console.log('✅ Set SESSION max_allowed_packet to 300MB');
    } catch (error) {
      console.warn('⚠️  Could not set SESSION max_allowed_packet:', error.message);
    }

    // Verify current settings
    const [globalRows] = await connection.execute("SHOW GLOBAL VARIABLES LIKE 'max_allowed_packet'");
    if (globalRows.length > 0) {
      console.log(`📊 GLOBAL max_allowed_packet: ${globalRows[0].Value} bytes (${(parseInt(globalRows[0].Value) / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    const [sessionRows] = await connection.execute("SHOW VARIABLES LIKE 'max_allowed_packet'");
    if (sessionRows.length > 0) {
      console.log(`📊 SESSION max_allowed_packet: ${sessionRows[0].Value} bytes (${(parseInt(sessionRows[0].Value) / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    console.log('\n💡 Note: You may need to restart your MySQL server or backend application for the GLOBAL setting to take effect for all connections.');

    console.log('🎉 Script completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setMaxAllowedPacket();

