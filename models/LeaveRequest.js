import pool from '../config/db.js';

class LeaveRequest {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leave_id VARCHAR(50) NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        leave_type ENUM('annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other') NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days DECIMAL(5,2) NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
        requested_date DATE NOT NULL,
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        rejection_reason TEXT NULL,
        attachments TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff (staff_id),
        INDEX idx_leave_type (leave_type),
        INDEX idx_status (status),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Leave requests table created or already exists.');
  }

  static async generateLeaveId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM leave_requests WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `LR-${year}-${sequence}`;
  }

  static async create({
    leaveId, staffId, leaveType, startDate, endDate, totalDays, reason,
    status = 'pending', requestedDate, approvedBy, approvedByName, approvalDate,
    rejectionReason, attachments, notes
  }) {
    const lId = leaveId || await this.generateLeaveId();

    // Auto-calculate total days if not provided
    let calculatedDays = totalDays;
    if (!calculatedDays && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
    }

    const [result] = await pool.execute(
      `INSERT INTO leave_requests (
        leave_id, staff_id, leave_type, start_date, end_date, total_days, reason,
        status, requested_date, approved_by, approved_by_name, approval_date,
        rejection_reason, attachments, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lId, staffId, leaveType, startDate, endDate, calculatedDays, reason,
        status, requestedDate || new Date().toISOString().split('T')[0],
        approvedBy || null, approvedByName || null, approvalDate || null,
        rejectionReason || null, attachments ? JSON.stringify(attachments) : null, notes || null
      ]
    );

    return await this.findById(result.insertId);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT lr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
             d.name as department_name,
             a.first_name as approver_first_name, a.last_name as approver_last_name
      FROM leave_requests lr
      LEFT JOIN staff s ON lr.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN staff a ON lr.approved_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.staffId) {
      query += ` AND lr.staff_id = ?`;
      params.push(filters.staffId);
    }

    if (filters.staffEmail) {
      query += ` AND s.email = ?`;
      params.push(filters.staffEmail);
    }

    if (filters.leaveType && filters.leaveType !== 'all') {
      query += ` AND lr.leave_type = ?`;
      params.push(filters.leaveType);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND lr.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND lr.start_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND lr.end_date <= ?`;
      params.push(filters.endDate);
    }

    if (filters.search) {
      query += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR lr.reason LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY lr.requested_date DESC, lr.start_date DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToLeave(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT lr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              d.name as department_name,
              a.first_name as approver_first_name, a.last_name as approver_last_name
       FROM leave_requests lr
       LEFT JOIN staff s ON lr.staff_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff a ON lr.approved_by = a.id
       WHERE lr.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToLeave(rows[0]);
  }

  static async findByLeaveId(leaveId) {
    const [rows] = await pool.execute(
      `SELECT lr.*, s.first_name, s.last_name, s.email, s.position, s.department_id,
              d.name as department_name,
              a.first_name as approver_first_name, a.last_name as approver_last_name
       FROM leave_requests lr
       LEFT JOIN staff s ON lr.staff_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN staff a ON lr.approved_by = a.id
       WHERE lr.leave_id = ?`,
      [leaveId]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToLeave(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      leaveType: 'leave_type',
      startDate: 'start_date',
      endDate: 'end_date',
      totalDays: 'total_days',
      reason: 'reason',
      status: 'status',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      approvalDate: 'approval_date',
      rejectionReason: 'rejection_reason',
      attachments: 'attachments',
      notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && fieldMapping[key]) {
        if (key === 'attachments') {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key] ? JSON.stringify(updateData[key]) : null);
        } else {
          updateFields.push(`${fieldMapping[key]} = ?`);
          params.push(updateData[key]);
        }
      }
    });

    // Auto-calculate total days if dates updated
    if (updateData.startDate !== undefined || updateData.endDate !== undefined) {
      const existing = await this.findById(id);
      if (existing) {
        const start = updateData.startDate !== undefined ? updateData.startDate : existing.startDate;
        const end = updateData.endDate !== undefined ? updateData.endDate : existing.endDate;
        if (start && end && !updateData.totalDays) {
          const startDate = new Date(start);
          const endDate = new Date(end);
          const diffTime = Math.abs(endDate - startDate);
          const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          updateFields.push('total_days = ?');
          params.push(calculatedDays);
        }
      }
    }

    if (updateFields.length === 0) return false;

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE leave_requests SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM leave_requests WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static mapRowToLeave(row) {
    return {
      id: row.leave_id,
      dbId: row.id,
      staffId: row.staff_id,
      staffName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      staffEmail: row.email,
      staffPosition: row.position,
      departmentId: row.department_id,
      departmentName: row.department_name,
      leaveType: row.leave_type,
      startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : null,
      endDate: row.end_date ? row.end_date.toISOString().split('T')[0] : null,
      totalDays: row.total_days ? parseFloat(row.total_days) : 0,
      reason: row.reason,
      status: row.status,
      requestedDate: row.requested_date ? row.requested_date.toISOString().split('T')[0] : null,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      rejectionReason: row.rejection_reason,
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default LeaveRequest;
