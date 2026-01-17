import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as workBreakdownController from '../controllers/workBreakdownController.js';

const router = express.Router();

router.get('/', authenticate, workBreakdownController.getWorkBreakdowns);
router.get('/:id', authenticate, workBreakdownController.getWorkBreakdownById);
router.post('/', authenticate, workBreakdownController.createWorkBreakdown);
router.put('/:id', authenticate, workBreakdownController.updateWorkBreakdown);
router.delete('/:id', authenticate, workBreakdownController.deleteWorkBreakdown);

export default router;
