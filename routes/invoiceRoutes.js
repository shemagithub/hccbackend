import express from 'express';
import { InvoiceController } from '../controllers/invoiceController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Invoice routes - all require authentication
router.use(authenticate);

router.post('/', InvoiceController.createInvoice);
router.get('/', InvoiceController.getInvoices);
router.get('/stats', InvoiceController.getInvoiceStats);
router.get('/:id', InvoiceController.getInvoiceById);
router.put('/:id', InvoiceController.updateInvoice);
router.delete('/:id', InvoiceController.deleteInvoice);

export default router;

