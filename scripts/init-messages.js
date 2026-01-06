import pool, { testConnection } from '../config/db.js';

export async function initializeMessagesTable() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Cannot initialize messages table: Database not connected.');
    return false;
  }

  try {
    console.log('Creating messages table...');

    // Create messages table
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

        // Insert sample messages using valid staff IDs (11, 12, 13)
        const sampleMessages = [
          {
            sender_id: 11,
            receiver_id: 12,
            content: "Hello! How are you doing today?",
            message_type: "text",
            status: "read"
          },
          {
            sender_id: 12,
            receiver_id: 11,
            content: "Hi! I'm doing great, thanks for asking. How about you?",
            message_type: "text",
            status: "read"
          },
          {
            sender_id: 11,
            receiver_id: 13,
            content: "Can we schedule a meeting for tomorrow?",
            message_type: "text",
            status: "delivered"
          },
          {
            sender_id: 13,
            receiver_id: 11,
            content: "Sure! What time works best for you?",
            message_type: "text",
            status: "read"
          },
          {
            sender_id: 12,
            receiver_id: 13,
            content: "The project report is ready for review",
            message_type: "text",
            status: "sent"
          },
          {
            sender_id: 13,
            receiver_id: 12,
            content: "Thanks for the update on the construction progress",
            message_type: "text",
            status: "read"
          },
          {
            sender_id: 11,
            receiver_id: 13,
            content: "Meeting reminder: Team standup at 9 AM",
            message_type: "text",
            status: "delivered"
          },
          {
            sender_id: 12,
            receiver_id: 11,
            content: "Budget approval needed for the new equipment",
            message_type: "text",
            status: "sent"
          }
        ];

    for (const message of sampleMessages) {
      await pool.execute(
        `INSERT INTO messages (sender_id, receiver_id, content, message_type, status, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND() * 7) DAY)`,
        [message.sender_id, message.receiver_id, message.content, message.message_type, message.status]
      );
    }

    console.log('✅ Sample messages inserted successfully');

    // Get message count
    const [countResult] = await pool.execute('SELECT COUNT(*) as count FROM messages');
    console.log(`📊 Total messages in database: ${countResult[0].count}`);

    return true;
  } catch (error) {
    console.error('❌ Error initializing messages table:', error);
    return false;
  }
}

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeMessagesTable()
    .then((success) => {
      if (success) {
        console.log('✅ Messages table initialization completed successfully');
      } else {
        console.log('❌ Messages table initialization failed');
      }
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}
