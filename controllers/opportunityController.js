import Opportunity from '../models/Opportunity.js';
import Staff from '../models/Staff.js';
import pool from '../config/db.js';

export class OpportunityController {
  // Create a new opportunity
  static async createOpportunity(req, res) {
    try {
      const {
        opportunityId,
        department,
        country,
        name,
        legalEntity,
        client,
        contact,
        description,
        feedbackDeadline,
        operationDate,
        winProbability = 0,
        winProbabilityDocument,
        bidCurrency,
        fundAgency,
        urgency = 'medium',
        supportingDocument,
        comment,
        year,
        status = 'open',
        decision = 'pending',
        value = 0,
        expectedCloseDate,
        assignedTo
      } = req.body;

      // Validation
      if (!department || !country || !name || !legalEntity || !client || !contact || !description || !bidCurrency || !year) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: department, country, name, legalEntity, client, contact, description, bidCurrency, and year are required'
        });
      }

      // Validate win probability
      if (winProbability < 0 || winProbability > 100) {
        return res.status(400).json({
          success: false,
          message: 'Win probability must be between 0 and 100'
        });
      }

      // Validate value
      if (value < 0) {
        return res.status(400).json({
          success: false,
          message: 'Value must be greater than or equal to 0'
        });
      }

      // Validate urgency
      if (!['low', 'medium', 'high', 'critical'].includes(urgency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid urgency value. Must be: low, medium, high, or critical'
        });
      }

      // Validate status
      if (!['open', 'qualified', 'proposal', 'won', 'lost'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be: open, qualified, proposal, won, or lost'
        });
      }

      // Validate decision
      if (!['pending', 'approved', 'rejected', 'under_review', 'cancelled'].includes(decision)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid decision value. Must be: pending, approved, rejected, under_review, or cancelled'
        });
      }

      // Validate file sizes if base64 data is provided (max 200MB per file)
      // Base64 encoding increases size by ~33%, so we check the base64 string length
      const maxFileSize = 200 * 1024 * 1024; // 200MB original file size
      
      if (winProbabilityDocument) {
        // Check if it's a base64 string (with or without data URL prefix)
        const base64Data = winProbabilityDocument.startsWith('data:') 
          ? winProbabilityDocument.split(',')[1] || ''
          : winProbabilityDocument;
        
        // Base64 string length is approximately 4/3 of original file size
        // So we check if base64 length * 3/4 exceeds maxFileSize
        const estimatedFileSize = (base64Data.length * 3) / 4;
        if (estimatedFileSize > maxFileSize) {
          return res.status(400).json({
            success: false,
            message: `Win probability document exceeds 200MB limit. Estimated size: ${(estimatedFileSize / 1024 / 1024).toFixed(2)}MB. Please upload a smaller file.`
          });
        }
        
        // Also check the actual base64 string size (should not exceed ~267MB for 200MB file)
        // MySQL max_allowed_packet is 300MB, so we need to ensure base64 doesn't exceed that
        const maxBase64Size = 300 * 1024 * 1024; // 300MB max for base64 string
        if (base64Data.length > maxBase64Size) {
          return res.status(400).json({
            success: false,
            message: `Win probability document is too large. Base64 encoded size exceeds 300MB limit. Please upload a smaller file.`
          });
        }
      }
      
      if (supportingDocument) {
        // Check if it's a base64 string (with or without data URL prefix)
        const base64Data = supportingDocument.startsWith('data:') 
          ? supportingDocument.split(',')[1] || ''
          : supportingDocument;
        
        // Base64 string length is approximately 4/3 of original file size
        const estimatedFileSize = (base64Data.length * 3) / 4;
        if (estimatedFileSize > maxFileSize) {
          return res.status(400).json({
            success: false,
            message: `Supporting document exceeds 200MB limit. Estimated size: ${(estimatedFileSize / 1024 / 1024).toFixed(2)}MB. Please upload a smaller file.`
          });
        }
        
        // Also check the actual base64 string size (should not exceed ~267MB for 200MB file)
        const maxBase64Size = 300 * 1024 * 1024; // 300MB max for base64 string
        if (base64Data.length > maxBase64Size) {
          return res.status(400).json({
            success: false,
            message: `Supporting document is too large. Base64 encoded size exceeds 300MB limit. Please upload a smaller file.`
          });
        }
      }

      // Clean and validate data
      const cleanData = {
        opportunityId,
        department: (department && String(department).trim()) || '',
        country: (country && String(country).trim()) || '',
        name: (name && String(name).trim()) || '',
        legalEntity: (legalEntity && String(legalEntity).trim()) || '',
        client: (client && String(client).trim()) || '',
        contact: (contact && String(contact).trim()) || '',
        description: (description && String(description).trim()) || '',
        feedbackDeadline: (feedbackDeadline && String(feedbackDeadline).trim()) || null,
        operationDate: (operationDate && String(operationDate).trim()) || null,
        winProbability: parseInt(winProbability) || 0,
        winProbabilityDocument: (winProbabilityDocument && String(winProbabilityDocument).trim()) || null,
        bidCurrency: (bidCurrency && String(bidCurrency).trim()) || '',
        fundAgency: (fundAgency && String(fundAgency).trim()) || null,
        urgency: (urgency && String(urgency).trim()) || 'medium',
        supportingDocument: (supportingDocument && String(supportingDocument).trim()) || null,
        comment: (comment && String(comment).trim()) || null,
        year: (year && String(year).trim()) || String(new Date().getFullYear()),
        status: (status && String(status).trim()) || 'open',
        decision: (decision && String(decision).trim()) || 'pending',
        value: parseFloat(value) || 0,
        expectedCloseDate: (expectedCloseDate && String(expectedCloseDate).trim()) || null,
        assignedTo: (assignedTo && String(assignedTo).trim()) || null
      };

      // Re-validate after cleaning (check for empty strings)
      if (!cleanData.department || !cleanData.country || !cleanData.name || !cleanData.legalEntity || 
          !cleanData.client || !cleanData.contact || !cleanData.description || !cleanData.bidCurrency || !cleanData.year) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: department, country, name, legalEntity, client, contact, description, bidCurrency, and year are required'
        });
      }

      const opportunity = await Opportunity.create(cleanData);

      res.status(201).json({
        success: true,
        message: 'Opportunity created successfully',
        data: opportunity
      });
    } catch (error) {
      console.error('Create opportunity error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sql: error.sql,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: 'Failed to create opportunity',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          errno: error.errno,
          sqlState: error.sqlState
        } : undefined
      });
    }
  }

  // Get all opportunities
  static async getOpportunities(req, res) {
    try {
      const {
        search,
        status,
        department,
        year,
        urgency,
        decision,
        page = 1,
        limit = 10,
        includeAll = false
      } = req.query;

      // Get the logged-in user's email from staff ID
      // Only filter by user if includeAll is not true (for discussion page, we want all opportunities)
      // SuperAdmin users always get all opportunities regardless of includeAll flag
      let userEmail = null;
      let isSuperAdmin = false;
      
      // Check includeAll - it comes as a string from query params, so we need to check both string and boolean
      const shouldIncludeAll = includeAll === 'true' || includeAll === true || includeAll === '1';
      
      if (req.staffId) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            // Check if user is SuperAdmin or Finance - always give full access
            const userRole = staff.role?.toLowerCase() || '';
            if (userRole === 'superadmin' || userRole === 'finance') {
              isSuperAdmin = true;
              userEmail = null; // SuperAdmin and Finance get all opportunities
              console.log(`📋 getOpportunities - ${staff.role} user detected, granting full access`);
            } else if (!shouldIncludeAll && staff.email) {
              // Regular users: filter by their email unless includeAll is true
              userEmail = staff.email;
            }
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
          // Continue without filtering if staff lookup fails
        }
      }
      
      console.log('📋 getOpportunities - includeAll:', includeAll, 'shouldIncludeAll:', shouldIncludeAll, 'isSuperAdmin:', isSuperAdmin, 'userEmail:', userEmail);

      // Get department filter from query or user's department
      let departmentFilter = department;
      if (!departmentFilter && req.staffId && !isSuperAdmin) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff && staff.departmentId) {
            // Get department name from department ID
            const [deptRows] = await pool.execute('SELECT name FROM departments WHERE id = ?', [staff.departmentId]);
            if (deptRows.length > 0) {
              departmentFilter = deptRows[0].name;
            }
          }
        } catch (deptError) {
          console.error('Error fetching department:', deptError);
        }
      }

      const filters = {
        search,
        status,
        department: departmentFilter,
        year,
        urgency,
        decision,
        userEmail, // Filter by assigned user (null for SuperAdmin or when includeAll is true)
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const opportunities = await Opportunity.findAll(filters);
      // For stats, also use null for SuperAdmin to get all stats
      const stats = await Opportunity.getStats(isSuperAdmin ? null : userEmail);

      res.json({
        success: true,
        data: opportunities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          totalValue: parseFloat(stats.totalValue || 0),
          weightedValue: parseFloat(stats.weightedValue || 0),
          open: stats.open,
          qualified: stats.qualified,
          proposal: stats.proposal,
          won: stats.won,
          lost: stats.lost
        }
      });
    } catch (error) {
      console.error('Get opportunities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch opportunities',
        error: error.message
      });
    }
  }

  // Get opportunity by ID
  static async getOpportunityById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Opportunity ID is required'
        });
      }

      // Try to find by database ID first, then by opportunity_id
      let opportunity = await Opportunity.findById(parseInt(id));
      if (!opportunity) {
        opportunity = await Opportunity.findByOpportunityId(id);
      }
      
      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found'
        });
      }

      // Check if the logged-in user is assigned to this opportunity
      // SuperAdmin users always have access to all opportunities
      if (req.staffId) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            // SuperAdmin always has access
            if (staff.role === 'SuperAdmin' || staff.role === 'superadmin' || staff.role === 'SUPERADMIN') {
              console.log('📋 getOpportunityById - SuperAdmin user detected, granting full access');
              // Skip assignment check for SuperAdmin
            } else if (staff.email && opportunity.assignedTo) {
              // Check if user's email is in the assigned_to comma-separated list
              const assignedEmails = opportunity.assignedTo.split(',').map(email => email.trim());
              if (!assignedEmails.includes(staff.email)) {
                return res.status(403).json({
                  success: false,
                  message: 'You do not have access to this opportunity. It is not assigned to you.'
                });
              }
            }
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
          // Continue if staff lookup fails (shouldn't block access)
        }
      }

      res.json({
        success: true,
        message: 'Opportunity retrieved successfully',
        data: opportunity
      });
    } catch (error) {
      console.error('Get opportunity by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch opportunity',
        error: error.message
      });
    }
  }

  // Update opportunity
  static async updateOpportunity(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Opportunity ID is required'
        });
      }

      // Try to find by database ID first, then by opportunity_id
      let opportunity = await Opportunity.findById(parseInt(id));
      if (!opportunity) {
        opportunity = await Opportunity.findByOpportunityId(id);
      }

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found'
        });
      }

      // Validate win probability if provided
      if (updateData.winProbability !== undefined && (updateData.winProbability < 0 || updateData.winProbability > 100)) {
        return res.status(400).json({
          success: false,
          message: 'Win probability must be between 0 and 100'
        });
      }

      // Validate value if provided
      if (updateData.value !== undefined && updateData.value < 0) {
        return res.status(400).json({
          success: false,
          message: 'Value must be greater than or equal to 0'
        });
      }

      // Validate urgency if provided
      if (updateData.urgency !== undefined && !['low', 'medium', 'high', 'critical'].includes(updateData.urgency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid urgency value. Must be: low, medium, high, or critical'
        });
      }

      // Validate status if provided
      if (updateData.status !== undefined && !['open', 'qualified', 'proposal', 'won', 'lost'].includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be: open, qualified, proposal, won, or lost'
        });
      }

      // Validate decision if provided
      if (updateData.decision !== undefined && !['pending', 'approved', 'rejected', 'under_review', 'cancelled'].includes(updateData.decision)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid decision value. Must be: pending, approved, rejected, under_review, or cancelled'
        });
      }

      // Validate file sizes if base64 data is provided (max 200MB per file)
      // Base64 encoding increases size by ~33%, so we check the base64 string length
      const maxFileSize = 200 * 1024 * 1024; // 200MB original file size
      const maxBase64Size = 300 * 1024 * 1024; // 300MB max for base64 string (MySQL max_allowed_packet)
      
      if (updateData.winProbabilityDocument) {
        // Check if it's a base64 string (with or without data URL prefix)
        const base64Data = typeof updateData.winProbabilityDocument === 'string' && updateData.winProbabilityDocument.startsWith('data:') 
          ? updateData.winProbabilityDocument.split(',')[1] || ''
          : (typeof updateData.winProbabilityDocument === 'string' ? updateData.winProbabilityDocument : '');
        
        if (base64Data) {
          // Base64 string length is approximately 4/3 of original file size
          // So we check if base64 length * 3/4 exceeds maxFileSize
          const estimatedFileSize = (base64Data.length * 3) / 4;
          if (estimatedFileSize > maxFileSize) {
            return res.status(400).json({
              success: false,
              message: `Win probability document exceeds 200MB limit. Estimated size: ${(estimatedFileSize / 1024 / 1024).toFixed(2)}MB. Please upload a smaller file.`
            });
          }
          
          // Also check the actual base64 string size (should not exceed 300MB)
          if (base64Data.length > maxBase64Size) {
            return res.status(400).json({
              success: false,
              message: `Win probability document is too large. Base64 encoded size (${(base64Data.length / 1024 / 1024).toFixed(2)}MB) exceeds 300MB MySQL packet limit. Please upload a smaller file.`
            });
          }
        }
      }
      
      if (updateData.supportingDocument) {
        // Check if it's a base64 string (with or without data URL prefix)
        const base64Data = typeof updateData.supportingDocument === 'string' && updateData.supportingDocument.startsWith('data:') 
          ? updateData.supportingDocument.split(',')[1] || ''
          : (typeof updateData.supportingDocument === 'string' ? updateData.supportingDocument : '');
        
        if (base64Data) {
          // Base64 string length is approximately 4/3 of original file size
          const estimatedFileSize = (base64Data.length * 3) / 4;
          if (estimatedFileSize > maxFileSize) {
            return res.status(400).json({
              success: false,
              message: `Supporting document exceeds 200MB limit. Estimated size: ${(estimatedFileSize / 1024 / 1024).toFixed(2)}MB. Please upload a smaller file.`
            });
          }
          
          // Also check the actual base64 string size (should not exceed 300MB)
          if (base64Data.length > maxBase64Size) {
            return res.status(400).json({
              success: false,
              message: `Supporting document is too large. Base64 encoded size (${(base64Data.length / 1024 / 1024).toFixed(2)}MB) exceeds 300MB MySQL packet limit. Please upload a smaller file.`
            });
          }
        }
      }

      // Remove undefined values from updateData (but keep null as it's a valid value for clearing fields)
      const cleanedUpdateData = {};
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          cleanedUpdateData[key] = updateData[key];
        }
      });

      // Check if there are any fields to update
      if (Object.keys(cleanedUpdateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided to update'
        });
      }

      const dbId = opportunity.dbId || parseInt(id);
      const success = await Opportunity.update(dbId, cleanedUpdateData);

      if (success) {
        const updatedOpportunity = await Opportunity.findById(dbId);
        if (!updatedOpportunity) {
          return res.status(404).json({
            success: false,
            message: 'Opportunity not found after update'
          });
        }
        res.json({
          success: true,
          message: 'Opportunity updated successfully',
          data: updatedOpportunity
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update opportunity. No changes were made.'
        });
      }
    } catch (error) {
      console.error('Update opportunity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update opportunity',
        error: error.message
      });
    }
  }

  // Delete opportunity
  static async deleteOpportunity(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Opportunity ID is required'
        });
      }

      // Try to find by database ID first, then by opportunity_id
      let opportunity = await Opportunity.findById(parseInt(id));
      if (!opportunity) {
        opportunity = await Opportunity.findByOpportunityId(id);
      }
      
      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found'
        });
      }

      const dbId = opportunity.dbId || parseInt(id);
      const success = await Opportunity.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Opportunity deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete opportunity'
        });
      }
    } catch (error) {
      console.error('Delete opportunity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete opportunity',
        error: error.message
      });
    }
  }

  // Get opportunity statistics
  static async getOpportunityStats(req, res) {
    try {
      // Get the logged-in user's email from staff ID
      // SuperAdmin users always get all stats
      let userEmail = null;
      if (req.staffId) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            // Check if user is SuperAdmin - always give full access
            if (staff.role === 'SuperAdmin' || staff.role === 'superadmin' || staff.role === 'SUPERADMIN') {
              userEmail = null; // SuperAdmin gets all stats
              console.log('📋 getOpportunityStats - SuperAdmin user detected, granting full access');
            } else if (staff.email) {
              userEmail = staff.email;
            }
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
          // Continue without filtering if staff lookup fails
        }
      }

      const stats = await Opportunity.getStats(userEmail);
      
      res.json({
        success: true,
        data: {
          total: stats.total,
          totalValue: parseFloat(stats.totalValue || 0),
          weightedValue: parseFloat(stats.weightedValue || 0),
          open: stats.open,
          qualified: stats.qualified,
          proposal: stats.proposal,
          won: stats.won,
          lost: stats.lost
        }
      });
    } catch (error) {
      console.error('Get opportunity stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch opportunity statistics',
        error: error.message
      });
    }
  }
}

