import pool from '../config/db.js';

class SkillProfile {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS skill_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        profile_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        skill_id INT NOT NULL,
        skill_name VARCHAR(255) NOT NULL,
        skill_category VARCHAR(100) NULL,
        level INT DEFAULT 1,
        level_label VARCHAR(50) NULL,
        years_experience DECIMAL(5,2) DEFAULT 0,
        certifications TEXT NULL,
        past_projects TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_skill (skill_id),
        INDEX idx_category (skill_category),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Skill profiles table created or already exists.');
  }

  static async generateProfileId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM skill_profiles WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `SP-${year}-${sequence}`;
  }

  static async create({
    profileId, staffId, skillId, skillName, skillCategory, level = 1,
    levelLabel, yearsExperience = 0, certifications, pastProjects, notes
  }) {
    const pId = profileId || await this.generateProfileId();

    const [result] = await pool.execute(
      `INSERT INTO skill_profiles (
        profile_id, staff_id, skill_id, skill_name, skill_category, level, level_label,
        years_experience, certifications, past_projects, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pId, staffId, skillId, skillName, skillCategory || null, level, levelLabel || null,
        yearsExperience, certifications ? JSON.stringify(certifications) : null,
        pastProjects ? JSON.stringify(pastProjects) : null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT sp.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
             d.name as department_name, sk.name as skill_full_name, sk.category as skill_category_name
      FROM skill_profiles sp
      LEFT JOIN staff s ON sp.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN skills sk ON sp.skill_id = sk.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND sp.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.skillId) {
      query += ` AND sp.skill_id = ?`;
      params.push(filters.skillId);
    }

    if (filters.category) {
      query += ` AND sp.skill_category = ?`;
      params.push(filters.category);
    }

    if (filters.search) {
      query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR sp.skill_name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY s.last_name, s.first_name, sp.skill_category, sp.skill_name`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToProfile(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT sp.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              d.name as department_name, sk.name as skill_full_name, sk.category as skill_category_name
       FROM skill_profiles sp
       LEFT JOIN staff s ON sp.staff_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN skills sk ON sp.skill_id = sk.id
       WHERE sp.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToProfile(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      skillId: 'skill_id',
      skillName: 'skill_name',
      skillCategory: 'skill_category',
      level: 'level',
      levelLabel: 'level_label',
      yearsExperience: 'years_experience',
      certifications: 'certifications',
      pastProjects: 'past_projects',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'certifications' || key === 'pastProjects') {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key] ? JSON.stringify(updateData[key]) : null);
        } else {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE skill_profiles SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM skill_profiles WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToProfile(row) {
    return {
      id: row.profile_id,
      dbId: row.id,
      staffId: row.staff_id,
      staffName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      staffEmail: row.email,
      staffPosition: row.position,
      departmentId: row.department_id,
      departmentName: row.department_name,
      skillId: row.skill_id,
      skillName: row.skill_name,
      skillCategory: row.skill_category,
      skillFullName: row.skill_full_name,
      level: row.level,
      levelLabel: row.level_label,
      yearsExperience: row.years_experience ? parseFloat(row.years_experience) : 0,
      certifications: row.certifications ? JSON.parse(row.certifications) : [],
      pastProjects: row.past_projects ? JSON.parse(row.past_projects) : [],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default SkillProfile;
