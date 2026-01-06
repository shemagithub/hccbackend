import Staff from '../models/Staff.js';

export class StaffController {
  // Create a new staff member
  static async createStaff(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        password,
        departmentId,
        position,
        role,
        controlPanel,
        status = 'pending',
        profileImage,
        notes
      } = req.body;


      // Validation
      if (!firstName || !lastName || !email || !password || !position || !role) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: firstName, lastName, email, password, position, and role are required'
        });
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Check if email already exists
      const existingStaff = await Staff.emailExists(email);
      if (existingStaff) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }

      // Validate department ID if provided
      if (departmentId && isNaN(departmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department ID'
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        });
      }

      const staffId = await Staff.create({
        firstName,
        lastName,
        email,
        phone,
        password,
        departmentId: departmentId ? parseInt(departmentId) : null,
        position,
        role,
        controlPanel,
        status,
        profileImage,
        notes
      });

      const newStaff = await Staff.findById(staffId.id);

      res.status(201).json({
        success: true,
        message: 'Staff member created successfully',
        data: newStaff
      });
    } catch (error) {
      console.error('Create staff error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create staff member',
        error: error.message
      });
    }
  }

  // Get all staff members
  static async getStaff(req, res) {
    try {
      const {
        search,
        role,
        status,
        departmentId,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        search,
        role,
        status,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const staff = await Staff.findAll(filters);
      const stats = await Staff.getStats();

      res.json({
        success: true,
        data: staff,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          active: stats.active,
          pending: stats.pending,
          inactive: stats.inactive
        }
      });
    } catch (error) {
      console.error('Get staff error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staff members',
        error: error.message
      });
    }
  }

  // Get staff member by ID
  static async getStaffById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid staff ID'
        });
      }

      const staff = await Staff.findById(parseInt(id));
      
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }

      res.json({
        success: true,
        data: staff
      });
    } catch (error) {
      console.error('Get staff by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staff member',
        error: error.message
      });
    }
  }

  // Update staff member
  static async updateStaff(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid staff ID'
        });
      }

      const staff = await Staff.findById(parseInt(id));
      
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }

      // Check if email already exists (excluding current staff)
      if (updateData.email && updateData.email !== staff.email) {
        const emailExists = await Staff.emailExists(updateData.email, parseInt(id));
        if (emailExists) {
          return res.status(409).json({
            success: false,
            message: 'Email already exists'
          });
        }
      }

      // Validate email format if provided
      if (updateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate department ID if provided
      if (updateData.departmentId && isNaN(updateData.departmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department ID'
        });
      }

      // Validate password if provided
      if (updateData.password) {
        if (updateData.password.length < 8) {
          return res.status(400).json({
            success: false,
            message: 'Password must be at least 8 characters long'
          });
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(updateData.password)) {
          return res.status(400).json({
            success: false,
            message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
          });
        }
      }

      const success = await Staff.update(parseInt(id), {
        ...updateData,
        departmentId: updateData.departmentId ? parseInt(updateData.departmentId) : undefined
      });

      if (success) {
        const updatedStaff = await Staff.findById(parseInt(id));
        res.json({
          success: true,
          message: 'Staff member updated successfully',
          data: updatedStaff
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update staff member'
        });
      }
    } catch (error) {
      console.error('Update staff error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update staff member',
        error: error.message
      });
    }
  }

  // Delete staff member
  static async deleteStaff(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid staff ID'
        });
      }

      const staff = await Staff.findById(parseInt(id));
      
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }

      const success = await Staff.delete(parseInt(id));

      if (success) {
        res.json({
          success: true,
          message: 'Staff member deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete staff member'
        });
      }
    } catch (error) {
      console.error('Delete staff error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete staff member',
        error: error.message
      });
    }
  }

  // Get staff statistics
  static async getStaffStats(req, res) {
    try {
      const stats = await Staff.getStats();
      const statsByRole = await Staff.getStatsByRole();
      const statsByDepartment = await Staff.getStatsByDepartment();
      
      res.json({
        success: true,
        data: {
          ...stats,
          byRole: statsByRole,
          byDepartment: statsByDepartment
        }
      });
    } catch (error) {
      console.error('Get staff stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch staff statistics',
        error: error.message
      });
    }
  }

  // Check if email exists
  static async checkEmail(req, res) {
    try {
      const { email } = req.params;
      const { excludeId } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const exists = await Staff.emailExists(email, excludeId);
      
      res.json({
        success: true,
        exists: exists,
        message: exists ? 'Email already exists' : 'Email is available'
      });
    } catch (error) {
      console.error('Check email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check email',
        error: error.message
      });
    }
  }

  // Authenticate staff member
  static async authenticate(req, res) {
    try {
      const { email, password } = req.body;

      // Log authentication attempt (without password)
      console.log(`[AUTH] Authentication attempt for email: ${email}`);

      if (!email || !password) {
        console.log(`[AUTH] Missing credentials - email: ${!!email}, password: ${!!password}`);
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const staff = await Staff.findByEmail(email);
      
      if (!staff) {
        console.log(`[AUTH] User not found: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      console.log(`[AUTH] User found: ${staff.email}, Role: ${staff.role}, Status: ${staff.status}`);

      // Check if password hash exists
      if (!staff.passwordHash) {
        console.log(`[AUTH] No password hash found for user: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const isValidPassword = await Staff.verifyPassword(password, staff.passwordHash);
      
      if (!isValidPassword) {
        console.log(`[AUTH] Password verification failed for user: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      console.log(`[AUTH] Password verified successfully for user: ${email}`);

      if (staff.status !== 'active') {
        console.log(`[AUTH] Account not active for user: ${email}, status: ${staff.status}`);
        return res.status(403).json({
          success: false,
          message: `Account is not active. Current status: ${staff.status}. Please contact administrator.`
        });
      }

      // Update last login
      await Staff.updateLastLogin(staff.id);

      // Remove password hash from response
      const { passwordHash, ...staffWithoutPassword } = staff;

      console.log(`[AUTH] Authentication successful for user: ${email}, role: ${staff.role}`);

      res.json({
        success: true,
        message: 'Authentication successful',
        data: staffWithoutPassword
      });
    } catch (error) {
      console.error('[AUTH] Authentication error:', error);
      console.error('[AUTH] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Authentication failed',
        error: error.message
      });
    }
  }

  // Reset staff password
  static async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid staff ID'
        });
      }

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      // Check if staff exists
      const staff = await Staff.findById(parseInt(id));
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }

      // Reset password
      await Staff.resetPassword(parseInt(id), newPassword);

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        error: error.message
      });
    }
  }
}
