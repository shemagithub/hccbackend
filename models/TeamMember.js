import pool from '../config/db.js';

class TeamMember {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS team_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        staff_id INT NOT NULL,
        role ENUM('member','leader') DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_team_staff (team_id, staff_id),
        INDEX idx_team (team_id),
        INDEX idx_staff (staff_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await pool.execute(query);
    console.log('TeamMembers table created or already exists.');
  }

  static async addMember({ teamId, staffId, role = 'member' }) {
    const [result] = await pool.execute(
      `INSERT INTO team_members (team_id, staff_id, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [teamId, staffId, role],
    );
    return { id: result.insertId, teamId, staffId, role };
  }

  static async removeMember(teamId, staffId) {
    await pool.execute('DELETE FROM team_members WHERE team_id = ? AND staff_id = ?', [
      teamId,
      staffId,
    ]);
    return true;
  }

  static async getTeamMembers(teamId) {
    const [rows] = await pool.execute(
      `SELECT tm.*, s.first_name, s.last_name, s.email, s.position
       FROM team_members tm
       JOIN staff s ON tm.staff_id = s.id
       WHERE tm.team_id = ?`,
      [teamId],
    );
    return rows;
  }

  static async getTeamsForStaff(staffId) {
    const [rows] = await pool.execute(
      `SELECT tm.*, t.name as team_name, t.project_id
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.staff_id = ?`,
      [staffId],
    );
    return rows;
  }
}

export default TeamMember;

