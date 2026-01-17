import express from 'express';
import { DeductionController } from '../controllers/deductionController.js';

const router = express.Router();

router.post('/', DeductionController.createDeduction);
router.get('/', DeductionController.getDeductions);
router.get('/:id', DeductionController.getDeductionById);
router.put('/:id', DeductionController.updateDeduction);
router.delete('/:id', DeductionController.deleteDeduction);

export default router;
