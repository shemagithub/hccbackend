import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as skillController from '../controllers/skillController.js';

const router = express.Router();

router.get('/', authenticate, skillController.getSkills);
router.get('/:id', authenticate, skillController.getSkillById);
router.post('/', authenticate, skillController.createSkill);
router.put('/:id', authenticate, skillController.updateSkill);
router.delete('/:id', authenticate, skillController.deleteSkill);

export default router;
