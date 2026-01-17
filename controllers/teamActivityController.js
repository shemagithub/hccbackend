import pool from '../config/db.js';

export class TeamActivityController {
  // Get team activity from all projects - Focus on tasks from teams
  static async getTeamActivity(req, res) {
    try {
      console.log('📊 Fetching team activity (tasks) from all projects...');
      const { limit = 50 } = req.query;

      const activities = [];

      // Fetch tasks from teams across different projects
      try {
        const [taskRows] = await pool.execute(`
          SELECT 
            t.id,
            t.task_id,
            t.project_id,
            t.title,
            t.status,
            t.priority,
            t.progress,
            t.updated_at,
            t.created_at,
            t.assignee_id,
            t.assignee_name,
            p.name as project_name,
            p.project_id as project_code,
            s.first_name,
            s.last_name,
            s.profile_image,
            s.position,
            s.email
          FROM tasks t
          LEFT JOIN projects p ON t.project_id = p.id
          LEFT JOIN staff s ON t.assignee_id = s.id
          WHERE t.assignee_id IS NOT NULL
            AND t.status IN ('in_progress', 'completed', 'pending')
            AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          ORDER BY t.updated_at DESC
          LIMIT ?
        `, [parseInt(limit)]);

        taskRows.forEach(row => {
          const userName = row.assignee_name || 
            (row.first_name && row.last_name 
              ? `${row.first_name} ${row.last_name}` 
              : 'Unknown Team Member');
          
          let action = '';
          if (row.status === 'completed') {
            action = `Completed task - ${row.title || 'Untitled Task'}`;
          } else if (row.status === 'in_progress') {
            action = `Working on task - ${row.title || 'Untitled Task'}`;
          } else {
            action = `Assigned to task - ${row.title || 'Untitled Task'}`;
          }

          activities.push({
            id: `task-${row.id}`,
            type: 'task',
            action: action,
            project: row.project_name || 'N/A',
            projectId: row.project_id,
            projectCode: row.project_code,
            user: userName,
            userId: row.assignee_id,
            avatar: row.profile_image,
            timestamp: row.updated_at || row.created_at,
            metadata: {
              taskId: row.task_id,
              status: row.status,
              priority: row.priority,
              progress: row.progress,
              position: row.position
            }
          });
        });
      } catch (error) {
        console.error('Error fetching task activities:', error);
      }


      // Sort all activities by timestamp (most recent first)
      activities.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      // Limit results
      const limitedActivities = activities.slice(0, parseInt(limit));

      // Get online staff members (team members with active tasks in last 24 hours)
      const [onlineStaffRows] = await pool.execute(`
        SELECT DISTINCT
          s.id,
          s.first_name,
          s.last_name,
          s.profile_image,
          s.position,
          s.role
        FROM staff s
        WHERE s.status = 'active'
          AND s.id IN (
            SELECT DISTINCT assignee_id 
            FROM tasks 
            WHERE assignee_id IS NOT NULL
              AND updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
              AND status IN ('in_progress', 'pending', 'completed')
          )
        ORDER BY s.first_name, s.last_name
        LIMIT 10
      `);

      const onlineUsers = onlineStaffRows.map(row => ({
        id: row.id,
        name: `${row.first_name} ${row.last_name}`,
        avatar: row.profile_image,
        role: row.position || row.role
      }));

      res.json({
        success: true,
        data: {
          activities: limitedActivities,
          onlineUsers: onlineUsers,
          totalActivities: activities.length
        }
      });
    } catch (error) {
      console.error('❌ Get team activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch team activity.',
        error: error.message
      });
    }
  }
}
