import express from 'express';
import { NotificationController } from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new notification (for system/admin use)
router.post('/', NotificationController.createNotification);

// Get all notifications for the authenticated user
router.get('/', NotificationController.getNotifications);

// Get notification statistics
router.get('/stats', NotificationController.getNotificationStats);

// Mark all notifications as read
router.post('/mark-all-read', NotificationController.markAllAsRead);

// Get notification by ID
router.get('/:id', NotificationController.getNotificationById);

// Mark notification as read
router.post('/:id/read', NotificationController.markAsRead);

// Update notification
router.put('/:id', NotificationController.updateNotification);

// Delete notification
router.delete('/:id', NotificationController.deleteNotification);

export default router;
