import express from 'express';
import { DocumentController } from '../controllers/documentController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Document routes
router.post('/', DocumentController.createDocument);
router.get('/', DocumentController.getDocuments);
router.get('/stats', DocumentController.getDocumentStats);
router.get('/:id', DocumentController.getDocumentById);
router.put('/:id', DocumentController.updateDocument);
router.delete('/:id', DocumentController.deleteDocument);

export default router;

