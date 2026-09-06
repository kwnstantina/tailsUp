// Trainer seed (db:seed) — resolves the chicken-and-egg in the required config.
//
// config.ts requires DEFAULT_TRAINER_ID at startup, but that UUID is a row in
// the `trainer` table, and nothing else creates one. So a fresh deployment can
// never boot until a trainer exists. This script creates it and prints the id
// to paste into DEFAULT_TRAINER_ID.
//
// It runs BEFORE the API has a valid DEFAULT_TRAINER_ID, so it must not import
// config.ts (which would throw on the very var this script exists to produce) —
// it reads DATABASE_URL directly and builds its own pool.
//
// Idempotent: re-running with the same email prints the existing id instead of
// creating a duplicate (`trainer.email` has no unique constraint, so the guard
// is here rather than an ON CONFLICT clause).
//
// Usage:
//   SEED_TRAINER_EMAIL=you@example.com SEED_TRAINER_NAME='Your Name' \
//     npm run db:seed -w apps/api

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { trainer } from './db/schema.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const email = required('SEED_TRAINER_EMAIL').trim();
  const name = (process.env.SEED_TRAINER_NAME ?? 'TailsUp Trainer').trim();

  const pool = new Pool({ connectionString: required('DATABASE_URL') });
  const db = drizzle(pool, { schema: { trainer }, casing: 'snake_case' });

  try {
    const [existing] = await db
      .select()
      .from(trainer)
      .where(eq(trainer.email, email))
      .limit(1);

    if (existing) {
      console.log(`Trainer already exists for ${email}.`);
      console.log(`DEFAULT_TRAINER_ID=${existing.id}`);
      return;
    }

    const [created] = await db
      .insert(trainer)
      .values({ name, email })
      .returning();

    console.log(`Created trainer "${created.name}" <${created.email}>.`);
    console.log(`DEFAULT_TRAINER_ID=${created.id}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
