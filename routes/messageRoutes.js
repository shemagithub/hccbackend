import express from 'express';
import { MessageController } from '../controllers/messageController.js';

const router = express.Router();

// Message routes
router.post('/', MessageController.createMessage);
router.get('/conversations/:userId', MessageController.getConversations);
router.get('/staff/:userId', MessageController.getAllStaff);
router.get('/', MessageController.getMessages);
router.put('/mark-read', MessageController.markAsRead);
router.put('/:id/status', MessageController.updateMessageStatus);
router.delete('/:id', MessageController.deleteMessage);
router.delete('/clear', MessageController.clearConversation);
router.get('/stats/:userId', MessageController.getMessageStats);

export default router;
