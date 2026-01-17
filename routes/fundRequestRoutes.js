import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as fundRequestController from '../controllers/fundRequestController.js';

const router = express.Router();

router.get('/', authenticate, fundRequestController.getFundRequests);
router.get('/:id', authenticate, fundRequestController.getFundRequestById);
router.post('/', authenticate, fundRequestController.createFundRequest);
router.put('/:id', authenticate, fundRequestController.updateFundRequest);
router.delete('/:id', authenticate, fundRequestController.deleteFundRequest);

export default router;
