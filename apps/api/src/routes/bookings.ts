// POST /bookings (Phase 3 — public site booking request, Booking page form).
//
// A visitor requesting a booking supplies their name and contact details, but
// the `booking` table holds NEITHER — it carries contact only by reference
// (leadId / clientId, both nullable). So a public booking request writes TWO
// rows in ONE transaction:
//
//   lead    (source 'booking')  — carries the requester's name + contact
//   booking (leadId -> that lead) — carries type / requestedAt / notes
//
// The transaction matters: a booking whose lead insert failed would be an
// unreachable request (a slot held for someone with no contact details), and a
// lead whose booking failed would silently drop the thing the visitor asked
// for. Both rows land or neither does.
//
// Same public-write rules as POST /leads: `trainerId` comes from config, never
// the body, and `status` is never client-supplied — every request starts
// 'requested' and only the trainer advances it (PATCH /bookings/:id/status).

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { BOOKING_TYPES } from '@tailsup/shared';
import type { BookingDTO } from '@tailsup/shared';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { booking, lead } from '../db/schema.js';

const bookingBody = z.object({
  name: z.string().trim().min(1).max(200),
  contact: z.string().trim().min(1).max(200),
  type: z.enum(BOOKING_TYPES),
  // ISO-8601 datetime. Coerced to Date for the timestamptz column; an invalid
  // or non-ISO string fails validation here rather than at the driver.
  requestedAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(5000).optional(),
});

export const bookings = new Hono();

bookings.post('/bookings', zValidator('json', bookingBody), async (c) => {
  const body = c.req.valid('json');

  const created = await db.transaction(async (tx) => {
    const [leadRow] = await tx
      .insert(lead)
      .values({
        trainerId: config.defaultTrainerId,
        name: body.name,
        contact: body.contact,
        source: 'booking',
        message: body.notes ?? null,
      })
      .returning();

    const [bookingRow] = await tx
      .insert(booking)
      .values({
        trainerId: config.defaultTrainerId,
        leadId: leadRow.id,
        type: body.type,
        requestedAt: new Date(body.requestedAt),
        notes: body.notes ?? null,
        // status defaults to 'requested' in the schema.
      })
      .returning();

    return bookingRow;
  });

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

  return c.json(dto, 201);
});
