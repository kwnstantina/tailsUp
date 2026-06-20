// Drizzle/pg client. Uses a node-postgres Pool built from the validated config
// (config.ts throws if DATABASE_URL is missing — D-8/D-11).
//
// casing: 'snake_case' maps camelCase TS column keys to snake_case DB columns,
// matching drizzle.config.ts so generated migrations and runtime agree.

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

// (If a Railway SSL cert error appears in prod, add
//  ssl: { rejectUnauthorized: false } here — not added pre-emptively.)
export const pool = new Pool({ connectionString: config.databaseUrl });

export const db = drizzle(pool, { schema, casing: 'snake_case' });

export { schema };
