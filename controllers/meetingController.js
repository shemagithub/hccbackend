import Meeting from '../models/Meeting.js';
import MeetingMinutes from '../models/MeetingMinutes.js';
import ActionItem from '../models/ActionItem.js';
import Responsibility from '../models/Responsibility.js';
import Staff from '../models/Staff.js';

export class MeetingController {
  // Create a new meeting
  static async createMeeting(req, res) {
    try {
      const {
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
      } = req.body;

      // Basic validation
      if (!title || !scheduledDate || !scheduledTime) {
        return res.status(400).json({
          success: false,
          message: 'Title, scheduled date, and scheduled time are required.'
        });
      }

      // Get organizer info if staffId is available
      let finalOrganizerName = organizerName;
      const organizerIdToUse = organizerId || req.staffId;
      if (organizerIdToUse && !finalOrganizerName) {
        try {
          const staff = await Staff.findById(organizerIdToUse);
          if (staff) {
            finalOrganizerName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const meeting = await Meeting.create({
        meetingId,
        projectId: projectId || null,
        title,
        type,
        scheduledDate,
        scheduledTime,
        durationMinutes,
        location: location || null,
        status,
        organizerId: organizerIdToUse || null,
        organizerName: finalOrganizerName || null,
        attendees: attendees ? JSON.stringify(attendees) : null,
        agenda: agenda || null,
        minutes: minutes || null,
        actionItems: actionItems ? JSON.stringify(actionItems) : null
      });

      res.status(201).json({
        success: true,
        message: 'Meeting created successfully.',
        data: meeting
      });
    } catch (error) {
      console.error('Create meeting error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create meeting.',
        error: error.message
      });
    }
  }

  // Get all meetings
  static async getMeetings(req, res) {
    try {
      const {
        search,
        projectId,
        type,
        status,
        startDate,
        endDate,
        departmentId,
        departmentName,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : undefined,
        type,
        status,
        startDate,
        endDate,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        departmentName,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const meetings = await Meeting.findAll(filters);
      const stats = await Meeting.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: meetings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total
        },
        stats: {
          total: stats.total,
          scheduled: stats.scheduled,
          completed: stats.completed,
          today: stats.today
        }
      });
    } catch (error) {
      console.error('Get meetings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch meetings.',
        error: error.message
      });
    }
  }

  // Get meeting by ID
  static async getMeetingById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Meeting ID is required.'
        });
      }

      // Try to find by database ID first
      let meeting = await Meeting.findById(parseInt(id));
      
      // If not found by database ID, try to find by meeting_id
      if (!meeting && isNaN(id)) {
        meeting = await Meeting.findByMeetingId(id);
      }

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found.'
        });
      }

      res.json({
        success: true,
        message: 'Meeting retrieved successfully.',
        data: meeting
      });
    } catch (error) {
      console.error('Get meeting by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch meeting.',
        error: error.message
      });
    }
  }

  // Update meeting
  static async updateMeeting(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Meeting ID is required.'
        });
      }

      // Try to find by database ID first
      let meeting = await Meeting.findById(parseInt(id));
      
      // If not found by database ID, try to find by meeting_id
      if (!meeting && isNaN(id)) {
        meeting = await Meeting.findByMeetingId(id);
      }

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found.'
        });
      }

      // Handle JSON fields
      if (updateData.attendees && typeof updateData.attendees === 'object') {
        updateData.attendees = JSON.stringify(updateData.attendees);
      }
      if (updateData.actionItems && typeof updateData.actionItems === 'object') {
        updateData.actionItems = JSON.stringify(updateData.actionItems);
      }

      const dbId = meeting.dbId || parseInt(id);
      const success = await Meeting.update(dbId, updateData);

      if (success) {
        const updatedMeeting = await Meeting.findById(dbId);
        res.json({
          success: true,
          message: 'Meeting updated successfully.',
          data: updatedMeeting
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update meeting.'
        });
      }
    } catch (error) {
      console.error('Update meeting error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update meeting.',
        error: error.message
      });
    }
  }

  // Delete meeting
  static async deleteMeeting(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Meeting ID is required.'
        });
      }

      // Try to find by database ID first
      let meeting = await Meeting.findById(parseInt(id));
      
      // If not found by database ID, try to find by meeting_id
      if (!meeting && isNaN(id)) {
        meeting = await Meeting.findByMeetingId(id);
      }

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found.'
        });
      }

      const dbId = meeting.dbId || parseInt(id);
      const success = await Meeting.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Meeting deleted successfully.'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete meeting.'
        });
      }
    } catch (error) {
      console.error('Delete meeting error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete meeting.',
        error: error.message
      });
    }
  }

  // ========== Meeting Minutes ==========

  static async createMeetingMinutes(req, res) {
    try {
      const {
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
      } = req.body;

      if (!meetingId || !title || !meetingDate) {
        return res.status(400).json({
          success: false,
          message: 'Meeting ID, title, and meeting date are required.'
        });
      }

      let recordedByNameFinal = recordedByName;
      if ((recordedBy || req.staffId) && !recordedByName) {
        const recorderId = recordedBy || req.staffId;
        try {
          const staff = await Staff.findById(recorderId);
          if (staff) {
            recordedByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const minutes = await MeetingMinutes.create({
        minutesId,
        meetingId,
        projectId: projectId || null,
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
        recordedBy: recordedBy || req.staffId || null,
        recordedByName: recordedByNameFinal,
        status
      });

      res.status(201).json({
        success: true,
        message: 'Meeting minutes created successfully.',
        data: minutes
      });
    } catch (error) {
      console.error('Create meeting minutes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create meeting minutes.',
        error: error.message
      });
    }
  }

  static async getMeetingMinutes(req, res) {
    try {
      const {
        search,
        meetingId,
        projectId,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        meetingId: meetingId ? parseInt(meetingId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        status,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const minutes = await MeetingMinutes.findAll(filters);
      const stats = await MeetingMinutes.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: minutes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          draft: stats.draft || 0,
          finalized: stats.finalized || 0,
          approved: stats.approved || 0,
          archived: stats.archived || 0,
          avgAttendees: stats.avgAttendees ? parseFloat(stats.avgAttendees) : 0,
          totalActionPoints: stats.totalActionPoints || 0
        }
      });
    } catch (error) {
      console.error('Get meeting minutes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch meeting minutes.',
        error: error.message
      });
    }
  }

  static async updateMeetingMinutes(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Minutes ID is required.'
        });
      }

      let minutes = await MeetingMinutes.findById(parseInt(id));
      if (!minutes && isNaN(id)) {
        minutes = await MeetingMinutes.findByMinutesId(id);
      }

      if (!minutes) {
        return res.status(404).json({
          success: false,
          message: 'Meeting minutes not found.'
        });
      }

      if (updateData.approvedBy && !updateData.approvedByName) {
        try {
          const staff = await Staff.findById(updateData.approvedBy);
          if (staff) {
            updateData.approvedByName = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const dbId = minutes.dbId || parseInt(id);
      const success = await MeetingMinutes.update(dbId, updateData);

      if (success) {
        const updatedMinutes = await MeetingMinutes.findById(dbId);
        res.json({
          success: true,
          message: 'Meeting minutes updated successfully.',
          data: updatedMinutes
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update meeting minutes.'
        });
      }
    } catch (error) {
      console.error('Update meeting minutes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update meeting minutes.',
        error: error.message
      });
    }
  }

  // ========== Action Items ==========

  static async createActionItem(req, res) {
    try {
      const {
        actionItemId,
        meetingId,
        minutesId,
        projectId,
        title,
        description,
        assignedTo,
        assignedToName,
        assignedDate,
        dueDate,
        status = 'open',
        priority = 'medium',
        completionPercentage = 0,
        notes,
        createdBy,
        createdByName
      } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Title is required.'
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

      let createdByNameFinal = createdByName;
      if ((createdBy || req.staffId) && !createdByName) {
        const creatorId = createdBy || req.staffId;
        try {
          const staff = await Staff.findById(creatorId);
          if (staff) {
            createdByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const actionItem = await ActionItem.create({
        actionItemId,
        meetingId,
        minutesId,
        projectId: projectId || null,
        title,
        description,
        assignedTo,
        assignedToName: assignedToNameFinal,
        assignedDate,
        dueDate,
        status,
        priority,
        completionPercentage,
        notes,
        createdBy: createdBy || req.staffId || null,
        createdByName: createdByNameFinal
      });

      res.status(201).json({
        success: true,
        message: 'Action item created successfully.',
        data: actionItem
      });
    } catch (error) {
      console.error('Create action item error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create action item.',
        error: error.message
      });
    }
  }

  static async getActionItems(req, res) {
    try {
      const {
        search,
        meetingId,
        minutesId,
        projectId,
        assignedTo,
        status,
        priority,
        overdue,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        meetingId: meetingId ? parseInt(meetingId) : undefined,
        minutesId: minutesId ? parseInt(minutesId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
        status,
        priority,
        overdue: overdue === 'true' || overdue === true,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const actionItems = await ActionItem.findAll(filters);
      const stats = await ActionItem.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: actionItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          open: stats.open || 0,
          inProgress: stats.inProgress || 0,
          completed: stats.completed || 0,
          cancelled: stats.cancelled || 0,
          onHold: stats.onHold || 0,
          overdue: stats.overdue || 0,
          urgent: stats.urgent || 0,
          high: stats.high || 0,
          avgCompletion: stats.avgCompletion ? parseFloat(stats.avgCompletion) : 0
        }
      });
    } catch (error) {
      console.error('Get action items error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch action items.',
        error: error.message
      });
    }
  }

  static async updateActionItem(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Action item ID is required.'
        });
      }

      let actionItem = await ActionItem.findById(parseInt(id));
      if (!actionItem && isNaN(id)) {
        actionItem = await ActionItem.findByActionItemId(id);
      }

      if (!actionItem) {
        return res.status(404).json({
          success: false,
          message: 'Action item not found.'
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

      const dbId = actionItem.dbId || parseInt(id);
      const success = await ActionItem.update(dbId, updateData);

      if (success) {
        const updatedActionItem = await ActionItem.findById(dbId);
        res.json({
          success: true,
          message: 'Action item updated successfully.',
          data: updatedActionItem
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update action item.'
        });
      }
    } catch (error) {
      console.error('Update action item error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update action item.',
        error: error.message
      });
    }
  }

  // ========== Responsibilities ==========

  static async createResponsibility(req, res) {
    try {
      const {
        responsibilityId,
        actionItemId,
        meetingId,
        projectId,
        title,
        description,
        assignedTo,
        assignedToName,
        assignedDate,
        dueDate,
        status = 'pending',
        priority = 'medium',
        responsibilityType = 'action_item',
        relatedItemType,
        relatedItemId,
        completionPercentage = 0,
        notes,
        createdBy,
        createdByName
      } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Title is required.'
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

      let createdByNameFinal = createdByName;
      if ((createdBy || req.staffId) && !createdByName) {
        const creatorId = createdBy || req.staffId;
        try {
          const staff = await Staff.findById(creatorId);
          if (staff) {
            createdByNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      const responsibility = await Responsibility.create({
        responsibilityId,
        actionItemId,
        meetingId,
        projectId: projectId || null,
        title,
        description,
        assignedTo,
        assignedToName: assignedToNameFinal,
        assignedDate,
        dueDate,
        status,
        priority,
        responsibilityType,
        relatedItemType,
        relatedItemId,
        completionPercentage,
        notes,
        createdBy: createdBy || req.staffId || null,
        createdByName: createdByNameFinal
      });

      res.status(201).json({
        success: true,
        message: 'Responsibility created successfully.',
        data: responsibility
      });
    } catch (error) {
      console.error('Create responsibility error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create responsibility.',
        error: error.message
      });
    }
  }

  static async getResponsibilities(req, res) {
    try {
      const {
        search,
        actionItemId,
        meetingId,
        projectId,
        assignedTo,
        status,
        priority,
        responsibilityType,
        overdue,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        actionItemId: actionItemId ? parseInt(actionItemId) : undefined,
        meetingId: meetingId ? parseInt(meetingId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
        assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
        status,
        priority,
        responsibilityType,
        overdue: overdue === 'true' || overdue === true,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const responsibilities = await Responsibility.findAll(filters);
      const stats = await Responsibility.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: responsibilities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total || 0
        },
        stats: {
          total: stats.total || 0,
          pending: stats.pending || 0,
          inProgress: stats.inProgress || 0,
          completed: stats.completed || 0,
          cancelled: stats.cancelled || 0,
          deferred: stats.deferred || 0,
          overdue: stats.overdue || 0,
          urgent: stats.urgent || 0,
          high: stats.high || 0,
          avgCompletion: stats.avgCompletion ? parseFloat(stats.avgCompletion) : 0
        }
      });
    } catch (error) {
      console.error('Get responsibilities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch responsibilities.',
        error: error.message
      });
    }
  }

  static async updateResponsibility(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Responsibility ID is required.'
        });
      }

      let responsibility = await Responsibility.findById(parseInt(id));
      if (!responsibility && isNaN(id)) {
        responsibility = await Responsibility.findByResponsibilityId(id);
      }

      if (!responsibility) {
        return res.status(404).json({
          success: false,
          message: 'Responsibility not found.'
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

      const dbId = responsibility.dbId || parseInt(id);
      const success = await Responsibility.update(dbId, updateData);

      if (success) {
        const updatedResponsibility = await Responsibility.findById(dbId);
        res.json({
          success: true,
          message: 'Responsibility updated successfully.',
          data: updatedResponsibility
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update responsibility.'
        });
      }
    } catch (error) {
      console.error('Update responsibility error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update responsibility.',
        error: error.message
      });
    }
  }
}
