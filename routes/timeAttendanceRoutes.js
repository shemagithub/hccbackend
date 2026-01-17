import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as timeAttendanceController from '../controllers/timeAttendanceController.js';

const router = express.Router();

router.get('/', authenticate, timeAttendanceController.getTimeAttendances);
router.get('/:id', authenticate, timeAttendanceController.getTimeAttendanceById);
router.post('/', authenticate, timeAttendanceController.createTimeAttendance);
router.put('/:id', authenticate, timeAttendanceController.updateTimeAttendance);
router.delete('/:id', authenticate, timeAttendanceController.deleteTimeAttendance);

export default router;
