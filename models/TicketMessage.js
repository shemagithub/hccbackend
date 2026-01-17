import pool from '../config/db.js';

class TicketMessage {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        message TEXT NOT NULL,
        author_id INT NULL,
        author_name VARCHAR(255) NOT NULL,
        author_type ENUM('customer', 'support_agent', 'system') DEFAULT 'customer',
        attachments TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ticket (ticket_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Ticket messages table created or already exists.');
  }

  static async create({
    ticketId,
    message,
    authorId = null,
    authorName,
    authorType = 'customer',
    attachments = null
  }) {
    const [result] = await pool.execute(
      `INSERT INTO ticket_messages (
        ticket_id, message, author_id, author_name, author_type, attachments
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ticketId, message, authorId || null, authorName,
        authorType, attachments ? JSON.stringify(attachments) : null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findByTicketId(ticketId) {
    const [rows] = await pool.execute(
      `SELECT m.*, s.first_name, s.last_name, s.email
       FROM ticket_messages m
       LEFT JOIN staff s ON m.author_id = s.id
       WHERE m.ticket_id = ?
       ORDER BY m.created_at ASC`,
      [ticketId]
    );

    return rows.map(row => this.mapRowToMessage(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT m.*, s.first_name, s.last_name, s.email
       FROM ticket_messages m
       LEFT JOIN staff s ON m.author_id = s.id
       WHERE m.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRowToMessage(rows[0]);
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM ticket_messages WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToMessage(row) {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      message: row.message,
      authorId: row.author_id,
      authorName: row.author_name || (row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null),
      authorEmail: row.email,
      authorType: row.author_type,
      attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : [],
      createdAt: row.created_at
    };
  }
}

export default TicketMessage;
