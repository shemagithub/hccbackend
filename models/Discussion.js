import pool from '../config/db.js';

class Discussion {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS discussions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        discussion_id VARCHAR(50) NOT NULL UNIQUE,
        opportunity_id INT NOT NULL,
        content TEXT NOT NULL,
        message_type ENUM('text', 'image', 'voice', 'file') DEFAULT 'text',
        file_data LONGTEXT NULL,
        file_name VARCHAR(500) NULL,
        file_size INT NULL,
        file_type VARCHAR(100) NULL,
        voice_duration INT NULL,
        author_id INT NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        author_profile_image VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_opportunity (opportunity_id),
        INDEX idx_author (author_id),
        INDEX idx_created_at (created_at),
        INDEX idx_message_type (message_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Discussions table created or already exists.');
  }

  static async generateDiscussionId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM discussions WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `DISC-${year}-${sequence}`;
  }

  static async create({
    discussionId,
    opportunityId,
    content,
    messageType = 'text',
    fileData,
    fileName,
    fileSize,
    fileType,
    voiceDuration,
    authorId,
    authorName,
    authorProfileImage,
    replyToId
  }) {
    const discId = discussionId || await this.generateDiscussionId();
    
    // Clean and validate data
    const cleanContent = content ? String(content).trim() : '';
    if (!cleanContent && messageType === 'text') {
      throw new Error('Discussion content is required for text messages');
    }

    if (!opportunityId || isNaN(parseInt(opportunityId))) {
      throw new Error('Valid opportunity ID is required');
    }

    if (!authorId || isNaN(parseInt(authorId))) {
      throw new Error('Valid author ID is required');
    }

    // Validate message type
    const validMessageTypes = ['text', 'image', 'voice', 'file'];
    const cleanMessageType = validMessageTypes.includes(messageType) ? messageType : 'text';

    const cleanAuthorName = authorName ? String(authorName).trim() : 'Unknown User';
    const cleanAuthorProfileImage = authorProfileImage ? String(authorProfileImage).trim() : null;
    
    // Clean file data
    const cleanFileData = fileData ? String(fileData) : null;
    const cleanFileName = fileName ? String(fileName).trim() : null;
    const cleanFileSize = fileSize && !isNaN(parseInt(fileSize)) ? parseInt(fileSize) : null;
    const cleanFileType = fileType ? String(fileType).trim() : null;
    const cleanVoiceDuration = voiceDuration && !isNaN(parseInt(voiceDuration)) ? parseInt(voiceDuration) : null;

    const cleanReplyToId = replyToId && !isNaN(parseInt(replyToId)) ? parseInt(replyToId) : null;
    
    const [result] = await pool.execute(
      `INSERT INTO discussions (
        discussion_id, opportunity_id, content, message_type, file_data, file_name, file_size, file_type, voice_duration,
        author_id, author_name, author_profile_image, reply_to_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        discId, parseInt(opportunityId), cleanContent, cleanMessageType, cleanFileData, cleanFileName, 
        cleanFileSize, cleanFileType, cleanVoiceDuration,
        parseInt(authorId), cleanAuthorName, cleanAuthorProfileImage, cleanReplyToId
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT d.*, s.profile_image as author_profile_image
      FROM discussions d
      LEFT JOIN staff s ON d.author_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.opportunityId) {
      query += ` AND d.opportunity_id = ?`;
      params.push(parseInt(filters.opportunityId));
    }

    if (filters.authorId) {
      query += ` AND d.author_id = ?`;
      params.push(parseInt(filters.authorId));
    }

    // Order by created_at
    query += ` ORDER BY d.created_at ASC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToDiscussion(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT d.*, s.profile_image as author_profile_image
       FROM discussions d
       LEFT JOIN staff s ON d.author_id = s.id
       WHERE d.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToDiscussion(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      content: 'content',
      authorName: 'author_name',
      authorProfileImage: 'author_profile_image'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key] !== undefined) {
        if (key === 'content') {
          updateFields.push(`content = ?`);
          params.push(String(updateData[key]).trim());
        } else {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) return null;

    params.push(id);
    await pool.execute(
      `UPDATE discussions SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return this.findById(id);
  }

  static async delete(id) {
    // Hard delete - remove the discussion record
    const [result] = await pool.execute(
      'DELETE FROM discussions WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  static mapRowToDiscussion(row) {
    return {
      id: row.discussion_id,
      dbId: row.id,
      opportunityId: row.opportunity_id,
      content: row.content,
      messageType: row.message_type || 'text',
      fileData: row.file_data || null,
      fileName: row.file_name || null,
      fileSize: row.file_size || null,
      fileType: row.file_type || null,
      voiceDuration: row.voice_duration || null,
      authorId: row.author_id,
      authorName: row.author_name,
      authorProfileImage: row.author_profile_image || null,
      replyToId: row.reply_to_id || null,
      isEdited: !!row.edited_at,
      editedAt: row.edited_at ? row.edited_at.toISOString() : null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      isPinned: false,
      pinnedAt: null,
      pinnedBy: null,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
      timestamp: row.created_at ? row.created_at.toISOString() : null,
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null
    };
  }
}

export default Discussion;

