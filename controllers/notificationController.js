import Notification from '../models/Notification.js';
import Staff from '../models/Staff.js';

export class NotificationController {
  // Create a new notification
  static async createNotification(req, res) {
    try {
      const {
        notificationId,
        recipientId,
        recipientName,
        title,
        message,
        type = 'info',
        category = 'other',
        priority = 'medium',
        projectId,
        relatedItemType,
        relatedItemId,
        actionUrl,
        metadata,
        createdBy,
        createdByName
      } = req.body;

      if (!recipientId || !title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Recipient ID, title, and message are required.'
        });
      }

      // Get recipient name if not provided
      let recipientNameFinal = recipientName;
      if (!recipientName) {
        try {
          const staff = await Staff.findById(recipientId);
          if (staff) {
            recipientNameFinal = `${staff.firstName} ${staff.lastName}`;
          }
        } catch (staffError) {
          console.error('Error fetching staff info:', staffError);
        }
      }

      // Get creator name if not provided
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

      const notification = await Notification.create({
        notificationId,
        recipientId,
        recipientName: recipientNameFinal,
        title,
        message,
        type,
        category,
        priority,
        projectId: projectId || null,
        relatedItemType: relatedItemType || null,
        relatedItemId: relatedItemId || null,
        actionUrl: actionUrl || null,
        metadata: metadata || null,
        createdBy: createdBy || req.staffId || null,
        createdByName: createdByNameFinal
      });

      res.status(201).json({
        success: true,
        message: 'Notification created successfully.',
        data: notification
      });
    } catch (error) {
      console.error('Create notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create notification.',
        error: error.message
      });
    }
  }

  // Get all notifications for the authenticated user
  static async getNotifications(req, res) {
    try {
      const {
        status,
        isRead,
        type,
        category,
        priority,
        projectId,
        search,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        recipientId: req.staffId,
        status: status && status !== 'all' ? status : undefined,
        isRead: isRead !== undefined ? isRead === 'true' : undefined,
        type,
        category,
        priority,
        projectId: projectId ? parseInt(projectId) : undefined,
        search,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      const notifications = await Notification.findAll(filters);
      const stats = await Notification.getStats(req.staffId);

      res.json({
        success: true,
        data: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(stats.total || 0)
        },
        stats: {
          total: parseInt(stats.total || 0),
          unread: parseInt(stats.unread || 0),
          read: parseInt(stats.read || 0),
          archived: parseInt(stats.archived || 0),
          urgent: parseInt(stats.urgent || 0),
          warning: parseInt(stats.warning || 0),
          success: parseInt(stats.success || 0),
          info: parseInt(stats.info || 0)
        }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications.',
        error: error.message
      });
    }
  }

  // Get notification by ID
  static async getNotificationById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Notification ID is required.'
        });
      }

      let notification = await Notification.findById(parseInt(id));
      if (!notification && isNaN(id)) {
        notification = await Notification.findByNotificationId(id);
      }

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found.'
        });
      }

      // Check if user is the recipient
      if (notification.recipientId !== req.staffId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this notification.'
        });
      }

      res.json({
        success: true,
        message: 'Notification retrieved successfully.',
        data: notification
      });
    } catch (error) {
      console.error('Get notification by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification.',
        error: error.message
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Notification ID is required.'
        });
      }

      let notification = await Notification.findById(parseInt(id));
      if (!notification && isNaN(id)) {
        notification = await Notification.findByNotificationId(id);
      }

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found.'
        });
      }

      // Check if user is the recipient
      if (notification.recipientId !== req.staffId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this notification.'
        });
      }

      const dbId = notification.dbId || parseInt(id);
      const success = await Notification.markAsRead(dbId);

      if (success) {
        const updatedNotification = await Notification.findById(dbId);
        res.json({
          success: true,
          message: 'Notification marked as read.',
          data: updatedNotification
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to mark notification as read.'
        });
      }
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read.',
        error: error.message
      });
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(req, res) {
    try {
      const count = await Notification.markAllAsRead(req.staffId);

      res.json({
        success: true,
        message: `Marked ${count} notifications as read.`,
        count
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read.',
        error: error.message
      });
    }
  }

  // Update notification
  static async updateNotification(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Notification ID is required.'
        });
      }

      let notification = await Notification.findById(parseInt(id));
      if (!notification && isNaN(id)) {
        notification = await Notification.findByNotificationId(id);
      }

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found.'
        });
      }

      // Check if user is the recipient
      if (notification.recipientId !== req.staffId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this notification.'
        });
      }

      const dbId = notification.dbId || parseInt(id);
      const success = await Notification.update(dbId, updateData);

      if (success) {
        const updatedNotification = await Notification.findById(dbId);
        res.json({
          success: true,
          message: 'Notification updated successfully.',
          data: updatedNotification
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update notification.'
        });
      }
    } catch (error) {
      console.error('Update notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification.',
        error: error.message
      });
    }
  }

  // Delete notification
  static async deleteNotification(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Notification ID is required.'
        });
      }

      let notification = await Notification.findById(parseInt(id));
      if (!notification && isNaN(id)) {
        notification = await Notification.findByNotificationId(id);
      }

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found.'
        });
      }

      // Check if user is the recipient
      if (notification.recipientId !== req.staffId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this notification.'
        });
      }

      const dbId = notification.dbId || parseInt(id);
      const success = await Notification.delete(dbId);

      if (success) {
        res.json({
          success: true,
          message: 'Notification deleted successfully.'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete notification.'
        });
      }
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification.',
        error: error.message
      });
    }
  }

  // Get notification statistics
  static async getNotificationStats(req, res) {
    try {
      const stats = await Notification.getStats(req.staffId);

      res.json({
        success: true,
        data: {
          total: parseInt(stats.total || 0),
          unread: parseInt(stats.unread || 0),
          read: parseInt(stats.read || 0),
          archived: parseInt(stats.archived || 0),
          urgent: parseInt(stats.urgent || 0),
          warning: parseInt(stats.warning || 0),
          success: parseInt(stats.success || 0),
          info: parseInt(stats.info || 0),
          urgentPriority: parseInt(stats.urgentPriority || 0),
          highPriority: parseInt(stats.highPriority || 0)
        }
      });
    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification statistics.',
        error: error.message
      });
    }
  }
}
