import Bonus from '../models/Bonus.js';

export class BonusController {
  static async createBonus(req, res) {
    try {
      const {
        bonusId, staffId, bonusType, amount, currency, paymentPeriod,
        paymentDate, status, description, notes, approvedBy, approvedByName, approvalDate
      } = req.body;

      const user = req.user || {};
      const createdBy = user.id || req.staffId || null;
      const createdByName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null;

      if (!staffId || !bonusType || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Staff ID, bonus type, and amount are required'
        });
      }

      const bonus = await Bonus.create({
        bonusId, staffId, bonusType, amount, currency: currency || 'USD',
        paymentPeriod, paymentDate, status: status || 'pending', description, notes,
        approvedBy, approvedByName, approvalDate, createdBy, createdByName
      });

      res.status(201).json({
        success: true,
        message: 'Bonus created successfully',
        data: bonus
      });
    } catch (error) {
      console.error('Create bonus error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create bonus',
        error: error.message
      });
    }
  }

  static async getBonuses(req, res) {
    try {
      const { staffId, bonusType, status, paymentPeriod, search, startDate, endDate, page = 1, limit = 50 } = req.query;
      const filters = {
        staffId: staffId ? parseInt(staffId) : undefined, bonusType, status, paymentPeriod, search, startDate, endDate,
        limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit)
      };
      const bonuses = await Bonus.findAll(filters);
      const stats = await Bonus.getStats(filters);
      res.json({
        success: true,
        data: bonuses,
        stats,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: stats.total || 0 }
      });
    } catch (error) {
      console.error('Get bonuses error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch bonuses', error: error.message });
    }
  }

  static async getBonusById(req, res) {
    try {
      const { id } = req.params;
      const bonus = await Bonus.findById(parseInt(id));
      if (!bonus) return res.status(404).json({ success: false, message: 'Bonus not found' });
      res.json({ success: true, data: bonus });
    } catch (error) {
      console.error('Get bonus error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch bonus', error: error.message });
    }
  }

  static async updateBonus(req, res) {
    try {
      const { id } = req.params;
      const bonus = await Bonus.findById(parseInt(id));
      if (!bonus) return res.status(404).json({ success: false, message: 'Bonus not found' });
      const updatedBonus = await Bonus.update(parseInt(id), req.body);
      res.json({ success: true, message: 'Bonus updated successfully', data: updatedBonus });
    } catch (error) {
      console.error('Update bonus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update bonus', error: error.message });
    }
  }

  static async deleteBonus(req, res) {
    try {
      const { id } = req.params;
      const bonus = await Bonus.findById(parseInt(id));
      if (!bonus) return res.status(404).json({ success: false, message: 'Bonus not found' });
      await Bonus.delete(parseInt(id));
      res.json({ success: true, message: 'Bonus deleted successfully' });
    } catch (error) {
      console.error('Delete bonus error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete bonus', error: error.message });
    }
  }
}
