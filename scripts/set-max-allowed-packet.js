import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/** Minimum acceptable on shared hosting (256MB). */
const TARGET_PACKET_BYTES = 268435456;
const MIN_ACCEPTABLE_BYTES = TARGET_PACKET_BYTES;

async function readPacketSize(connection, scope = 'SESSION') {
  const sql =
    scope === 'GLOBAL'
      ? "SHOW GLOBAL VARIABLES LIKE 'max_allowed_packet'"
      : "SHOW VARIABLES LIKE 'max_allowed_packet'";
  const [rows] = await connection.execute(sql);
  if (!rows.length) return 0;
  return parseInt(rows[0].Value, 10) || 0;
}

function formatMb(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

async function setMaxAllowedPacket() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hcc',
    });

    console.log('🔗 Connected to MySQL server');

    const globalBytes = await readPacketSize(connection, 'GLOBAL');
    const sessionBytes = await readPacketSize(connection, 'SESSION');

    console.log(`📊 GLOBAL max_allowed_packet: ${globalBytes} bytes (${formatMb(globalBytes)} MB)`);
    console.log(`📊 SESSION max_allowed_packet: ${sessionBytes} bytes (${formatMb(sessionBytes)} MB)`);

    if (globalBytes >= MIN_ACCEPTABLE_BYTES) {
      console.log('\n✅ max_allowed_packet is already at least 256MB — no change needed.');
      console.log('   On shared hosting, GLOBAL is set by the host and cannot be changed without SUPER.');
      console.log('   Your HCC app is configured to work with 256MB.');
      process.exit(0);
    }

    console.log(`\n⚠️  max_allowed_packet is below ${formatMb(MIN_ACCEPTABLE_BYTES)}MB. Attempting to raise it...`);

    let globalUpdated = false;
    try {
      await connection.execute(`SET GLOBAL max_allowed_packet = ${TARGET_PACKET_BYTES}`);
      console.log('✅ Set GLOBAL max_allowed_packet to 256MB');
      globalUpdated = true;
    } catch (error) {
      console.log('ℹ️  GLOBAL not changed (host restricts this user):', error.message);
      console.log('   Ask your hosting provider to set max_allowed_packet=256M in MySQL, or use cPanel → MySQL settings.');
    }

    try {
      await connection.execute(`SET SESSION max_allowed_packet = ${TARGET_PACKET_BYTES}`);
      console.log('✅ Set SESSION max_allowed_packet to 256MB');
    } catch (error) {
      if (globalBytes >= MIN_ACCEPTABLE_BYTES) {
        console.log('ℹ️  SESSION is read-only because GLOBAL already defines the limit — this is normal.');
      } else {
        console.log('ℹ️  SESSION not changed:', error.message);
      }
    }

    const globalAfter = await readPacketSize(connection, 'GLOBAL');
    const sessionAfter = await readPacketSize(connection, 'SESSION');
    console.log(`\n📊 After check — GLOBAL: ${formatMb(globalAfter)} MB, SESSION: ${formatMb(sessionAfter)} MB`);

    if (globalAfter >= MIN_ACCEPTABLE_BYTES || sessionAfter >= MIN_ACCEPTABLE_BYTES) {
      console.log('\n✅ Packet size is sufficient for HCC file uploads.');
      if (globalUpdated) {
        console.log('💡 Restart the Node.js app (Passenger/cPanel) so new connections pick up GLOBAL changes.');
      }
      process.exit(0);
    }

    console.error('\n❌ max_allowed_packet is still too small for large uploads.');
    console.error('   Contact hosting support to increase GLOBAL max_allowed_packet to 256M.');
    process.exit(1);
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
