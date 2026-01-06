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

export default router;
