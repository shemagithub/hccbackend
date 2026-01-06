import pool from '../config/db.js';

export class MessageController {
  // Create a new message
  static async createMessage(req, res) {
    try {
      const {
        senderId,
        receiverId,
        content,
        messageType = 'text',
        voiceDuration,
        fileName,
        fileSize
      } = req.body;

      // Validation
      if (!senderId || !receiverId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: senderId, receiverId, and content are required'
        });
      }

      // Validate message type
      const validTypes = ['text', 'voice', 'image', 'file'];
      if (!validTypes.includes(messageType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid message type. Must be one of: text, voice, image, file'
        });
      }

      // Check if sender and receiver exist
      const [sender] = await pool.execute('SELECT id FROM staff WHERE id = ?', [senderId]);
      const [receiver] = await pool.execute('SELECT id FROM staff WHERE id = ?', [receiverId]);

      if (sender.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sender not found'
        });
      }

      if (receiver.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Receiver not found'
        });
      }

      // Insert message
      const [result] = await pool.execute(
        `INSERT INTO messages (sender_id, receiver_id, content, message_type, voice_duration, file_name, file_size, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', NOW())`,
        [senderId, receiverId, content, messageType, voiceDuration || null, fileName || null, fileSize || null]
      );

      // Get the created message
      const [newMessage] = await pool.execute(
        `SELECT m.*, s.first_name as sender_first_name, s.last_name as sender_last_name, 
                r.first_name as receiver_first_name, r.last_name as receiver_last_name
         FROM messages m
         LEFT JOIN staff s ON m.sender_id = s.id
         LEFT JOIN staff r ON m.receiver_id = r.id
         WHERE m.id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: newMessage[0]
      });
    } catch (error) {
      console.error('Create message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error.message
      });
    }
  }

  // Get messages between two users
  static async getMessages(req, res) {
    try {
      const { senderId, receiverId, userId } = req.query;
      const { page = 1, limit = 50 } = req.query;

      if (!senderId || !receiverId) {
        return res.status(400).json({
          success: false,
          message: 'Both senderId and receiverId are required'
        });
      }

      // Optional server-side guard: if userId is provided, enforce it matches one side of the conversation
      if (userId && parseInt(userId) !== parseInt(senderId) && parseInt(userId) !== parseInt(receiverId)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: requester must be a participant in this conversation'
        });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Get messages between the two users
      const [messages] = await pool.execute(
        `SELECT m.*, s.first_name as sender_first_name, s.last_name as sender_last_name,
                s.profile_image as sender_profile_image
         FROM messages m
         LEFT JOIN staff s ON m.sender_id = s.id
         WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
         ORDER BY m.created_at ASC
         LIMIT ? OFFSET ?`,
        [senderId, receiverId, receiverId, senderId, parseInt(limit), offset]
      );

      // Get total count
      const [countResult] = await pool.execute(
        `SELECT COUNT(*) as total FROM messages 
         WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
        [senderId, receiverId, receiverId, senderId]
      );

      res.json({
        success: true,
        data: messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total
        }
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages',
        error: error.message
      });
    }
  }

  // Get conversations for a user
  static async getConversations(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Simplified query to get conversations
      const [conversations] = await pool.execute(
        `SELECT DISTINCT 
           CASE 
             WHEN m.sender_id = ? THEN m.receiver_id
             ELSE m.sender_id
           END as participant_id,
           s.first_name, s.last_name, s.email, s.profile_image, s.status,
           MAX(m.created_at) as last_activity,
           COUNT(CASE WHEN m.receiver_id = ? AND m.status != 'read' THEN 1 END) as unread_count
         FROM messages m
         LEFT JOIN staff s ON CASE 
           WHEN m.sender_id = ? THEN m.receiver_id
           ELSE m.sender_id
         END = s.id
         WHERE m.sender_id = ? OR m.receiver_id = ?
         GROUP BY participant_id, s.first_name, s.last_name, s.email, s.profile_image, s.status
         ORDER BY last_activity DESC
         LIMIT ? OFFSET ?`,
        [userId, userId, userId, userId, userId, parseInt(limit), offset]
      );

      // Get last message for each conversation
      const conversationsWithLastMessage = await Promise.all(
        conversations.map(async (conv) => {
          const [lastMessage] = await pool.execute(
            `SELECT content, message_type FROM messages 
             WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
             ORDER BY created_at DESC LIMIT 1`,
            [userId, conv.participant_id, conv.participant_id, userId]
          );

          return {
            ...conv,
            last_message_content: lastMessage[0]?.content || null,
            last_message_type: lastMessage[0]?.message_type || 'text'
          };
        })
      );

      res.json({
        success: true,
        data: conversationsWithLastMessage
      });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversations',
        error: error.message
      });
    }
  }

  // Mark messages as read
  static async markAsRead(req, res) {
    try {
      const { userId, senderId } = req.body;

      if (!userId || !senderId) {
        return res.status(400).json({
          success: false,
          message: 'Both userId and senderId are required'
        });
      }

      // Mark messages from sender to user as read
      const [result] = await pool.execute(
        'UPDATE messages SET status = "read", read_at = NOW() WHERE sender_id = ? AND receiver_id = ? AND status != "read"',
        [senderId, userId]
      );

      res.json({
        success: true,
        message: 'Messages marked as read',
        affectedRows: result.affectedRows
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark messages as read',
        error: error.message
      });
    }
  }

  // Update message status
  static async updateMessageStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || !status) {
        return res.status(400).json({
          success: false,
          message: 'Message ID and status are required'
        });
      }

      const validStatuses = ['sent', 'delivered', 'read'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: sent, delivered, read'
        });
      }

      const updateFields = ['status = ?'];
      const updateValues = [status];

      if (status === 'read') {
        updateFields.push('read_at = NOW()');
      }

      const [result] = await pool.execute(
        `UPDATE messages SET ${updateFields.join(', ')} WHERE id = ?`,
        [...updateValues, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      res.json({
        success: true,
        message: 'Message status updated successfully'
      });
    } catch (error) {
      console.error('Update message status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update message status',
        error: error.message
      });
    }
  }

  // Delete a message
  static async deleteMessage(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!id || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Message ID and user ID are required'
        });
      }

      // Check if user is the sender of the message
      const [message] = await pool.execute(
        'SELECT sender_id FROM messages WHERE id = ?',
        [id]
      );

      if (message.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      if (message[0].sender_id !== parseInt(userId)) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own messages'
        });
      }

      const [result] = await pool.execute('DELETE FROM messages WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete message',
        error: error.message
      });
    }
  }

  // Get all staff members for starting new conversations
  static async getAllStaff(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Get all staff members except the current user
      const [staff] = await pool.execute(
        `SELECT id, first_name, last_name, email, profile_image, status, position, role
         FROM staff 
         WHERE id != ? AND status = 'active'
         ORDER BY first_name, last_name`,
        [userId]
      );

      res.json({
        success: true,
        data: staff
      });
    } catch (error) {
      console.error('Get all staff error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staff members',
        error: error.message
      });
    }
  }

      // Get message statistics
      static async getMessageStats(req, res) {
        try {
          const { userId } = req.params;

          if (!userId) {
            return res.status(400).json({
              success: false,
              message: 'User ID is required'
            });
          }

          // Get various message statistics
          const [totalMessages] = await pool.execute(
            'SELECT COUNT(*) as total FROM messages WHERE sender_id = ? OR receiver_id = ?',
            [userId, userId]
          );

          const [unreadMessages] = await pool.execute(
            'SELECT COUNT(*) as unread FROM messages WHERE receiver_id = ? AND status != "read"',
            [userId]
          );

          const [conversationsCount] = await pool.execute(
            `SELECT COUNT(DISTINCT CASE 
               WHEN sender_id = ? THEN receiver_id
               ELSE sender_id
             END) as conversations FROM messages WHERE sender_id = ? OR receiver_id = ?`,
            [userId, userId, userId]
          );

          res.json({
            success: true,
            data: {
              totalMessages: totalMessages[0].total,
              unreadMessages: unreadMessages[0].unread,
              conversationsCount: conversationsCount[0].conversations
            }
          });
        } catch (error) {
          console.error('Get message stats error:', error);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch message statistics',
            error: error.message
          });
        }
      }

      // Clear all messages in a conversation
      static async clearConversation(req, res) {
        try {
          const { userId, participantId } = req.body;

          if (!userId || !participantId) {
            return res.status(400).json({
              success: false,
              message: 'Both userId and participantId are required'
            });
          }

          // Delete all messages between the two users
          const [result] = await pool.execute(
            'DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
            [userId, participantId, participantId, userId]
          );

          res.json({
            success: true,
            message: 'Conversation cleared successfully',
            deletedCount: result.affectedRows
          });
        } catch (error) {
          console.error('Clear conversation error:', error);
          res.status(500).json({
            success: false,
            message: 'Failed to clear conversation',
            error: error.message
          });
        }
      }
  }
