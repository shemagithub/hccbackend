import pool from '../config/db.js';
import Staff from './Staff.js';

class Driver {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS drivers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        license_number VARCHAR(50) NOT NULL UNIQUE,
        license_expiry DATE NULL,
        assigned_vehicle_id INT NULL,
        assigned_project_id INT NULL,
        join_date DATE NOT NULL,
        status ENUM('active', 'on_leave', 'inactive') DEFAULT 'active',
        total_trips INT DEFAULT 0,
        total_distance DECIMAL(10,2) DEFAULT 0,
        total_fuel_consumption DECIMAL(10,2) DEFAULT 0,
        reliability_score INT DEFAULT 0,
        punctuality_score INT DEFAULT 0,
        fuel_efficiency_score INT DEFAULT 0,
        last_trip_date DATE NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_license (license_number),
        INDEX idx_status (status),
        INDEX idx_vehicle (assigned_vehicle_id),
        INDEX idx_project (assigned_project_id),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_project_id) REFERENCES projects(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Drivers table created or already exists.');
  }

  static async generateDriverId() {
    const [rows] = await pool.execute(
      'SELECT driver_id FROM drivers ORDER BY id DESC LIMIT 1'
    );
    
    if (rows.length === 0) {
      return 'DRV-001';
    }
    
    const lastId = rows[0].driver_id;
    const match = lastId.match(/DRV-(\d+)/);
    
    if (match) {
      const num = parseInt(match[1], 10);
      const nextNum = num + 1;
      return `DRV-${nextNum.toString().padStart(3, '0')}`;
    }
    
    return 'DRV-001';
  }

  static async create({
    driverId,
    staffId,
    licenseNumber,
    licenseExpiry,
    assignedVehicleId,
    assignedProjectId,
    joinDate,
    status = 'active',
    notes
  }) {
    const drvId = driverId || await this.generateDriverId();
    
    const [result] = await pool.execute(
      `INSERT INTO drivers (
        driver_id, staff_id, license_number, license_expiry, assigned_vehicle_id,
        assigned_project_id, join_date, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        drvId, staffId, licenseNumber, licenseExpiry || null,
        assignedVehicleId || null, assignedProjectId || null,
        joinDate, status, notes || null
      ]
    );

    return this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT 
        d.*,
        s.first_name, s.last_name, s.email, s.phone, s.position, s.role,
        s.department_id, s.status as staff_status,
        v.vehicle_id, v.plate_number as vehicle_plate, v.brand, v.model,
        p.name as project_name, p.project_id as project_code,
        dept.name as department_name
      FROM drivers d
      INNER JOIN staff s ON d.staff_id = s.id
      LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id
      LEFT JOIN projects p ON d.assigned_project_id = p.id
      LEFT JOIN departments dept ON s.department_id = dept.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (
        s.first_name LIKE ? OR
        s.last_name LIKE ? OR
        s.email LIKE ? OR
        d.license_number LIKE ? OR
        CONCAT(s.first_name, ' ', s.last_name) LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND d.status = ?`;
      params.push(filters.status);
    }

    if (filters.assignedVehicleId) {
      query += ` AND d.assigned_vehicle_id = ?`;
      params.push(filters.assignedVehicleId);
    }

    if (filters.assignedProjectId) {
      query += ` AND d.assigned_project_id = ?`;
      params.push(filters.assignedProjectId);
    }

    query += ` ORDER BY d.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToDriver(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT 
        d.*,
        s.first_name, s.last_name, s.email, s.phone, s.position, s.role,
        s.department_id, s.status as staff_status,
        v.vehicle_id, v.plate_number as vehicle_plate, v.brand, v.model,
        p.name as project_name, p.project_id as project_code,
        dept.name as department_name
      FROM drivers d
      INNER JOIN staff s ON d.staff_id = s.id
      LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id
      LEFT JOIN projects p ON d.assigned_project_id = p.id
      LEFT JOIN departments dept ON s.department_id = dept.id
      WHERE d.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToDriver(rows[0]);
  }

  static async findByDriverId(driverId) {
    const [rows] = await pool.execute(
      `SELECT 
        d.*,
        s.first_name, s.last_name, s.email, s.phone, s.position, s.role,
        s.department_id, s.status as staff_status,
        v.vehicle_id, v.plate_number as vehicle_plate, v.brand, v.model,
        p.name as project_name, p.project_id as project_code,
        dept.name as department_name
      FROM drivers d
      INNER JOIN staff s ON d.staff_id = s.id
      LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id
      LEFT JOIN projects p ON d.assigned_project_id = p.id
      LEFT JOIN departments dept ON s.department_id = dept.id
      WHERE d.driver_id = ?`,
      [driverId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToDriver(rows[0]);
  }

  static async findByStaffId(staffId) {
    const [rows] = await pool.execute(
      `SELECT 
        d.*,
        s.first_name, s.last_name, s.email, s.phone, s.position, s.role,
        s.department_id, s.status as staff_status,
        v.vehicle_id, v.plate_number as vehicle_plate, v.brand, v.model,
        p.name as project_name, p.project_id as project_code,
        dept.name as department_name
      FROM drivers d
      INNER JOIN staff s ON d.staff_id = s.id
      LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id
      LEFT JOIN projects p ON d.assigned_project_id = p.id
      LEFT JOIN departments dept ON s.department_id = dept.id
      WHERE d.staff_id = ?`,
      [staffId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToDriver(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      licenseNumber: 'license_number',
      licenseExpiry: 'license_expiry',
      assignedVehicleId: 'assigned_vehicle_id',
      assignedProjectId: 'assigned_project_id',
      joinDate: 'join_date',
      status: 'status',
      totalTrips: 'total_trips',
      totalDistance: 'total_distance',
      totalFuelConsumption: 'total_fuel_consumption',
      reliabilityScore: 'reliability_score',
      punctualityScore: 'punctuality_score',
      fuelEfficiencyScore: 'fuel_efficiency_score',
      lastTripDate: 'last_trip_date',
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
      `UPDATE drivers SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0 ? this.findById(id) : null;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM drivers WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) as onLeave,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(total_trips) as totalTrips,
        SUM(total_distance) as totalDistance,
        SUM(total_fuel_consumption) as totalFuelConsumption
      FROM drivers
    `);
    return rows[0] || {
      total: 0,
      active: 0,
      onLeave: 0,
      inactive: 0,
      totalTrips: 0,
      totalDistance: 0,
      totalFuelConsumption: 0
    };
  }

  static mapRowToDriver(row) {
    return {
      id: row.driver_id,
      dbId: row.id,
      staffId: row.staff_id,
      name: `${row.first_name} ${row.last_name}`,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      licenseNumber: row.license_number,
      licenseExpiry: row.license_expiry ? row.license_expiry.toISOString().split('T')[0] : null,
      assignedVehicleId: row.assigned_vehicle_id,
      assignedVehicle: row.vehicle_id ? `${row.brand} ${row.model} (${row.vehicle_plate})` : null,
      assignedVehiclePlate: row.vehicle_plate,
      assignedProjectId: row.assigned_project_id,
      assignedProject: row.project_name || null,
      projectCode: row.project_code || null,
      joinDate: row.join_date ? row.join_date.toISOString().split('T')[0] : null,
      status: row.status,
      staffStatus: row.staff_status,
      position: row.position,
      role: row.role,
      department: row.department_name || null,
      departmentId: row.department_id,
      totalTrips: row.total_trips || 0,
      totalDistance: parseFloat(row.total_distance || 0),
      totalFuelConsumption: parseFloat(row.total_fuel_consumption || 0),
      reliabilityScore: row.reliability_score || 0,
      punctualityScore: row.punctuality_score || 0,
      fuelEfficiencyScore: row.fuel_efficiency_score || 0,
      lastTripDate: row.last_trip_date ? row.last_trip_date.toISOString().split('T')[0] : null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Driver;
