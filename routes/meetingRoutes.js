import express from 'express';
import { MeetingController } from '../controllers/meetingController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new meeting
router.post('/', MeetingController.createMeeting);

// Get all meetings
router.get('/', MeetingController.getMeetings);

// Get meeting by ID
router.get('/:id', MeetingController.getMeetingById);

// Update meeting
router.put('/:id', MeetingController.updateMeeting);

// Delete meeting
router.delete('/:id', MeetingController.deleteMeeting);

// Meeting Minutes routes
router.post('/minutes', MeetingController.createMeetingMinutes);
router.get('/minutes', MeetingController.getMeetingMinutes);
router.put('/minutes/:id', MeetingController.updateMeetingMinutes);

// Action Items routes
router.post('/action-items', MeetingController.createActionItem);
router.get('/action-items', MeetingController.getActionItems);
router.put('/action-items/:id', MeetingController.updateActionItem);

// Responsibilities routes
router.post('/responsibilities', MeetingController.createResponsibility);
router.get('/responsibilities', MeetingController.getResponsibilities);
router.put('/responsibilities/:id', MeetingController.updateResponsibility);

export default router;
