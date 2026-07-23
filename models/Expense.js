import pool from '../config/db.js';
import Project from './Project.js';
import Implementation from './Implementation.js';

class Expense {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_id VARCHAR(50) NOT NULL UNIQUE,
        project_id INT NULL,
        category ENUM('Personnel', 'Transport & Fuel', 'Field Activities', 'Consultants', 'Materials', 'Equipment', 'Other') NOT NULL,
        description VARCHAR(500) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        expense_date DATE NOT NULL,
        submitted_by INT NULL,
        submitted_by_name VARCHAR(255) NULL,
        status ENUM('draft', 'pending', 'approved', 'rejected') DEFAULT 'pending',
        approved_by INT NULL,
        approved_by_name VARCHAR(255) NULL,
        approval_date DATE NULL,
        approval_comments TEXT NULL,
        receipt_path VARCHAR(500) NULL,
        receipt_data LONGTEXT NULL,
        receipt_name VARCHAR(255) NULL,
        receipt_type VARCHAR(100) NULL,
        receipt_size VARCHAR(50) NULL,
        vendor VARCHAR(255) NULL,
        invoice_number VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_category (category),
        INDEX idx_status (status),
        INDEX idx_expense_date (expense_date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (submitted_by) REFERENCES staff(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(query);
    console.log('Expenses table created or already exists.');
    
    // Add new receipt fields if they don't exist (migration)
    try {
      // First check if table exists
      const [tables] = await pool.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'expenses'
      `);
      
      if (tables.length === 0) {
        console.log('Expenses table does not exist yet, will be created with all columns.');
        return;
      }
      
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'expenses' 
        AND COLUMN_NAME IN ('receipt_data', 'receipt_name', 'receipt_type', 'receipt_size')
      `);
      
      const existingColumns = columns.map(col => col.COLUMN_NAME);
      
      if (!existingColumns.includes('receipt_data')) {
        await pool.execute('ALTER TABLE expenses ADD COLUMN receipt_data LONGTEXT NULL AFTER receipt_path');
        console.log('✅ Added receipt_data column to expenses table.');
      }
      if (!existingColumns.includes('receipt_name')) {
        await pool.execute('ALTER TABLE expenses ADD COLUMN receipt_name VARCHAR(255) NULL AFTER receipt_data');
        console.log('✅ Added receipt_name column to expenses table.');
      }
      if (!existingColumns.includes('receipt_type')) {
        await pool.execute('ALTER TABLE expenses ADD COLUMN receipt_type VARCHAR(100) NULL AFTER receipt_name');
        console.log('✅ Added receipt_type column to expenses table.');
      }
      if (!existingColumns.includes('receipt_size')) {
        await pool.execute('ALTER TABLE expenses ADD COLUMN receipt_size VARCHAR(50) NULL AFTER receipt_type');
        console.log('✅ Added receipt_size column to expenses table.');
      }
      
      if (existingColumns.length === 4) {
        console.log('✅ All receipt columns already exist in expenses table.');
      }
    } catch (migrationError) {
      console.error('❌ Error migrating expenses table:', migrationError);
      console.error('Migration error details:', {
        message: migrationError.message,
        code: migrationError.code,
        sqlMessage: migrationError.sqlMessage
      });
      // Don't fail if migration fails - table might already have columns or migration might not be needed
    }
  }

  static async generateExpenseId() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM expenses WHERE YEAR(created_at) = YEAR(NOW())'
    );
    const count = rows[0].count;
    const year = new Date().getFullYear();
    const sequence = String(count + 1).padStart(4, '0');
    return `EXP-${year}-${sequence}`;
  }

  static async create({
    expenseId,
    projectId,
    category,
    description,
    amount,
    currency = 'USD',
    expenseDate,
    submittedBy,
    submittedByName,
    status = 'pending',
    receiptPath,
    receiptData,
    receiptName,
    receiptType,
    receiptSize,
    vendor,
    invoiceNumber
  }) {
    try {
      const expId = expenseId || await this.generateExpenseId();

      // Check if receipt columns exist, if not, use only basic columns
      let hasReceiptColumns = true;
      try {
        const [columns] = await pool.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'expenses' 
          AND COLUMN_NAME = 'receipt_data'
        `);
        hasReceiptColumns = columns.length > 0;
      } catch (checkError) {
        console.warn('Could not check for receipt columns, assuming they exist:', checkError.message);
      }

      // Get a connection to set max_allowed_packet for large file uploads
      const connection = await pool.getConnection();
      
      try {
        // Check current max_allowed_packet first (check GLOBAL, not SESSION, as SESSION is read-only)
        let currentPacketSize = 0;
        try {
          // Check GLOBAL value (this is what new connections will use)
          const [globalRows] = await connection.execute("SHOW GLOBAL VARIABLES LIKE 'max_allowed_packet'");
          if (globalRows.length > 0) {
            currentPacketSize = parseInt(globalRows[0].Value);
            const packetSizeMB = (currentPacketSize / 1024 / 1024).toFixed(2);
            console.log(`📦 GLOBAL max_allowed_packet: ${packetSizeMB}MB`);
          }
          
          // Also check SESSION for reference
          const [sessionRows] = await connection.execute("SHOW VARIABLES LIKE 'max_allowed_packet'");
          if (sessionRows.length > 0) {
            const sessionPacketSize = parseInt(sessionRows[0].Value);
            const sessionPacketSizeMB = (sessionPacketSize / 1024 / 1024).toFixed(2);
            console.log(`📦 SESSION max_allowed_packet: ${sessionPacketSizeMB}MB (read-only, new connections use GLOBAL)`);
          }
        } catch (checkError) {
          console.warn('Could not check max_allowed_packet:', checkError.message);
        }
        
        // Set max_allowed_packet to 300MB (314572800 bytes) if current is too small
        const targetPacketSize = 314572800; // 300MB
        if (currentPacketSize < targetPacketSize) {
          // Try GLOBAL first (requires SUPER privilege but affects all connections)
          try {
            await connection.execute(`SET GLOBAL max_allowed_packet = ${targetPacketSize}`);
            console.log('✅ Set GLOBAL max_allowed_packet to 300MB');
            console.log('⚠️  Note: You may need to restart the backend server for new connections to use this setting.');
            
            // SESSION max_allowed_packet is read-only in newer MySQL versions
            // New connections will automatically use the GLOBAL value
            // For this connection, we need to reconnect to pick up the GLOBAL value
            // But since we're in a transaction, we'll proceed and hope the GLOBAL setting helps
          } catch (globalError) {
            console.warn('Could not set GLOBAL max_allowed_packet:', globalError.message);
            console.warn('⚠️  Please run: npm run set-max-allowed-packet');
            console.warn('⚠️  Or restart your MySQL server with max_allowed_packet=300M in my.cnf');
          }
        }
        
        // Verify the actual max_allowed_packet value after setting
        try {
          const [rows] = await connection.execute("SHOW VARIABLES LIKE 'max_allowed_packet'");
          if (rows.length > 0) {
            const packetSize = parseInt(rows[0].Value);
            const packetSizeMB = (packetSize / 1024 / 1024).toFixed(2);
            console.log(`📦 Final max_allowed_packet: ${packetSizeMB}MB`);
            
            // Check if receipt data would exceed the limit
            if (receiptData) {
              const receiptSizeMB = receiptData.length / 1024 / 1024;
              if (receiptSizeMB > packetSize / 1024 / 1024 * 0.9) { // 90% of limit as safety margin
                console.warn(`⚠️ Receipt size (${receiptSizeMB.toFixed(2)}MB) is close to max_allowed_packet limit (${packetSizeMB}MB)`);
              }
            }
          }
        } catch (checkError) {
          console.warn('Could not verify max_allowed_packet:', checkError.message);
        }

        let query, params;
        
        if (hasReceiptColumns) {
          // Use full query with receipt columns
          query = `INSERT INTO expenses (
            expense_id, project_id, category, description, amount, currency, expense_date,
            submitted_by, submitted_by_name, status, receipt_path, receipt_data, receipt_name, receipt_type, receipt_size, vendor, invoice_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          params = [
            expId, projectId || null, category, description, amount, currency,
            expenseDate || new Date().toISOString().split('T')[0],
            submittedBy || null, submittedByName || null, status,
            receiptPath || null, receiptData || null, receiptName || null, receiptType || null, receiptSize || null,
            vendor || null, invoiceNumber || null
          ];
        } else {
          // Fallback to basic query without receipt columns
          console.warn('Receipt columns not found, using basic INSERT without receipt data');
          query = `INSERT INTO expenses (
            expense_id, project_id, category, description, amount, currency, expense_date,
            submitted_by, submitted_by_name, status, receipt_path, vendor, invoice_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          params = [
            expId, projectId || null, category, description, amount, currency,
            expenseDate || new Date().toISOString().split('T')[0],
            submittedBy || null, submittedByName || null, status,
            receiptPath || null,
            vendor || null, invoiceNumber || null
          ];
        }

        const [result] = await connection.execute(query, params);
        const expense = await this.findById(result.insertId);
        return expense;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in Expense.create:', error);
      console.error('SQL Error details:', {
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage,
        sqlState: error.sqlState
      });
      
      // Provide helpful error message for packet size errors
      if (error.code === 'ER_NET_PACKET_TOO_LARGE' || error.message?.includes('max_allowed_packet')) {
        const fileSizeMB = receiptData ? (receiptData.length / 1024 / 1024).toFixed(2) : 'unknown';
        const originalSizeMB = receiptData ? ((receiptData.length * 3 / 4) / 1024 / 1024).toFixed(2) : 'unknown';
        
        // Try to get the actual max_allowed_packet value for better error message
        let packetSizeInfo = '';
        try {
          const checkConnection = await pool.getConnection();
          try {
            const [packetRows] = await checkConnection.execute("SHOW VARIABLES LIKE 'max_allowed_packet'");
            if (packetRows.length > 0) {
              const packetSize = parseInt(packetRows[0].Value);
              const packetSizeMB = (packetSize / 1024 / 1024).toFixed(2);
              packetSizeInfo = ` Current MySQL max_allowed_packet is ${packetSizeMB}MB.`;
            }
          } finally {
            checkConnection.release();
          }
        } catch (checkErr) {
          // Ignore check errors
        }
        
        throw new Error(`Receipt file is too large (original: ${originalSizeMB}MB, encoded: ${fileSizeMB}MB).${packetSizeInfo} Please run 'npm run set-max-allowed-packet' in the backend directory or contact your administrator to increase the database packet size limit.`);
      }
      
      throw error;
    }
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT e.*, p.name as project_name, p.project_id as project_code,
             s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
             s2.first_name as approver_first_name, s2.last_name as approver_last_name
      FROM expenses e
      LEFT JOIN projects p ON e.project_id = p.id
      LEFT JOIN staff s1 ON e.submitted_by = s1.id
      LEFT JOIN staff s2 ON e.approved_by = s2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ` AND (e.description LIKE ? OR e.vendor LIKE ? OR e.invoice_number LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.projectId) {
      query += ` AND e.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.category) {
      query += ` AND e.category = ?`;
      params.push(filters.category);
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND e.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      query += ` AND e.expense_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND e.expense_date <= ?`;
      params.push(filters.endDate);
    }

    // Filter by department through projects
    if (filters.departmentId) {
      // Get department name from departments table
      query += ` AND EXISTS (
        SELECT 1 FROM projects pr
        INNER JOIN departments d ON pr.department = d.name
        WHERE pr.id = e.project_id AND d.id = ?
      )`;
      params.push(filters.departmentId);
    } else if (filters.departmentName) {
      // Filter by department name directly
      query += ` AND p.department = ?`;
      params.push(filters.departmentName);
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(filters.offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => this.mapRowToExpense(row));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT e.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
              s2.first_name as approver_first_name, s2.last_name as approver_last_name
       FROM expenses e
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN staff s1 ON e.submitted_by = s1.id
       LEFT JOIN staff s2 ON e.approved_by = s2.id
       WHERE e.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return null;
    return this.mapRowToExpense(rows[0]);
  }

  static async findByExpenseId(expenseId) {
    const [rows] = await pool.execute(
      `SELECT e.*, p.name as project_name, p.project_id as project_code,
              s1.first_name as submitter_first_name, s1.last_name as submitter_last_name,
              s2.first_name as approver_first_name, s2.last_name as approver_last_name
       FROM expenses e
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN staff s1 ON e.submitted_by = s1.id
       LEFT JOIN staff s2 ON e.approved_by = s2.id
       WHERE e.expense_id = ?`,
      [expenseId]
    );

    if (rows.length === 0) return null;
    return this.mapRowToExpense(rows[0]);
  }

  static async update(id, updateData) {
    const updateFields = [];
    const params = [];

    const fieldMapping = {
      projectId: 'project_id',
      category: 'category',
      description: 'description',
      amount: 'amount',
      currency: 'currency',
      expenseDate: 'expense_date',
      status: 'status',
      approvedBy: 'approved_by',
      approvedByName: 'approved_by_name',
      approvalDate: 'approval_date',
      approvalComments: 'approval_comments',
      receiptPath: 'receipt_path',
      receiptData: 'receipt_data',
      receiptName: 'receipt_name',
      receiptType: 'receipt_type',
      receiptSize: 'receipt_size',
      vendor: 'vendor',
      invoiceNumber: 'invoice_number'
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
      `UPDATE expenses SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM expenses WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getProjectExpenseTotal(projectId, { excludeRejected = true } = {}) {
    if (!projectId) return 0;

    let query = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE project_id = ?
    `;
    const params = [projectId];

    if (excludeRejected) {
      query += ` AND status != 'rejected'`;
    }

    const [rows] = await pool.execute(query, params);
    return parseFloat(rows[0]?.total || 0);
  }

  /** Recalculate project + linked implementation spent from expense records. */
  static async syncProjectSpentFromExpenses(projectId) {
    if (!projectId) return 0;

    const spent = await this.getProjectExpenseTotal(projectId);

    await Project.update(projectId, { spent });

    try {
      const implementation = await Implementation.findByProjectId(projectId);
      if (implementation?.dbId) {
        await Implementation.update(implementation.dbId, { spent });
      }
    } catch (error) {
      console.error('Error syncing implementation spent from expenses:', error);
    }

    return spent;
  }

  static async getStats(projectId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(amount) as totalAmount,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approvedAmount,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN category = 'Personnel' THEN amount ELSE 0 END) as personnelAmount,
        SUM(CASE WHEN category = 'Transport & Fuel' THEN amount ELSE 0 END) as transportAmount,
        SUM(CASE WHEN category = 'Field Activities' THEN amount ELSE 0 END) as fieldAmount,
        SUM(CASE WHEN category = 'Consultants' THEN amount ELSE 0 END) as consultantsAmount,
        SUM(CASE WHEN category = 'Materials' THEN amount ELSE 0 END) as materialsAmount
      FROM expenses
    `;
    const params = [];

    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }

  static mapRowToExpense(row) {
    return {
      id: row.expense_id,
      dbId: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      category: row.category,
      description: row.description,
      amount: parseFloat(row.amount),
      currency: row.currency,
      expenseDate: row.expense_date ? row.expense_date.toISOString().split('T')[0] : null,
      submittedBy: row.submitted_by,
      submittedByName: row.submitted_by_name || (row.submitter_first_name && row.submitter_last_name
        ? `${row.submitter_first_name} ${row.submitter_last_name}` : null),
      status: row.status,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by_name || (row.approver_first_name && row.approver_last_name
        ? `${row.approver_first_name} ${row.approver_last_name}` : null),
      approvalDate: row.approval_date ? row.approval_date.toISOString().split('T')[0] : null,
      approvalComments: row.approval_comments,
      receiptPath: row.receipt_path,
      receiptData: row.receipt_data,
      receiptName: row.receipt_name,
      receiptType: row.receipt_type,
      receiptSize: row.receipt_size,
      vendor: row.vendor,
      invoiceNumber: row.invoice_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default Expense;

