import pool from '../config/db.js';

class Trip {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS trips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trip_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        vehicle_id INT NULL,
        driver_id INT NULL,
        driver_name VARCHAR(255) NULL,
        purpose VARCHAR(255) NOT NULL,
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        start_time TIME NULL,
        end_date DATE NULL,
        end_time TIME NULL,
        status ENUM('planned', 'ongoing', 'completed', 'cancelled') DEFAULT 'planned',
        estimated_duration VARCHAR(50) NULL,
        actual_duration VARCHAR(50) NULL,
        distance_km DECIMAL(10,2) NULL,
        fuel_used DECIMAL(10,2) NULL,
        notes TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_status (status),
        INDEX idx_start_date (start_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
        FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Trips table created or already exists.');
  }

  static async generateTripId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM trips WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `TRIP-${year}-${sequence}`;
  }

  static async create({
    tripId,
    projectId,
    vehicleId,
    driverId,
    driverName,
    purpose,
    origin,
    destination,
    startDate,
    startTime,
    endDate,
    endTime,
    status = 'planned',
    estimatedDuration,
    actualDuration,
    distanceKm,
    fuelUsed,
    notes,
    createdBy
  }) {
    const tId = tripId || await this.generateTripId();

    const [result] = await pool.execute(
      `INSERT INTO trips (
        trip_id, project_id, vehicle_id, driver_id, driver_name, purpose, origin, destination,
        start_date, start_time, end_date, end_time, status, estimated_duration, actual_duration,
        distance_km, fuel_used, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tId, projectId || null, vehicleId || null, driverId || null, driverName || null,
        purpose, origin, destination, startDate, startTime || null, endDate || null, endTime || null,
        status, estimatedDuration || null, actualDuration || null, distanceKm || null,
        fuelUsed || null, notes || null, createdBy || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT t.*, p.name as project_name, p.project_id as project_code,
             v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
             s.first_name as driver_first_name, s.last_name as driver_last_name
      FROM trips t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN staff s ON t.driver_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (t.purpose LIKE ? OR t.origin LIKE ? OR t.destination LIKE ? OR t.trip_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND t.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.vehicleId) {
      query += ` AND t.vehicle_id = ?`;
      params.push(filters.vehicleId);
    }

    if (filters.driverId) {
      query += ` AND t.driver_id = ?`;
      params.push(filters.driverId);
    }

    if (filters.driverEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.driverEmail);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND t.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND t.start_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND t.start_date <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY t.start_date DESC, t.start_time DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToTrip(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT t.*, p.name as project_name, p.project_id as project_code,
              v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
              s.first_name as driver_first_name, s.last_name as driver_last_name
       FROM trips t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       LEFT JOIN staff s ON t.driver_id = s.id
       WHERE t.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToTrip(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      vehicleId: 'vehicle_id',
      driverId: 'driver_id',
      driverName: 'driver_name',
      purpose: 'purpose',
      origin: 'origin',
      destination: 'destination',
      startDate: 'start_date',
      startTime: 'start_time',
      endDate: 'end_date',
      endTime: 'end_time',
      status: 'status',
      estimatedDuration: 'estimated_duration',
      actualDuration: 'actual_duration',
      distanceKm: 'distance_km',
      fuelUsed: 'fuel_used',
      notes: 'notes'
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
      `UPDATE trips SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM trips WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned,
        SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) as ongoing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(distance_km) as totalDistance,
        SUM(fuel_used) as totalFuelUsed
      FROM trips
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToTrip(row) {
    return {
      id: row.trip_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      vehicleId: row.vehicle_id,
      vehicleCode: row.vehicle_code,
      vehiclePlate: row.plate_number,
      vehicleBrand: row.brand,
      vehicleModel: row.model,
      driverId: row.driver_id,
      driverName: row.driver_name || (row.driver_first_name && row.driver_last_name
        ? `${row.driver_first_name} ${row.driver_last_name}` : null),
      purpose: row.purpose,
      origin: row.origin,
      destination: row.destination,
      startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : null,
      startTime: row.start_time ? row.start_time.toString() : null,
      endDate: row.end_date ? row.end_date.toISOString().split('T')[0] : null,
      endTime: row.end_time ? row.end_time.toString() : null,
      status: row.status,
      estimatedDuration: row.estimated_duration,
      actualDuration: row.actual_duration,
      distanceKm: row.distance_km ? parseFloat(row.distance_km) : null,
      fuelUsed: row.fuel_used ? parseFloat(row.fuel_used) : null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Trip;

