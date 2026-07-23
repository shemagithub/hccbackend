import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import EOI from '../models/EOI.js';
import OpportunityProposal from '../models/OpportunityProposal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function migrate() {
  console.log('Migrating EOI opportunity link and proposal tables...');
  await EOI.ensureOpportunityLink();
  await EOI.ensureAttachmentFields();
  await EOI.ensureGoDecisionField();
  await OpportunityProposal.ensureTable();
  await OpportunityProposal.ensureAttachmentFields();
  console.log('Migration completed successfully.');
  process.exit(0);
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
