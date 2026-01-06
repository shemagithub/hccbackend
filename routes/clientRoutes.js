import express from 'express';
import { ClientController } from '../controllers/clientController.js';

const router = express.Router();

router.post('/', ClientController.createClient);
router.get('/stats', ClientController.getClientStats);
router.get('/:id', ClientController.getClientById);
router.put('/:id', ClientController.updateClient);
router.delete('/:id', ClientController.deleteClient);
router.get('/', ClientController.getClients);

export default router;

