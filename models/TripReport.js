import pool from '../config/db.js';

class TripReport {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS trip_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trip_report_id VARCHAR(50) NOT NULL UNIQUE,
        trip_id VARCHAR(50) NULL,
        project_id INT NULL,
        vehicle_id INT NULL,
        driver_id INT NOT NULL,
        driver_name VARCHAR(255) NULL,
        purpose VARCHAR(255) NOT NULL,
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        start_time TIME NULL,
        start_odometer INT NULL,
        end_date DATE NULL,
        end_time TIME NULL,
        end_odometer INT NULL,
        distance_km DECIMAL(10,2) NULL,
        fuel_consumed DECIMAL(10,2) NULL,
        status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft',
        photos TEXT NULL,
        notes TEXT NULL,
        observations TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_trip (trip_id),
        INDEX idx_project (project_id),
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_driver (driver_id),
        INDEX idx_status (status),
        INDEX idx_start_date (start_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
        FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Trip reports table created or already exists.');
  }

  static async generateTripReportId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM trip_reports WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `TR-${year}-${sequence}`;
  }

  static async create({
    tripReportId,
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
    startOdometer,
    endDate,
    endTime,
    endOdometer,
    distanceKm,
    fuelConsumed,
    status = 'draft',
    photos,
    notes,
    observations
  }) {
    const trId = tripReportId || await this.generateTripReportId();

    // Auto-calculate distance if odometer readings provided
    let calculatedDistance = distanceKm;
    if (!calculatedDistance && startOdometer && endOdometer) {
      calculatedDistance = endOdometer - startOdometer;
    }

    const [result] = await pool.execute(
      `INSERT INTO trip_reports (
        trip_report_id, trip_id, project_id, vehicle_id, driver_id, driver_name, purpose, origin, destination,
        start_date, start_time, start_odometer, end_date, end_time, end_odometer,
        distance_km, fuel_consumed, status, photos, notes, observations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trId, tripId || null, projectId || null, vehicleId || null, driverId, driverName || null,
        purpose, origin, destination, startDate, startTime || null, startOdometer || null,
        endDate || null, endTime || null, endOdometer || null, calculatedDistance || null,
        fuelConsumed || null, status, photos || null, notes || null, observations || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT tr.*, p.name as project_name, p.project_id as project_code,
             v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
             s.first_name as driver_first_name, s.last_name as driver_last_name
      FROM trip_reports tr
      LEFT JOIN projects p ON tr.project_id = p.id
      LEFT JOIN vehicles v ON tr.vehicle_id = v.id
      LEFT JOIN staff s ON tr.driver_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.driverId) {
      query += ` AND tr.driver_id = ?`;
      params.push(filters.driverId);
    }

    if (filters.driverEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.driverEmail);
    }

    if (filters.search) {
      query += ` AND (tr.purpose LIKE ? OR tr.origin LIKE ? OR tr.destination LIKE ? OR tr.trip_report_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND tr.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.vehicleId) {
      query += ` AND tr.vehicle_id = ?`;
      params.push(filters.vehicleId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND tr.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND tr.start_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND tr.start_date <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY tr.start_date DESC, tr.start_time DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToTripReport(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT tr.*, p.name as project_name, p.project_id as project_code,
              v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
              s.first_name as driver_first_name, s.last_name as driver_last_name
       FROM trip_reports tr
       LEFT JOIN projects p ON tr.project_id = p.id
       LEFT JOIN vehicles v ON tr.vehicle_id = v.id
       LEFT JOIN staff s ON tr.driver_id = s.id
       WHERE tr.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToTripReport(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      tripId: 'trip_id',
      projectId: 'project_id',
      vehicleId: 'vehicle_id',
      driverName: 'driver_name',
      purpose: 'purpose',
      origin: 'origin',
      destination: 'destination',
      startDate: 'start_date',
      startTime: 'start_time',
      startOdometer: 'start_odometer',
      endDate: 'end_date',
      endTime: 'end_time',
      endOdometer: 'end_odometer',
      distanceKm: 'distance_km',
      fuelConsumed: 'fuel_consumed',
      status: 'status',
      photos: 'photos',
      notes: 'notes',
      observations: 'observations'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    // Auto-calculate distance if odometer readings updated
    if (updateData.startOdometer !== undefined || updateData.endOdometer !== undefined) {
      const existing = await this.findById(id);
      if (existing) {
        const startOdo = updateData.startOdometer !== undefined ? updateData.startOdometer : existing.startOdometer;
        const endOdo = updateData.endOdometer !== undefined ? updateData.endOdometer : existing.endOdometer;
        if (startOdo && endOdo && !updateData.distanceKm) {
          updateFields.push('distance_km = ?');
          params.push(endOdo - startOdo);
        }
      }
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE trip_reports SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM trip_reports WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToTripReport(row) {
    return {
      id: row.trip_report_id,
      dbId: row.id,
      tripId: row.trip_id,
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
      startOdometer: row.start_odometer,
      endDate: row.end_date ? row.end_date.toISOString().split('T')[0] : null,
      endTime: row.end_time ? row.end_time.toString() : null,
      endOdometer: row.end_odometer,
      distanceKm: row.distance_km ? parseFloat(row.distance_km) : null,
      fuelConsumed: row.fuel_consumed ? parseFloat(row.fuel_consumed) : null,
      status: row.status,
      photos: row.photos ? JSON.parse(row.photos) : null,
      notes: row.notes,
      observations: row.observations,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default TripReport;
