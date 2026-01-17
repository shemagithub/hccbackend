import express from 'express';
import { TaxManagementController } from '../controllers/taxManagementController.js';

const router = express.Router();

router.post('/', TaxManagementController.createTax);
router.get('/', TaxManagementController.getTaxes);
router.get('/:id', TaxManagementController.getTaxById);
router.put('/:id', TaxManagementController.updateTax);
router.delete('/:id', TaxManagementController.deleteTax);

export default router;
