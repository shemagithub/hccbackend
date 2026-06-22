import { repairAllMissingPrimaryKeys } from './ensure-primary-key.js';
import { initializeDepartments } from './init-departments.js';
import { initializeRoles } from './init-roles.js';
import { initializeStaff } from './init-staff.js';
import { initializeMessagesTable } from './init-messages.js';
import { initializeOpportunities } from './init-opportunities.js';
import { initializeProjects } from './init-projects.js';
import { initializeClients } from './init-clients.js';
import { initializeVehicles } from './init-vehicles.js';
import { initializeEOIs } from './init-eois.js';
import { initializeOpportunityProposals } from './init-opportunity-proposals.js';
import { initializeBudgets } from './init-budgets.js';
import initializeInvoices from './init-invoices.js';
import { initializeImplementations } from './init-implementations.js';
import { initializeTasks } from './init-tasks.js';
import { initializeDeliverables } from './init-deliverables.js';
import { initializeExpenses } from './init-expenses.js';
import { addMessageTypesToDiscussions } from './add-message-types-to-discussions.js';
import addReplyEditPinToDiscussions from './add-reply-edit-pin-to-discussions.js';
import { addAwardedDecisionFields } from './add-awarded-decision-fields.js';
import { initializeReceptionDesk } from './init-reception-desk.js';

import ClientBilling from '../models/ClientBilling.js';
import Contract from '../models/Contract.js';
import Team from '../models/Team.js';
import TeamMember from '../models/TeamMember.js';
import VendorPayment from '../models/VendorPayment.js';
import SupplierInvoice from '../models/SupplierInvoice.js';
import SalaryPayment from '../models/SalaryPayment.js';
import Deduction from '../models/Deduction.js';
import Bonus from '../models/Bonus.js';
import TaxManagement from '../models/TaxManagement.js';
import Milestone from '../models/Milestone.js';
import Trip from '../models/Trip.js';
import TripReport from '../models/TripReport.js';
import FuelLog from '../models/FuelLog.js';
import VehicleInspection from '../models/VehicleInspection.js';
import Maintenance from '../models/Maintenance.js';
import TimeAttendance from '../models/TimeAttendance.js';
import ProjectSupportLog from '../models/ProjectSupportLog.js';
import Skill from '../models/Skill.js';
import SkillProfile from '../models/SkillProfile.js';
import ProjectAssignment from '../models/ProjectAssignment.js';
import Availability from '../models/Availability.js';
import SkillGap from '../models/SkillGap.js';
import Training from '../models/Training.js';
import Performance from '../models/Performance.js';
import WorkReport from '../models/WorkReport.js';
import FieldReport from '../models/FieldReport.js';
import EmployeeRequest from '../models/EmployeeRequest.js';
import LeaveRequest from '../models/LeaveRequest.js';
import FundRequest from '../models/FundRequest.js';
import WorkBreakdown from '../models/WorkBreakdown.js';
import Document from '../models/Document.js';
import Driver from '../models/Driver.js';
import SupportTicket from '../models/SupportTicket.js';
import TicketMessage from '../models/TicketMessage.js';
import UserPermission from '../models/UserPermission.js';
import Review from '../models/Review.js';
import QualityControl from '../models/QualityControl.js';
import ComplianceCheck from '../models/ComplianceCheck.js';
import ESIAStandard from '../models/ESIAStandard.js';
import NonConformanceReport from '../models/NonConformanceReport.js';
import Risk from '../models/Risk.js';
import Issue from '../models/Issue.js';
import MitigationAction from '../models/MitigationAction.js';
import Escalation from '../models/Escalation.js';
import MeetingMinutes from '../models/MeetingMinutes.js';
import ActionItem from '../models/ActionItem.js';
import Responsibility from '../models/Responsibility.js';
import Notification from '../models/Notification.js';
import Payment from '../models/Payment.js';
import Approval from '../models/Approval.js';
import FieldTask from '../models/FieldTask.js';
import Meeting from '../models/Meeting.js';
import Discussion from '../models/Discussion.js';

async function createTable(Model, label) {
  console.log(`📋 Creating ${label} table...`);
  await Model.createTable();
  console.log(`✅ ${label} table ready`);
}

/**
 * Create all application tables (IF NOT EXISTS) and run lightweight schema migrations.
 * Called automatically when the server starts and the database is connected.
 */
export async function initializeDatabaseSchema() {
  console.log('🗄️  Initializing database schema...\n');

  await repairAllMissingPrimaryKeys();

  await initializeDepartments();
  await initializeRoles();
  await initializeStaff();
  await initializeMessagesTable();
  await initializeOpportunities();
  await initializeProjects();
  await initializeClients();
  await initializeVehicles();
  await initializeEOIs();
  await initializeOpportunityProposals();
  await initializeBudgets();
  await initializeInvoices();
  await initializeImplementations();
  await initializeTasks();
  await initializeDeliverables();
  await initializeExpenses();

  await createTable(Document, 'Documents');
  await createTable(Payment, 'Payments');
  await createTable(Approval, 'Approvals');
  await createTable(FieldTask, 'Field Tasks');
  await createTable(Meeting, 'Meetings');
  await createTable(Discussion, 'Discussions');

  await addMessageTypesToDiscussions();
  await addReplyEditPinToDiscussions();
  await addAwardedDecisionFields();
  await initializeReceptionDesk();

  await createTable(ClientBilling, 'Client Billings');
  await createTable(VendorPayment, 'Vendor Payments');
  await createTable(SupplierInvoice, 'Supplier Invoices');
  await createTable(SalaryPayment, 'Salary Payments');
  await createTable(Deduction, 'Deductions');
  await createTable(Bonus, 'Bonuses');
  await createTable(TaxManagement, 'Tax Management');
  await createTable(Contract, 'Contracts');
  await createTable(Team, 'Teams');
  await createTable(TeamMember, 'Team Members');
  await createTable(Milestone, 'Milestones');
  await createTable(Trip, 'Trips');
  await createTable(TripReport, 'Trip Reports');
  await createTable(FuelLog, 'Fuel Logs');
  await createTable(VehicleInspection, 'Vehicle Inspections');
  await createTable(Maintenance, 'Maintenance');
  await createTable(TimeAttendance, 'Time Attendance');
  await createTable(ProjectSupportLog, 'Project Support Logs');
  await createTable(Skill, 'Skills');
  await createTable(SkillProfile, 'Skill Profiles');
  await createTable(ProjectAssignment, 'Project Assignments');
  await createTable(Availability, 'Availability');
  await createTable(SkillGap, 'Skill Gaps');
  await createTable(Training, 'Training');
  await createTable(Performance, 'Performance');
  await createTable(WorkReport, 'Work Reports');
  await createTable(FieldReport, 'Field Reports');
  await createTable(EmployeeRequest, 'Employee Requests');
  await createTable(LeaveRequest, 'Leave Requests');
  await createTable(FundRequest, 'Fund Requests');
  await createTable(WorkBreakdown, 'Work Breakdown');
  await createTable(Driver, 'Drivers');
  await createTable(SupportTicket, 'Support Tickets');
  await createTable(TicketMessage, 'Ticket Messages');
  await createTable(UserPermission, 'User Permissions');
  await createTable(Review, 'Reviews');
  await createTable(Notification, 'Notifications');
  await createTable(QualityControl, 'Quality Control');
  await createTable(ComplianceCheck, 'Compliance Checks');
  await createTable(ESIAStandard, 'ESIA Standards');
  await createTable(NonConformanceReport, 'Non-Conformance Reports');
  await createTable(Risk, 'Risks');
  await createTable(Issue, 'Issues');
  await createTable(MitigationAction, 'Mitigation Actions');
  await createTable(Escalation, 'Escalations');
  await createTable(MeetingMinutes, 'Meeting Minutes');
  await createTable(ActionItem, 'Action Items');
  await createTable(Responsibility, 'Responsibilities');

  console.log('\n✅ Database schema initialization complete');
}
