import QualityControl from '../models/QualityControl.js';
import ComplianceCheck from '../models/ComplianceCheck.js';
import ESIAStandard from '../models/ESIAStandard.js';
import NonConformanceReport from '../models/NonConformanceReport.js';
import Staff from '../models/Staff.js';

export class QualityController {
  // ========== Quality Control ==========
  
  static async createQualityControl(req, res) {
    try {
      const {
        qualityControlId,
        projectId,
        checklistItem,
        category = 'Technical',
        description,
        status = 'pending',
        complianceScore,
        checkedBy,
        checkedByName,
        checkDate,
        findings,
        correctiveActions,
        priority = 'medium',
        dueDate
      } = req.body;

      if (!checklistItem) {
        return res.status(400).json({
          success: false,
          message: 'Checklist item is required.'
        });
      }

      let checkedByNameFinal = checkedByName;
      if (checkedBy && !checkedByName) {
        try {
          const staff = await Staff.findById(checkedBy);
          if (staff) {
            checkedByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const qualityControl = await QualityControl.create({
        qualityControlId,
        projectId: projectId || null,
        checklistItem,
        category,
        description,
        status,
        complianceScore,
        checkedBy: checkedBy || req.staffId || null,
        checkedByName: checkedByNameFinal,
        checkDate,
        findings,
        correctiveActions,
        priority,
        dueDate
      });

      res.status(201).json({
        success: true,
        message: 'Quality control created successfully.',
        data: qualityControl
      });
    } catch (error) {
      console.error('Create quality control error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quality control.',
        error: error.message
      });
    }
  }

  static async getQualityControls(req, res) {
    try {
      const {
        search,
        projectId,
        category,
        status,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : undefined,
        category,
        status,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const qualityControls = await QualityControl.findAll(filters);
      const stats = await QualityControl.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: qualityControls,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          compliant: stats.compliant || 0,
          nonCompliant: stats.nonCompliant || 0,
          pending: stats.pending || 0,
          inProgress: stats.inProgress || 0,
          avgComplianceScore: stats.avgComplianceScore ? parseFloat(stats.avgComplianceScore) : null
        }
      });
    } catch (error) {
      console.error('Get quality controls error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quality controls.',
        error: error.message
      });
    }
  }

  static async updateQualityControl(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Quality control ID is required.'
        });
      }

      let qualityControl = await QualityControl.findById(parseInt(id));
      if (!qualityControl && isNaN(id)) {
        qualityControl = await QualityControl.findByQualityControlId(id);
      }

      if (!qualityControl) {
        return res.status(404).json({
          success: false,
          message: 'Quality control not found.'
        });
      }

      if (updateData.checkedBy && !updateData.checkedByName) {
        try {
          const staff = await Staff.findById(updateData.checkedBy);
          if (staff) {
            updateData.checkedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = qualityControl.dbId || parseInt(id);
      const success = await QualityControl.update(dbId, updateData);

      if (success) {
        const updatedQC = await QualityControl.findById(dbId);
        res.json({
          success: true,
          message: 'Quality control updated successfully.',
          data: updatedQC
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update quality control.'
        });
      }
    } catch (error) {
      console.error('Update quality control error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quality control.',
        error: error.message
      });
    }
  }

  // ========== Compliance Checks ==========

  static async createComplianceCheck(req, res) {
    try {
      const {
        complianceCheckId,
        projectId,
        category,
        subcategory,
        description,
        compliancePercentage = 0,
        status = 'pending',
        checkedBy,
        checkedByName,
        checkDate,
        findings,
        requirements,
        gaps,
        actionPlan,
        nextReviewDate,
        priority = 'medium'
      } = req.body;

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required.'
        });
      }

      let checkedByNameFinal = checkedByName;
      if (checkedBy && !checkedByName) {
        try {
          const staff = await Staff.findById(checkedBy);
          if (staff) {
            checkedByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const complianceCheck = await ComplianceCheck.create({
        complianceCheckId,
        projectId: projectId || null,
        category,
        subcategory,
        description,
        compliancePercentage,
        status,
        checkedBy: checkedBy || req.staffId || null,
        checkedByName: checkedByNameFinal,
        checkDate,
        findings,
        requirements,
        gaps,
        actionPlan,
        nextReviewDate,
        priority
      });

      res.status(201).json({
        success: true,
        message: 'Compliance check created successfully.',
        data: complianceCheck
      });
    } catch (error) {
      console.error('Create compliance check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create compliance check.',
        error: error.message
      });
    }
  }

  static async getComplianceChecks(req, res) {
    try {
      const {
        search,
        projectId,
        category,
        status,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : undefined,
        category,
        status,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const complianceChecks = await ComplianceCheck.findAll(filters);
      const stats = await ComplianceCheck.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: complianceChecks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          compliant: stats.compliant || 0,
          partial: stats.partial || 0,
          nonCompliant: stats.nonCompliant || 0,
          pending: stats.pending || 0,
          avgCompliancePercentage: stats.avgCompliancePercentage ? parseFloat(stats.avgCompliancePercentage) : null
        }
      });
    } catch (error) {
      console.error('Get compliance checks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch compliance checks.',
        error: error.message
      });
    }
  }

  static async updateComplianceCheck(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Compliance check ID is required.'
        });
      }

      let complianceCheck = await ComplianceCheck.findById(parseInt(id));
      if (!complianceCheck && isNaN(id)) {
        complianceCheck = await ComplianceCheck.findByComplianceCheckId(id);
      }

      if (!complianceCheck) {
        return res.status(404).json({
          success: false,
          message: 'Compliance check not found.'
        });
      }

      if (updateData.checkedBy && !updateData.checkedByName) {
        try {
          const staff = await Staff.findById(updateData.checkedBy);
          if (staff) {
            updateData.checkedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = complianceCheck.dbId || parseInt(id);
      const success = await ComplianceCheck.update(dbId, updateData);

      if (success) {
        const updatedCC = await ComplianceCheck.findById(dbId);
        res.json({
          success: true,
          message: 'Compliance check updated successfully.',
          data: updatedCC
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update compliance check.'
        });
      }
    } catch (error) {
      console.error('Update compliance check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update compliance check.',
        error: error.message
      });
    }
  }

  // ========== ESIA Standards ==========

  static async createESIAStandard(req, res) {
    try {
      const {
        esiaStandardId,
        projectId,
        standardType,
        title,
        description,
        complianceStatus = 'pending',
        complianceScore,
        requirements,
        findings,
        gaps,
        actionPlan,
        assessedBy,
        assessedByName,
        assessmentDate,
        nextReviewDate,
        priority = 'medium'
      } = req.body;

      if (!standardType || !title) {
        return res.status(400).json({
          success: false,
          message: 'Standard type and title are required.'
        });
      }

      let assessedByNameFinal = assessedByName;
      if (assessedBy && !assessedByName) {
        try {
          const staff = await Staff.findById(assessedBy);
          if (staff) {
            assessedByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const esiaStandard = await ESIAStandard.create({
        esiaStandardId,
        projectId: projectId || null,
        standardType,
        title,
        description,
        complianceStatus,
        complianceScore,
        requirements,
        findings,
        gaps,
        actionPlan,
        assessedBy: assessedBy || req.staffId || null,
        assessedByName: assessedByNameFinal,
        assessmentDate,
        nextReviewDate,
        priority
      });

      res.status(201).json({
        success: true,
        message: 'ESIA standard created successfully.',
        data: esiaStandard
      });
    } catch (error) {
      console.error('Create ESIA standard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create ESIA standard.',
        error: error.message
      });
    }
  }

  static async getESIAStandards(req, res) {
    try {
      const {
        search,
        projectId,
        standardType,
        complianceStatus,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : undefined,
        standardType,
        complianceStatus,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const esiaStandards = await ESIAStandard.findAll(filters);
      const stats = await ESIAStandard.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: esiaStandards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          compliant: stats.compliant || 0,
          partial: stats.partial || 0,
          nonCompliant: stats.nonCompliant || 0,
          pending: stats.pending || 0,
          avgComplianceScore: stats.avgComplianceScore ? parseFloat(stats.avgComplianceScore) : null
        }
      });
    } catch (error) {
      console.error('Get ESIA standards error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch ESIA standards.',
        error: error.message
      });
    }
  }

  static async updateESIAStandard(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ESIA standard ID is required.'
        });
      }

      let esiaStandard = await ESIAStandard.findById(parseInt(id));
      if (!esiaStandard && isNaN(id)) {
        esiaStandard = await ESIAStandard.findByESIAStandardId(id);
      }

      if (!esiaStandard) {
        return res.status(404).json({
          success: false,
          message: 'ESIA standard not found.'
        });
      }

      if (updateData.assessedBy && !updateData.assessedByName) {
        try {
          const staff = await Staff.findById(updateData.assessedBy);
          if (staff) {
            updateData.assessedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = esiaStandard.dbId || parseInt(id);
      const success = await ESIAStandard.update(dbId, updateData);

      if (success) {
        const updatedESIA = await ESIAStandard.findById(dbId);
        res.json({
          success: true,
          message: 'ESIA standard updated successfully.',
          data: updatedESIA
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update ESIA standard.'
        });
      }
    } catch (error) {
      console.error('Update ESIA standard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update ESIA standard.',
        error: error.message
      });
    }
  }

  // ========== Non-Conformance Reports ==========

  static async createNCR(req, res) {
    try {
      const {
        ncrId,
        projectId,
        title,
        description,
        issueType = 'Quality',
        severity = 'medium',
        status = 'open',
        reportedBy,
        reportedByName,
        reportDate,
        assignedTo,
        assignedToName,
        rootCause,
        correctiveAction,
        preventiveAction,
        priority = 'medium',
        dueDate,
        relatedItemType,
        relatedItemId
      } = req.body;

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: 'Title and description are required.'
        });
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

      const ncr = await NonConformanceReport.create({
        ncrId,
        projectId: projectId || null,
        title,
        description,
        issueType,
        severity,
        status,
        reportedBy: reportedBy || req.staffId || null,
        reportedByName: reportedByNameFinal,
        reportDate: reportDate || new Date().toISOString().split('T')[0],
        assignedTo,
        assignedToName: assignedToNameFinal,
        rootCause,
        correctiveAction,
        preventiveAction,
        priority,
        dueDate,
        relatedItemType,
        relatedItemId
      });

      res.status(201).json({
        success: true,
        message: 'Non-conformance report created successfully.',
        data: ncr
      });
    } catch (error) {
      console.error('Create NCR error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create non-conformance report.',
        error: error.message
      });
    }
  }

  static async getNCRs(req, res) {
    try {
      const {
        search,
        projectId,
        issueType,
        severity,
        status,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : undefined,
        issueType,
        severity,
        status,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const ncrs = await NonConformanceReport.findAll(filters);
      const stats = await NonConformanceReport.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: ncrs,
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
          critical: stats.critical || 0,
          high: stats.high || 0
        }
      });
    } catch (error) {
      console.error('Get NCRs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch non-conformance reports.',
        error: error.message
      });
    }
  }

  static async updateNCR(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'NCR ID is required.'
        });
      }

      let ncr = await NonConformanceReport.findById(parseInt(id));
      if (!ncr && isNaN(id)) {
        ncr = await NonConformanceReport.findByNCRId(id);
      }

      if (!ncr) {
        return res.status(404).json({
          success: false,
          message: 'Non-conformance report not found.'
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

      if (updateData.verifiedBy && !updateData.verifiedByName) {
        try {
          const staff = await Staff.findById(updateData.verifiedBy);
          if (staff) {
            updateData.verifiedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      // Auto-set closure date if status is closed
      if (updateData.status === 'closed' && !updateData.closureDate) {
        updateData.closureDate = new Date().toISOString().split('T')[0];
      }

      const dbId = ncr.dbId || parseInt(id);
      const success = await NonConformanceReport.update(dbId, updateData);

      if (success) {
        const updatedNCR = await NonConformanceReport.findById(dbId);
        res.json({
          success: true,
          message: 'Non-conformance report updated successfully.',
          data: updatedNCR
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update non-conformance report.'
        });
      }
    } catch (error) {
      console.error('Update NCR error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update non-conformance report.',
        error: error.message
      });
    }
  }

  // ========== Statistics ==========

  static async getQualityStats(req, res) {
    try {
      const { projectId } = req.query;
      const projId = projectId ? parseInt(projectId) : null;

      const [qcStats, ccStats, esiaStats, ncrStats] = await Promise.all([
        QualityControl.getStats(projId),
        ComplianceCheck.getStats(projId),
        ESIAStandard.getStats(projId),
        NonConformanceReport.getStats(projId)
      ]);

      // Calculate overall compliance
      const totalChecks = (qcStats.total || 0) + (ccStats.total || 0);
      const compliantChecks = (qcStats.compliant || 0) + (ccStats.compliant || 0);
      const overallCompliance = totalChecks > 0 
        ? Math.round((compliantChecks / totalChecks) * 100) 
        : 0;

      // Calculate ESIA average
      const esiaAvg = esiaStats.avgComplianceScore 
        ? Math.round(parseFloat(esiaStats.avgComplianceScore)) 
        : 0;

      res.json({
        success: true,
        data: {
          overallCompliance,
          qualityControls: {
            total: qcStats.total || 0,
            compliant: qcStats.compliant || 0,
            nonCompliant: qcStats.nonCompliant || 0,
            pending: qcStats.pending || 0,
            avgScore: qcStats.avgComplianceScore ? parseFloat(qcStats.avgComplianceScore) : null
          },
          complianceChecks: {
            total: ccStats.total || 0,
            compliant: ccStats.compliant || 0,
            partial: ccStats.partial || 0,
            nonCompliant: ccStats.nonCompliant || 0,
            avgPercentage: ccStats.avgCompliancePercentage ? parseFloat(ccStats.avgCompliancePercentage) : null
          },
          esiaStandards: {
            total: esiaStats.total || 0,
            compliant: esiaStats.compliant || 0,
            partial: esiaStats.partial || 0,
            nonCompliant: esiaStats.nonCompliant || 0,
            avgScore: esiaAvg
          },
          ncrReports: {
            total: ncrStats.total || 0,
            open: ncrStats.open || 0,
            inProgress: ncrStats.inProgress || 0,
            resolved: ncrStats.resolved || 0,
            closed: ncrStats.closed || 0,
            critical: ncrStats.critical || 0,
            high: ncrStats.high || 0
          }
        }
      });
    } catch (error) {
      console.error('Get quality stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quality statistics.',
        error: error.message
      });
    }
  }
}
