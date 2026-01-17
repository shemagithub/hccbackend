import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as trainingController from '../controllers/trainingController.js';

const router = express.Router();

router.get('/', authenticate, trainingController.getTrainings);
router.get('/:id', authenticate, trainingController.getTrainingById);
router.post('/', authenticate, trainingController.createTraining);
router.put('/:id', authenticate, trainingController.updateTraining);
router.delete('/:id', authenticate, trainingController.deleteTraining);

export default router;
