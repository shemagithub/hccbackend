import SkillProfile from '../models/SkillProfile.js';
import Skill from '../models/Skill.js';
import ProjectAssignment from '../models/ProjectAssignment.js';
import Availability from '../models/Availability.js';
import Staff from '../models/Staff.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import WorkReport from '../models/WorkReport.js';
import Deliverable from '../models/Deliverable.js';
import Performance from '../models/Performance.js';
import Training from '../models/Training.js';
import SkillGap from '../models/SkillGap.js';
import TeamMember from '../models/TeamMember.js';
import Team from '../models/Team.js';

export class TeamSkillsController {
  // Get comprehensive employee information for team leader
  static async getEmployeeInfo(req, res) {
    try {
      const { staffId } = req.params;
      const staffIdNum = parseInt(staffId);

      if (!staffIdNum || isNaN(staffIdNum)) {
        return res.status(400).json({
          success: false,
          message: 'Valid staff ID is required.'
        });
      }

      // Get staff basic info
      const staff = await Staff.findById(staffIdNum);
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found.'
        });
      }

      // Get skill profiles
      const skillProfiles = await SkillProfile.findAll({ staffId: staffIdNum, limit: 1000 });

      // Get project assignments
      const assignments = await ProjectAssignment.findAll({ staffId: staffIdNum, limit: 1000 });

      // Get availability
      const today = new Date().toISOString().split('T')[0];
      const availability = await Availability.findAll({
        staffId: staffIdNum,
        startDate: today,
        limit: 100
      });

      // Get tasks assigned to this employee
      const tasks = await Task.findAll({ assigneeId: staffIdNum, limit: 1000 });

      // Get work reports
      const workReports = await WorkReport.findAll({ staffId: staffIdNum, limit: 100 });

      // Get deliverables
      const deliverables = await Deliverable.findAll({ limit: 1000 });
      const employeeDeliverables = deliverables.filter(d => {
        const submittedById = d.submittedBy;
        return submittedById === staffIdNum || 
               (d.submittedByName && (
                 d.submittedByName.includes(staff.firstName) ||
                 d.submittedByName.includes(`${staff.firstName} ${staff.lastName}`)
               ));
      });

      // Get performance records
      const performanceRecords = await Performance.findAll({ 
        staffId: staffIdNum, 
        limit: 100 
      });

      // Get training records
      const trainingRecords = await Training.findAll({ 
        staffId: staffIdNum, 
        limit: 100 
      });

      // Calculate statistics
      const stats = {
        totalSkills: skillProfiles.length,
        activeProjects: assignments.filter(a => a.status === 'active').length,
        completedProjects: assignments.filter(a => a.status === 'completed').length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        overdueTasks: tasks.filter(t => t.status === 'overdue').length,
        totalWorkReports: workReports.length,
        totalDeliverables: employeeDeliverables.length,
        approvedDeliverables: employeeDeliverables.filter(d => d.status === 'approved').length,
        averageAvailability: availability.length > 0
          ? availability.reduce((sum, a) => sum + (parseFloat(a.capacityPercentage) || 100), 0) / availability.length
          : 100,
        totalTraining: trainingRecords.length,
        completedTraining: trainingRecords.filter(t => t.status === 'completed').length
      };

      res.json({
        success: true,
        data: {
          employee: staff,
          skillProfiles,
          projectAssignments: assignments,
          availability: availability.slice(0, 30), // Last 30 days
          tasks,
          workReports,
          deliverables: employeeDeliverables,
          performance: performanceRecords,
          training: trainingRecords,
          stats
        }
      });
    } catch (error) {
      console.error('Get employee info error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee information.',
        error: error.message
      });
    }
  }

  // Get team membership and leader info for an employee
  static async getEmployeeTeams(req, res) {
    try {
      const { staffId } = req.params;
      const staffIdNum = parseInt(staffId);

      if (!staffIdNum || isNaN(staffIdNum)) {
        return res.status(400).json({
          success: false,
          message: 'Valid staff ID is required.',
        });
      }

      const staff = await Staff.findById(staffIdNum);
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found.',
        });
      }

      // Get all teams this staff belongs to
      const memberships = await TeamMember.getTeamsForStaff(staffIdNum);

      if (!memberships || memberships.length === 0) {
        return res.json({
          success: true,
          data: {
            employee: {
              id: staff.id || staff.dbId,
              firstName: staff.firstName,
              lastName: staff.lastName,
              email: staff.email,
              position: staff.position,
              departmentId: staff.departmentId,
              departmentName: staff.departmentName,
            },
            teams: [],
          },
        });
      }

      const projectIds = Array.from(
        new Set(
          memberships
            .map((m) => m.project_id)
            .filter((pid) => pid !== null && pid !== undefined),
        ),
      );

      // Load basic project info
      let projectsById = {};
      if (projectIds.length > 0) {
        const placeholders = projectIds.map(() => '?').join(',');
        const [projectRows] = await Project.rawQuery?.(
          `SELECT id, name, project_code, client, status FROM projects WHERE id IN (${placeholders})`,
          projectIds,
        ) || [[], null];

        projectsById = (projectRows || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      // Load leaders for these teams
      const leaderIds = Array.from(
        new Set(
          memberships
            .map((m) => m.leader_id)
            .filter((lid) => lid !== null && lid !== undefined),
        ),
      );

      let leadersById = {};
      if (leaderIds.length > 0) {
        const placeholders = leaderIds.map(() => '?').join(',');
        const [leaderRows] = await Staff.rawQuery?.(
          `SELECT id, first_name, last_name, email, position, department_id, department_name 
           FROM staff WHERE id IN (${placeholders})`,
          leaderIds,
        ) || [[], null];

        leadersById = (leaderRows || []).reduce((acc, l) => {
          acc[l.id] = l;
          return acc;
        }, {});
      }

      const teams = memberships.map((m) => {
        const leader = leadersById[m.leader_id] || null;
        const project = projectsById[m.project_id] || null;

        return {
          teamId: m.team_id,
          teamName: m.team_name,
          role: m.role,
          projectId: m.project_id,
          projectName: project?.name || null,
          projectCode: project?.project_code || null,
          projectClient: project?.client || null,
          projectStatus: project?.status || null,
          leader: leader
            ? {
                id: leader.id,
                firstName: leader.first_name,
                lastName: leader.last_name,
                email: leader.email,
                position: leader.position,
                departmentId: leader.department_id,
                departmentName: leader.department_name,
              }
            : null,
        };
      });

      res.json({
        success: true,
        data: {
          employee: {
            id: staff.id || staff.dbId,
            firstName: staff.firstName,
            lastName: staff.lastName,
            email: staff.email,
            position: staff.position,
            departmentId: staff.departmentId,
            departmentName: staff.departmentName,
          },
          teams,
        },
      });
    } catch (error) {
      console.error('Get employee teams error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee team information.',
        error: error.message,
      });
    }
  }

  // Get team overview with employee information
  static async getTeamOverview(req, res) {
    try {
      const { departmentId, projectId, search } = req.query;
      
      // Handle case where req.staffId might not be set
      let staff = null;
      if (req.staffId) {
        try {
          staff = await Staff.findById(req.staffId);
        } catch (err) {
          console.warn('Could not fetch staff for team overview:', err.message);
        }
      }

      // Build filters
      const staffFilters = {
        status: 'active',
        limit: 10000
      };
      if (departmentId) staffFilters.departmentId = parseInt(departmentId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        // Restrict to staff's department by default
        if (staff.departmentId) {
          staffFilters.departmentId = staff.departmentId;
        }
      }

      // Get all staff
      const allStaff = await Staff.findAll(staffFilters);

      // Get skill profiles for all staff
      const skillProfiles = await SkillProfile.findAll({ limit: 10000 });

      // Get project assignments
      const assignmentFilters = {
        status: 'active',
        limit: 10000
      };
      if (projectId) assignmentFilters.projectId = parseInt(projectId);
      const assignments = await ProjectAssignment.findAll(assignmentFilters);

      // If the logged-in user is a team leader (or has team skills control panel),
      // limit visibility to staff who share projects with them.
      let leaderProjectIds = null;
      if (staff && (staff.controlPanel && typeof staff.controlPanel === 'string')) {
        const cp = staff.controlPanel.toLowerCase();
        const isTeamSkillsLeader =
          cp === 'team-skills' ||
          cp === 'team_skills' ||
          cp.includes('team skills') ||
          (staff.role && String(staff.role).toLowerCase().includes('team'));

        if (isTeamSkillsLeader) {
          try {
            const leaderAssignments = await ProjectAssignment.findAll({
              staffId: staff.id || staff.dbId,
              status: 'active',
              limit: 10000,
            });
            if (leaderAssignments && leaderAssignments.length > 0) {
              leaderProjectIds = new Set(
                leaderAssignments
                  .map((a) => a.projectId)
                  .filter((pid) => pid !== null && pid !== undefined),
              );
            }
          } catch (err) {
            console.warn('Could not load leader project assignments for team overview:', err.message);
          }
        }
      }

      // Get availability
      const today = new Date().toISOString().split('T')[0];
      const availability = await Availability.findAll({
        startDate: today,
        limit: 10000
      });

      // Get tasks
      const taskFilters = { limit: 10000 };
      if (projectId) taskFilters.projectId = parseInt(projectId);
      const tasks = await Task.findAll(taskFilters);

      // Aggregate employee data
      const teamMembers = allStaff.map(employee => {
        const employeeId = employee.id || employee.dbId;
        const employeeSkillProfiles = skillProfiles.filter(sp => 
          sp.staffId === employee.id || sp.staffId === employee.dbId || sp.staffId === employeeId
        );
        const employeeAssignments = assignments.filter(a => 
          a.staffId === employee.id || a.staffId === employee.dbId || a.staffId === employeeId
        );
        const employeeAvailability = availability.filter(a => 
          a.staffId === employee.id || a.staffId === employee.dbId || a.staffId === employeeId
        );
        const employeeTasks = tasks.filter(t => {
          if (t.assigneeId === employee.id || t.assigneeId === employee.dbId || t.assigneeId === employeeId) {
            return true;
          }
          // Check assigneeIds array
          if (t.assigneeIds) {
            try {
              const assigneeIds = typeof t.assigneeIds === 'string' ? JSON.parse(t.assigneeIds) : t.assigneeIds;
              if (Array.isArray(assigneeIds)) {
                return assigneeIds.includes(employee.id) || assigneeIds.includes(employee.dbId) || assigneeIds.includes(employeeId);
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
          return false;
        });

        const avgAvailability = employeeAvailability.length > 0
          ? employeeAvailability.reduce((sum, a) => sum + (parseFloat(a.capacityPercentage) || 100), 0) / employeeAvailability.length
          : 100;

        return {
          id: employee.id || employee.dbId,
          dbId: employee.dbId || employee.id,
          firstName: employee.firstName || '',
          lastName: employee.lastName || '',
          email: employee.email || '',
          role: employee.role || '',
          department: employee.department || '',
          departmentId: employee.departmentId || null,
          position: employee.position || '',
          status: employee.status || 'active',
          projectIds: employeeAssignments.map(a => a.projectId).filter(Boolean),
          skills: employeeSkillProfiles.map(sp => ({
            skillName: sp.skillName || '',
            level: sp.level || 0,
            levelLabel: sp.levelLabel || '',
            yearsExperience: sp.yearsExperience || 0
          })),
          totalSkills: employeeSkillProfiles.length,
          activeProjects: employeeAssignments.filter(a => a.status === 'active').length,
          totalTasks: employeeTasks.length,
          completedTasks: employeeTasks.filter(t => t.status === 'completed').length,
          availability: Math.round(avgAvailability || 100),
          workload: employeeAssignments.length
        };
      });

      // Filter by search if provided
      let filteredTeam = teamMembers;

      // If leaderProjectIds is set, only include staff who are assigned to at least
      // one project that the leader is also assigned to. This ensures that team
      // leaders see only their own team members and related resources.
      if (leaderProjectIds && leaderProjectIds.size > 0) {
        filteredTeam = filteredTeam.filter((member) =>
          Array.isArray(member.projectIds) &&
          member.projectIds.some((pid) => leaderProjectIds.has(pid)),
        );
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filteredTeam = teamMembers.filter(member =>
          `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchLower) ||
          member.email.toLowerCase().includes(searchLower) ||
          member.role.toLowerCase().includes(searchLower) ||
          member.skills.some(s => s.skillName.toLowerCase().includes(searchLower))
        );
      }

      // Calculate team statistics
      const teamStats = {
        totalMembers: filteredTeam.length,
        totalSkills: filteredTeam.reduce((sum, m) => sum + m.totalSkills, 0),
        activeProjects: filteredTeam.reduce((sum, m) => sum + m.activeProjects, 0),
        totalTasks: filteredTeam.reduce((sum, m) => sum + m.totalTasks, 0),
        completedTasks: filteredTeam.reduce((sum, m) => sum + m.completedTasks, 0),
        averageAvailability: filteredTeam.length > 0
          ? Math.round(filteredTeam.reduce((sum, m) => sum + m.availability, 0) / filteredTeam.length)
          : 100,
        overloadedMembers: filteredTeam.filter(m => m.workload > 3).length,
        availableMembers: filteredTeam.filter(m => m.workload <= 1).length
      };

      res.json({
        success: true,
        data: filteredTeam,
        stats: teamStats
      });
    } catch (error) {
      console.error('Get team overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch team overview.',
        error: error.message
      });
    }
  }

  // Get skills matrix for team
  static async getSkillsMatrix(req, res) {
    try {
      const { departmentId, projectId } = req.query;
      const staff = await Staff.findById(req.staffId);

      // Get all skills
      const allSkills = await Skill.findAll({ limit: 10000 });

      // Get staff
      const staffFilters = {
        status: 'active',
        limit: 10000
      };
      if (departmentId) staffFilters.departmentId = parseInt(departmentId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        if (staff.departmentId) {
          staffFilters.departmentId = staff.departmentId;
        }
      }
      const allStaff = await Staff.findAll(staffFilters);

      // Get skill profiles
      const skillProfiles = await SkillProfile.findAll({ limit: 10000 });

      // Get project assignments to see required skills
      const assignmentFilters = {
        status: 'active',
        limit: 10000
      };
      if (projectId) assignmentFilters.projectId = parseInt(projectId);
      const assignments = await ProjectAssignment.findAll(assignmentFilters);

      // Build skills matrix
      const matrix = allSkills.map(skill => {
        const profilesWithSkill = skillProfiles.filter(sp => 
          sp.skillId === skill.dbId || sp.skillName === skill.name
        );
        const assignmentsNeedingSkill = assignments.filter(a => {
          try {
            const requiredSkills = a.skillsRequired ? 
              (typeof a.skillsRequired === 'string' ? JSON.parse(a.skillsRequired) : a.skillsRequired) : 
              [];
            if (Array.isArray(requiredSkills)) {
              return requiredSkills.includes(skill.name) || requiredSkills.includes(skill.id);
            }
          } catch (e) {
            // Invalid JSON, skip
          }
          return false;
        });

        const employeesWithSkill = profilesWithSkill.map(sp => {
          const employee = allStaff.find(s => s.id === sp.staffId || s.dbId === sp.staffId);
          return {
            staffId: sp.staffId,
            staffName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
            level: sp.level,
            levelLabel: sp.levelLabel,
            yearsExperience: sp.yearsExperience
          };
        });

        return {
          skillId: skill.id,
          skillName: skill.name,
          category: skill.category,
          totalEmployees: employeesWithSkill.length,
          neededForProjects: assignmentsNeedingSkill.length,
          employees: employeesWithSkill,
          gap: Math.max(0, assignmentsNeedingSkill.length - employeesWithSkill.length)
        };
      });

      res.json({
        success: true,
        data: matrix,
        stats: {
          totalSkills: matrix.length,
          skillsWithGaps: matrix.filter(m => m.gap > 0).length,
          totalGap: matrix.reduce((sum, m) => sum + m.gap, 0)
        }
      });
    } catch (error) {
      console.error('Get skills matrix error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch skills matrix.',
        error: error.message
      });
    }
  }

  // Get employee performance summary
  static async getEmployeePerformance(req, res) {
    try {
      const { staffId } = req.params;
      const staffIdNum = parseInt(staffId);

      if (!staffIdNum || isNaN(staffIdNum)) {
        return res.status(400).json({
          success: false,
          message: 'Valid staff ID is required.'
        });
      }

      // Get tasks
      const tasks = await Task.findAll({ assigneeId: staffIdNum, limit: 1000 });
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const overdueTasks = tasks.filter(t => t.status === 'overdue');

      // Get deliverables
      const deliverables = await Deliverable.findAll({ limit: 1000 });
      const employeeDeliverables = deliverables.filter(d => {
        return d.submittedBy === staffIdNum;
      });
      const approvedDeliverables = employeeDeliverables.filter(d => d.status === 'approved');

      // Get work reports
      const workReports = await WorkReport.findAll({ staffId: staffIdNum, limit: 100 });
      const approvedReports = workReports.filter(r => r.status === 'approved');

      // Get performance records
      const performanceRecords = await Performance.findAll({ 
        staffId: staffIdNum, 
        limit: 100 
      });

      // Calculate performance metrics
      const taskCompletionRate = tasks.length > 0
        ? (completedTasks.length / tasks.length) * 100
        : 0;

      const deliverableApprovalRate = employeeDeliverables.length > 0
        ? (approvedDeliverables.length / employeeDeliverables.length) * 100
        : 0;

      const averagePerformance = performanceRecords.length > 0
        ? performanceRecords.reduce((sum, p) => sum + (parseFloat(p.performanceScore || p.overallRating || 0)), 0) / performanceRecords.length
        : 0;

      res.json({
        success: true,
        data: {
          taskMetrics: {
            total: tasks.length,
            completed: completedTasks.length,
            overdue: overdueTasks.length,
            completionRate: Math.round(taskCompletionRate)
          },
          deliverableMetrics: {
            total: employeeDeliverables.length,
            approved: approvedDeliverables.length,
            approvalRate: Math.round(deliverableApprovalRate)
          },
          workReportMetrics: {
            total: workReports.length,
            approved: approvedReports.length
          },
          performanceScore: Math.round(averagePerformance),
          performanceHistory: performanceRecords.slice(0, 12) // Last 12 records
        }
      });
    } catch (error) {
      console.error('Get employee performance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee performance.',
        error: error.message
      });
    }
  }

  // Get skill gaps for team
  static async getSkillGaps(req, res) {
    try {
      const { departmentId, projectId } = req.query;
      const staff = await Staff.findById(req.staffId);

      // Get all skills
      const allSkills = await Skill.findAll({ limit: 10000 });

      // Get project assignments
      const assignmentFilters = {
        status: 'active',
        limit: 10000
      };
      if (projectId) assignmentFilters.projectId = parseInt(projectId);
      const assignments = await ProjectAssignment.findAll(assignmentFilters);

      // Get skill profiles
      const skillProfiles = await SkillProfile.findAll({ limit: 10000 });

      // Get staff
      const staffFilters = {
        status: 'active',
        limit: 10000
      };
      if (departmentId) staffFilters.departmentId = parseInt(departmentId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        if (staff.departmentId) {
          staffFilters.departmentId = staff.departmentId;
        }
      }
      const allStaff = await Staff.findAll(staffFilters);

      // Calculate skill gaps
      const gaps = allSkills.map(skill => {
        const requiredCount = assignments.filter(a => {
          try {
            const requiredSkills = a.skillsRequired ? 
              (typeof a.skillsRequired === 'string' ? JSON.parse(a.skillsRequired) : a.skillsRequired) : 
              [];
            if (Array.isArray(requiredSkills)) {
              return requiredSkills.includes(skill.name) || requiredSkills.includes(skill.id);
            }
          } catch (e) {
            // Invalid JSON, skip
          }
          return false;
        }).length;

        const availableCount = skillProfiles.filter(sp => 
          sp.skillId === skill.dbId || sp.skillName === skill.name
        ).length;

        const gap = Math.max(0, requiredCount - availableCount);

        return {
          skillId: skill.id,
          skillName: skill.name,
          category: skill.category,
          required: requiredCount,
          available: availableCount,
          gap,
          severity: gap === 0 ? 'none' : gap <= 2 ? 'low' : gap <= 5 ? 'medium' : 'high'
        };
      }).filter(g => g.gap > 0).sort((a, b) => b.gap - a.gap);

      res.json({
        success: true,
        data: gaps,
        stats: {
          totalGaps: gaps.length,
          criticalGaps: gaps.filter(g => g.severity === 'high').length,
          mediumGaps: gaps.filter(g => g.severity === 'medium').length,
          lowGaps: gaps.filter(g => g.severity === 'low').length
        }
      });
    } catch (error) {
      console.error('Get skill gaps error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch skill gaps.',
        error: error.message
      });
    }
  }

  // Get employee workload analysis
  static async getEmployeeWorkload(req, res) {
    try {
      const { departmentId, projectId } = req.query;
      const staff = await Staff.findById(req.staffId);

      // Get staff
      const staffFilters = {
        status: 'active',
        limit: 10000
      };
      if (departmentId) staffFilters.departmentId = parseInt(departmentId);
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin') {
        if (staff.departmentId) {
          staffFilters.departmentId = staff.departmentId;
        }
      }
      const allStaff = await Staff.findAll(staffFilters);

      // Get project assignments
      const assignmentFilters = {
        status: 'active',
        limit: 10000
      };
      if (projectId) assignmentFilters.projectId = parseInt(projectId);
      const assignments = await ProjectAssignment.findAll(assignmentFilters);

      // Get tasks
      const taskFilters = { limit: 10000 };
      if (projectId) taskFilters.projectId = parseInt(projectId);
      const tasks = await Task.findAll(taskFilters);

      // Get availability
      const today = new Date().toISOString().split('T')[0];
      const availability = await Availability.findAll({
        startDate: today,
        limit: 10000
      });

      // Calculate workload for each employee
      const workloadData = allStaff.map(employee => {
        const employeeId = employee.id || employee.dbId;
        const employeeAssignments = assignments.filter(a => 
          a.staffId === employee.id || a.staffId === employee.dbId || a.staffId === employeeId
        );
        const employeeTasks = tasks.filter(t => {
          if (t.assigneeId === employee.id || t.assigneeId === employee.dbId || t.assigneeId === employeeId) {
            return true;
          }
          // Check assigneeIds array
          if (t.assigneeIds) {
            try {
              const assigneeIds = typeof t.assigneeIds === 'string' ? JSON.parse(t.assigneeIds) : t.assigneeIds;
              if (Array.isArray(assigneeIds)) {
                return assigneeIds.includes(employee.id) || assigneeIds.includes(employee.dbId) || assigneeIds.includes(employeeId);
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
          return false;
        });
        const employeeAvailability = availability.filter(a => 
          a.staffId === employee.id || a.staffId === employee.dbId
        );

        const totalAllocation = employeeAssignments.reduce((sum, a) => 
          sum + (parseFloat(a.allocationPercentage) || 0), 0
        );
        const avgAvailability = employeeAvailability.length > 0
          ? employeeAvailability.reduce((sum, a) => sum + (parseFloat(a.capacityPercentage) || 100), 0) / employeeAvailability.length
          : 100;

        const workloadStatus = totalAllocation > 100 ? 'overloaded' :
          totalAllocation > 80 ? 'high' :
          totalAllocation > 50 ? 'medium' : 'available';

        return {
          staffId: employee.id,
          dbId: employee.dbId,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          role: employee.role,
          department: employee.department,
          activeProjects: employeeAssignments.length,
          totalAllocation: Math.round(totalAllocation),
          totalTasks: employeeTasks.length,
          completedTasks: employeeTasks.filter(t => t.status === 'completed').length,
          overdueTasks: employeeTasks.filter(t => t.status === 'overdue').length,
          availability: Math.round(avgAvailability),
          workloadStatus
        };
      });

      res.json({
        success: true,
        data: workloadData,
        stats: {
          totalEmployees: workloadData.length,
          overloaded: workloadData.filter(w => w.workloadStatus === 'overloaded').length,
          highWorkload: workloadData.filter(w => w.workloadStatus === 'high').length,
          mediumWorkload: workloadData.filter(w => w.workloadStatus === 'medium').length,
          available: workloadData.filter(w => w.workloadStatus === 'available').length
        }
      });
    } catch (error) {
      console.error('Get employee workload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee workload.',
        error: error.message
      });
    }
  }

  // Get training records for team
  static async getTrainingRecords(req, res) {
    try {
      const { staffId, status, skillId } = req.query;
      const staff = await Staff.findById(req.staffId);

      const filters = { limit: 10000 };
      if (staffId) filters.staffId = parseInt(staffId);
      if (status) filters.status = status;
      if (skillId) filters.skillId = parseInt(skillId);

      // If team leader, filter by department
      let trainingRecords = [];
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.departmentId && !staffId) {
        // Get all staff in department
        const deptStaff = await Staff.findAll({ departmentId: staff.departmentId, limit: 10000 });
        const deptStaffIds = deptStaff.map(s => s.id || s.dbId).filter(Boolean);
        if (deptStaffIds.length > 0) {
          // Fetch training for each staff member
          const allTraining = await Promise.all(
            deptStaffIds.map(id => Training.findAll({ ...filters, staffId: id }))
          );
          trainingRecords = allTraining.flat();
        }
      } else {
        trainingRecords = await Training.findAll(filters);
      }

      // Get recommended training based on skill gaps
      const skillGaps = await SkillGap.findAll({ limit: 1000 });
      const recommendedTraining = skillGaps
        .filter(gap => gap.gap > 0)
        .map(gap => ({
          skill: gap.skillName,
          category: gap.category,
          gap: gap.gap,
          priority: gap.severity === 'high' ? 'High' : gap.severity === 'medium' ? 'Medium' : 'Low'
        }));

      // Get expiring certifications (within 90 days)
      const today = new Date();
      const ninetyDaysFromNow = new Date(today);
      ninetyDaysFromNow.setDate(today.getDate() + 90);
      
      const expiringCertifications = trainingRecords
        .filter(t => t.certificationIssued && t.certificationExpiry)
        .map(t => {
          const expiryDate = new Date(t.certificationExpiry);
          const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
          return {
            id: t.id,
            trainingId: t.trainingId,
            employee: t.firstName && t.lastName ? `${t.firstName} ${t.lastName}` : 'Unknown',
            employeeId: t.staffId,
            certification: t.title,
            expiryDate: t.certificationExpiry,
            daysRemaining: daysRemaining
          };
        })
        .filter(cert => cert.daysRemaining <= 90 && cert.daysRemaining >= 0)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      res.json({
        success: true,
        data: {
          trainingRecords: trainingRecords.map(t => ({
            id: t.id,
            trainingId: t.trainingId,
            employee: t.firstName && t.lastName ? `${t.firstName} ${t.lastName}` : 'Unknown',
            employeeId: t.staffId,
            training: t.title,
            trainingType: t.trainingType,
            date: t.startDate,
            endDate: t.endDate,
            status: t.status,
            completionPercentage: t.completionPercentage,
            certification: t.certificationIssued ? t.title : null,
            expiryDate: t.certificationExpiry,
            provider: t.provider,
            skillName: t.skillName || t.skillFullName
          })),
          recommendedTraining,
          expiringCertifications
        }
      });
    } catch (error) {
      console.error('Get training records error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch training records.',
        error: error.message
      });
    }
  }

  // Get performance overview for team
  static async getPerformanceOverview(req, res) {
    try {
      const { staffId, projectId } = req.query;
      const staff = await Staff.findById(req.staffId);

      const filters = { limit: 10000 };
      if (staffId) filters.staffId = parseInt(staffId);
      if (projectId) filters.projectId = parseInt(projectId);

      // If team leader, filter by department
      let performanceRecords = [];
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.departmentId && !staffId) {
        const deptStaff = await Staff.findAll({ departmentId: staff.departmentId, limit: 10000 });
        const deptStaffIds = deptStaff.map(s => s.id || s.dbId).filter(Boolean);
        if (deptStaffIds.length > 0) {
          // Fetch performance for each staff member
          const allPerformance = await Promise.all(
            deptStaffIds.map(id => Performance.findAll({ ...filters, staffId: id }))
          );
          performanceRecords = allPerformance.flat();
        }
      } else {
        performanceRecords = await Performance.findAll(filters);
      }

      // Get all staff for performance summary
      const staffFilters = { status: 'active', limit: 10000 };
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.departmentId) {
        staffFilters.departmentId = staff.departmentId;
      }
      const allStaff = await Staff.findAll(staffFilters);

      // Calculate performance metrics for each employee
      const performanceData = allStaff.map(employee => {
        const employeePerformance = performanceRecords.filter(p => 
          p.staffId === employee.id || p.staffId === employee.dbId
        );

        // Get tasks
        const employeeTasks = performanceRecords.filter(p => 
          p.staffId === employee.id || p.staffId === employee.dbId
        );

        // Calculate averages
        const avgScore = employeePerformance.length > 0
          ? employeePerformance.reduce((sum, p) => sum + (parseFloat(p.performanceScore || p.overallRating || 0)), 0) / employeePerformance.length
          : 0;

        // Get project assignments to count completed projects
        const assignments = performanceRecords.filter(p => 
          p.staffId === employee.id || p.staffId === employee.dbId && p.projectId
        );
        const uniqueProjects = new Set(assignments.map(a => a.projectId).filter(Boolean));

        return {
          id: employee.id || employee.dbId,
          employee: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
          overallScore: Math.round(avgScore),
          projectsCompleted: uniqueProjects.size,
          onTimeDelivery: 95, // Mock - can be calculated from deliverables
          qualityScore: Math.round(avgScore * 0.95), // Mock - can be calculated from reviews
          reliability: avgScore >= 90 ? 'High' : avgScore >= 75 ? 'Medium' : 'Low',
          feedback: employeePerformance.length > 0 ? employeePerformance[0].feedback : null
        };
      });

      // Get project-based feedback
      const projectFeedback = performanceRecords
        .filter(p => p.projectId && p.feedback)
        .map(p => ({
          project: p.projectName || 'Unknown Project',
          projectId: p.projectId,
          employee: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
          employeeId: p.staffId,
          feedback: p.feedback,
          rating: Math.round((p.performanceScore || p.overallRating || 0) / 20), // Convert to 1-5 scale
          date: p.reviewDate || p.createdAt
        }));

      res.json({
        success: true,
        data: {
          performanceData,
          projectFeedback,
          lessonsLearned: performanceRecords
            .filter(p => p.lessonsLearned)
            .map(p => ({
              project: p.projectName || 'Unknown Project',
              projectId: p.projectId,
              lessonsLearned: p.lessonsLearned,
              date: p.reviewDate || p.createdAt
            }))
        }
      });
    } catch (error) {
      console.error('Get performance overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch performance overview.',
        error: error.message
      });
    }
  }

  // Get project assignments for team
  static async getProjectAssignments(req, res) {
    try {
      const { staffId, projectId, status } = req.query;
      const staff = await Staff.findById(req.staffId);

      const filters = { limit: 10000 };
      if (staffId) filters.staffId = parseInt(staffId);
      if (projectId) filters.projectId = parseInt(projectId);
      if (status) filters.status = status;

      // If team leader, filter by department
      let assignments = [];
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.departmentId && !staffId) {
        const deptStaff = await Staff.findAll({ departmentId: staff.departmentId, limit: 10000 });
        const deptStaffIds = deptStaff.map(s => s.id || s.dbId).filter(Boolean);
        if (deptStaffIds.length > 0) {
          // Fetch assignments for each staff member
          const allAssignments = await Promise.all(
            deptStaffIds.map(id => ProjectAssignment.findAll({ ...filters, staffId: id }))
          );
          assignments = allAssignments.flat();
        }
      } else {
        assignments = await ProjectAssignment.findAll(filters);
      }

      res.json({
        success: true,
        data: assignments.map(a => ({
          id: a.id,
          assignmentId: a.assignmentId,
          employee: a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : 'Unknown',
          employeeId: a.staffId,
          project: a.projectName || 'Unknown Project',
          projectId: a.projectId,
          projectCode: a.projectCode,
          skillRole: a.role,
          allocation: parseFloat(a.allocationPercentage || 0),
          startDate: a.startDate,
          endDate: a.endDate,
          duration: a.startDate && a.endDate 
            ? `${a.startDate} to ${a.endDate}`
            : a.startDate 
            ? `From ${a.startDate}`
            : 'N/A',
          status: a.status,
          skillsRequired: a.skillsRequired ? 
            (typeof a.skillsRequired === 'string' ? JSON.parse(a.skillsRequired) : a.skillsRequired) : 
            []
        }))
      });
    } catch (error) {
      console.error('Get project assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch project assignments.',
        error: error.message
      });
    }
  }

  // Create project assignment
  static async createProjectAssignment(req, res) {
    try {
      const { projectId, staffId, role, allocationPercentage, startDate, endDate, skillsRequired } = req.body;

      if (!projectId || !staffId || !startDate) {
        return res.status(400).json({
          success: false,
          message: 'Project ID, Staff ID, and Start Date are required.'
        });
      }

      const assignment = await ProjectAssignment.create({
        projectId: parseInt(projectId),
        staffId: parseInt(staffId),
        role: role || null,
        allocationPercentage: parseFloat(allocationPercentage || 100),
        startDate,
        endDate: endDate || null,
        status: 'active',
        skillsRequired: skillsRequired || null,
        createdBy: req.staffId || null
      });

      res.json({
        success: true,
        message: 'Project assignment created successfully.',
        data: assignment
      });
    } catch (error) {
      console.error('Create project assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create project assignment.',
        error: error.message
      });
    }
  }

  // Get tasks for team skills
  static async getTeamTasks(req, res) {
    try {
      const { staffId, projectId, status } = req.query;
      const staff = await Staff.findById(req.staffId);

      const filters = { limit: 10000 };
      if (staffId) filters.assigneeId = parseInt(staffId);
      if (projectId) filters.projectId = parseInt(projectId);
      if (status) filters.status = status;

      // If team leader, filter by department
      let tasks = [];
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.departmentId && !staffId) {
        const deptStaff = await Staff.findAll({ departmentId: staff.departmentId, limit: 10000 });
        const deptStaffIds = deptStaff.map(s => s.id || s.dbId).filter(Boolean);
        if (deptStaffIds.length > 0) {
          // Fetch tasks for each staff member
          const allTasks = await Promise.all(
            deptStaffIds.map(id => Task.findAll({ ...filters, assigneeId: id }))
          );
          tasks = allTasks.flat();
        }
      } else {
        tasks = await Task.findAll(filters);
      }

      res.json({
        success: true,
        data: tasks.map(t => ({
          id: t.id,
          taskId: t.taskId,
          title: t.title,
          description: t.description,
          projectId: t.projectId,
          projectName: t.projectName,
          assigneeId: t.assigneeId,
          assigneeName: t.assigneeName,
          status: t.status,
          priority: t.priority,
          progress: t.progress || 0,
          dueDate: t.dueDate,
          startDate: t.startDate,
          completedDate: t.completedDate
        }))
      });
    } catch (error) {
      console.error('Get team tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tasks.',
        error: error.message
      });
    }
  }

  // Get deliverables for team skills
  static async getTeamDeliverables(req, res) {
    try {
      const { staffId, projectId, status } = req.query;
      const staff = await Staff.findById(req.staffId);

      const filters = { limit: 10000 };
      if (projectId) filters.projectId = parseInt(projectId);
      if (status) filters.status = status;

      // If team leader, filter by department
      let deliverables = [];
      if (staff && staff.role !== 'superadmin' && staff.role !== 'admin' && staff.departmentId && !staffId) {
        const deptStaff = await Staff.findAll({ departmentId: staff.departmentId, limit: 10000 });
        const deptStaffIds = deptStaff.map(s => s.id || s.dbId).filter(Boolean);
        if (deptStaffIds.length > 0) {
          // Fetch deliverables for each staff member
          const allDeliverables = await Promise.all(
            deptStaffIds.map(id => Deliverable.findAll({ ...filters, submittedBy: id }))
          );
          deliverables = allDeliverables.flat();
        }
      } else {
        if (staffId) {
          filters.submittedBy = parseInt(staffId);
        }
        deliverables = await Deliverable.findAll(filters);
      }

      res.json({
        success: true,
        data: deliverables.map(d => ({
          id: d.id,
          deliverableId: d.deliverableId,
          title: d.title,
          type: d.type,
          category: d.category,
          projectId: d.projectId,
          projectName: d.projectName,
          submittedBy: d.submittedBy,
          submittedByName: d.submittedByName,
          status: d.status,
          submissionDate: d.submissionDate,
          approvalDate: d.approvalDate,
          description: d.description
        }))
      });
    } catch (error) {
      console.error('Get team deliverables error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deliverables.',
        error: error.message
      });
    }
  }

  // Generate reports
  static async generateReport(req, res) {
    try {
      const { reportType, format = 'pdf', filters = {} } = req.body;

      if (!reportType) {
        return res.status(400).json({
          success: false,
          message: 'Report type is required.'
        });
      }

      // Note: In a real implementation, you would generate PDF/Excel/CSV files here using libraries like pdfkit, exceljs, etc.
      // For now, we return a success message indicating the report would be generated
      // The frontend can use the existing endpoints to fetch the data and generate reports client-side if needed

      const reportTypes = {
        'skills': 'Skills Overview Report',
        'availability': 'Availability Report',
        'assignments': 'Project Assignments Report',
        'performance': 'Performance Report',
        'gaps': 'Skill Gap Analysis Report',
        'training': 'Training & Development Report'
      };

      res.json({
        success: true,
        message: `${reportTypes[reportType] || 'Report'} data prepared successfully for ${format.toUpperCase()} format.`,
        reportType,
        format,
        filters,
        generatedAt: new Date().toISOString(),
        note: 'Use the corresponding GET endpoints to fetch the actual data for report generation.'
      });
    } catch (error) {
      console.error('Generate report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate report.',
        error: error.message
      });
    }
  }
}
