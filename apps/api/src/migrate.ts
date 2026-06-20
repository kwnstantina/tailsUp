// Programmatic migration runner (db:migrate).
// Applies the committed SQL migrations under ./drizzle to the DATABASE_URL target,
// then exits. Used in CI/deploy and to apply the from-scratch migration to an
// empty DB for AC-3.

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './db/client.js';

async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
