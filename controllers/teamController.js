import Team from '../models/Team.js';
import TeamMember from '../models/TeamMember.js';
import Staff from '../models/Staff.js';
import ProjectAssignment from '../models/ProjectAssignment.js';
import SkillProfile from '../models/SkillProfile.js';
import Availability from '../models/Availability.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Skill from '../models/Skill.js';

export const createTeam = async (req, res) => {
  try {
    const { name, projectId, leaderId, description, memberIds } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Team name is required' });
    }

    const team = await Team.create({ name, projectId, leaderId, description });

    if (Array.isArray(memberIds)) {
      for (const memberId of memberIds) {
        const role = Number(memberId) === Number(leaderId) ? 'leader' : 'member';
        await TeamMember.addMember({ teamId: team.id, staffId: memberId, role });
      }
    } else if (leaderId) {
      await TeamMember.addMember({ teamId: team.id, staffId: leaderId, role: 'leader' });
    }

    // If a leader is specified, ensure they have the team-skills control panel
    if (leaderId) {
      try {
        const leader = await Staff.findById(leaderId);
        if (leader && leader.controlPanel !== 'team-skills') {
          await Staff.update(leaderId, { controlPanel: 'team-skills' });
        }
      } catch (err) {
        console.warn('Failed to ensure team leader control panel assignment:', err.message);
      }
    }

    const members = await TeamMember.getTeamMembers(team.id);

    return res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: { ...team, members },
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create team',
      error: error.message,
    });
  }
};

export const getTeams = async (req, res) => {
  try {
    const { projectId, leaderId } = req.query;
    const filters = {};

    if (projectId) filters.projectId = Number(projectId);
    if (leaderId) filters.leaderId = Number(leaderId);

    const teams = await Team.findAll(filters);

    // Optionally attach members
    const enriched = [];
    for (const team of teams) {
      const members = await TeamMember.getTeamMembers(team.id);
      enriched.push({ ...team, members });
    }

    res.json({
      success: true,
      data: enriched,
      meta: { count: enriched.length },
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
      error: error.message,
    });
  }
};

export const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, projectId, leaderId, description, memberIds } = req.body;

    const updated = await Team.update(id, { name, projectId, leaderId, description });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // Update membership: simple strategy – clear and reinsert
    if (Array.isArray(memberIds)) {
      const [existing] = await import('../config/db.js').then(({ default: pool }) =>
        pool.execute('DELETE FROM team_members WHERE team_id = ?', [updated.id]),
      );
      for (const memberId of memberIds) {
        const role = Number(memberId) === Number(leaderId) ? 'leader' : 'member';
        await TeamMember.addMember({ teamId: updated.id, staffId: memberId, role });
      }

      if (leaderId) {
        try {
          const leader = await Staff.findById(leaderId);
          if (leader && leader.controlPanel !== 'team-skills') {
            await Staff.update(leaderId, { controlPanel: 'team-skills' });
          }
        } catch (err) {
          console.warn('Failed to ensure team leader control panel assignment on update:', err.message);
        }
      }
    }

    const members = await TeamMember.getTeamMembers(updated.id);

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: { ...updated, members },
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team',
      error: error.message,
    });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    await Team.delete(id);
    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete team',
      error: error.message,
    });
  }
};

export class TeamController {
  // ========== Team Overview ==========
  
  static async getTeamOverview(req, res) {
    try {
      const { projectId, departmentId, search, status } = req.query;

      // Get all active project assignments
      const assignmentFilters = {
        status: status || 'active',
        projectId: projectId ? parseInt(projectId) : undefined,
        limit: 10000
      };
      const assignments = await ProjectAssignment.findAll(assignmentFilters);

      // Get all staff members
      const staffFilters = {
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        status: 'active',
        limit: 10000
      };
      const allStaff = await Staff.findAll(staffFilters);

      // Get skill profiles for all staff
      const skillProfiles = await SkillProfile.findAll({ limit: 10000 });

      // Get availability data
      const today = new Date().toISOString().split('T')[0];
      const availabilityData = await Availability.findAll({
        startDate: today,
        limit: 10000
      });

      // Aggregate data by staff member
      const teamMembers = allStaff.map(staff => {
        const staffAssignments = assignments.filter(a => a.staffId === staff.dbId);
        const staffSkills = skillProfiles.filter(sp => sp.staffId === staff.dbId);
        const staffAvailability = availabilityData.find(a => a.staffId === staff.dbId && a.date === today);

        // Calculate workload from assignments
        const totalWorkload = staffAssignments.reduce((sum, assignment) => {
          return sum + (assignment.allocationPercentage || 0);
        }, 0);

        // Determine availability status
        let availabilityStatus = 'Available';
        if (staffAvailability) {
          if (staffAvailability.capacityPercentage <= 0 || staffAvailability.workType === 'unavailable' || staffAvailability.workType === 'leave') {
            availabilityStatus = 'Unavailable';
          } else if (staffAvailability.capacityPercentage < 50) {
            availabilityStatus = 'Limited';
          } else if (totalWorkload >= 90) {
            availabilityStatus = 'Busy';
          } else if (totalWorkload >= 75) {
            availabilityStatus = 'Moderate';
          }
        } else if (totalWorkload >= 90) {
          availabilityStatus = 'Busy';
        } else if (totalWorkload >= 75) {
          availabilityStatus = 'Moderate';
        }

        // Get primary project (highest allocation)
        const primaryAssignment = staffAssignments.length > 0
          ? staffAssignments.reduce((max, a) => (a.allocationPercentage || 0) > (max.allocationPercentage || 0) ? a : max)
          : null;

        // Extract skills
        const skills = staffSkills.map(sp => sp.skillName || sp.skillFullName).filter(Boolean);

        return {
          id: staff.id,
          dbId: staff.dbId,
          name: `${staff.firstName} ${staff.lastName}`,
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          role: staff.position || primaryAssignment?.role || 'Staff',
          position: staff.position,
          departmentId: staff.departmentId,
          departmentName: staff.departmentName,
          project: primaryAssignment?.projectName || primaryAssignment?.projectCode || 'Unassigned',
          projectId: primaryAssignment?.projectId || null,
          projects: staffAssignments.map(a => ({
            id: a.projectId,
            name: a.projectName || a.projectCode,
            code: a.projectCode,
            role: a.role,
            allocation: a.allocationPercentage
          })),
          workload: Math.min(100, Math.round(totalWorkload)),
          availability: availabilityStatus,
          capacity: staffAvailability?.capacityPercentage || 100,
          workType: staffAvailability?.workType || 'office',
          skills: skills,
          skillCount: skills.length,
          assignments: staffAssignments.length,
          status: staff.status
        };
      });

      // Filter by search term if provided
      let filteredMembers = teamMembers;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredMembers = teamMembers.filter(member =>
          member.name.toLowerCase().includes(searchLower) ||
          member.role.toLowerCase().includes(searchLower) ||
          member.email.toLowerCase().includes(searchLower) ||
          member.project.toLowerCase().includes(searchLower) ||
          member.skills.some(skill => skill.toLowerCase().includes(searchLower))
        );
      }

      // Calculate statistics
      const stats = {
        total: filteredMembers.length,
        available: filteredMembers.filter(m => m.availability === 'Available').length,
        busy: filteredMembers.filter(m => m.availability === 'Busy').length,
        unavailable: filteredMembers.filter(m => m.availability === 'Unavailable').length,
        averageWorkload: filteredMembers.length > 0
          ? Math.round(filteredMembers.reduce((sum, m) => sum + m.workload, 0) / filteredMembers.length)
          : 0,
        totalSkills: new Set(filteredMembers.flatMap(m => m.skills)).size,
        assignedToProjects: filteredMembers.filter(m => m.assignments > 0).length
      };

      res.json({
        success: true,
        data: filteredMembers,
        stats
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

  // ========== Resource Allocation ==========

  static async getResourceAllocation(req, res) {
    try {
      const { projectId, departmentId } = req.query;

      // Get all projects
      const projectFilters = {
        projectId: projectId ? parseInt(projectId) : undefined,
        status: 'all',
        limit: 10000
      };
      const projects = await Project.findAll(projectFilters);

      // Get all active assignments
      const assignmentFilters = {
        status: 'active',
        projectId: projectId ? parseInt(projectId) : undefined,
        limit: 10000
      };
      const assignments = await ProjectAssignment.findAll(assignmentFilters);

      // Get all staff
      const staffFilters = {
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        status: 'active',
        limit: 10000
      };
      const allStaff = await Staff.findAll(staffFilters);

      // Aggregate by project
      const allocationData = projects.map(project => {
        const projectAssignments = assignments.filter(a => a.projectId === project.dbId);
        
        // Categorize staff by role/position
        const engineers = projectAssignments.filter(a => {
          const staff = allStaff.find(s => s.dbId === a.staffId);
          const role = (a.role || staff?.position || '').toLowerCase();
          return role.includes('engineer') || role.includes('design') || role.includes('technical');
        });

        const specialists = projectAssignments.filter(a => {
          const staff = allStaff.find(s => s.dbId === a.staffId);
          const role = (a.role || staff?.position || '').toLowerCase();
          return role.includes('specialist') || role.includes('expert') || role.includes('consultant') || 
                 role.includes('esia') || role.includes('environmental');
        });

        const managers = projectAssignments.filter(a => {
          const staff = allStaff.find(s => s.dbId === a.staffId);
          const role = (a.role || staff?.position || '').toLowerCase();
          return role.includes('manager') || role.includes('director') || role.includes('lead');
        });

        const others = projectAssignments.filter(a => {
          const staff = allStaff.find(s => s.dbId === a.staffId);
          const role = (a.role || staff?.position || '').toLowerCase();
          return !role.includes('engineer') && !role.includes('design') && !role.includes('technical') &&
                 !role.includes('specialist') && !role.includes('expert') && !role.includes('consultant') &&
                 !role.includes('manager') && !role.includes('director') && !role.includes('lead');
        });

        // Calculate total utilization
        const totalAllocation = projectAssignments.reduce((sum, a) => sum + (a.allocationPercentage || 0), 0);
        const utilization = Math.min(100, Math.round(totalAllocation / projectAssignments.length || 0));

        return {
          projectId: project.id,
          projectDbId: project.dbId,
          project: project.name,
          projectCode: project.projectCode,
          projectStatus: project.status,
          engineers: engineers.length,
          specialists: specialists.length,
          managers: managers.length,
          others: others.length,
          total: projectAssignments.length,
          utilization: utilization,
          totalAllocation: totalAllocation,
          assignments: projectAssignments.map(a => ({
            staffId: a.staffId,
            staffName: a.staffName,
            role: a.role,
            allocation: a.allocationPercentage
          }))
        };
      }).filter(p => p.total > 0 || projectId); // Only show projects with assignments, or the specific project if requested

      // Calculate overall statistics
      const stats = {
        totalProjects: allocationData.length,
        totalResources: assignments.length,
        averageUtilization: allocationData.length > 0
          ? Math.round(allocationData.reduce((sum, p) => sum + p.utilization, 0) / allocationData.length)
          : 0,
        totalEngineers: allocationData.reduce((sum, p) => sum + p.engineers, 0),
        totalSpecialists: allocationData.reduce((sum, p) => sum + p.specialists, 0),
        totalManagers: allocationData.reduce((sum, p) => sum + p.managers, 0)
      };

      res.json({
        success: true,
        data: allocationData,
        stats
      });
    } catch (error) {
      console.error('Get resource allocation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch resource allocation.',
        error: error.message
      });
    }
  }

  // ========== Workload Overview ==========

  static async getWorkloadOverview(req, res) {
    try {
      const { projectId, departmentId, overloaded } = req.query;

      // Get all active assignments
      const assignmentFilters = {
        status: 'active',
        projectId: projectId ? parseInt(projectId) : undefined,
        limit: 10000
      };
      const assignments = await ProjectAssignment.findAll(assignmentFilters);

      // Get all staff
      const staffFilters = {
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        status: 'active',
        limit: 10000
      };
      const allStaff = await Staff.findAll(staffFilters);

      // Get tasks assigned to staff
      const taskFilters = {
        status: 'all',
        limit: 10000
      };
      const allTasks = await Task.findAll(taskFilters);

      // Aggregate workload by staff member
      const workloadData = allStaff.map(staff => {
        const staffAssignments = assignments.filter(a => a.staffId === staff.dbId);
        const staffTasks = allTasks.filter(t => {
          if (t.assigneeIds && Array.isArray(t.assigneeIds)) {
            return t.assigneeIds.includes(staff.dbId);
          }
          return t.assigneeId === staff.dbId;
        });

        // Calculate workload from assignments
        const assignmentWorkload = staffAssignments.reduce((sum, assignment) => {
          return sum + (assignment.allocationPercentage || 0);
        }, 0);

        // Estimate workload from tasks (assuming each task is ~5% workload)
        const taskWorkload = staffTasks.length * 5;

        // Total workload
        const totalWorkload = Math.min(100, Math.round(assignmentWorkload + taskWorkload));

        // Determine status
        let status = 'Normal';
        if (totalWorkload > 90) {
          status = 'Overloaded';
        } else if (totalWorkload > 75) {
          status = 'High';
        } else if (totalWorkload < 50) {
          status = 'Light';
        }

        return {
          id: staff.id,
          dbId: staff.dbId,
          name: `${staff.firstName} ${staff.lastName}`,
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          role: staff.position || 'Staff',
          position: staff.position,
          departmentId: staff.departmentId,
          departmentName: staff.departmentName,
          projects: staffAssignments.map(a => ({
            id: a.projectId,
            name: a.projectName || a.projectCode,
            code: a.projectCode,
            allocation: a.allocationPercentage
          })),
          workload: totalWorkload,
          assignmentWorkload: Math.round(assignmentWorkload),
          taskCount: staffTasks.length,
          taskWorkload: taskWorkload,
          status: status,
          assignments: staffAssignments.length
        };
      });

      // Filter by overloaded if requested
      let filteredWorkload = workloadData;
      if (overloaded === 'true' || overloaded === true) {
        filteredWorkload = workloadData.filter(w => w.workload > 90);
      }

      // Calculate statistics
      const stats = {
        total: filteredWorkload.length,
        overloaded: filteredWorkload.filter(w => w.status === 'Overloaded').length,
        high: filteredWorkload.filter(w => w.status === 'High').length,
        normal: filteredWorkload.filter(w => w.status === 'Normal').length,
        light: filteredWorkload.filter(w => w.status === 'Light').length,
        averageWorkload: filteredWorkload.length > 0
          ? Math.round(filteredWorkload.reduce((sum, w) => sum + w.workload, 0) / filteredWorkload.length)
          : 0
      };

      res.json({
        success: true,
        data: filteredWorkload,
        stats
      });
    } catch (error) {
      console.error('Get workload overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch workload overview.',
        error: error.message
      });
    }
  }

  // ========== Skills Matching ==========

  static async getSkillsMatching(req, res) {
    try {
      const { projectId, skillId, category } = req.query;

      // Get all projects
      const projectFilters = {
        projectId: projectId ? parseInt(projectId) : undefined,
        status: 'all',
        limit: 10000
      };
      const projects = await Project.findAll(projectFilters);

      // Get all active assignments
      const assignmentFilters = {
        status: 'active',
        projectId: projectId ? parseInt(projectId) : undefined,
        limit: 10000
      };
      const assignments = await ProjectAssignment.findAll(assignmentFilters);

      // Get all skill profiles
      const skillProfileFilters = {
        skillId: skillId ? parseInt(skillId) : undefined,
        category: category,
        limit: 10000
      };
      const skillProfiles = await SkillProfile.findAll(skillProfileFilters);

      // Get all skills
      const allSkills = await Skill.findAll({ limit: 10000 });

      // Aggregate skills needed vs available
      const skillsData = allSkills.map(skill => {
        // Find assignments that require this skill
        const assignmentsNeedingSkill = assignments.filter(assignment => {
          const requiredSkills = assignment.skillsRequired || [];
          const assignedSkills = assignment.skillsAssigned || [];
          return requiredSkills.includes(skill.name) || 
                 requiredSkills.includes(skill.id) ||
                 assignedSkills.includes(skill.name) ||
                 assignedSkills.includes(skill.id);
        });

        // Count how many are needed (from assignments)
        const needed = assignmentsNeedingSkill.length;

        // Count how many staff have this skill
        const availableProfiles = skillProfiles.filter(sp => 
          sp.skillId === skill.dbId || 
          sp.skillName === skill.name ||
          sp.skillFullName === skill.name
        );
        const available = availableProfiles.length;

        // Calculate gap
        const gap = Math.max(0, needed - available);

        // Get staff with this skill
        const staffWithSkill = availableProfiles.map(sp => ({
          staffId: sp.staffId,
          staffName: sp.staffName,
          level: sp.level,
          levelLabel: sp.levelLabel,
          yearsExperience: sp.yearsExperience
        }));

        return {
          skillId: skill.id,
          skillDbId: skill.dbId,
          skill: skill.name,
          category: skill.category || skill.categoryName,
          needed: needed,
          available: available,
          gap: gap,
          status: gap > 0 ? 'Gap' : 'Adequate',
          staffWithSkill: staffWithSkill,
          assignmentsNeeding: assignmentsNeedingSkill.map(a => ({
            projectId: a.projectId,
            projectName: a.projectName || a.projectCode,
            staffName: a.staffName,
            role: a.role
          }))
        };
      }).filter(s => s.needed > 0 || !projectId); // Only show skills that are needed, or all if no project filter

      // Calculate statistics
      const stats = {
        total: skillsData.length,
        withGaps: skillsData.filter(s => s.gap > 0).length,
        adequate: skillsData.filter(s => s.gap === 0).length,
        totalNeeded: skillsData.reduce((sum, s) => sum + s.needed, 0),
        totalAvailable: skillsData.reduce((sum, s) => sum + s.available, 0),
        totalGap: skillsData.reduce((sum, s) => sum + s.gap, 0)
      };

      res.json({
        success: true,
        data: skillsData,
        stats
      });
    } catch (error) {
      console.error('Get skills matching error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch skills matching.',
        error: error.message
      });
    }
  }

  // ========== Combined Statistics ==========

  static async getTeamStats(req, res) {
    try {
      const { projectId, departmentId } = req.query;

      // Get all data in parallel
      const [teamOverview, resourceAllocation, workloadOverview, skillsMatching] = await Promise.all([
        this.getTeamOverviewData(req.query),
        this.getResourceAllocationData(req.query),
        this.getWorkloadOverviewData(req.query),
        this.getSkillsMatchingData(req.query)
      ]);

      res.json({
        success: true,
        data: {
          teamOverview: teamOverview.stats,
          resourceAllocation: resourceAllocation.stats,
          workloadOverview: workloadOverview.stats,
          skillsMatching: skillsMatching.stats
        }
      });
    } catch (error) {
      console.error('Get team stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch team statistics.',
        error: error.message
      });
    }
  }

  // Helper methods to get data without response
  static async getTeamOverviewData(filters) {
    // Similar to getTeamOverview but returns data object
    const assignmentFilters = {
      status: filters.status || 'active',
      projectId: filters.projectId ? parseInt(filters.projectId) : undefined,
      limit: 10000
    };
    const assignments = await ProjectAssignment.findAll(assignmentFilters);
    const allStaff = await Staff.findAll({
      departmentId: filters.departmentId ? parseInt(filters.departmentId) : undefined,
      status: 'active',
      limit: 10000
    });
    const skillProfiles = await SkillProfile.findAll({ limit: 10000 });
    const today = new Date().toISOString().split('T')[0];
    const availabilityData = await Availability.findAll({ startDate: today, limit: 10000 });

    const teamMembers = allStaff.map(staff => {
      const staffAssignments = assignments.filter(a => a.staffId === staff.dbId);
      const totalWorkload = staffAssignments.reduce((sum, a) => sum + (a.allocationPercentage || 0), 0);
      return { workload: Math.min(100, Math.round(totalWorkload)) };
    });

    return {
      stats: {
        total: teamMembers.length,
        averageWorkload: teamMembers.length > 0
          ? Math.round(teamMembers.reduce((sum, m) => sum + m.workload, 0) / teamMembers.length)
          : 0
      }
    };
  }

  static async getResourceAllocationData(filters) {
    const projects = await Project.findAll({
      projectId: filters.projectId ? parseInt(filters.projectId) : undefined,
      status: 'all',
      limit: 10000
    });
    const assignments = await ProjectAssignment.findAll({
      status: 'active',
      projectId: filters.projectId ? parseInt(filters.projectId) : undefined,
      limit: 10000
    });
    return { stats: { totalProjects: projects.length, totalResources: assignments.length } };
  }

  static async getWorkloadOverviewData(filters) {
    const assignments = await ProjectAssignment.findAll({
      status: 'active',
      projectId: filters.projectId ? parseInt(filters.projectId) : undefined,
      limit: 10000
    });
    const allStaff = await Staff.findAll({
      departmentId: filters.departmentId ? parseInt(filters.departmentId) : undefined,
      status: 'active',
      limit: 10000
    });
    const workloadData = allStaff.map(staff => {
      const staffAssignments = assignments.filter(a => a.staffId === staff.dbId);
      const totalWorkload = staffAssignments.reduce((sum, a) => sum + (a.allocationPercentage || 0), 0);
      return { workload: Math.min(100, Math.round(totalWorkload)) };
    });
    return {
      stats: {
        total: workloadData.length,
        averageWorkload: workloadData.length > 0
          ? Math.round(workloadData.reduce((sum, w) => sum + w.workload, 0) / workloadData.length)
          : 0
      }
    };
  }

  static async getSkillsMatchingData(filters) {
    const allSkills = await Skill.findAll({ limit: 10000 });
    const assignments = await ProjectAssignment.findAll({
      status: 'active',
      projectId: filters.projectId ? parseInt(filters.projectId) : undefined,
      limit: 10000
    });
    const skillProfiles = await SkillProfile.findAll({ limit: 10000 });
    const skillsData = allSkills.map(skill => {
      const assignmentsNeedingSkill = assignments.filter(a => {
        const requiredSkills = a.skillsRequired || [];
        return requiredSkills.includes(skill.name) || requiredSkills.includes(skill.id);
      });
      const availableProfiles = skillProfiles.filter(sp => 
        sp.skillId === skill.dbId || sp.skillName === skill.name
      );
      return {
        needed: assignmentsNeedingSkill.length,
        available: availableProfiles.length,
        gap: Math.max(0, assignmentsNeedingSkill.length - availableProfiles.length)
      };
    });
    return {
      stats: {
        total: skillsData.length,
        withGaps: skillsData.filter(s => s.gap > 0).length,
        totalGap: skillsData.reduce((sum, s) => sum + s.gap, 0)
      }
    };
  }
}
