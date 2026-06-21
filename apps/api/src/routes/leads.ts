// POST /leads (PUBLIC, unauthenticated) — Phase 3a public capture (FR-A3).
//
// Flow (design P3a / investigation 6a–6c), in order:
//   1. zValidator('json', createLead) — missing/empty name|contact|source or an
//      over-cap field → automatic 400. Length caps (.max) satisfy the FR-A3
//      input-size limits.
//   2. resolveTrainerId() — PRACTICE_TRAINER_ID → sole/oldest trainer → throw.
//      The throw is caught and mapped to 503 { error: 'practice not configured' };
//      we never insert with a fabricated/empty trainerId (NOT-NULL FK).
//   3. Insert the lead row (status left to DB default 'new', clientId: null).
//   4. Look up the trainer's email (the notification recipient — OQ-7).
//   5. FIRE-AND-FORGET sendLeadNotification(...) — NEVER awaited. The email is
//      best-effort: a missing key (stub), an API error, or a transport rejection
//      must never block or fail the 201 (AC-3a-6 / NFR-9). The .catch() on the
//      un-awaited promise prevents an unhandled rejection from crashing Node.
//   6. Return 201 with the LeadDTO.
//
// Follows routes/sessions.ts verbatim: Hono sub-app, zValidator, db.insert()
// .returning(), { error } JSON on domain failures, c.json(dto, 201), ESM .js
// import specifiers, .toISOString() on timestamps.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { LeadDTO } from '@tailsup/shared';
import { db } from '../db/client.js';
import { lead } from '../db/schema.js';
import { sendLeadNotification } from '../lib/email.js';
import {
  PracticeNotConfiguredError,
  getTrainerEmail,
  resolveTrainerId,
} from '../lib/trainer.js';

// Length caps satisfy the FR-A3 input-size limits (matches investigation 6a).
const createLead = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().min(1).max(200),
  source: z.string().min(1).max(100),
  message: z.string().max(2000).optional(),
});

export const leads = new Hono();

leads.post('/leads', zValidator('json', createLead), async (c) => {
  const body = c.req.valid('json');

  // 2. Resolve the practice trainer (→ 503 if none configured).
  let trainerId: string;
  try {
    trainerId = await resolveTrainerId();
  } catch (err) {
    if (err instanceof PracticeNotConfiguredError) {
      return c.json({ error: 'practice not configured' }, 503);
    }
    throw err; // unexpected — let onError map to 500
  }

  // 3. Insert the lead (status DB-default 'new', clientId: null).
  const [created] = await db
    .insert(lead)
    .values({
      trainerId,
      name: body.name,
      contact: body.contact,
      source: body.source,
      message: body.message ?? null,
      clientId: null,
    })
    .returning();

  const dto: LeadDTO = {
    id: created.id,
    trainerId: created.trainerId,
    name: created.name,
    contact: created.contact,
    source: created.source,
    message: created.message,
    status: created.status as LeadDTO['status'],
    clientId: created.clientId,
    createdAt: created.createdAt.toISOString(),
  };

  // 4. + 5. Best-effort email — look up the recipient, then FIRE-AND-FORGET.
  // Never awaited; the .catch() absorbs any transport rejection so a slow/down
  // Resend (or an unhandled rejection) can neither block nor fail the 201.
  const trainerEmail = await getTrainerEmail(trainerId);
  void sendLeadNotification(trainerEmail, dto).catch((e) =>
    console.error('[email] send failed (non-fatal)', e),
  );

  // 6. Respond — the insert is the source of truth regardless of email outcome.
  return c.json(dto, 201);
});
