import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as receptionController from '../controllers/receptionController.js';

const router = express.Router();

router.get('/stats', authenticate, receptionController.getStats);

router.get('/visitors', authenticate, receptionController.listVisitors);
router.get('/visitors/:id', authenticate, receptionController.getVisitor);
router.post('/visitors', authenticate, receptionController.createVisitor);
router.put('/visitors/:id', authenticate, receptionController.updateVisitor);
router.delete('/visitors/:id', authenticate, receptionController.deleteVisitor);

router.get('/appointments', authenticate, receptionController.listAppointments);
router.get('/appointments/:id', authenticate, receptionController.getAppointment);
router.post('/appointments', authenticate, receptionController.createAppointment);
router.put('/appointments/:id', authenticate, receptionController.updateAppointment);
router.delete('/appointments/:id', authenticate, receptionController.deleteAppointment);

router.get('/calls', authenticate, receptionController.listCalls);
router.get('/calls/:id', authenticate, receptionController.getCall);
router.post('/calls', authenticate, receptionController.createCall);
router.put('/calls/:id', authenticate, receptionController.updateCall);
router.delete('/calls/:id', authenticate, receptionController.deleteCall);

export default router;
