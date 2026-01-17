import pool from '../config/db.js';

class Availability {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS availability (
        id INT AUTO_INCREMENT PRIMARY KEY,
        availability_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        date DATE NOT NULL,
        capacity_percentage DECIMAL(5,2) DEFAULT 100.00,
        work_type ENUM('field', 'office', 'mixed', 'leave', 'unavailable') DEFAULT 'office',
        project_allocations TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_date (date),
        INDEX idx_work_type (work_type),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Availability table created or already exists.');
  }

  static async generateAvailabilityId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM availability WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `AVAIL-${year}-${sequence}`;
  }

  static async create({
    availabilityId, staffId, date, capacityPercentage = 100.00,
    workType = 'office', projectAllocations, notes
  }) {
    const aId = availabilityId || await this.generateAvailabilityId();

    const [result] = await pool.execute(
      `INSERT INTO availability (
        availability_id, staff_id, date, capacity_percentage, work_type, project_allocations, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        aId, staffId, date, capacityPercentage, workType,
        projectAllocations ? JSON.stringify(projectAllocations) : null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT a.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
             d.name as department_name
      FROM availability a
      LEFT JOIN staff s ON a.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND a.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.startDate) {
      query += ` AND a.date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND a.date <= ?`;
      params.push(filters.endDate);
    }

    if (filters.workType && filters.workType !== 'all') {
      query += ` AND a.work_type = ?`;
      params.push(filters.workType);
    }

    query += ` ORDER BY a.date DESC, s.last_name, s.first_name`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToAvailability(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT a.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              d.name as department_name
       FROM availability a
       LEFT JOIN staff s ON a.staff_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE a.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToAvailability(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      date: 'date',
      capacityPercentage: 'capacity_percentage',
      workType: 'work_type',
      projectAllocations: 'project_allocations',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'projectAllocations') {
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
      `UPDATE availability SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM availability WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToAvailability(row) {
    return {
      id: row.availability_id,
      dbId: row.id,
      staffId: row.staff_id,
      staffName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      staffEmail: row.email,
      staffPosition: row.position,
      departmentId: row.department_id,
      departmentName: row.department_name,
      date: row.date ? row.date.toISOString().split('T')[0] : null,
      capacityPercentage: row.capacity_percentage ? parseFloat(row.capacity_percentage) : 100,
      workType: row.work_type,
      projectAllocations: row.project_allocations ? JSON.parse(row.project_allocations) : [],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Availability;
