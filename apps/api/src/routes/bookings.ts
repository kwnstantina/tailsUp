// POST /bookings (PUBLIC, unauthenticated) — Phase 3a public capture (FR-A3).
//
// Flow (design P3a / investigation 6a–6b), in order:
//   1. zValidator('json', createBooking) — type ∉ BOOKING_TYPES, non-ISO
//      requestedAt, missing/empty name|contact, or an over-cap field → 400.
//   2. resolveTrainerId() — PRACTICE_TRAINER_ID → sole/oldest trainer → throw,
//      caught and mapped to 503 { error: 'practice not configured' }.
//   3. Insert the booking row (status DB-default 'requested', leadId: null,
//      clientId: null — D-7 keeps 3a simple). requestedAt is converted to a Date.
//      The `booking` table has NO name/contact columns, so the captured contact
//      is folded into `notes` (prepended) so it is not lost (Unit A note / D-7).
//   4. Return 201 with the BookingDTO.
//
// Follows routes/sessions.ts verbatim (Hono sub-app, zValidator, .returning(),
// { error } JSON, c.json(dto, 201), ESM .js specifiers, .toISOString()).

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { BOOKING_TYPES } from '@tailsup/shared';
import type { BookingDTO } from '@tailsup/shared';
import { db } from '../db/client.js';
import { booking } from '../db/schema.js';
import { PracticeNotConfiguredError, resolveTrainerId } from '../lib/trainer.js';

// type from the shared array; requestedAt ISO; name/contact captured for the
// practice to follow up (folded into notes). .max caps satisfy FR-A3.
const createBooking = z.object({
  type: z.enum(BOOKING_TYPES),
  requestedAt: z.iso.datetime(),
  name: z.string().min(1).max(200),
  contact: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});

export const bookings = new Hono();

bookings.post('/bookings', zValidator('json', createBooking), async (c) => {
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

  // 3. Fold the captured name/contact into `notes` (no such columns exist; D-7).
  const notes = `[${body.name} · ${body.contact}] ${body.notes ?? ''}`.trim();

  const [created] = await db
    .insert(booking)
    .values({
      trainerId,
      leadId: null,
      clientId: null,
      type: body.type,
      requestedAt: new Date(body.requestedAt),
      notes,
    })
    .returning();

  const dto: BookingDTO = {
    id: created.id,
    trainerId: created.trainerId,
    leadId: created.leadId,
    clientId: created.clientId,
    type: created.type as BookingDTO['type'],
    requestedAt: created.requestedAt.toISOString(),
    status: created.status as BookingDTO['status'],
    notes: created.notes,
    createdAt: created.createdAt.toISOString(),
  };

  // 4. Respond.
  return c.json(dto, 201);
});
