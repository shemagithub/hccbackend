import dotenv from 'dotenv';
import { ensureDatabase } from '../config/db.js';

dotenv.config();

const initDatabase = async () => {
  const ok = await ensureDatabase();
  if (!ok) {
    process.exit(1);
  }
  console.log('🎉 Database initialization completed successfully!');
  process.exit(0);
};

initDatabase();
