import express from 'express';
import { SupplierInvoiceController } from '../controllers/supplierInvoiceController.js';

const router = express.Router();

router.post('/', SupplierInvoiceController.createSupplierInvoice);
router.get('/', SupplierInvoiceController.getSupplierInvoices);
router.get('/:id', SupplierInvoiceController.getSupplierInvoiceById);
router.put('/:id', SupplierInvoiceController.updateSupplierInvoice);
router.delete('/:id', SupplierInvoiceController.deleteSupplierInvoice);

export default router;
