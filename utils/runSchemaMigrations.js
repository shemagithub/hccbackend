import Task from '../models/Task.js';
import Contract from '../models/Contract.js';
import Deliverable from '../models/Deliverable.js';
import RiskIssueComment from '../models/RiskIssueComment.js';

/** Apply incremental column migrations for existing databases. */
export async function runSchemaMigrations() {
  await Task.ensureSchemaFields();
  await Contract.createTable();
  await Deliverable.ensureSchemaFields();
  await RiskIssueComment.ensureSchemaFields();
}
