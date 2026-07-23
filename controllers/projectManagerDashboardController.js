import { buildManagerDashboard } from '../utils/managerDashboard.js';

export class ProjectManagerDashboardController {
  static async getDashboard(req, res) {
    try {
      if (!req.staffId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const data = await buildManagerDashboard(req.staffId);
      if (!data) {
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error('Get project manager dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load project manager dashboard',
        error: error.message,
      });
    }
  }
}
