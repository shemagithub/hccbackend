import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as supportTicketController from '../controllers/supportTicketController.js';

const router = express.Router();

router.get('/', authenticate, supportTicketController.getSupportTickets);
router.get('/stats', authenticate, supportTicketController.getTicketStats);
router.get('/:id', authenticate, supportTicketController.getSupportTicketById);
router.post('/', authenticate, supportTicketController.createSupportTicket);
router.put('/:id', authenticate, supportTicketController.updateSupportTicket);
router.delete('/:id', authenticate, supportTicketController.deleteSupportTicket);
router.post('/:id/messages', authenticate, supportTicketController.addTicketMessage);

export default router;
