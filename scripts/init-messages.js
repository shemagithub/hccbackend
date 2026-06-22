import pool from '../config/db.js';

export async function initializeMessagesTable() {
  try {
    console.log('Creating messages table...');

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        content TEXT NOT NULL,
        message_type ENUM('text', 'voice', 'image', 'file') DEFAULT 'text',
        voice_duration INT NULL COMMENT 'Duration in seconds for voice messages',
        file_name VARCHAR(255) NULL COMMENT 'Original filename for file messages',
        file_size INT NULL COMMENT 'File size in bytes',
        status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES staff(id) ON DELETE CASCADE,
        INDEX idx_sender_receiver (sender_id, receiver_id),
        INDEX idx_receiver_status (receiver_id, status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Messages table created successfully');

    const [countResult] = await pool.execute('SELECT COUNT(*) as count FROM messages');
    if (countResult[0].count > 0) {
      console.log(`📊 Messages table already has ${countResult[0].count} record(s), skipping sample data`);
      return true;
    }

    const [staffRows] = await pool.execute('SELECT id FROM staff ORDER BY id ASC LIMIT 3');
    if (staffRows.length < 2) {
      console.log('ℹ️  Not enough staff records for sample messages, skipping sample data');
      return true;
    }

    const [senderId, receiverId, thirdId] = staffRows.map((row) => row.id);
    const sampleMessages = [
      { sender_id: senderId, receiver_id: receiverId, content: 'Hello! How are you doing today?', message_type: 'text', status: 'read' },
      { sender_id: receiverId, receiver_id: senderId, content: "Hi! I'm doing great, thanks for asking.", message_type: 'text', status: 'read' },
      { sender_id: senderId, receiver_id: thirdId ?? receiverId, content: 'Can we schedule a meeting for tomorrow?', message_type: 'text', status: 'delivered' },
    ];

    for (const message of sampleMessages) {
      await pool.execute(
        `INSERT INTO messages (sender_id, receiver_id, content, message_type, status, created_at)
         VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 7) DAY)`,
        [message.sender_id, message.receiver_id, message.content, message.message_type, message.status]
      );
    }

    console.log('✅ Sample messages inserted successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing messages table:', error);
    throw error;
  }
}

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeMessagesTable()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch(() => process.exit(1));
}
