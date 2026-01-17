import pool from '../config/db.js';

class MeetingMinutes {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS meeting_minutes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        minutes_id VARCHAR(50) NOT NULL UNIQUE,
        meeting_id INT NOT NULL,
        project_id INT NULL,
        title VARCHAR(500) NOT NULL,
        meeting_date DATE NOT NULL,
        meeting_time TIME NULL,
        duration_minutes INT NULL,
        location VARCHAR(255) NULL,
        attendees TEXT NULL,
        attendee_count INT DEFAULT 0,
        agenda TEXT NULL,
        discussion_points TEXT NULL,
        decisions_made TEXT NULL,
        action_points_summary TEXT NULL,
        action_points_count INT DEFAULT 0,
        next_steps TEXT NULL,
        attachments TEXT NULL,
        recorded_by INT NULL,
        recorded_by_name VARCHAR(255) NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        status ENUM('draft', 'finalized', 'approved', 'archived') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_meeting (meeting_id),
        INDEX idx_project (project_id),
        INDEX idx_meeting_date (meeting_date),
        INDEX idx_status (status),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (recorded_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Meeting minutes table created or already exists.');
  }

  static async generateMinutesId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM meeting_minutes WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `MIN-${year}-${sequence}`;
  }

  static async create({
    minutesId,
    meetingId,
    projectId,
    title,
    meetingDate,
    meetingTime,
    durationMinutes,
    location,
    attendees,
    agenda,
    discussionPoints,
    decisionsMade,
    actionPointsSummary,
    nextSteps,
    attachments,
    recordedBy,
    recordedByName,
    status = 'draft'
  }) {
    const mId = minutesId || await this.generateMinutesId();
    
    // Calculate attendee count
    const attendeeCount = attendees ? (Array.isArray(attendees) ? attendees.length : JSON.parse(attendees).length) : 0;
    
    // Count action points from summary
    const actionPointsCount = actionPointsSummary ? (actionPointsSummary.match(/action|action point|action item/gi) || []).length : 0;

    const [result] = await pool.execute(
      `INSERT INTO meeting_minutes (
        minutes_id, meeting_id, project_id, title, meeting_date, meeting_time, duration_minutes,
        location, attendees, attendee_count, agenda, discussion_points, decisions_made,
        action_points_summary, action_points_count, next_steps, attachments,
        recorded_by, recorded_by_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mId, meetingId, projectId || null, title, meetingDate, meetingTime || null, durationMinutes || null,
        location || null, attendees ? (Array.isArray(attendees) ? JSON.stringify(attendees) : attendees) : null,
        attendeeCount, agenda || null, discussionPoints || null, decisionsMade || null,
        actionPointsSummary || null, actionPointsCount, nextSteps || null,
        attachments ? (Array.isArray(attachments) ? JSON.stringify(attachments) : attachments) : null,
        recordedBy || null, recordedByName || null, status
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT mm.*, m.title as meeting_title, m.meeting_id as meeting_reference,
             p.name as project_name, p.project_id as project_code,
             s1.first_name as recorder_first_name, s1.last_name as recorder_last_name,
             s2.first_name as approver_first_name, s2.last_name as approver_last_name
      FROM meeting_minutes mm
      LEFT JOIN meetings m ON mm.meeting_id = m.id
      LEFT JOIN projects p ON mm.project_id = p.id
      LEFT JOIN staff s1 ON mm.recorded_by = s1.id
      LEFT JOIN staff s2 ON mm.approved_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (mm.title LIKE ? OR mm.discussion_points LIKE ? OR mm.decisions_made LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.meetingId) {
      query += ` AND mm.meeting_id = ?`;
      params.push(filters.meetingId);
    }

    if (filters.projectId) {
      query += ` AND mm.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND mm.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND mm.meeting_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND mm.meeting_date <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY mm.meeting_date DESC, mm.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToMinutes(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT mm.*, m.title as meeting_title, m.meeting_id as meeting_reference,
              p.name as project_name, p.project_id as project_code,
              s1.first_name as recorder_first_name, s1.last_name as recorder_last_name,
              s2.first_name as approver_first_name, s2.last_name as approver_last_name
       FROM meeting_minutes mm
       LEFT JOIN meetings m ON mm.meeting_id = m.id
       LEFT JOIN projects p ON mm.project_id = p.id
       LEFT JOIN staff s1 ON mm.recorded_by = s1.id
       LEFT JOIN staff s2 ON mm.approved_by = s2.id
       WHERE mm.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToMinutes(rows[0]);
  }

  static async findByMinutesId(minutesId) {
    const [rows] = await pool.execute(
      `SELECT mm.*, m.title as meeting_title, m.meeting_id as meeting_reference,
              p.name as project_name, p.project_id as project_code,
              s1.first_name as recorder_first_name, s1.last_name as recorder_last_name,
              s2.first_name as approver_first_name, s2.last_name as approver_last_name
       FROM meeting_minutes mm
       LEFT JOIN meetings m ON mm.meeting_id = m.id
       LEFT JOIN projects p ON mm.project_id = p.id
       LEFT JOIN staff s1 ON mm.recorded_by = s1.id
       LEFT JOIN staff s2 ON mm.approved_by = s2.id
       WHERE mm.minutes_id = ?`,
      [minutesId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToMinutes(rows[0]);
  }

  static async findByMeetingId(meetingId) {
    const [rows] = await pool.execute(
      `SELECT mm.*, m.title as meeting_title, m.meeting_id as meeting_reference,
              p.name as project_name, p.project_id as project_code,
              s1.first_name as recorder_first_name, s1.last_name as recorder_last_name,
              s2.first_name as approver_first_name, s2.last_name as approver_last_name
       FROM meeting_minutes mm
       LEFT JOIN meetings m ON mm.meeting_id = m.id
       LEFT JOIN projects p ON mm.project_id = p.id
       LEFT JOIN staff s1 ON mm.recorded_by = s1.id
       LEFT JOIN staff s2 ON mm.approved_by = s2.id
       WHERE mm.meeting_id = ?
       ORDER BY mm.meeting_date DESC`,
      [meetingId]
    );
    
    return rows.map(row => this.mapRowToMinutes(row));
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      meetingId: 'meeting_id',
      projectId: 'project_id',
      title: 'title',
      meetingDate: 'meeting_date',
      meetingTime: 'meeting_time',
      durationMinutes: 'duration_minutes',
      location: 'location',
      attendees: 'attendees',
      agenda: 'agenda',
      discussionPoints: 'discussion_points',
      decisionsMade: 'decisions_made',
      actionPointsSummary: 'action_points_summary',
      nextSteps: 'next_steps',
      attachments: 'attachments',
      recordedBy: 'recorded_by',
      recordedByName: 'recorded_by_name',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      approvalDate: 'approval_date',
      status: 'status'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'attendees' || key === 'attachments') {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key] ? (Array.isArray(updateData[key]) ? JSON.stringify(updateData[key]) : updateData[key]) : null);
          
          // Update attendee count if attendees changed
          if (key === 'attendees') {
            const attendeeCount = updateData[key] ? (Array.isArray(updateData[key]) ? updateData[key].length : JSON.parse(updateData[key]).length) : 0;
            updateFields.push(`attendee_count = ?`);
            params.splice(params.length - 1, 0, attendeeCount);
          }
        } else {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key]);
        }
      }
    });

    // Auto-set approval date if status is approved
    if (updateData.status === 'approved' && !updateData.approvalDate) {
      updateFields.push(`approval_date = ?`);
      params.splice(params.length - 1, 0, new Date().toISOString().split('T')[0]);
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE meeting_minutes SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM meeting_minutes WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) as finalized,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        AVG(attendee_count) as avgAttendees,
        SUM(action_points_count) as totalActionPoints
      FROM meeting_minutes
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToMinutes(row) {
    return {
      id: row.minutes_id,
      dbId: row.id,
      meetingId: row.meeting_id,
      meetingTitle: row.meeting_title,
      meetingReference: row.meeting_reference,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      title: row.title,
      meetingDate: row.meeting_date ? row.meeting_date.toISOString().split('T')[0] : null,
      meetingTime: row.meeting_time ? row.meeting_time.toString() : null,
      durationMinutes: row.duration_minutes ? parseInt(row.duration_minutes) : null,
      location: row.location,
      attendees: row.attendees ? (typeof row.attendees === 'string' ? JSON.parse(row.attendees) : row.attendees) : [],
      attendeeCount: parseInt(row.attendee_count) || 0,
      agenda: row.agenda,
      discussionPoints: row.discussion_points,
      decisionsMade: row.decisions_made,
      actionPointsSummary: row.action_points_summary,
      actionPointsCount: parseInt(row.action_points_count) || 0,
      nextSteps: row.next_steps,
      attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : [],
      recordedBy: row.recorded_by,
      recordedByName: row.recorded_by_name || (row.recorder_first_name && row.recorder_last_name
        ? `${row.recorder_first_name} ${row.recorder_last_name}` : null),
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default MeetingMinutes;
