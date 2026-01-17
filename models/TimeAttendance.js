import pool from '../config/db.js';

class TimeAttendance {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS time_attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attendance_id VARCHAR(50) NOT NULL UNIQUE,
        driver_id INT NOT NULL,
        project_id INT NULL,
        vehicle_id INT NULL,
        date DATE NOT NULL,
        check_in_time TIME NULL,
        check_out_time TIME NULL,
        driving_hours DECIMAL(5,2) NULL,
        waiting_hours DECIMAL(5,2) NULL,
        overtime_hours DECIMAL(5,2) NULL,
        total_hours DECIMAL(5,2) NULL,
        work_type ENUM('field', 'office', 'mixed') DEFAULT 'field',
        status ENUM('present', 'absent', 'late', 'half_day') DEFAULT 'present',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_driver (driver_id),
        INDEX idx_project (project_id),
        INDEX idx_vehicle (vehicle_id),
        INDEX idx_date (date),
        INDEX idx_status (status),
        FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Time attendance table created or already exists.');
  }

  static async generateAttendanceId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM time_attendance WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `ATT-${year}-${sequence}`;
  }

  static async create({
    attendanceId,
    driverId,
    projectId,
    vehicleId,
    date,
    checkInTime,
    checkOutTime,
    drivingHours,
    waitingHours,
    overtimeHours,
    totalHours,
    workType = 'field',
    status = 'present',
    notes
  }) {
    const attId = attendanceId || await this.generateAttendanceId();

    // Auto-calculate total hours if check-in/out times provided
    let calculatedTotal = totalHours;
    if (!calculatedTotal && checkInTime && checkOutTime) {
      const checkIn = new Date(`2000-01-01 ${checkInTime}`);
      const checkOut = new Date(`2000-01-01 ${checkOutTime}`);
      const diffMs = checkOut - checkIn;
      calculatedTotal = diffMs / (1000 * 60 * 60); // Convert to hours
    }

    const [result] = await pool.execute(
      `INSERT INTO time_attendance (
        attendance_id, driver_id, project_id, vehicle_id, date, check_in_time, check_out_time,
        driving_hours, waiting_hours, overtime_hours, total_hours, work_type, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attId, driverId, projectId || null, vehicleId || null, date || new Date().toISOString().split('T')[0],
        checkInTime || null, checkOutTime || null, drivingHours || null, waitingHours || null,
        overtimeHours || null, calculatedTotal || null, workType, status, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT ta.*, s.first_name as driver_first_name, s.last_name as driver_last_name, s.email as driver_email,
             p.name as project_name, p.project_id as project_code,
             v.vehicle_id as vehicle_code, v.plate_number
      FROM time_attendance ta
      LEFT JOIN staff s ON ta.driver_id = s.id
      LEFT JOIN projects p ON ta.project_id = p.id
      LEFT JOIN vehicles v ON ta.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.driverId) {
      query += ` AND ta.driver_id = ?`;
      params.push(filters.driverId);
    }

    if (filters.driverEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.driverEmail);
    }

    if (filters.search) {
      query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR ta.attendance_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND ta.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.vehicleId) {
      query += ` AND ta.vehicle_id = ?`;
      params.push(filters.vehicleId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND ta.status = ?`;
      params.push(filters.status);
    }

    if (filters.workType && filters.workType !== 'all') {
      query += ` AND ta.work_type = ?`;
      params.push(filters.workType);
    }

    if (filters.startDate) {
      query += ` AND ta.date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND ta.date <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY ta.date DESC, ta.check_in_time DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToAttendance(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ta.*, s.first_name as driver_first_name, s.last_name as driver_last_name, s.email as driver_email,
              p.name as project_name, p.project_id as project_code,
              v.vehicle_id as vehicle_code, v.plate_number
       FROM time_attendance ta
       LEFT JOIN staff s ON ta.driver_id = s.id
       LEFT JOIN projects p ON ta.project_id = p.id
       LEFT JOIN vehicles v ON ta.vehicle_id = v.id
       WHERE ta.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToAttendance(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      vehicleId: 'vehicle_id',
      date: 'date',
      checkInTime: 'check_in_time',
      checkOutTime: 'check_out_time',
      drivingHours: 'driving_hours',
      waitingHours: 'waiting_hours',
      overtimeHours: 'overtime_hours',
      totalHours: 'total_hours',
      workType: 'work_type',
      status: 'status',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = ?`);
        params.push(updateData[key]);
      }
    });

    // Auto-calculate total hours if check-in/out times updated
    if (updateData.checkInTime !== undefined || updateData.checkOutTime !== undefined) {
      const existing = await this.findById(id);
      if (existing) {
        const checkIn = updateData.checkInTime !== undefined ? updateData.checkInTime : existing.checkInTime;
        const checkOut = updateData.checkOutTime !== undefined ? updateData.checkOutTime : existing.checkOutTime;
        if (checkIn && checkOut && !updateData.totalHours) {
          const checkInDate = new Date(`2000-01-01 ${checkIn}`);
          const checkOutDate = new Date(`2000-01-01 ${checkOut}`);
          const diffMs = checkOutDate - checkInDate;
          const calculatedTotal = diffMs / (1000 * 60 * 60);
          updateFields.push('total_hours = ?');
          params.push(calculatedTotal);
        }
      }
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE time_attendance SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM time_attendance WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToAttendance(row) {
    return {
      id: row.attendance_id,
      dbId: row.id,
      driverId: row.driver_id,
      driverName: row.driver_first_name && row.driver_last_name
        ? `${row.driver_first_name} ${row.driver_last_name}` : null,
      driverEmail: row.driver_email,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      vehicleId: row.vehicle_id,
      vehicleCode: row.vehicle_code,
      vehiclePlate: row.plate_number,
      date: row.date ? row.date.toISOString().split('T')[0] : null,
      checkInTime: row.check_in_time ? row.check_in_time.toString() : null,
      checkOutTime: row.check_out_time ? row.check_out_time.toString() : null,
      drivingHours: row.driving_hours ? parseFloat(row.driving_hours) : null,
      waitingHours: row.waiting_hours ? parseFloat(row.waiting_hours) : null,
      overtimeHours: row.overtime_hours ? parseFloat(row.overtime_hours) : null,
      totalHours: row.total_hours ? parseFloat(row.total_hours) : null,
      workType: row.work_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default TimeAttendance;
