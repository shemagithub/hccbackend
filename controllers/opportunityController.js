import Opportunity from '../models/Opportunity.js';
import OpportunityProposal from '../models/OpportunityProposal.js';
import Implementation from '../models/Implementation.js';
import Contract from '../models/Contract.js';
import Staff from '../models/Staff.js';
import EOI from '../models/EOI.js';
import pool from '../config/db.js';
import {
  DEFAULT_OPPORTUNITY_DECISION,
  DEFAULT_OPPORTUNITY_URGENCY,
  isValidOpportunityDecision,
  isValidOpportunityUrgency,
  normalizeBase64Document,
  validateBase64DocumentSize,
} from '../constants/opportunityOptions.js';
import { syncGoEOIsToProposals } from '../utils/opportunityPipeline.js';
import { isSuperAdminRole } from '../utils/rolePermissions.js';

function addDaysFromDate(baseDate, days) {
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function buildEOIPayloadFromOpportunity(opportunity) {
  const today = new Date().toISOString().split('T')[0];
  const requirements = [];

  if (opportunity.comment) {
    requirements.push(opportunity.comment);
  }
  if (opportunity.fundAgency) {
    requirements.push(`Fund agency: ${opportunity.fundAgency}`);
  }
  if (opportunity.legalEntity) {
    requirements.push(`Legal entity: ${opportunity.legalEntity}`);
  }

  return {
    title: opportunity.name,
    organization: opportunity.client,
    submissionDate: opportunity.operationDate || today,
    deadline:
      opportunity.feedbackDeadline ||
      opportunity.expectedCloseDate ||
      addDaysFromDate(today, 30),
    status: 'draft',
    value: opportunity.value || 0,
    assignedTo: opportunity.assignedTo || null,
    description:
      opportunity.description ||
      `Expression of interest for ${opportunity.name} (${opportunity.client}).`,
    requirements,
  };
}

function buildOpportunitySummary(opportunity) {
  return {
    opportunityId: opportunity.id,
    dbId: opportunity.dbId,
    name: opportunity.name,
    client: opportunity.client,
    department: opportunity.department,
    country: opportunity.country,
    legalEntity: opportunity.legalEntity,
    contact: opportunity.contact,
    value: opportunity.value,
    bidCurrency: opportunity.bidCurrency,
    fundAgency: opportunity.fundAgency,
    description: opportunity.description,
    comment: opportunity.comment,
    feedbackDeadline: opportunity.feedbackDeadline,
    expectedCloseDate: opportunity.expectedCloseDate,
    operationDate: opportunity.operationDate,
    winProbability: opportunity.winProbability,
    urgency: opportunity.urgency,
    decision: opportunity.decision,
    assignedTo: opportunity.assignedTo,
    year: opportunity.year,
  };
}

function buildProposalSeedFromOpportunity(opportunity) {
  const summary = buildOpportunitySummary(opportunity);

  return {
    technicalProposal: JSON.stringify(
      {
        opportunity: summary,
        technicalApproach: opportunity.description || '',
        scopeNotes: opportunity.comment || '',
      },
      null,
      2
    ),
    financialProposal: JSON.stringify(
      {
        opportunity: summary,
        estimatedValue: opportunity.value || 0,
        currency: opportunity.bidCurrency || 'USD',
        fundAgency: opportunity.fundAgency || null,
      },
      null,
      2
    ),
    technicalStatus: 'draft',
    financialStatus: 'draft',
    decision: 'pending',
  };
}

function validateProposalWonDecision(data, statuses = {}) {
  if (data.decision !== 'won') return null;

  const technicalStatus = statuses.technicalStatus ?? 'draft';
  const financialStatus = statuses.financialStatus ?? 'draft';

  if (technicalStatus !== 'approved' || financialStatus !== 'approved') {
    return 'Technical and financial proposals must be approved before decision can be Won';
  }

  if (!data.implementationStartDate || !data.implementationDueDate) {
    return 'Start date and due date are required when decision is Won';
  }

  if (new Date(data.implementationStartDate) > new Date(data.implementationDueDate)) {
    return 'Due date must be on or after the start date';
  }

  return null;
}

const VALID_PROPOSAL_DECISIONS = ['pending', 'under_review', 'won', 'rejected', 'cancelled'];

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
        urgency = DEFAULT_OPPORTUNITY_URGENCY,
        supportingDocument,
        comment,
        year,
        status = 'open',
        decision = DEFAULT_OPPORTUNITY_DECISION,
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

      if (!isValidOpportunityUrgency(urgency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid urgency value. Must be: not_urgent, urgent, very_urgent, or past_due'
        });
      }

      // Validate status (kept for pipeline stats; defaults to open)
      if (!['open', 'qualified', 'proposal', 'won', 'lost'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be: open, qualified, proposal, won, or lost'
        });
      }

      if (!isValidOpportunityDecision(decision)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid decision value. Must be: submitted, under_preparation, internal_review, overdue, or failed'
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
        urgency: (urgency && String(urgency).trim()) || DEFAULT_OPPORTUNITY_URGENCY,
        supportingDocument: (supportingDocument && String(supportingDocument).trim()) || null,
        comment: (comment && String(comment).trim()) || null,
        year: (year && String(year).trim()) || String(new Date().getFullYear()),
        status: (status && String(status).trim()) || 'open',
        decision: (decision && String(decision).trim()) || DEFAULT_OPPORTUNITY_DECISION,
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

  static async resolveOpportunityListAccess(req, query = {}) {
    const { department, includeAll = false } = query;
    const shouldIncludeAll =
      includeAll === 'true' || includeAll === true || includeAll === '1';

    let userEmail = null;
    let isSuperAdmin = false;
    let departmentFilter = department;

    if (req.staffId) {
      try {
        const staff = await Staff.findById(req.staffId);
        if (staff) {
          const userRole = staff.role?.toLowerCase() || '';
          if (userRole === 'superadmin' || userRole === 'finance') {
            isSuperAdmin = true;
            userEmail = null;
          } else if (!shouldIncludeAll && staff.email) {
            userEmail = staff.email;
          }

          if (!departmentFilter && !isSuperAdmin && staff.departmentId) {
            const [deptRows] = await pool.execute('SELECT name FROM departments WHERE id = ?', [
              staff.departmentId,
            ]);
            if (deptRows.length > 0) {
              departmentFilter = deptRows[0].name;
            }
          }
        }
      } catch (staffError) {
        console.error('Error fetching staff info:', staffError);
      }
    }

    return { userEmail, isSuperAdmin, departmentFilter, shouldIncludeAll };
  }

  // List opportunities with saved proposal records (proposal stage pipeline)
  static async getOpportunityProposals(req, res) {
    try {
      const { search, page = 1, limit = 50, includeAll = false } = req.query;
      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
      const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

      const { userEmail, isSuperAdmin, departmentFilter } =
        await OpportunityController.resolveOpportunityListAccess(req, {
          includeAll,
        });

      await OpportunityProposal.ensureTable();
      await EOI.ensureGoDecisionField();
      await EOI.ensureOpportunityLink();

      const filters = {
        search,
        department: departmentFilter,
        userEmail,
        limit: parsedLimit,
        offset: (parsedPage - 1) * parsedLimit,
      };

      const items = await OpportunityProposal.findAllWithOpportunities(filters);
      const stats = await Opportunity.getStats(isSuperAdmin ? null : userEmail);

      res.json({
        success: true,
        data: items,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: stats.total,
        },
        stats: {
          total: stats.total,
          totalValue: parseFloat(stats.totalValue || 0),
          weightedValue: parseFloat(stats.weightedValue || 0),
          open: stats.open,
          qualified: stats.qualified,
          proposal: stats.proposal,
          won: stats.won,
          lost: stats.lost,
        },
      });
    } catch (error) {
      console.error('Get opportunity proposals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch proposals',
        error: error.message,
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
        includeAll = false,
        forDiscussion = false,
        pipelineStage
      } = req.query;

      const shouldIncludeAll = includeAll === 'true' || includeAll === true || includeAll === '1';
      const isDiscussionView = forDiscussion === 'true' || forDiscussion === true || forDiscussion === '1';

      const parsedLimit = isDiscussionView
        ? Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500)
        : Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
      const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

      // Get the logged-in user's email from staff ID
      // Only filter by user if includeAll is not true (for discussion page, we want all opportunities)
      // SuperAdmin users always get all opportunities regardless of includeAll flag
      let userEmail = null;
      let isSuperAdmin = false;
      let departmentFilter = department;
      
      // Check includeAll - it comes as a string from query params, so we need to check both string and boolean
      
      if (req.staffId) {
        try {
          const staff = await Staff.findById(req.staffId);
          if (staff) {
            const userRole = staff.role?.toLowerCase() || '';
            isSuperAdmin = isSuperAdminRole(staff.role);

            if (isSuperAdmin || userRole === 'finance') {
              userEmail = null; // SuperAdmin and Finance get all opportunities
              console.log(`📋 getOpportunities - ${staff.role} user detected, granting full access`);
            } else if (isDiscussionView) {
              // Discussion: show assigned opportunities across all portals/departments
              userEmail = staff.email || null;
            } else if (!shouldIncludeAll && staff.email) {
              // Regular users: filter by their email unless includeAll is true
              userEmail = staff.email;
            }

            if (
              !departmentFilter &&
              !isSuperAdmin &&
              !shouldIncludeAll &&
              !isDiscussionView &&
              staff.departmentId
            ) {
              const [deptRows] = await pool.execute('SELECT name FROM departments WHERE id = ?', [staff.departmentId]);
              if (deptRows.length > 0) {
                departmentFilter = deptRows[0].name;
              }
            }
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
          // Continue without filtering if staff lookup fails
        }
      }
      
      console.log('📋 getOpportunities - includeAll:', includeAll, 'forDiscussion:', forDiscussion, 'shouldIncludeAll:', shouldIncludeAll, 'isSuperAdmin:', isSuperAdmin, 'userEmail:', userEmail);

      const filters = {
        search,
        status,
        department: departmentFilter,
        year,
        urgency,
        decision,
        pipelineStage,
        userEmail,
        limit: parsedLimit,
        offset: (parsedPage - 1) * parsedLimit
      };

      if (pipelineStage === 'proposals') {
        await OpportunityProposal.ensureTable();
        await EOI.ensureGoDecisionField();
      }

      await EOI.ensureOpportunityLink();
      await OpportunityProposal.ensureTable();

      const opportunities =
        pipelineStage === 'proposals'
          ? await OpportunityProposal.findAllWithOpportunities(filters)
          : await Opportunity.findAll(filters);
      // For stats, also use null for SuperAdmin to get all stats
      const stats = await Opportunity.getStats(isSuperAdmin ? null : userEmail);

      res.json({
        success: true,
        data: opportunities,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
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
      if (updateData.urgency !== undefined && !isValidOpportunityUrgency(updateData.urgency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid urgency value. Must be: not_urgent, urgent, very_urgent, or past_due'
        });
      }

      // Validate status if provided
      if (updateData.status !== undefined && !['open', 'qualified', 'proposal', 'won', 'lost'].includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value. Must be: open, qualified, proposal, won, or lost'
        });
      }

      if (updateData.decision !== undefined && !isValidOpportunityDecision(updateData.decision)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid decision value. Must be: submitted, under_preparation, internal_review, overdue, or failed'
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
        const excludeDocuments = !(
          cleanedUpdateData.winProbabilityDocument !== undefined ||
          cleanedUpdateData.supportingDocument !== undefined
        );
        const updatedOpportunity = await Opportunity.findById(dbId, { excludeDocuments });
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

  static async ensureOpportunityEOI(req, res) {
    try {
      await EOI.ensureOpportunityLink();
      const { id } = req.params;
      const opportunity = await OpportunityProposal.resolveOpportunity(id);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found',
        });
      }

      let eoi = await EOI.findByOpportunityDbId(opportunity.dbId);
      let created = false;

      if (!eoi) {
        const payload = buildEOIPayloadFromOpportunity(opportunity);
        eoi = await EOI.create({
          ...payload,
          opportunityId: opportunity.dbId,
        });
        created = true;
      }

      if (opportunity.status !== 'qualified' && opportunity.status !== 'proposal') {
        await Opportunity.update(opportunity.dbId, { status: 'qualified' });
        opportunity.status = 'qualified';
      }

      res.status(created ? 201 : 200).json({
        success: true,
        message: created
          ? 'Expression of interest created from opportunity'
          : 'Expression of interest already exists for this opportunity',
        data: {
          eoi,
          opportunity,
          created,
        },
      });
    } catch (error) {
      console.error('Ensure opportunity EOI error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create expression of interest from opportunity',
        error: error.message,
      });
    }
  }

  static async ensureOpportunityProposal(req, res) {
    try {
      await OpportunityProposal.ensureTable();
      const { id } = req.params;
      const opportunity = await OpportunityProposal.resolveOpportunity(id);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found',
        });
      }

      let proposal = await OpportunityProposal.findByOpportunityDbId(opportunity.dbId);
      let created = false;

      if (!proposal) {
        const seed = buildProposalSeedFromOpportunity(opportunity);
        proposal = await OpportunityProposal.upsert(opportunity.dbId, seed);
        created = true;
      }

      if (opportunity.status !== 'proposal') {
        await Opportunity.update(opportunity.dbId, { status: 'proposal' });
        opportunity.status = 'proposal';
      }

      res.status(created ? 201 : 200).json({
        success: true,
        message: created
          ? 'Proposal created from opportunity'
          : 'Proposal already exists for this opportunity',
        data: {
          proposal,
          opportunity,
          created,
        },
      });
    } catch (error) {
      console.error('Ensure opportunity proposal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create proposal from opportunity',
        error: error.message,
      });
    }
  }

  static async getOpportunityProposal(req, res) {
    try {
      await OpportunityProposal.ensureAttachmentFields();
      const { id } = req.params;
      const opportunity = await OpportunityProposal.resolveOpportunity(id);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found',
        });
      }

      const proposal =
        (await OpportunityProposal.findByOpportunityDbId(opportunity.dbId)) || {
          opportunityId: opportunity.dbId,
          technicalProposal: '',
          financialProposal: '',
          technicalStatus: 'draft',
          financialStatus: 'draft',
          decision: 'pending',
          implementationStartDate: null,
          implementationDueDate: null,
          implementationId: null,
        };

      const contract = await Contract.findByOpportunityId(opportunity.dbId, {
        excludeDocuments: true,
      });

      res.json({
        success: true,
        data: {
          ...proposal,
          opportunity,
          contract,
        },
      });
    } catch (error) {
      console.error('Get opportunity proposal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch opportunity proposal',
        error: error.message,
      });
    }
  }

  static async upsertOpportunityProposal(req, res) {
    try {
      await OpportunityProposal.ensureAttachmentFields();
      const { id } = req.params;
      const {
        technicalProposal,
        financialProposal,
        technicalStatus,
        financialStatus,
        decision,
        implementationStartDate,
        implementationDueDate,
        technicalAttachment,
        technicalAttachmentName,
        financialAttachment,
        financialAttachmentName,
      } = req.body;

      const opportunity = await OpportunityProposal.resolveOpportunity(id);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found',
        });
      }

      const validStatuses = ['draft', 'submitted', 'approved'];
      if (technicalStatus && !validStatuses.includes(technicalStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid technical status',
        });
      }
      if (financialStatus && !validStatuses.includes(financialStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid financial status',
        });
      }

      if (decision && !VALID_PROPOSAL_DECISIONS.includes(decision)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid decision value',
        });
      }

      const existingProposal = await OpportunityProposal.findByOpportunityDbId(opportunity.dbId);
      const mergedStatuses = {
        technicalStatus: technicalStatus ?? existingProposal?.technicalStatus ?? 'draft',
        financialStatus: financialStatus ?? existingProposal?.financialStatus ?? 'draft',
      };
      const mergedDecisionData = {
        decision: decision ?? existingProposal?.decision ?? 'pending',
        implementationStartDate:
          implementationStartDate ?? existingProposal?.implementationStartDate ?? null,
        implementationDueDate:
          implementationDueDate ?? existingProposal?.implementationDueDate ?? null,
      };
      const wonError = validateProposalWonDecision(mergedDecisionData, mergedStatuses);
      if (wonError) {
        return res.status(400).json({ success: false, message: wonError });
      }

      const normalizedTechnicalAttachment = normalizeBase64Document(technicalAttachment);
      const normalizedFinancialAttachment = normalizeBase64Document(financialAttachment);
      const technicalAttachmentError = validateBase64DocumentSize(
        normalizedTechnicalAttachment,
        'Technical attachment'
      );
      if (technicalAttachmentError) {
        return res.status(400).json({ success: false, message: technicalAttachmentError });
      }
      const financialAttachmentError = validateBase64DocumentSize(
        normalizedFinancialAttachment,
        'Financial attachment'
      );
      if (financialAttachmentError) {
        return res.status(400).json({ success: false, message: financialAttachmentError });
      }

      const proposal = await OpportunityProposal.upsert(opportunity.dbId, {
        technicalProposal,
        financialProposal,
        technicalStatus,
        financialStatus,
        decision,
        implementationStartDate,
        implementationDueDate,
        technicalAttachment: technicalAttachment !== undefined ? normalizedTechnicalAttachment : undefined,
        technicalAttachmentName,
        financialAttachment: financialAttachment !== undefined ? normalizedFinancialAttachment : undefined,
        financialAttachmentName,
      });

      let contract = null;
      if (mergedDecisionData.decision === 'won') {
        const staff = req.staffId ? await Staff.findById(req.staffId) : null;
        const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'System';
        let linkedProjectId = null;
        if (proposal.implementationId) {
          const existingImpl = await Implementation.findById(proposal.implementationId);
          linkedProjectId = existingImpl?.projectId || null;
        }
        contract = await Contract.createFromWonProposal({
          opportunity,
          proposal,
          projectId: linkedProjectId,
          createdBy: req.staffId || null,
          createdByName: staffName,
        });
      }

      res.json({
        success: true,
        message:
          mergedDecisionData.decision === 'won'
            ? 'Proposal saved and contract created in Contract Management'
            : 'Proposal saved successfully',
        data: {
          ...proposal,
          opportunity,
          contract,
        },
      });
    } catch (error) {
      console.error('Upsert opportunity proposal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save opportunity proposal',
        error: error.message,
      });
    }
  }

  static async startProposalImplementation(req, res) {
    try {
      await OpportunityProposal.ensureTable();
      const { id } = req.params;
      const opportunity = await OpportunityProposal.resolveOpportunity(id);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found',
        });
      }

      let proposal = await OpportunityProposal.findByOpportunityDbId(opportunity.dbId);
      const {
        decision: bodyDecision,
        implementationStartDate: bodyStartDate,
        implementationDueDate: bodyDueDate,
      } = req.body || {};

      if (!proposal) {
        if (
          bodyDecision === 'won' &&
          bodyStartDate &&
          bodyDueDate
        ) {
          proposal = await OpportunityProposal.upsert(opportunity.dbId, {
            decision: 'won',
            implementationStartDate: bodyStartDate,
            implementationDueDate: bodyDueDate,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'Save proposal decision with Won dates before starting implementation',
          });
        }
      }

      if (proposal.decision !== 'won') {
        return res.status(400).json({
          success: false,
          message: 'Implementation can only be started when the proposal decision is Won',
        });
      }

      if (!proposal.implementationStartDate || !proposal.implementationDueDate) {
        return res.status(400).json({
          success: false,
          message: 'Save implementation start date and due date before starting',
        });
      }

      if (proposal.implementationId) {
        const existing = await Implementation.findById(proposal.implementationId);
        if (existing) {
          return res.json({
            success: true,
            message: 'Implementation already started',
            data: { proposal, opportunity, implementation: existing },
          });
        }
      }

      let budget = opportunity.value || 0;
      let enrichedDescription = opportunity.description || '';
      try {
        const financial = proposal.financialProposal ? JSON.parse(proposal.financialProposal) : null;
        if (financial?.totalAmount) {
          budget = financial.totalAmount;
        }
        if (financial?.summary) {
          enrichedDescription = [enrichedDescription, `Financial: ${financial.summary}`].filter(Boolean).join('\n\n');
        }
        const technical = proposal.technicalProposal ? JSON.parse(proposal.technicalProposal) : null;
        if (technical?.executiveSummary) {
          enrichedDescription = [enrichedDescription, `Technical: ${technical.executiveSummary}`].filter(Boolean).join('\n\n');
        }
      } catch {
        // keep opportunity value as budget fallback
      }

      const implementation = await Implementation.createFromAwarded({
        title: opportunity.name,
        client: opportunity.client,
        description: enrichedDescription,
        startDate: proposal.implementationStartDate,
        endDate: proposal.implementationDueDate,
        budget,
        assignedTo: opportunity.assignedTo,
        createdBy: req.staffId || null,
        department: opportunity.department || null,
      });

      const updatedProposal = await OpportunityProposal.upsert(opportunity.dbId, {
        implementationId: implementation.dbId,
      });

      await Opportunity.update(opportunity.dbId, {
        status: 'won',
        decision: 'approved',
      });

      const staff = req.staffId ? await Staff.findById(req.staffId) : null;
      const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'System';
      const contract = await Contract.createFromWonProposal({
        opportunity,
        proposal: updatedProposal,
        projectId: implementation.projectId || implementation.projectDbId || null,
        createdBy: req.staffId || null,
        createdByName: staffName,
      });

      res.status(201).json({
        success: true,
        message: 'Implementation started and contract linked successfully',
        data: {
          proposal: updatedProposal,
          opportunity: await Opportunity.findById(opportunity.dbId, { excludeDocuments: true }),
          implementation,
          contract,
        },
      });
    } catch (error) {
      console.error('Start proposal implementation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start implementation',
        error: error.message,
      });
    }
  }
}

