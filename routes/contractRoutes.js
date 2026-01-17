import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
} from '../controllers/contractController.js';

const router = express.Router();

router.get('/', authenticate, getContracts);
router.get('/:id', authenticate, getContractById);
router.post('/', authenticate, createContract);
router.put('/:id', authenticate, updateContract);
router.delete('/:id', authenticate, deleteContract);

export default router;

