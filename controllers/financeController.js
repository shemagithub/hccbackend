import { buildFinanceOverview } from '../utils/financeAggregation.js';

export class FinanceController {
  static async getDashboard(req, res) {
    try {
      const { departmentId } = req.query;
      const data = await buildFinanceOverview({
        staffId: req.staffId,
        departmentId: departmentId ? Number(departmentId) : undefined,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('Get finance dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch finance dashboard',
        error: error.message,
      });
    }
  }

  static async getProjectsOverview(req, res) {
    try {
      const { departmentId } = req.query;
      const data = await buildFinanceOverview({
        staffId: req.staffId,
        departmentId: departmentId ? Number(departmentId) : undefined,
      });

      res.json({
        success: true,
        data: {
          stats: data.stats,
          projects: data.projects,
        },
      });
    } catch (error) {
      console.error('Get finance projects overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch project financial overview',
        error: error.message,
      });
    }
  }
}
