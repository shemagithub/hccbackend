import express from 'express';
import { VendorPaymentController } from '../controllers/vendorPaymentController.js';

const router = express.Router();

router.post('/', VendorPaymentController.createVendorPayment);
router.get('/', VendorPaymentController.getVendorPayments);
router.get('/:id', VendorPaymentController.getVendorPaymentById);
router.put('/:id', VendorPaymentController.updateVendorPayment);
router.delete('/:id', VendorPaymentController.deleteVendorPayment);

export default router;
