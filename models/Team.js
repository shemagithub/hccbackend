import pool from '../config/db.js';

class Team {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        project_id INT NULL,
        leader_id INT NULL,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_leader (leader_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (leader_id) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await pool.execute(query);
    console.log('Teams table created or already exists.');
  }

  static async generateTeamId() {
    const prefix = 'TEAM';
    const year = new Date().getFullYear();
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM teams WHERE YEAR(created_at) = ?',
      [year],
    );
    const count = rows[0]?.count || 0;
    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  static async create({ name, projectId, leaderId, description }) {
    const teamId = await Team.generateTeamId();
    const [result] = await pool.execute(
      `INSERT INTO teams (team_id, name, project_id, leader_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [teamId, name, projectId || null, leaderId || null, description || null],
    );
    return { id: result.insertId, team_id: teamId, name, projectId, leaderId, description };
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM teams WHERE id = ? OR team_id = ? LIMIT 1',
      [id, id],
    );
    return rows[0] || null;
  }

  static async findAll(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.projectId) {
      conditions.push('project_id = ?');
      params.push(filters.projectId);
    }

    if (filters.leaderId) {
      conditions.push('leader_id = ?');
      params.push(filters.leaderId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT * FROM teams ${whereClause} ORDER BY created_at DESC LIMIT 1000`,
      params,
    );
    return rows;
  }

  static async update(id, data) {
    const fields = [];
    const params = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.projectId !== undefined) {
      fields.push('project_id = ?');
      params.push(data.projectId);
    }
    if (data.leaderId !== undefined) {
      fields.push('leader_id = ?');
      params.push(data.leaderId);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }

    if (!fields.length) return null;

    params.push(id, id);
    await pool.execute(
      `UPDATE teams SET ${fields.join(', ')} WHERE id = ? OR team_id = ?`,
      params,
    );

    return Team.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM teams WHERE id = ? OR team_id = ?', [id, id]);
    return true;
  }
}

export default Team;

