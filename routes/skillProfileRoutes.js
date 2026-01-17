import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as skillProfileController from '../controllers/skillProfileController.js';

const router = express.Router();

router.get('/', authenticate, skillProfileController.getSkillProfiles);
router.get('/:id', authenticate, skillProfileController.getSkillProfileById);
router.post('/', authenticate, skillProfileController.createSkillProfile);
router.put('/:id', authenticate, skillProfileController.updateSkillProfile);
router.delete('/:id', authenticate, skillProfileController.deleteSkillProfile);

export default router;
