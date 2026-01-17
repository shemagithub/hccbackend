import express from 'express';
import { SalaryPaymentController } from '../controllers/salaryPaymentController.js';

const router = express.Router();

router.post('/', SalaryPaymentController.createSalaryPayment);
router.get('/', SalaryPaymentController.getSalaryPayments);
router.get('/:id', SalaryPaymentController.getSalaryPaymentById);
router.put('/:id', SalaryPaymentController.updateSalaryPayment);
router.delete('/:id', SalaryPaymentController.deleteSalaryPayment);

export default router;
