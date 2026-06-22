import Role from '../models/Role.js';

async function initializeRolesTable() {
  try {
    await Role.createTable();
    console.log('Roles table initialization complete.');

    // Insert sample roles
    const sampleRoles = [
      {
        name: 'Administrator',
        description: 'Full system access with all administrative privileges',
        permissions: ['user_management', 'system_settings', 'data_export', 'audit_logs', 'role_management'],
        status: 'active',
        notes: 'Highest level access for system administrators'
      },
      {
        name: 'Project Manager',
        description: 'Manage projects and coordinate team activities',
        permissions: ['project_management', 'team_management', 'task_assignment', 'report_generation'],
        status: 'active',
        notes: 'Responsible for project planning and execution'
      },
      {
        name: 'Team Lead',
        description: 'Lead development teams and oversee technical work',
        permissions: ['project_view', 'task_assignment', 'team_management', 'report_view'],
        status: 'active',
        notes: 'Technical leadership role within development teams'
      },
      {
        name: 'Marketing Manager',
        description: 'Oversee marketing campaigns and brand management',
        permissions: ['project_view', 'report_view', 'client_communication'],
        status: 'active',
        notes: 'Responsible for marketing strategy and execution'
      },
      {
        name: 'Sales Representative',
        description: 'Handle client relationships and sales activities',
        permissions: ['client_communication', 'project_view', 'report_view'],
        status: 'active',
        notes: 'Front-line sales and client interaction'
      },
      {
        name: 'HR Manager',
        description: 'Manage human resources and employee relations',
        permissions: ['user_management', 'report_view', 'audit_logs'],
        status: 'active',
        notes: 'Responsible for employee lifecycle management'
      },
      {
        name: 'Finance Analyst',
        description: 'Handle financial analysis and reporting',
        permissions: ['financial_access', 'report_generation', 'data_export'],
        status: 'active',
        notes: 'Financial data analysis and reporting'
      },
      {
        name: 'Operations Manager',
        description: 'Oversee daily operations and process optimization',
        permissions: ['project_view', 'report_view', 'task_view'],
        status: 'active',
        notes: 'Operational efficiency and process management'
      },
      {
        name: 'Customer Service Rep',
        description: 'Handle customer inquiries and support requests',
        permissions: ['client_communication', 'task_view', 'profile_view'],
        status: 'active',
        notes: 'First point of contact for customer support'
      },
      {
        name: 'IT Support',
        description: 'Provide technical support and system maintenance',
        permissions: ['system_settings', 'user_management', 'audit_logs'],
        status: 'active',
        notes: 'Technical support and system administration'
      },
      {
        name: 'Logistic',
        description: 'Manage logistics, transportation, and supply chain operations',
        permissions: ['project_view', 'task_assignment', 'report_view', 'client_communication'],
        status: 'active',
        notes: 'Handles vehicle fleet, shipments, inventory, and route management'
      },
      {
        name: 'Department Director',
        description: 'Technical + managerial role focused on department performance, project quality, timelines, and coordination',
        permissions: ['project_management', 'team_management', 'report_generation', 'quality_control', 'deliverable_review', 'department_management', 'client_communication', 'data_export'],
        status: 'active',
        notes: 'Sits between Managing Director and Project Managers. Oversees department performance, project quality, compliance, and technical delivery for consulting & engineering projects (water, energy, environment, infrastructure, ESIA, supervision)'
      },
      {
        name: 'Project Manager',
        description: 'Manages day-to-day project execution, task oversight, deliverables, and team coordination for consulting and engineering projects',
        permissions: ['project_management', 'task_assignment', 'deliverable_management', 'team_coordination', 'report_generation', 'quality_control', 'client_communication', 'risk_management'],
        status: 'active',
        notes: 'Handles project planning, task oversight, deliverables management, reviews & approvals, quality compliance, risks & issues, and team coordination for HCC consulting projects (feasibility, design, ESIA, supervision)'
      },
      {
        name: 'LogisticProject',
        description: 'Project implementation support role focused on field operations, transport, fuel, and logistics for assigned projects within their department',
        permissions: ['project_view', 'task_assignment', 'report_view', 'field_operations', 'transport_management', 'fuel_logging', 'vehicle_tracking'],
        status: 'active',
        notes: 'Department-based and project-based access. Executes logistics tasks, records transport and fuel data, supports field operations for consulting and engineering projects. Cannot approve budgets but can submit records and escalate issues.'
      },
      {
        name: 'FinanceProject',
        description: 'Project-focused finance role supporting project implementation by tracking budgets, costs, payments, and expenses per department and per project',
        permissions: ['project_view', 'financial_access', 'budget_tracking', 'expense_management', 'payment_processing', 'report_generation', 'approval_requests', 'data_export'],
        status: 'active',
        notes: 'Department-based and project-based access. Tracks budgets, costs, and payments for assigned projects. Supports project implementation by monitoring financial health, expense tracking, and payment processing. Collaborates with Project Managers and Department Directors.'
      }
    ];

    // Check if roles already exist
    const existingRoles = await Role.findAll({ limit: 1 });
    if (existingRoles.length === 0) {
      console.log('Inserting sample roles...');
      for (const roleData of sampleRoles) {
        await Role.create(roleData);
        console.log(`Created role: ${roleData.name}`);
      }
      console.log('Sample roles inserted successfully.');
    } else {
      console.log('Roles already exist, skipping sample data insertion.');
    }

  } catch (error) {
    console.error('Error during roles table initialization:', error);
    throw error;
  }
}

// Export the function for use in other modules
export async function initializeRoles() {
  return initializeRolesTable();
}

// Run the initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeRolesTable().catch(() => process.exit(1));
}
