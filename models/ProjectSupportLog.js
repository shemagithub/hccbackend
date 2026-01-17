import pool from '../config/db.js';

class ProjectSupportLog {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS project_support_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        log_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NOT NULL,
        driver_id INT NOT NULL,
        driver_name VARCHAR(255) NULL,
        vehicle_id INT NULL,
        trip_id VARCHAR(50) NULL,
        purpose VARCHAR(255) NOT NULL,
        description TEXT NULL,
        date DATE NOT NULL,
        time TIME NULL,
        location VARCHAR(255) NULL,
        deliverables_confirmed TEXT NULL,
        site_visit_confirmed BOOLEAN DEFAULT FALSE,
        delivery_confirmed BOOLEAN DEFAULT FALSE,
        photos TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_driver (driver_id),
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_date (date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Project support logs table created or already exists.');
  }

  static async generateLogId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM project_support_logs WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `PSL-${year}-${sequence}`;
  }

  static async create({
    logId,
    projectId,
    driverId,
    driverName,
    vehicleId,
    tripId,
    purpose,
    description,
    date,
    time,
    location,
    deliverablesConfirmed,
    siteVisitConfirmed = false,
    deliveryConfirmed = false,
    photos,
    notes
  }) {
    const lId = logId || await this.generateLogId();

    const [result] = await pool.execute(
      `INSERT INTO project_support_logs (
        log_id, project_id, driver_id, driver_name, vehicle_id, trip_id, purpose, description,
        date, time, location, deliverables_confirmed, site_visit_confirmed, delivery_confirmed,
        photos, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lId, projectId, driverId, driverName || null, vehicleId || null, tripId || null,
        purpose, description || null, date || new Date().toISOString().split('T')[0],
        time || null, location || null, deliverablesConfirmed || null,
        siteVisitConfirmed, deliveryConfirmed, photos ? JSON.stringify(photos) : null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT psl.*, p.name as project_name, p.project_id as project_code,
             s.first_name as driver_first_name, s.last_name as driver_last_name, s.email as driver_email,
             v.vehicle_id as vehicle_code, v.plate_number
      FROM project_support_logs psl
      LEFT JOIN projects p ON psl.project_id = p.id
      LEFT JOIN staff s ON psl.driver_id = s.id
      LEFT JOIN vehicles v ON psl.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.driverId) {
      query += ` AND psl.driver_id = ?`;
      params.push(filters.driverId);
    }

    if (filters.driverEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.driverEmail);
    }

    if (filters.search) {
      query += ` AND (psl.purpose LIKE ? OR p.name LIKE ? OR psl.log_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND psl.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.vehicleId) {
      query += ` AND psl.vehicle_id = ?`;
      params.push(filters.vehicleId);
    }

    if (filters.startDate) {
      query += ` AND psl.date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND psl.date <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY psl.date DESC, psl.time DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToLog(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT psl.*, p.name as project_name, p.project_id as project_code,
              s.first_name as driver_first_name, s.last_name as driver_last_name, s.email as driver_email,
              v.vehicle_id as vehicle_code, v.plate_number
       FROM project_support_logs psl
       LEFT JOIN projects p ON psl.project_id = p.id
       LEFT JOIN staff s ON psl.driver_id = s.id
       LEFT JOIN vehicles v ON psl.vehicle_id = v.id
       WHERE psl.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToLog(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      driverName: 'driver_name',
      vehicleId: 'vehicle_id',
      tripId: 'trip_id',
      purpose: 'purpose',
      description: 'description',
      date: 'date',
      time: 'time',
      location: 'location',
      deliverablesConfirmed: 'deliverables_confirmed',
      siteVisitConfirmed: 'site_visit_confirmed',
      deliveryConfirmed: 'delivery_confirmed',
      photos: 'photos',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'photos') {
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
      `UPDATE project_support_logs SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM project_support_logs WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToLog(row) {
    return {
      id: row.log_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      driverId: row.driver_id,
      driverName: row.driver_name || (row.driver_first_name && row.driver_last_name
        ? `${row.driver_first_name} ${row.driver_last_name}` : null),
      driverEmail: row.driver_email,
      vehicleId: row.vehicle_id,
      vehicleCode: row.vehicle_code,
      vehiclePlate: row.plate_number,
      tripId: row.trip_id,
      purpose: row.purpose,
      description: row.description,
      date: row.date ? row.date.toISOString().split('T')[0] : null,
      time: row.time ? row.time.toString() : null,
      location: row.location,
      deliverablesConfirmed: row.deliverables_confirmed,
      siteVisitConfirmed: row.site_visit_confirmed === 1,
      deliveryConfirmed: row.delivery_confirmed === 1,
      photos: row.photos ? JSON.parse(row.photos) : null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default ProjectSupportLog;
