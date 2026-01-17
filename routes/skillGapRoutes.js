import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as skillGapController from '../controllers/skillGapController.js';

const router = express.Router();

router.get('/', authenticate, skillGapController.getSkillGaps);
router.get('/:id', authenticate, skillGapController.getSkillGapById);
router.post('/', authenticate, skillGapController.createSkillGap);
router.put('/:id', authenticate, skillGapController.updateSkillGap);
router.delete('/:id', authenticate, skillGapController.deleteSkillGap);

export default router;
