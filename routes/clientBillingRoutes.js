import express from 'express';
import { ClientBillingController } from '../controllers/clientBillingController.js';

const router = express.Router();

router.post('/', ClientBillingController.createClientBilling);
router.get('/', ClientBillingController.getClientBillings);
router.get('/stats', ClientBillingController.getClientBillingStats);
router.get('/:id', ClientBillingController.getClientBillingById);
router.put('/:id', ClientBillingController.updateClientBilling);
router.delete('/:id', ClientBillingController.deleteClientBilling);

export default router;
