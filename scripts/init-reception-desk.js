import { createReceptionTables } from '../models/Reception.js';

export async function initializeReceptionDesk() {
  await createReceptionTables();
  console.log('✅ Reception desk tables initialized');
}
