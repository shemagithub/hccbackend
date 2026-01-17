import express from 'express';
import { BonusController } from '../controllers/bonusController.js';

const router = express.Router();

router.post('/', BonusController.createBonus);
router.get('/', BonusController.getBonuses);
router.get('/:id', BonusController.getBonusById);
router.put('/:id', BonusController.updateBonus);
router.delete('/:id', BonusController.deleteBonus);

export default router;
