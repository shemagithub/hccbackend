import pool from '../config/db.js';

class RiskIssueComment {
  static schemaReady = false;

  static async ensureSchemaFields() {
    if (this.schemaReady) return;

    const query = `
      CREATE TABLE IF NOT EXISTS risk_issue_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_type ENUM('risk', 'issue') NOT NULL,
        item_id INT NOT NULL,
        project_id INT NULL,
        staff_id INT NULL,
        staff_name VARCHAR(255) NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_item (item_type, item_id),
        INDEX idx_project (project_id),
        INDEX idx_staff (staff_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    this.schemaReady = true;
  }

  static async create({ itemType, itemId, projectId, staffId, staffName, comment }) {
    await this.ensureSchemaFields();

    const [result] = await pool.execute(
      `INSERT INTO risk_issue_comments (item_type, item_id, project_id, staff_id, staff_name, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [itemType, itemId, projectId || null, staffId || null, staffName || null, String(comment).trim()]
    );

    return this.findById(result.insertId);
  }

  static async findById(id) {
    await this.ensureSchemaFields();
    const [rows] = await pool.execute('SELECT * FROM risk_issue_comments WHERE id = ?', [id]);
    if (!rows.length) return null;
    return this.mapRow(rows[0]);
  }

  static async findByItem(itemType, itemId) {
    await this.ensureSchemaFields();
    const [rows] = await pool.execute(
      `SELECT * FROM risk_issue_comments
       WHERE item_type = ? AND item_id = ?
       ORDER BY created_at ASC`,
      [itemType, itemId]
    );
    return rows.map((row) => this.mapRow(row));
  }

  static mapRow(row) {
    return {
      id: row.id,
      itemType: row.item_type,
      itemId: row.item_id,
      projectId: row.project_id,
      staffId: row.staff_id,
      staffName: row.staff_name,
      comment: row.comment,
      createdAt: row.created_at,
    };
  }
}

export default RiskIssueComment;
