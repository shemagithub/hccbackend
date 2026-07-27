import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { MailController } from '../controllers/mailController.js';

const router = express.Router();

router.use(authenticate);

router.get('/account', MailController.getAccount);
router.get('/folders', MailController.listFolders);
router.get('/messages', MailController.listMessages);
router.get('/messages/:uid/attachments/:attachmentId', MailController.downloadAttachment);
router.get('/messages/:uid', MailController.getMessage);
router.post('/send', MailController.send);
router.post('/client-update', MailController.sendClientUpdate);
router.patch('/messages/:uid/flags', MailController.updateFlags);
router.post('/messages/:uid/move', MailController.move);
router.delete('/messages/:uid', MailController.remove);

export default router;
