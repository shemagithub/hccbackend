import pool from '../config/db.js';

class Vehicle {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS vehicles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vehicle_id VARCHAR(50) NOT NULL UNIQUE,
        plate_number VARCHAR(20) NOT NULL UNIQUE,
        brand VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        year INT NOT NULL,
        fuel_type ENUM('gasoline', 'diesel', 'electric', 'hybrid') DEFAULT 'gasoline',
        status ENUM('in_use', 'available', 'under_maintenance', 'out_of_service') DEFAULT 'available',
        assigned_driver VARCHAR(255) NULL,
        assigned_project VARCHAR(255) NULL,
        mileage INT DEFAULT 0,
        last_service DATE NULL,
        next_service DATE NULL,
        insurance_expiry DATE NULL,
        registration_expiry DATE NULL,
        capacity VARCHAR(50) NULL,
        fuel_capacity VARCHAR(50) NULL,
        avg_fuel_consumption VARCHAR(50) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_plate_number (plate_number),
        INDEX idx_fuel_type (fuel_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Vehicles table created or already exists.');
  }

  static async generateVehicleId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM vehicles WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(3, '0');
    return `VEH-${year}-${sequence}`;
  }

  static async create({
    vehicleId,
    plateNumber,
    brand,
    model,
    year,
    fuelType = 'gasoline',
    status = 'available',
    assignedDriver,
    assignedProject,
    mileage = 0,
    lastService,
    nextService,
    insuranceExpiry,
    registrationExpiry,
    capacity,
    fuelCapacity,
    avgFuelConsumption,
    notes
  }) {
    const vehId = vehicleId || await this.generateVehicleId();

    const [result] = await pool.execute(
      `INSERT INTO vehicles (
        vehicle_id, plate_number, brand, model, year, fuel_type, status,
        assigned_driver, assigned_project, mileage, last_service, next_service,
        insurance_expiry, registration_expiry, capacity, fuel_capacity,
        avg_fuel_consumption, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vehId, plateNumber, brand, model, year, fuelType, status,
        assignedDriver || null, assignedProject || null, mileage,
        lastService || null, nextService || null,
        insuranceExpiry || null, registrationExpiry || null,
        capacity || null, fuelCapacity || null,
        avgFuelConsumption || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `SELECT * FROM vehicles WHERE 1=1`;
    const params = [];

    if (filters.search) {
      query += ` AND (
        plate_number LIKE ? OR
        brand LIKE ? OR
        model LIKE ? OR
        vehicle_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.fuelType) {
      query += ` AND fuel_type = ?`;
      params.push(filters.fuelType);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToVehicle(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM vehicles WHERE id = ?', [id]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToVehicle(rows[0]);
  }

  static async findByVehicleId(vehicleId) {
    const [rows] = await pool.execute('SELECT * FROM vehicles WHERE vehicle_id = ?', [vehicleId]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToVehicle(rows[0]);
  }

  static async findByPlateNumber(plateNumber) {
    const [rows] = await pool.execute('SELECT * FROM vehicles WHERE plate_number = ?', [plateNumber]);
    
    if (rows.length === 0) return null;
    
    return this.mapRowToVehicle(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      plateNumber: 'plate_number',
      brand: 'brand',
      model: 'model',
      year: 'year',
      fuelType: 'fuel_type',
      status: 'status',
      assignedDriver: 'assigned_driver',
      assignedProject: 'assigned_project',
      mileage: 'mileage',
      lastService: 'last_service',
      nextService: 'next_service',
      insuranceExpiry: 'insurance_expiry',
      registrationExpiry: 'registration_expiry',
      capacity: 'capacity',
      fuelCapacity: 'fuel_capacity',
      avgFuelConsumption: 'avg_fuel_consumption',
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
      `UPDATE vehicles SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM vehicles WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) as inUse,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'under_maintenance' THEN 1 ELSE 0 END) as underMaintenance,
        SUM(CASE WHEN status = 'out_of_service' THEN 1 ELSE 0 END) as outOfService
      FROM vehicles
    `);
    return rows[0];
  }

  static mapRowToVehicle(row) {
    return {
      id: row.vehicle_id,
      dbId: row.id,
      plateNumber: row.plate_number,
      brand: row.brand,
      model: row.model,
      year: row.year,
      fuelType: row.fuel_type,
      status: row.status,
      assignedDriver: row.assigned_driver,
      assignedProject: row.assigned_project,
      mileage: row.mileage,
      lastService: row.last_service ? row.last_service.toISOString().split('T')[0] : null,
      nextService: row.next_service ? row.next_service.toISOString().split('T')[0] : null,
      insuranceExpiry: row.insurance_expiry ? row.insurance_expiry.toISOString().split('T')[0] : null,
      registrationExpiry: row.registration_expiry ? row.registration_expiry.toISOString().split('T')[0] : null,
      capacity: row.capacity,
      fuelCapacity: row.fuel_capacity,
      avgFuelConsumption: row.avg_fuel_consumption,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Vehicle;

