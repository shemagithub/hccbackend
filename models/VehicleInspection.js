import pool from '../config/db.js';

class VehicleInspection {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS vehicle_inspections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inspection_id VARCHAR(50) NOT NULL UNIQUE,
        vehicle_id INT NOT NULL,
        project_id INT NULL,
        driver_id INT NOT NULL,
        driver_name VARCHAR(255) NULL,
        inspection_type ENUM('pre_trip', 'post_trip', 'routine', 'incident') DEFAULT 'pre_trip',
        inspection_date DATE NOT NULL,
        inspection_time TIME NULL,
        odometer_reading INT NULL,
        fuel_level INT NULL,
        status ENUM('passed', 'failed', 'conditional') DEFAULT 'passed',
        damage_reported TEXT NULL,
        issues_found TEXT NULL,
        photos TEXT NULL,
        notes TEXT NULL,
        inspected_by INT NULL,
        inspected_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_project (project_id),
        INDEX idx_driver (driver_id),
        INDEX idx_inspection_type (inspection_type),
        INDEX idx_inspection_date (inspection_date),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (inspected_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Vehicle inspections table created or already exists.');
  }

  static async generateInspectionId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM vehicle_inspections WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `INSP-${year}-${sequence}`;
  }

  static async create({
    inspectionId,
    vehicleId,
    projectId,
    driverId,
    driverName,
    inspectionType = 'pre_trip',
    inspectionDate,
    inspectionTime,
    odometerReading,
    fuelLevel,
    status = 'passed',
    damageReported,
    issuesFound,
    photos,
    notes,
    inspectedBy,
    inspectedByName
  }) {
    const inspId = inspectionId || await this.generateInspectionId();

    const [result] = await pool.execute(
      `INSERT INTO vehicle_inspections (
        inspection_id, vehicle_id, project_id, driver_id, driver_name, inspection_type,
        inspection_date, inspection_time, odometer_reading, fuel_level, status,
        damage_reported, issues_found, photos, notes, inspected_by, inspected_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inspId, vehicleId, projectId || null, driverId, driverName || null, inspectionType,
        inspectionDate || new Date().toISOString().split('T')[0], inspectionTime || null,
        odometerReading || null, fuelLevel || null, status,
        damageReported || null, issuesFound || null, photos ? JSON.stringify(photos) : null,
        notes || null, inspectedBy || null, inspectedByName || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT vi.*, v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
             p.name as project_name, p.project_id as project_code,
             s.first_name as driver_first_name, s.last_name as driver_last_name,
             ins.first_name as inspector_first_name, ins.last_name as inspector_last_name
      FROM vehicle_inspections vi
      LEFT JOIN vehicles v ON vi.vehicle_id = v.id
      LEFT JOIN projects p ON vi.project_id = p.id
      LEFT JOIN staff s ON vi.driver_id = s.id
      LEFT JOIN staff ins ON vi.inspected_by = ins.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.driverId) {
      query += ` AND vi.driver_id = ?`;
      params.push(filters.driverId);
    }

    if (filters.driverEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.driverEmail);
    }

    if (filters.search) {
      query += ` AND (v.plate_number LIKE ? OR vi.inspection_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.vehicleId) {
      query += ` AND vi.vehicle_id = ?`;
      params.push(filters.vehicleId);
    }

    if (filters.projectId) {
      query += ` AND vi.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.inspectionType && filters.inspectionType !== 'all') {
      query += ` AND vi.inspection_type = ?`;
      params.push(filters.inspectionType);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND vi.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND vi.inspection_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND vi.inspection_date <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY vi.inspection_date DESC, vi.inspection_time DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToInspection(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT vi.*, v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
              p.name as project_name, p.project_id as project_code,
              s.first_name as driver_first_name, s.last_name as driver_last_name,
              ins.first_name as inspector_first_name, ins.last_name as inspector_last_name
       FROM vehicle_inspections vi
       LEFT JOIN vehicles v ON vi.vehicle_id = v.id
       LEFT JOIN projects p ON vi.project_id = p.id
       LEFT JOIN staff s ON vi.driver_id = s.id
       LEFT JOIN staff ins ON vi.inspected_by = ins.id
       WHERE vi.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToInspection(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      vehicleId: 'vehicle_id',
      projectId: 'project_id',
      driverName: 'driver_name',
      inspectionType: 'inspection_type',
      inspectionDate: 'inspection_date',
      inspectionTime: 'inspection_time',
      odometerReading: 'odometer_reading',
      fuelLevel: 'fuel_level',
      status: 'status',
      damageReported: 'damage_reported',
      issuesFound: 'issues_found',
      photos: 'photos',
      notes: 'notes',
      inspectedBy: 'inspected_by',
      inspectedByName: 'inspected_by_name'
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
      `UPDATE vehicle_inspections SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM vehicle_inspections WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToInspection(row) {
    return {
      id: row.inspection_id,
      dbId: row.id,
      vehicleId: row.vehicle_id,
      vehicleCode: row.vehicle_code,
      vehiclePlate: row.plate_number,
      vehicleBrand: row.brand,
      vehicleModel: row.model,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      driverId: row.driver_id,
      driverName: row.driver_name || (row.driver_first_name && row.driver_last_name
        ? `${row.driver_first_name} ${row.driver_last_name}` : null),
      inspectionType: row.inspection_type,
      inspectionDate: row.inspection_date ? row.inspection_date.toISOString().split('T')[0] : null,
      inspectionTime: row.inspection_time ? row.inspection_time.toString() : null,
      odometerReading: row.odometer_reading,
      fuelLevel: row.fuel_level,
      status: row.status,
      damageReported: row.damage_reported,
      issuesFound: row.issues_found,
      photos: row.photos ? JSON.parse(row.photos) : null,
      notes: row.notes,
      inspectedBy: row.inspected_by,
      inspectedByName: row.inspected_by_name || (row.inspector_first_name && row.inspector_last_name
        ? `${row.inspector_first_name} ${row.inspector_last_name}` : null),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default VehicleInspection;
