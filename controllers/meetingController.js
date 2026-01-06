import Meeting from '../models/Meeting.js';
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
}
