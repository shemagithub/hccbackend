import pool from '../config/db.js';

class Notification {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_id VARCHAR(50) NOT NULL UNIQUE,
        recipient_id INT NOT NULL,
        recipient_name VARCHAR(255) NULL,
        title VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info', 'success', 'warning', 'urgent', 'error') DEFAULT 'info',
        category ENUM('task', 'deliverable', 'review', 'expense', 'meeting', 'risk', 'issue', 'project', 'system', 'other') DEFAULT 'other',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        status ENUM('unread', 'read', 'archived') DEFAULT 'unread',
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP NULL,
        project_id INT NULL,
        related_item_type VARCHAR(100) NULL,
        related_item_id INT NULL,
        action_url VARCHAR(500) NULL,
        metadata JSON NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_recipient (recipient_id),
        INDEX idx_status (status),
        INDEX idx_type (type),
        INDEX idx_category (category),
        INDEX idx_priority (priority),
        INDEX idx_is_read (is_read),
        INDEX idx_project (project_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (recipient_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Notifications table created or already exists.');
  }

  static async generateNotificationId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE notification_id LIKE ?',
      ['NOTIF-%']
    );
    const count = rows[0].count;
    const newId = `NOTIF-${String(count + 1).padStart(6, '0')}`;
    return newId;
  }

  static async create({
    notificationId,
    recipientId,
    recipientName,
    title,
    message,
    type = 'info',
    category = 'other',
    priority = 'medium',
    projectId = null,
    relatedItemType = null,
    relatedItemId = null,
    actionUrl = null,
    metadata = null,
    createdBy = null,
    createdByName = null
  }) {
    const nId = notificationId || await this.generateNotificationId();
    
    const query = `
      INSERT INTO notifications (
        notification_id, recipient_id, recipient_name, title, message, type, category, priority,
        project_id, related_item_type, related_item_id, action_url, metadata,
        created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    
    const [result] = await pool.execute(query, [
      nId, recipientId, recipientName, title, message, type, category, priority,
      projectId, relatedItemType, relatedItemId, actionUrl, metadataJson,
      createdBy, createdByName
    ]);

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT n.*, p.name as project_name, p.project_id as project_code
      FROM notifications n
      LEFT JOIN projects p ON n.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.recipientId) {
      query += ` AND n.recipient_id = ?`;
      params.push(filters.recipientId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND n.status = ?`;
      params.push(filters.status);
    }

    if (filters.isRead !== undefined) {
      query += ` AND n.is_read = ?`;
      params.push(filters.isRead);
    }

    if (filters.type) {
      query += ` AND n.type = ?`;
      params.push(filters.type);
    }

    if (filters.category) {
      query += ` AND n.category = ?`;
      params.push(filters.category);
    }

    if (filters.priority) {
      query += ` AND n.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.projectId) {
      query += ` AND n.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.search) {
      query += ` AND (n.title LIKE ? OR n.message LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY n.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToNotification(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT n.*, p.name as project_name, p.project_id as project_code
       FROM notifications n
       LEFT JOIN projects p ON n.project_id = p.id
       WHERE n.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToNotification(rows[0]);
  }

  static async findByNotificationId(notificationId) {
    const [rows] = await pool.execute(
      `SELECT n.*, p.name as project_name, p.project_id as project_code
       FROM notifications n
       LEFT JOIN projects p ON n.project_id = p.id
       WHERE n.notification_id = ?`,
      [notificationId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToNotification(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      status: 'status',
      isRead: 'is_read',
      readAt: 'read_at',
      title: 'title',
      message: 'message',
      type: 'type',
      category: 'category',
      priority: 'priority',
      actionUrl: 'action_url',
      metadata: 'metadata'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'metadata' && typeof updateData[key] === 'object') {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(JSON.stringify(updateData[key]));
        } else if (key === 'isRead' && updateData[key] === true) {
          updateFields.push(`${fieldMapping[key]} = ?`);
          updateFields.push(`read_at = NOW()`);
          params.push(true);
        } else {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE notifications SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async markAsRead(id) {
    const [result] = await pool.execute(
      `UPDATE notifications SET is_read = TRUE, status = 'read', read_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  static async markAllAsRead(recipientId) {
    const [result] = await pool.execute(
      `UPDATE notifications SET is_read = TRUE, status = 'read', read_at = NOW(), updated_at = NOW() WHERE recipient_id = ? AND is_read = FALSE`,
      [recipientId]
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM notifications WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async deleteAll(recipientId, filters = {}) {
    let query = `DELETE FROM notifications WHERE recipient_id = ?`;
    const params = [recipientId];

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.isRead !== undefined) {
      query += ` AND is_read = ?`;
      params.push(filters.isRead);
    }

    const [result] = await pool.execute(query, params);
    return result.affectedRows;
  }

  static async getStats(recipientId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN is_read = TRUE THEN 1 ELSE 0 END) as read,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN type = 'urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN type = 'warning' THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN type = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN type = 'info' THEN 1 ELSE 0 END) as info,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgentPriority,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as highPriority
      FROM notifications
    `;
    const params = [];

    if (recipientId) {
      query += ` WHERE recipient_id = ?`;
      params.push(recipientId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToNotification(row) {
    let metadata = null;
    if (row.metadata) {
      try {
        metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      } catch (e) {
        console.error('Error parsing metadata:', e);
      }
    }

    return {
      id: row.notification_id,
      dbId: row.id,
      recipientId: row.recipient_id,
      recipientName: row.recipient_name,
      title: row.title,
      message: row.message,
      type: row.type,
      category: row.category,
      priority: row.priority,
      status: row.status,
      isRead: Boolean(row.is_read),
      readAt: row.read_at ? row.read_at.toISOString() : null,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      relatedItemType: row.related_item_type,
      relatedItemId: row.related_item_id,
      actionUrl: row.action_url,
      metadata,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null
    };
  }
}

export default Notification;
