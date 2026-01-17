import pool from '../config/db.js';

class Skill {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS skills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        skill_id VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NULL,
        description TEXT NULL,
        level_type ENUM('junior', 'intermediate', 'senior', 'expert', 'numeric') DEFAULT 'numeric',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Skills table created or already exists.');
  }

  static async generateSkillId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM skills WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `SKILL-${year}-${sequence}`;
  }

  static async create({
    skillId, name, category, description, levelType = 'numeric'
  }) {
    const sId = skillId || await this.generateSkillId();

    const [result] = await pool.execute(
      `INSERT INTO skills (skill_id, name, category, description, level_type)
       VALUES (?, ?, ?, ?, ?)`,
      [sId, name, category || null, description || null, levelType]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT * FROM skills WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (name LIKE ? OR category LIKE ? OR description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.category) {
      query += ` AND category = ?`;
      params.push(filters.category);
    }

    query += ` ORDER BY category, name`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToSkill(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM skills WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToSkill(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      name: 'name',
      category: 'category',
      description: 'description',
      levelType: 'level_type'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE skills SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM skills WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToSkill(row) {
    return {
      id: row.skill_id,
      dbId: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      levelType: row.level_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Skill;
