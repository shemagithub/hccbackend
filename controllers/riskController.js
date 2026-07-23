import Risk from '../models/Risk.js';
import Issue from '../models/Issue.js';
import MitigationAction from '../models/MitigationAction.js';
import Escalation from '../models/Escalation.js';
import RiskIssueComment from '../models/RiskIssueComment.js';
import Staff from '../models/Staff.js';
import Project from '../models/Project.js';
import {
  userHasProjectAccess,
  resolveStaffProjectPermissions,
  canCommentOnProjectRisks,
  canCreateProjectRisks,
  canEvaluateProjectRisks,
  resolveEffectiveProjectRole,
  isElevatedProjectTeamCreator,
  isProjectManagerPortalStaff,
  isViewerPortalStaff,
  getProjectAssignments,
} from '../utils/projectTeam.js';

export class RiskController {
  // ========== Risk Register ==========
  
  static async createRisk(req, res) {
    try {
      const {
        riskId,
        projectId,
        title,
        description,
        category = 'Technical',
        probability = 'medium',
        impact = 'medium',
        severity,
        status = 'identified',
        ownerId,
        ownerName,
        identifiedBy,
        identifiedByName,
        identifiedDate,
        mitigationStrategy,
        contingencyPlan,
        residualRisk,
        reviewDate,
        nextReviewDate,
        priority = 'medium'
      } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Title is required.'
        });
      }

      const resolvedProjectId = projectId ? parseInt(projectId, 10) : null;
      if (resolvedProjectId && req.staffId) {
        const staff = await Staff.findById(req.staffId);
        const project = await Project.findById(resolvedProjectId);
        if (!project) {
          return res.status(404).json({ success: false, message: 'Project not found.' });
        }
        const assignments = await getProjectAssignments(resolvedProjectId);
        const isElevated = isElevatedProjectTeamCreator(staff);
        const isPmPortal = isProjectManagerPortalStaff(staff);
        const isViewerPortal = isViewerPortalStaff(staff);
        const hasAccess = isElevated || (await userHasProjectAccess({ project, staff, assignments }));
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to add risks on this project.',
          });
        }
        const projectRole = await resolveEffectiveProjectRole(req.staffId, resolvedProjectId, project);
        if (!canCreateProjectRisks(projectRole, { isElevated, isPmPortal, isViewerPortal })) {
          return res.status(403).json({
            success: false,
            message: 'Your project role cannot add risks or issues.',
          });
        }
      }

      let identifiedByNameFinal = identifiedByName;
      if ((identifiedBy || req.staffId) && !identifiedByName) {
        const identifierId = identifiedBy || req.staffId;
        try {
          const staff = await Staff.findById(identifierId);
          if (staff) {
            identifiedByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      let ownerNameFinal = ownerName;
      if (ownerId && !ownerName) {
        try {
          const staff = await Staff.findById(ownerId);
          if (staff) {
            ownerNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const risk = await Risk.create({
        riskId,
        projectId: projectId || null,
        title,
        description,
        category,
        probability,
        impact,
        severity,
        status,
        ownerId,
        ownerName: ownerNameFinal,
        identifiedBy: identifiedBy || req.staffId || null,
        identifiedByName: identifiedByNameFinal,
        identifiedDate,
        mitigationStrategy,
        contingencyPlan,
        residualRisk,
        reviewDate,
        nextReviewDate,
        priority
      });

      res.status(201).json({
        success: true,
        message: 'Risk created successfully.',
        data: risk
      });
    } catch (error) {
      console.error('Create risk error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create risk.',
        error: error.message
      });
    }
  }

  static async getRisks(req, res) {
    try {
      const {
        search,
        projectId,
        category,
        severity,
        status,
        activeOnly,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : undefined,
        category,
        severity,
        status,
        activeOnly: activeOnly === 'true' || activeOnly === true,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const risks = await Risk.findAll(filters);
      const stats = await Risk.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: risks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          identified: stats.identified || 0,
          assessed: stats.assessed || 0,
          mitigated: stats.mitigated || 0,
          monitored: stats.monitored || 0,
          closed: stats.closed || 0,
          escalated: stats.escalated || 0,
          critical: stats.critical || 0,
          high: stats.high || 0,
          active: stats.active || 0
        }
      });
    } catch (error) {
      console.error('Get risks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch risks.',
        error: error.message
      });
    }
  }

  static async updateRisk(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Risk ID is required.'
        });
      }

      let risk = await Risk.findById(parseInt(id));
      if (!risk && isNaN(id)) {
        risk = await Risk.findByRiskId(id);
      }

      if (!risk) {
        return res.status(404).json({
          success: false,
          message: 'Risk not found.'
        });
      }

      if (updateData.ownerId && !updateData.ownerName) {
        try {
          const staff = await Staff.findById(updateData.ownerId);
          if (staff) {
            updateData.ownerName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = risk.dbId || parseInt(id);

      if (req.staffId && risk.projectId) {
        const staff = await Staff.findById(req.staffId);
        const project = await Project.findById(risk.projectId);
        const projectRole = await resolveEffectiveProjectRole(req.staffId, risk.projectId, project);
        const isElevated = isElevatedProjectTeamCreator(staff);
        const isPmPortal = isProjectManagerPortalStaff(staff);
        const isSuperAdmin = (staff?.role || '').toLowerCase().replace(/\s+/g, '') === 'superadmin';
        if (!canEvaluateProjectRisks(projectRole, { isPmPortal, isElevated, isSuperAdmin })) {
          return res.status(403).json({
            success: false,
            message: 'Only project managers or administrators can evaluate and update risks.',
          });
        }
      }

      const success = await Risk.update(dbId, updateData);

      if (success) {
        const updatedRisk = await Risk.findById(dbId);
        res.json({
          success: true,
          message: 'Risk updated successfully.',
          data: updatedRisk
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update risk.'
        });
      }
    } catch (error) {
      console.error('Update risk error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update risk.',
        error: error.message
      });
    }
  }

  static async deleteRisk(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, message: 'Risk ID is required.' });
      }

      let risk = await Risk.findById(parseInt(id));
      if (!risk && isNaN(id)) {
        risk = await Risk.findByRiskId(id);
      }

      if (!risk) {
        return res.status(404).json({ success: false, message: 'Risk not found.' });
      }

      const dbId = risk.dbId || parseInt(id);
      const deleted = await Risk.delete(dbId);

      if (!deleted) {
        return res.status(500).json({ success: false, message: 'Failed to delete risk.' });
      }

      res.json({ success: true, message: 'Risk deleted successfully.' });
    } catch (error) {
      console.error('Delete risk error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete risk.',
        error: error.message,
      });
    }
  }

  // ========== Issue Reporting ==========

  static async createIssue(req, res) {
    try {
      const {
        issueId,
        projectId,
        title,
        description,
        category = 'Technical',
        severity = 'medium',
        priority = 'medium',
        status = 'open',
        reportedBy,
        reportedByName,
        reportDate,
        assignedTo,
        assignedToName,
        resolution,
        relatedRiskId,
        relatedItemType,
        relatedItemId
      } = req.body;

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: 'Title and description are required.'
        });
      }

      const resolvedProjectId = projectId ? parseInt(projectId, 10) : null;
      if (resolvedProjectId && req.staffId) {
        const staff = await Staff.findById(req.staffId);
        const project = await Project.findById(resolvedProjectId);
        if (!project) {
          return res.status(404).json({ success: false, message: 'Project not found.' });
        }
        const assignments = await getProjectAssignments(resolvedProjectId);
        const isElevated = isElevatedProjectTeamCreator(staff);
        const isPmPortal = isProjectManagerPortalStaff(staff);
        const isViewerPortal = isViewerPortalStaff(staff);
        const hasAccess = isElevated || (await userHasProjectAccess({ project, staff, assignments }));
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to add issues on this project.',
          });
        }
        const projectRole = await resolveEffectiveProjectRole(req.staffId, resolvedProjectId, project);
        if (!canCreateProjectRisks(projectRole, { isElevated, isPmPortal, isViewerPortal })) {
          return res.status(403).json({
            success: false,
            message: 'Your project role cannot add risks or issues.',
          });
        }
      }

      let reportedByNameFinal = reportedByName;
      if ((reportedBy || req.staffId) && !reportedByName) {
        const reporterId = reportedBy || req.staffId;
        try {
          const staff = await Staff.findById(reporterId);
          if (staff) {
            reportedByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      let assignedToNameFinal = assignedToName;
      if (assignedTo && !assignedToName) {
        try {
          const staff = await Staff.findById(assignedTo);
          if (staff) {
            assignedToNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const issue = await Issue.create({
        issueId,
        projectId: projectId || null,
        title,
        description,
        category,
        severity,
        priority,
        status,
        reportedBy: reportedBy || req.staffId || null,
        reportedByName: reportedByNameFinal,
        reportDate: reportDate || new Date().toISOString().split('T')[0],
        assignedTo,
        assignedToName: assignedToNameFinal,
        resolution,
        relatedRiskId,
        relatedItemType,
        relatedItemId
      });

      res.status(201).json({
        success: true,
        message: 'Issue created successfully.',
        data: issue
      });
    } catch (error) {
      console.error('Create issue error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create issue.',
        error: error.message
      });
    }
  }

  static async getIssues(req, res) {
    try {
      const {
        search,
        projectId,
        category,
        severity,
        status,
        openOnly,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : undefined,
        category,
        severity,
        status,
        openOnly: openOnly === 'true' || openOnly === true,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const issues = await Issue.findAll(filters);
      const stats = await Issue.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: issues,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          open: stats.open || 0,
          inProgress: stats.inProgress || 0,
          resolved: stats.resolved || 0,
          closed: stats.closed || 0,
          escalated: stats.escalated || 0,
          critical: stats.critical || 0,
          high: stats.high || 0
        }
      });
    } catch (error) {
      console.error('Get issues error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch issues.',
        error: error.message
      });
    }
  }

  static async updateIssue(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Issue ID is required.'
        });
      }

      let issue = await Issue.findById(parseInt(id));
      if (!issue && isNaN(id)) {
        issue = await Issue.findByIssueId(id);
      }

      if (!issue) {
        return res.status(404).json({
          success: false,
          message: 'Issue not found.'
        });
      }

      if (updateData.assignedTo && !updateData.assignedToName) {
        try {
          const staff = await Staff.findById(updateData.assignedTo);
          if (staff) {
            updateData.assignedToName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      if (updateData.resolvedBy && !updateData.resolvedByName) {
        try {
          const staff = await Staff.findById(updateData.resolvedBy);
          if (staff) {
            updateData.resolvedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = issue.dbId || parseInt(id);

      if (req.staffId && issue.projectId) {
        const staff = await Staff.findById(req.staffId);
        const project = await Project.findById(issue.projectId);
        const projectRole = await resolveEffectiveProjectRole(req.staffId, issue.projectId, project);
        const isElevated = isElevatedProjectTeamCreator(staff);
        const isPmPortal = isProjectManagerPortalStaff(staff);
        const isSuperAdmin = (staff?.role || '').toLowerCase().replace(/\s+/g, '') === 'superadmin';
        if (!canEvaluateProjectRisks(projectRole, { isPmPortal, isElevated, isSuperAdmin })) {
          return res.status(403).json({
            success: false,
            message: 'Only project managers or administrators can evaluate and update issues.',
          });
        }
      }

      const success = await Issue.update(dbId, updateData);

      if (success) {
        const updatedIssue = await Issue.findById(dbId);
        res.json({
          success: true,
          message: 'Issue updated successfully.',
          data: updatedIssue
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update issue.'
        });
      }
    } catch (error) {
      console.error('Update issue error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update issue.',
        error: error.message
      });
    }
  }

  static async deleteIssue(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, message: 'Issue ID is required.' });
      }

      let issue = await Issue.findById(parseInt(id));
      if (!issue && isNaN(id)) {
        issue = await Issue.findByIssueId(id);
      }

      if (!issue) {
        return res.status(404).json({ success: false, message: 'Issue not found.' });
      }

      const dbId = issue.dbId || parseInt(id);
      const deleted = await Issue.delete(dbId);

      if (!deleted) {
        return res.status(500).json({ success: false, message: 'Failed to delete issue.' });
      }

      res.json({ success: true, message: 'Issue deleted successfully.' });
    } catch (error) {
      console.error('Delete issue error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete issue.',
        error: error.message,
      });
    }
  }

  // ========== Mitigation Actions ==========

  static async createMitigationAction(req, res) {
    try {
      const {
        mitigationActionId,
        riskId,
        projectId,
        title,
        description,
        actionType = 'preventive',
        status = 'planned',
        assignedTo,
        assignedToName,
        assignedDate,
        dueDate,
        completionPercentage = 0,
        effectivenessRating,
        notes,
        costEstimate,
        actualCost,
        priority = 'medium'
      } = req.body;

      if (!riskId || !title) {
        return res.status(400).json({
          success: false,
          message: 'Risk ID and title are required.'
        });
      }

      let assignedToNameFinal = assignedToName;
      if (assignedTo && !assignedToName) {
        try {
          const staff = await Staff.findById(assignedTo);
          if (staff) {
            assignedToNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const mitigationAction = await MitigationAction.create({
        mitigationActionId,
        riskId,
        projectId: projectId || null,
        title,
        description,
        actionType,
        status,
        assignedTo,
        assignedToName: assignedToNameFinal,
        assignedDate,
        dueDate,
        completionPercentage,
        effectivenessRating,
        notes,
        costEstimate,
        actualCost,
        priority
      });

      res.status(201).json({
        success: true,
        message: 'Mitigation action created successfully.',
        data: mitigationAction
      });
    } catch (error) {
      console.error('Create mitigation action error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create mitigation action.',
        error: error.message
      });
    }
  }

  static async getMitigationActions(req, res) {
    try {
      const {
        search,
        riskId,
        projectId,
        status,
        actionType,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        riskId: riskId ? parseInt(riskId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        status,
        actionType,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const mitigationActions = await MitigationAction.findAll(filters);
      const stats = await MitigationAction.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: mitigationActions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          planned: stats.planned || 0,
          inProgress: stats.inProgress || 0,
          completed: stats.completed || 0,
          cancelled: stats.cancelled || 0,
          onHold: stats.onHold || 0,
          avgCompletionPercentage: stats.avgCompletionPercentage ? parseFloat(stats.avgCompletionPercentage) : null,
          avgEffectivenessRating: stats.avgEffectivenessRating ? parseFloat(stats.avgEffectivenessRating) : null
        }
      });
    } catch (error) {
      console.error('Get mitigation actions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch mitigation actions.',
        error: error.message
      });
    }
  }

  static async updateMitigationAction(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Mitigation action ID is required.'
        });
      }

      let mitigationAction = await MitigationAction.findById(parseInt(id));
      if (!mitigationAction && isNaN(id)) {
        mitigationAction = await MitigationAction.findByMitigationActionId(id);
      }

      if (!mitigationAction) {
        return res.status(404).json({
          success: false,
          message: 'Mitigation action not found.'
        });
      }

      if (updateData.assignedTo && !updateData.assignedToName) {
        try {
          const staff = await Staff.findById(updateData.assignedTo);
          if (staff) {
            updateData.assignedToName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = mitigationAction.dbId || parseInt(id);
      const success = await MitigationAction.update(dbId, updateData);

      if (success) {
        const updatedMA = await MitigationAction.findById(dbId);
        res.json({
          success: true,
          message: 'Mitigation action updated successfully.',
          data: updatedMA
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update mitigation action.'
        });
      }
    } catch (error) {
      console.error('Update mitigation action error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update mitigation action.',
        error: error.message
      });
    }
  }

  // ========== Escalations ==========

  static async createEscalation(req, res) {
    try {
      const {
        escalationId,
        riskId,
        issueId,
        projectId,
        title,
        description,
        escalationType,
        escalationLevel = 'department_director',
        currentLevel = 'project_manager',
        status = 'pending',
        escalatedBy,
        escalatedByName,
        escalationDate,
        escalatedTo,
        escalatedToName,
        priority = 'high',
        urgencyReason
      } = req.body;

      if (!title || !description || !escalationType) {
        return res.status(400).json({
          success: false,
          message: 'Title, description, and escalation type are required.'
        });
      }

      let escalatedByNameFinal = escalatedByName;
      if ((escalatedBy || req.staffId) && !escalatedByName) {
        const escalatorId = escalatedBy || req.staffId;
        try {
          const staff = await Staff.findById(escalatorId);
          if (staff) {
            escalatedByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      let escalatedToNameFinal = escalatedToName;
      if (escalatedTo && !escalatedToName) {
        try {
          const staff = await Staff.findById(escalatedTo);
          if (staff) {
            escalatedToNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const escalation = await Escalation.create({
        escalationId,
        riskId,
        issueId,
        projectId: projectId || null,
        title,
        description,
        escalationType,
        escalationLevel,
        currentLevel,
        status,
        escalatedBy: escalatedBy || req.staffId || null,
        escalatedByName: escalatedByNameFinal,
        escalationDate: escalationDate || new Date().toISOString().split('T')[0],
        escalatedTo,
        escalatedToName: escalatedToNameFinal,
        priority,
        urgencyReason
      });

      // Update risk or issue status to escalated
      if (riskId) {
        try {
          const risk = await Risk.findById(riskId);
          if (risk) {
            await Risk.update(risk.dbId, { status: 'escalated' });
          }
        } catch (riskError) {
          console.error('Error updating risk status:', riskError);
        }
      }

      if (issueId) {
        try {
          const issue = await Issue.findById(issueId);
          if (issue) {
            await Issue.update(issue.dbId, { status: 'escalated' });
          }
        } catch (issueError) {
          console.error('Error updating issue status:', issueError);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Escalation created successfully.',
        data: escalation
      });
    } catch (error) {
      console.error('Create escalation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create escalation.',
        error: error.message
      });
    }
  }

  static async getEscalations(req, res) {
    try {
      const {
        search,
        riskId,
        issueId,
        projectId,
        escalationType,
        escalationLevel,
        status,
        pendingOnly,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        riskId: riskId ? parseInt(riskId) : undefined,
        issueId: issueId ? parseInt(issueId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        escalationType,
        escalationLevel,
        status,
        pendingOnly: pendingOnly === 'true' || pendingOnly === true,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const escalations = await Escalation.findAll(filters);
      const stats = await Escalation.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: escalations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          pending: stats.pending || 0,
          acknowledged: stats.acknowledged || 0,
          inReview: stats.inReview || 0,
          resolved: stats.resolved || 0,
          closed: stats.closed || 0,
          departmentDirector: stats.departmentDirector || 0,
          executive: stats.executive || 0,
          board: stats.board || 0
        }
      });
    } catch (error) {
      console.error('Get escalations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch escalations.',
        error: error.message
      });
    }
  }

  static async updateEscalation(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Escalation ID is required.'
        });
      }

      let escalation = await Escalation.findById(parseInt(id));
      if (!escalation && isNaN(id)) {
        escalation = await Escalation.findByEscalationId(id);
      }

      if (!escalation) {
        return res.status(404).json({
          success: false,
          message: 'Escalation not found.'
        });
      }

      if (updateData.escalatedTo && !updateData.escalatedToName) {
        try {
          const staff = await Staff.findById(updateData.escalatedTo);
          if (staff) {
            updateData.escalatedToName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      if (updateData.acknowledgedBy && !updateData.acknowledgedByName) {
        try {
          const staff = await Staff.findById(updateData.acknowledgedBy);
          if (staff) {
            updateData.acknowledgedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      if (updateData.resolvedBy && !updateData.resolvedByName) {
        try {
          const staff = await Staff.findById(updateData.resolvedBy);
          if (staff) {
            updateData.resolvedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = escalation.dbId || parseInt(id);
      const success = await Escalation.update(dbId, updateData);

      if (success) {
        const updatedEscalation = await Escalation.findById(dbId);
        res.json({
          success: true,
          message: 'Escalation updated successfully.',
          data: updatedEscalation
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update escalation.'
        });
      }
    } catch (error) {
      console.error('Update escalation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update escalation.',
        error: error.message
      });
    }
  }

  // ========== Statistics ==========

  static async getRiskStats(req, res) {
    try {
      const { projectId } = req.query;
      const projId = projectId ? parseInt(projectId) : null;

      const [riskStats, issueStats, mitigationStats, escalationStats] = await Promise.all([
        Risk.getStats(projId),
        Issue.getStats(projId),
        MitigationAction.getStats(projId),
        Escalation.getStats(projId)
      ]);

      res.json({
        success: true,
        data: {
          risks: {
            total: riskStats.total || 0,
            active: riskStats.active || 0,
            critical: riskStats.critical || 0,
            high: riskStats.high || 0,
            mitigated: riskStats.mitigated || 0,
            escalated: riskStats.escalated || 0
          },
          issues: {
            total: issueStats.total || 0,
            open: issueStats.open || 0,
            critical: issueStats.critical || 0,
            high: issueStats.high || 0,
            resolved: issueStats.resolved || 0,
            escalated: issueStats.escalated || 0
          },
          mitigationActions: {
            total: mitigationStats.total || 0,
            inProgress: mitigationStats.inProgress || 0,
            completed: mitigationStats.completed || 0,
            avgCompletionPercentage: mitigationStats.avgCompletionPercentage ? parseFloat(mitigationStats.avgCompletionPercentage) : null
          },
          escalations: {
            total: escalationStats.total || 0,
            pending: escalationStats.pending || 0,
            inReview: escalationStats.inReview || 0,
            resolved: escalationStats.resolved || 0
          }
        }
      });
    } catch (error) {
      console.error('Get risk stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch risk statistics.',
        error: error.message
      });
    }
  }

  static async getRegisterComments(req, res) {
    try {
      const { itemType, itemId } = req.query;

      if (!itemType || !itemId || !['risk', 'issue'].includes(String(itemType))) {
        return res.status(400).json({
          success: false,
          message: 'itemType (risk|issue) and itemId are required',
        });
      }

      const comments = await RiskIssueComment.findByItem(String(itemType), parseInt(itemId, 10));
      res.json({ success: true, data: comments });
    } catch (error) {
      console.error('Get register comments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch comments',
        error: error.message,
      });
    }
  }

  static async createRegisterComment(req, res) {
    try {
      const { itemType, itemId, projectId, comment } = req.body;

      if (!itemType || !itemId || !comment?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'itemType, itemId, and comment are required',
        });
      }

      if (!['risk', 'issue'].includes(String(itemType))) {
        return res.status(400).json({
          success: false,
          message: 'itemType must be risk or issue',
        });
      }

      const numericItemId = parseInt(itemId, 10);
      const numericProjectId = projectId ? parseInt(projectId, 10) : null;

      const permissions = await resolveStaffProjectPermissions(req.staffId, numericProjectId);
      if (!permissions.canCommentOnRisks) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to comment on this register item',
        });
      }

      if (numericProjectId) {
        const project = await Project.findById(numericProjectId);
        if (!project) {
          return res.status(404).json({ success: false, message: 'Project not found' });
        }
        const assignments = await getProjectAssignments(numericProjectId);
        const hasAccess =
          permissions.isElevated ||
          (await userHasProjectAccess({ project, staff: permissions.staff, assignments }));
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this project',
          });
        }
      }

      if (itemType === 'risk') {
        const risk = await Risk.findById(numericItemId);
        if (!risk) {
          return res.status(404).json({ success: false, message: 'Risk not found' });
        }
      } else {
        const issue = await Issue.findById(numericItemId);
        if (!issue) {
          return res.status(404).json({ success: false, message: 'Issue not found' });
        }
      }

      let staffName = 'User';
      if (req.staffId) {
        const staff = await Staff.findById(req.staffId);
        if (staff) {
          staffName = `${staff.firstName} ${staff.lastName}`.trim() || staffName;
        }
      }

      const saved = await RiskIssueComment.create({
        itemType,
        itemId: numericItemId,
        projectId: numericProjectId,
        staffId: req.staffId || null,
        staffName,
        comment: String(comment).trim(),
      });

      res.status(201).json({
        success: true,
        message: 'Comment added',
        data: saved,
      });
    } catch (error) {
      console.error('Create register comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add comment',
        error: error.message,
      });
    }
  }
}
