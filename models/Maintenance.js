import pool from '../config/db.js';

class Maintenance {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS maintenance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        maintenance_id VARCHAR(50) NOT NULL UNIQUE,
        vehicle_id INT NOT NULL,
        project_id INT NULL,
        type ENUM('Service', 'Repair', 'Inspection', 'Upgrade', 'Other') DEFAULT 'Service',
        issue VARCHAR(500) NOT NULL,
        description TEXT NULL,
        status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
        scheduled_date DATE NOT NULL,
        completed_date DATE NULL,
        cost DECIMAL(15,2) NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        service_provider VARCHAR(255) NULL,
        technician VARCHAR(255) NULL,
        parts_used TEXT NULL,
        next_service_date DATE NULL,
        mileage_at_service INT NULL,
        reported_by INT NULL,
        reported_by_name VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_scheduled_date (scheduled_date),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (reported_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Maintenance table created or already exists.');
  }

  static async generateMaintenanceId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM maintenance WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `MAINT-${year}-${sequence}`;
  }

  static async create({
    maintenanceId,
    vehicleId,
    projectId,
    type = 'Service',
    issue,
    description,
    status = 'scheduled',
    scheduledDate,
    completedDate,
    cost,
    currency = 'USD',
    serviceProvider,
    technician,
    partsUsed,
    nextServiceDate,
    mileageAtService,
    reportedBy,
    reportedByName,
    notes
  }) {
    const maintId = maintenanceId || await this.generateMaintenanceId();
    const partsJson = partsUsed ? JSON.stringify(partsUsed) : null;

    const [result] = await pool.execute(
      `INSERT INTO maintenance (
        maintenance_id, vehicle_id, project_id, type, issue, description, status,
        scheduled_date, completed_date, cost, currency, service_provider, technician,
        parts_used, next_service_date, mileage_at_service, reported_by, reported_by_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        maintId, vehicleId, projectId || null, type, issue, description || null, status,
        scheduledDate, completedDate || null, cost || null, currency, serviceProvider || null,
        technician || null, partsJson, nextServiceDate || null, mileageAtService || null,
        reportedBy || null, reportedByName || null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT m.*, v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
             p.name as project_name, p.project_id as project_code,
             s.first_name as reporter_first_name, s.last_name as reporter_last_name
      FROM maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN staff s ON m.reported_by = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (m.issue LIKE ? OR v.plate_number LIKE ? OR m.technician LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.vehicleId) {
      query += ` AND m.vehicle_id = ?`;
      params.push(filters.vehicleId);
    }

    if (filters.projectId) {
      query += ` AND m.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.type) {
      query += ` AND m.type = ?`;
      params.push(filters.type);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND m.status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY m.scheduled_date DESC, m.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToMaintenance(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT m.*, v.vehicle_id as vehicle_code, v.plate_number, v.brand, v.model,
              p.name as project_name, p.project_id as project_code,
              s.first_name as reporter_first_name, s.last_name as reporter_last_name
       FROM maintenance m
       LEFT JOIN vehicles v ON m.vehicle_id = v.id
       LEFT JOIN projects p ON m.project_id = p.id
       LEFT JOIN staff s ON m.reported_by = s.id
       WHERE m.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToMaintenance(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      vehicleId: 'vehicle_id',
      projectId: 'project_id',
      type: 'type',
      issue: 'issue',
      description: 'description',
      status: 'status',
      scheduledDate: 'scheduled_date',
      completedDate: 'completed_date',
      cost: 'cost',
      currency: 'currency',
      serviceProvider: 'service_provider',
      technician: 'technician',
      partsUsed: 'parts_used',
      nextServiceDate: 'next_service_date',
      mileageAtService: 'mileage_at_service',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'partsUsed') {
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
      `UPDATE maintenance SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM maintenance WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(vehicleId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN cost IS NOT NULL THEN cost ELSE 0 END) as totalCost
      FROM maintenance
    `;
    const params = [];

    if (vehicleId) {
      query += ` WHERE vehicle_id = ?`;
      params.push(vehicleId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToMaintenance(row) {
    return {
      id: row.maintenance_id,
      dbId: row.id,
      vehicleId: row.vehicle_id,
      vehicleCode: row.vehicle_code,
      vehiclePlate: row.plate_number,
      vehicleBrand: row.brand,
      vehicleModel: row.model,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      type: row.type,
      issue: row.issue,
      description: row.description,
      status: row.status,
      scheduledDate: row.scheduled_date ? row.scheduled_date.toISOString().split('T')[0] : null,
      completedDate: row.completed_date ? row.completed_date.toISOString().split('T')[0] : null,
      cost: row.cost ? parseFloat(row.cost) : null,
      currency: row.currency,
      serviceProvider: row.service_provider,
      technician: row.technician,
      partsUsed: row.parts_used ? JSON.parse(row.parts_used) : [],
      nextServiceDate: row.next_service_date ? row.next_service_date.toISOString().split('T')[0] : null,
      mileageAtService: row.mileage_at_service,
      reportedBy: row.reported_by,
      reportedByName: row.reported_by_name || (row.reporter_first_name && row.reporter_last_name
        ? `${row.reporter_first_name} ${row.reporter_last_name}` : null),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Maintenance;

