import pool from '../config/db.js';

class Meeting {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS meetings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meeting_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        type ENUM('Client', 'Internal', 'Department', 'Project', 'Other') DEFAULT 'Internal',
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        duration_minutes INT DEFAULT 60,
        location VARCHAR(255) NULL,
        status ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed') DEFAULT 'scheduled',
        organizer_id INT NULL,
        organizer_name VARCHAR(255) NULL,
        attendees TEXT NULL,
        agenda TEXT NULL,
        minutes TEXT NULL,
        action_items TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_scheduled_date (scheduled_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (organizer_id) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Meetings table created or already exists.');
  }

  static async generateMeetingId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM meetings WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `MEET-${year}-${sequence}`;
  }

  static async create({
    meetingId,
    projectId,
    title,
    type = 'Internal',
    scheduledDate,
    scheduledTime,
    durationMinutes = 60,
    location,
    status = 'scheduled',
    organizerId,
    organizerName,
    attendees,
    agenda,
    minutes,
    actionItems
  }) {
    const meetId = meetingId || await this.generateMeetingId();
    const attendeesJson = attendees ? JSON.stringify(attendees) : null;
    const actionItemsJson = actionItems ? JSON.stringify(actionItems) : null;

    const [result] = await pool.execute(
      `INSERT INTO meetings (
        meeting_id, project_id, title, type, scheduled_date, scheduled_time, duration_minutes,
        location, status, organizer_id, organizer_name, attendees, agenda, minutes, action_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meetId, projectId || null, title, type, scheduledDate, scheduledTime, durationMinutes,
        location || null, status, organizerId || null, organizerName || null,
        attendeesJson, agenda || null, minutes || null, actionItemsJson
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT m.*, p.name as project_name, p.project_id as project_code,
             s.first_name as organizer_first_name, s.last_name as organizer_last_name
      FROM meetings m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN staff s ON m.organizer_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (m.title LIKE ? OR m.agenda LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
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

    if (filters.startDate) {
      query += ` AND m.scheduled_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND m.scheduled_date <= ?`;
      params.push(filters.endDate);
    }

    // Filter by department through projects
    if (filters.departmentId) {
      // Get department name from departments table
      query += ` AND EXISTS (
        SELECT 1 FROM projects pr
        INNER JOIN departments dept ON pr.department = dept.name
        WHERE pr.id = m.project_id AND dept.id = ?
      )`;
      params.push(filters.departmentId);
    } else if (filters.departmentName) {
      // Filter by department name directly
      query += ` AND p.department = ?`;
      params.push(filters.departmentName);
    }

    query += ` ORDER BY m.scheduled_date ASC, m.scheduled_time ASC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToMeeting(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT m.*, p.name as project_name, p.project_id as project_code,
              s.first_name as organizer_first_name, s.last_name as organizer_last_name
       FROM meetings m
       LEFT JOIN projects p ON m.project_id = p.id
       LEFT JOIN staff s ON m.organizer_id = s.id
       WHERE m.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToMeeting(rows[0]);
  }

  static async findByMeetingId(meetingId) {
    const [rows] = await pool.execute(
      `SELECT m.*, p.name as project_name, p.project_id as project_code,
              s.first_name as organizer_first_name, s.last_name as organizer_last_name
       FROM meetings m
       LEFT JOIN projects p ON m.project_id = p.id
       LEFT JOIN staff s ON m.organizer_id = s.id
       WHERE m.meeting_id = ?`,
      [meetingId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToMeeting(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      title: 'title',
      type: 'type',
      scheduledDate: 'scheduled_date',
      scheduledTime: 'scheduled_time',
      durationMinutes: 'duration_minutes',
      location: 'location',
      status: 'status',
      organizerId: 'organizer_id',
      organizerName: 'organizer_name',
      attendees: 'attendees',
      agenda: 'agenda',
      minutes: 'minutes',
      actionItems: 'action_items'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'attendees' || key === 'actionItems') {
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
      `UPDATE meetings SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM meetings WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN scheduled_date = CURDATE() THEN 1 ELSE 0 END) as today
      FROM meetings
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToMeeting(row) {
    return {
      id: row.meeting_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      type: row.type,
      scheduledDate: row.scheduled_date ? row.scheduled_date.toISOString().split('T')[0] : null,
      scheduledTime: row.scheduled_time ? row.scheduled_time.toString() : null,
      durationMinutes: row.duration_minutes,
      location: row.location,
      status: row.status,
      organizerId: row.organizer_id,
      organizerName: row.organizer_name || (row.organizer_first_name && row.organizer_last_name
        ? `${row.organizer_first_name} ${row.organizer_last_name}` : null),
      attendees: row.attendees ? JSON.parse(row.attendees) : [],
      agenda: row.agenda,
      minutes: row.minutes,
      actionItems: row.action_items ? JSON.parse(row.action_items) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Meeting;

