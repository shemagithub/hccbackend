import pool from '../config/db.js';

class FuelLog {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS fuel_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fuel_log_id VARCHAR(50) NOT NULL UNIQUE,
        vehicle_id INT NOT NULL,
        project_id INT NULL,
        fuel_type ENUM('gasoline', 'diesel', 'electric', 'hybrid') DEFAULT 'gasoline',
        amount DECIMAL(10,2) NOT NULL,
        unit VARCHAR(10) DEFAULT 'L',
        cost DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        fuel_date DATE NOT NULL,
        odometer_reading INT NULL,
        location VARCHAR(255) NULL,
        supplier VARCHAR(255) NULL,
        receipt_path VARCHAR(500) NULL,
        logged_by INT NULL,
        logged_by_name VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_project (project_id),
        INDEX idx_fuel_date (fuel_date),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (logged_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Fuel logs table created or already exists.');
  }

  static async generateFuelLogId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM fuel_logs WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `FUEL-${year}-${sequence}`;
  }

  static async create({
    fuelLogId,
    vehicleId,
    projectId,
    fuelType = 'gasoline',
    amount,
    unit = 'L',
    cost,
    currency = 'USD',
    fuelDate,
    odometerReading,
    location,
    supplier,
    receiptPath,
    loggedBy,
    loggedByName,
    notes
  }) {
    const flId = fuelLogId || await this.generateFuelLogId();

    const [result] = await pool.execute(
      `INSERT INTO fuel_logs (
        fuel_log_id, vehicle_id, project_id, fuel_type, amount, unit, cost, currency,
        fuel_date, odometer_reading, location, supplier, receipt_path, logged_by, logged_by_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        flId, vehicleId, projectId || null, fuelType, amount, unit, cost, currency,
        fuelDate || new Date().toISOString().split('T')[0], odometerReading || null,
        location || null, supplier || null, receiptPath || null, loggedBy || null,
        loggedByName || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT f.*, v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
             p.name as project_name, p.project_id as project_code,
             s.first_name as logger_first_name, s.last_name as logger_last_name
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN projects p ON f.project_id = p.id
      LEFT JOIN staff s ON f.logged_by = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (v.plate_number LIKE ? OR v.brand LIKE ? OR f.supplier LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.vehicleId) {
      query += ` AND f.vehicle_id = ?`;
      params.push(filters.vehicleId);
    }

    if (filters.projectId) {
      query += ` AND f.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.startDate) {
      query += ` AND f.fuel_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND f.fuel_date <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY f.fuel_date DESC, f.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToFuelLog(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT f.*, v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
              p.name as project_name, p.project_id as project_code,
              s.first_name as logger_first_name, s.last_name as logger_last_name
       FROM fuel_logs f
       LEFT JOIN vehicles v ON f.vehicle_id = v.id
       LEFT JOIN projects p ON f.project_id = p.id
       LEFT JOIN staff s ON f.logged_by = s.id
       WHERE f.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToFuelLog(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      vehicleId: 'vehicle_id',
      projectId: 'project_id',
      fuelType: 'fuel_type',
      amount: 'amount',
      unit: 'unit',
      cost: 'cost',
      currency: 'currency',
      fuelDate: 'fuel_date',
      odometerReading: 'odometer_reading',
      location: 'location',
      supplier: 'supplier',
      receiptPath: 'receipt_path',
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
      `UPDATE fuel_logs SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM fuel_logs WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null, vehicleId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(amount) as totalAmount,
        SUM(cost) as totalCost,
        AVG(amount) as avgAmount,
        AVG(cost) as avgCost
      FROM fuel_logs
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      query += ` AND project_id = ?`;
      params.push(projectId);
    }

    if (vehicleId) {
      query += ` AND vehicle_id = ?`;
      params.push(vehicleId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static async getFuelByProject() {
    const [rows] = await pool.execute(`
      SELECT 
        p.id as project_id,
        p.name as project_name,
        p.project_id as project_code,
        SUM(f.amount) as total_amount,
        SUM(f.cost) as total_cost,
        COUNT(*) as log_count
      FROM fuel_logs f
      LEFT JOIN projects p ON f.project_id = p.id
      WHERE f.project_id IS NOT NULL
      GROUP BY p.id, p.name, p.project_id
      ORDER BY total_cost DESC
    `);
    return rows;
  }

  static mapRowToFuelLog(row) {
    return {
      id: row.fuel_log_id,
      dbId: row.id,
      vehicleId: row.vehicle_id,
      vehicleCode: row.vehicle_code,
      vehiclePlate: row.plate_number,
      vehicleBrand: row.brand,
      vehicleModel: row.model,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      fuelType: row.fuel_type,
      amount: parseFloat(row.amount),
      unit: row.unit,
      cost: parseFloat(row.cost),
      currency: row.currency,
      fuelDate: row.fuel_date ? row.fuel_date.toISOString().split('T')[0] : null,
      odometerReading: row.odometer_reading,
      location: row.location,
      supplier: row.supplier,
      receiptPath: row.receipt_path,
      loggedBy: row.logged_by,
      loggedByName: row.logged_by_name || (row.logger_first_name && row.logger_last_name
        ? `${row.logger_first_name} ${row.logger_last_name}` : null),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default FuelLog;

