// Single-practice trainer resolution (design D-2 / investigation 6b) — Unit B.
//
// The public capture endpoints (POST /leads, POST /bookings) have no auth and no
// trainer in context, yet lead.trainerId / booking.trainerId are NOT-NULL FKs.
// resolveTrainerId() supplies the practice trainer for those writes:
//
//   1. PRACTICE_TRAINER_ID env var (read LAZILY at call time — like lib/r2.ts,
//      kept OUT of config.ts so the API boots / tests run without it) → use it.
//   2. Else the sole/oldest `trainer` row.
//   3. Else THROW — the route maps this to 503 { error: 'practice not configured' }.
//
// We NEVER fabricate an id and NEVER insert with an empty trainerId (the FK would
// reject it and leak a 500); an explicit throw → clean 503 is the honest signal.
//
// PRACTICE_TRAINER_ID stays OUT of config.ts (intentionally optional).

import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { trainer } from '../db/schema.js';

// Thrown when no practice trainer can be resolved. The route catches it and
// returns 503 { error: 'practice not configured' }.
export class PracticeNotConfiguredError extends Error {
  constructor() {
    super('practice not configured');
    this.name = 'PracticeNotConfiguredError';
  }
}

// Resolve the practice trainer id for a public write. Throws
// PracticeNotConfiguredError if neither the env var nor a trainer row yields one.
export async function resolveTrainerId(): Promise<string> {
  // 1. Explicit env override (lazy read).
  const envId = process.env.PRACTICE_TRAINER_ID;
  if (envId && envId.trim() !== '') {
    return envId.trim();
  }

  // 2. Sole/oldest trainer row. The trainer table has no createdAt column, so
  //    order by id for a stable, deterministic pick.
  const [row] = await db
    .select({ id: trainer.id })
    .from(trainer)
    .orderBy(asc(trainer.id))
    .limit(1);

  if (row) {
    return row.id;
  }

  // 3. Nothing resolvable — fail honestly (→ 503), never insert empty.
  throw new PracticeNotConfiguredError();
}

// Look up a trainer's email (the lead-notification recipient — OQ-7).
// Returns null when the id has no row / no email, so the email helper can stub.
export async function getTrainerEmail(id: string): Promise<string | null> {
  const [row] = await db
    .select({ email: trainer.email })
    .from(trainer)
    .where(eq(trainer.id, id))
    .limit(1);

  return row?.email ?? null;
}
