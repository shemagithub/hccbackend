import pool from '../config/db.js';
import { ensurePrimaryKey } from '../scripts/ensure-primary-key.js';

function mapVisitor(row) {
  if (!row) return null;
  return {
    id: row.visitor_code,
    dbId: row.id,
    name: row.name,
    company: row.company,
    hostName: row.host_name,
    purpose: row.purpose,
    phone: row.phone,
    badgeNumber: row.badge_number,
    checkInAt: row.check_in_at ? new Date(row.check_in_at).toISOString() : null,
    checkOutAt: row.check_out_at ? new Date(row.check_out_at).toISOString() : null,
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAppointment(row) {
  if (!row) return null;
  return {
    id: row.appointment_code,
    dbId: row.id,
    visitorName: row.visitor_name,
    hostName: row.host_name,
    purpose: row.purpose,
    date: row.appointment_date
      ? String(row.appointment_date instanceof Date ? row.appointment_date.toISOString().split('T')[0] : row.appointment_date).slice(0, 10)
      : null,
    time: row.appointment_time ? String(row.appointment_time).slice(0, 5) : row.appointment_time,
    phone: row.phone,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCall(row) {
  if (!row) return null;
  return {
    id: row.call_code,
    dbId: row.id,
    callerName: row.caller_name,
    phone: row.phone,
    direction: row.direction,
    purpose: row.purpose,
    handledBy: row.handled_by_name,
    loggedAt: row.logged_at ? new Date(row.logged_at).toISOString() : null,
    notes: row.notes,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ReceptionVisitor {
  static async createTable() {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reception_visitors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visitor_code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255) NULL,
        host_name VARCHAR(255) NOT NULL,
        purpose TEXT NOT NULL,
        phone VARCHAR(50) NULL,
        badge_number VARCHAR(50) NULL,
        check_in_at DATETIME NOT NULL,
        check_out_at DATETIME NULL,
        status ENUM('checked_in', 'checked_out') DEFAULT 'checked_in',
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_check_in (check_in_at),
        INDEX idx_host (host_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await ensurePrimaryKey('reception_visitors');
  }

  static async generateCode() {
    const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM reception_visitors');
    return `VIS-${String(rows[0].count + 1).padStart(5, '0')}`;
  }

  static async findAll(filters = {}) {
    let query = 'SELECT * FROM reception_visitors WHERE 1=1';
    const params = [];
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      query += ' AND (name LIKE ? OR company LIKE ? OR host_name LIKE ? OR purpose LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }
    if (filters.date) {
      query += ' AND DATE(check_in_at) = ?';
      params.push(filters.date);
    }
    query += ' ORDER BY check_in_at DESC';
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit, 10));
    }
    const [rows] = await pool.execute(query, params);
    return rows.map(mapVisitor);
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM reception_visitors WHERE id = ?', [id]);
    return mapVisitor(rows[0]);
  }

  static async create(data) {
    const code = data.visitorCode || (await this.generateCode());
    const [result] = await pool.execute(
      `INSERT INTO reception_visitors (
        visitor_code, name, company, host_name, purpose, phone, badge_number,
        check_in_at, check_out_at, status, created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        data.name,
        data.company || null,
        data.hostName,
        data.purpose,
        data.phone || null,
        data.badgeNumber || null,
        data.checkInAt || new Date(),
        data.checkOutAt || null,
        data.status || 'checked_in',
        data.createdBy || null,
        data.createdByName || null,
      ]
    );
    return this.findById(result.insertId);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    const map = {
      name: 'name',
      company: 'company',
      hostName: 'host_name',
      purpose: 'purpose',
      phone: 'phone',
      badgeNumber: 'badge_number',
      checkInAt: 'check_in_at',
      checkOutAt: 'check_out_at',
      status: 'status',
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        params.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    params.push(id);
    await pool.execute(`UPDATE reception_visitors SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM reception_visitors WHERE id = ?', [id]);
    return true;
  }
}

export class ReceptionAppointment {
  static async createTable() {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reception_appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        appointment_code VARCHAR(50) NOT NULL UNIQUE,
        visitor_name VARCHAR(255) NOT NULL,
        host_name VARCHAR(255) NOT NULL,
        purpose VARCHAR(500) NOT NULL DEFAULT 'Meeting',
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        phone VARCHAR(50) NULL,
        status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
        notes TEXT NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_date (appointment_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await ensurePrimaryKey('reception_appointments');
  }

  static async generateCode() {
    const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM reception_appointments');
    return `APPT-${String(rows[0].count + 1).padStart(5, '0')}`;
  }

  static async findAll(filters = {}) {
    let query = 'SELECT * FROM reception_appointments WHERE 1=1';
    const params = [];
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      query += ' AND (visitor_name LIKE ? OR host_name LIKE ? OR purpose LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }
    if (filters.date) {
      query += ' AND appointment_date = ?';
      params.push(filters.date);
    }
    query += ' ORDER BY appointment_date DESC, appointment_time DESC';
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit, 10));
    }
    const [rows] = await pool.execute(query, params);
    return rows.map(mapAppointment);
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM reception_appointments WHERE id = ?', [id]);
    return mapAppointment(rows[0]);
  }

  static async create(data) {
    const code = data.appointmentCode || (await this.generateCode());
    const [result] = await pool.execute(
      `INSERT INTO reception_appointments (
        appointment_code, visitor_name, host_name, purpose, appointment_date, appointment_time,
        phone, status, notes, created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        data.visitorName,
        data.hostName,
        data.purpose || 'Meeting',
        data.date,
        data.time,
        data.phone || null,
        data.status || 'scheduled',
        data.notes || null,
        data.createdBy || null,
        data.createdByName || null,
      ]
    );
    return this.findById(result.insertId);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    const map = {
      visitorName: 'visitor_name',
      hostName: 'host_name',
      purpose: 'purpose',
      date: 'appointment_date',
      time: 'appointment_time',
      phone: 'phone',
      status: 'status',
      notes: 'notes',
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        params.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    params.push(id);
    await pool.execute(`UPDATE reception_appointments SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM reception_appointments WHERE id = ?', [id]);
    return true;
  }
}

export class ReceptionCall {
  static async createTable() {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reception_calls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        call_code VARCHAR(50) NOT NULL UNIQUE,
        caller_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        direction ENUM('incoming', 'outgoing') DEFAULT 'incoming',
        purpose VARCHAR(500) NOT NULL,
        handled_by_name VARCHAR(255) NULL,
        logged_at DATETIME NOT NULL,
        notes TEXT NULL,
        created_by INT NULL,
        created_by_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_logged_at (logged_at),
        INDEX idx_direction (direction)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await ensurePrimaryKey('reception_calls');
  }

  static async generateCode() {
    const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM reception_calls');
    return `CALL-${String(rows[0].count + 1).padStart(5, '0')}`;
  }

  static async findAll(filters = {}) {
    let query = 'SELECT * FROM reception_calls WHERE 1=1';
    const params = [];
    if (filters.direction) {
      query += ' AND direction = ?';
      params.push(filters.direction);
    }
    if (filters.search) {
      query += ' AND (caller_name LIKE ? OR phone LIKE ? OR purpose LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }
    if (filters.date) {
      query += ' AND DATE(logged_at) = ?';
      params.push(filters.date);
    }
    query += ' ORDER BY logged_at DESC';
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit, 10));
    }
    const [rows] = await pool.execute(query, params);
    return rows.map(mapCall);
  }

  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM reception_calls WHERE id = ?', [id]);
    return mapCall(rows[0]);
  }

  static async create(data) {
    const code = data.callCode || (await this.generateCode());
    const [result] = await pool.execute(
      `INSERT INTO reception_calls (
        call_code, caller_name, phone, direction, purpose, handled_by_name,
        logged_at, notes, created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        data.callerName,
        data.phone,
        data.direction || 'incoming',
        data.purpose,
        data.handledBy || data.handledByName || null,
        data.loggedAt || new Date(),
        data.notes || null,
        data.createdBy || null,
        data.createdByName || null,
      ]
    );
    return this.findById(result.insertId);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    const map = {
      callerName: 'caller_name',
      phone: 'phone',
      direction: 'direction',
      purpose: 'purpose',
      handledBy: 'handled_by_name',
      handledByName: 'handled_by_name',
      loggedAt: 'logged_at',
      notes: 'notes',
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        params.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    params.push(id);
    await pool.execute(`UPDATE reception_calls SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  static async delete(id) {
    await pool.execute('DELETE FROM reception_calls WHERE id = ?', [id]);
    return true;
  }
}

export async function createReceptionTables() {
  await ReceptionVisitor.createTable();
  await ReceptionAppointment.createTable();
  await ReceptionCall.createTable();
  console.log('Reception desk tables ready');
}

export async function getReceptionStats() {
  const today = new Date().toISOString().split('T')[0];
  const [[visitorsToday], [checkedIn], [appointmentsToday], [callsToday]] = await Promise.all([
    pool.execute('SELECT COUNT(*) AS c FROM reception_visitors WHERE DATE(check_in_at) = ?', [today]),
    pool.execute("SELECT COUNT(*) AS c FROM reception_visitors WHERE status = 'checked_in'"),
    pool.execute('SELECT COUNT(*) AS c FROM reception_appointments WHERE appointment_date = ?', [today]),
    pool.execute('SELECT COUNT(*) AS c FROM reception_calls WHERE DATE(logged_at) = ?', [today]),
  ]);
  return {
    visitorsToday: visitorsToday[0].c,
    checkedInNow: checkedIn[0].c,
    appointmentsToday: appointmentsToday[0].c,
    callsToday: callsToday[0].c,
  };
}
