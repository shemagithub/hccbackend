import pool from '../config/db.js';

const URGENCY_MIGRATION_SQL = [
  "UPDATE opportunities SET urgency = 'not_urgent' WHERE urgency IN ('low', 'medium')",
  "UPDATE opportunities SET urgency = 'urgent' WHERE urgency = 'high'",
  "UPDATE opportunities SET urgency = 'very_urgent' WHERE urgency = 'critical'",
  "ALTER TABLE opportunities MODIFY COLUMN urgency ENUM('not_urgent', 'urgent', 'very_urgent', 'past_due') NOT NULL DEFAULT 'not_urgent'",
];

const DECISION_MIGRATION_SQL = [
  "UPDATE opportunities SET decision = 'submitted' WHERE decision = 'pending'",
  "UPDATE opportunities SET decision = 'under_preparation' WHERE decision = 'approved'",
  "UPDATE opportunities SET decision = 'internal_review' WHERE decision = 'under_review'",
  "UPDATE opportunities SET decision = 'failed' WHERE decision IN ('rejected', 'cancelled')",
  "ALTER TABLE opportunities MODIFY COLUMN decision ENUM('submitted', 'under_preparation', 'internal_review', 'overdue', 'failed') NOT NULL DEFAULT 'submitted'",
];

export async function migrateOpportunityStatusFields() {
  const connection = await pool.getConnection();
  try {
    for (const query of URGENCY_MIGRATION_SQL) {
      await connection.execute(query);
    }
    for (const query of DECISION_MIGRATION_SQL) {
      await connection.execute(query);
    }
    console.log('Opportunity urgency/decision fields migrated successfully.');
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_TRUNCATED_WRONG_VALUE') {
      console.warn('Opportunity field migration skipped or partially applied:', error.message);
      return;
    }
    throw error;
  } finally {
    connection.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateOpportunityStatusFields()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
