// Trainer management routes (Phase 3b-2 — FR-T1..T3, AC-3b-6/7/8) — Unit B.
//
//   GET   /trainers/:trainerId/leads    — LeadDTO[]    newest-first (createdAt desc).
//   GET   /trainers/:trainerId/bookings — BookingDTO[] newest-first (createdAt desc).
//   PATCH /bookings/:id/status          — transition a booking (200 BookingDTO).
//   POST  /leads/:id/convert            — lead → client (201 ConvertLeadResponse).
//   POST  /clients/:id/login            — provision a client login (201 ClientLoginDTO).
//
// AUTH (DG-2): the two GET lists sit under `/trainers/:trainerId/*`, already gated
// by the app-level `requireTrainerOwnsParam` prefix guard — the path id equals the
// session trainer, so no extra guard here. The three MUTATIONS live under
// `/bookings`, `/leads`, `/clients` prefixes that collide with the PUBLIC
// `POST /leads` + `POST /bookings`, so they carry a ROUTE-SCOPED `requireTrainer`
// (never a prefix `app.use`, which would gate the public POSTs). Every mutation
// re-checks row ownership against the session trainer (→ 404, never revealing
// another trainer's rows — NFR-3).
//
// Follows routes/dogs.ts verbatim: `export const x = new Hono<AppEnv>()`, zValidator,
// db.select()/insert()/update().returning(), eq/desc from drizzle-orm, row→DTO
// mappers at the top, `.toISOString()` on timestamps, ESM `.js` import specifiers,
// `{ error }` JSON on failures.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type {
  BookingDTO,
  ClientDTO,
  ClientLoginDTO,
  ConvertLeadResponse,
  LeadDTO,
} from '@tailsup/shared';
import { db } from '../db/client.js';
import { booking, client, lead } from '../db/schema.js';
import { user as userTable } from '../db/auth-schema.js';
import { auth } from '../lib/auth.js';
import { getUser, requireTrainer, type AppEnv } from '../middleware/auth.js';

export const management = new Hono<AppEnv>();

// ── Row → DTO mappers ──────────────────────────────────────────────────────────

type LeadRow = typeof lead.$inferSelect;
type BookingRow = typeof booking.$inferSelect;
type ClientRow = typeof client.$inferSelect;

function toLeadDTO(row: LeadRow): LeadDTO {
  return {
    id: row.id,
    trainerId: row.trainerId,
    name: row.name,
    contact: row.contact,
    source: row.source,
    message: row.message,
    status: row.status as LeadDTO['status'],
    clientId: row.clientId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toBookingDTO(row: BookingRow): BookingDTO {
  return {
    id: row.id,
    trainerId: row.trainerId,
    leadId: row.leadId,
    clientId: row.clientId,
    type: row.type as BookingDTO['type'],
    requestedAt: row.requestedAt.toISOString(),
    status: row.status as BookingDTO['status'],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function toClientDTO(row: ClientRow): ClientDTO {
  return {
    id: row.id,
    trainerId: row.trainerId,
    name: row.name,
    contact: row.contact,
  };
}

// ── GET /trainers/:trainerId/leads (FR-T1) ──────────────────────────────────────
// Gated by the app-level requireTrainerOwnsParam prefix guard — the path id already
// equals the session trainer.
management.get('/trainers/:trainerId/leads', async (c) => {
  const trainerId = c.req.param('trainerId');

  const rows = await db
    .select()
    .from(lead)
    .where(eq(lead.trainerId, trainerId))
    .orderBy(desc(lead.createdAt));

  return c.json(rows.map(toLeadDTO), 200);
});

// ── GET /trainers/:trainerId/bookings (FR-T1) ───────────────────────────────────
management.get('/trainers/:trainerId/bookings', async (c) => {
  const trainerId = c.req.param('trainerId');

  const rows = await db
    .select()
    .from(booking)
    .where(eq(booking.trainerId, trainerId))
    .orderBy(desc(booking.createdAt));

  return c.json(rows.map(toBookingDTO), 200);
});

// ── PATCH /bookings/:id/status (FR-T3 / DG-4 / AC-3b-7) ──────────────────────────
// Route-scoped requireTrainer. `requested` is NOT a valid target (a booking is
// created 'requested' by the public 3a endpoint; the trainer moves it forward).
// No transition state-machine in 3b-2 (DG-4).
const updateBookingStatusBody = z.object({
  status: z.enum(['confirmed', 'declined', 'completed', 'cancelled']),
});

management.patch(
  '/bookings/:id/status',
  requireTrainer,
  zValidator('json', updateBookingStatusBody),
  async (c) => {
    const id = c.req.param('id');
    const { status } = c.req.valid('json');
    const user = getUser(c);

    const [row] = await db.select().from(booking).where(eq(booking.id, id)).limit(1);
    // 404 on missing OR not-theirs — never reveal another trainer's rows (NFR-3).
    if (!row || row.trainerId !== user?.trainerId) {
      return c.json({ error: 'booking not found' }, 404);
    }

    const [updated] = await db
      .update(booking)
      .set({ status })
      .where(eq(booking.id, id))
      .returning();

    return c.json(toBookingDTO(updated), 200);
  },
);

// ── POST /leads/:id/convert (FR-T2 / DG-5 / AC-3b-8) ─────────────────────────────
// Route-scoped requireTrainer. Creates the domain `client` row + flips the lead to
// 'converted' (with clientId) in ONE db.transaction (both or neither). Idempotency:
// an already-'converted' lead → 409 (no duplicate client, DG-5). Login provisioning
// is a SEPARATE action (POST /clients/:id/login — DG-1).
management.post('/leads/:id/convert', requireTrainer, async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const [leadRow] = await db.select().from(lead).where(eq(lead.id, id)).limit(1);
  if (!leadRow || leadRow.trainerId !== user?.trainerId) {
    return c.json({ error: 'lead not found' }, 404);
  }
  if (leadRow.status === 'converted') {
    return c.json({ error: 'lead already converted' }, 409);
  }

  const { createdClient, updatedLead } = await db.transaction(async (tx) => {
    const [createdClient] = await tx
      .insert(client)
      .values({
        trainerId: leadRow.trainerId,
        name: leadRow.name,
        contact: leadRow.contact,
      })
      .returning();

    const [updatedLead] = await tx
      .update(lead)
      .set({ status: 'converted', clientId: createdClient.id })
      .where(eq(lead.id, id))
      .returning();

    return { createdClient, updatedLead };
  });

  const response: ConvertLeadResponse = {
    client: toClientDTO(createdClient),
    lead: toLeadDTO(updatedLead),
  };
  return c.json(response, 201);
});

// ── POST /clients/:id/login (FR-T2 / DG-1 / AC-3b-8) ─────────────────────────────
// Route-scoped requireTrainer. Mirrors seed.ts `ensureAuthUser`: signUpEmail creates
// the BetterAuth user+account (hashing the trainer-supplied initial password), then
// a Drizzle patch links role:'client' + clientId to the domain row. A duplicate
// email (login already exists) → 409.
const createClientLoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8), // BetterAuth minPasswordLength
});

management.post(
  '/clients/:id/login',
  requireTrainer,
  zValidator('json', createClientLoginBody),
  async (c) => {
    const id = c.req.param('id');
    const { email, password } = c.req.valid('json');
    const user = getUser(c);

    const [clientRow] = await db.select().from(client).where(eq(client.id, id)).limit(1);
    if (!clientRow || clientRow.trainerId !== user?.trainerId) {
      return c.json({ error: 'client not found' }, 404);
    }

    // signUpEmail creates the user + account rows; a duplicate email throws → 409
    // (mirrors seed.ts, where the throw means "already exists").
    try {
      await auth.api.signUpEmail({ body: { email, password, name: clientRow.name } });
    } catch {
      return c.json({ error: 'login already exists' }, 409);
    }

    const [userRow] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);
    if (!userRow) {
      // signUpEmail reported success but no row is present — provisioning failed.
      return c.json({ error: 'login provisioning failed' }, 500);
    }

    await db
      .update(userTable)
      .set({ role: 'client', clientId: id })
      .where(eq(userTable.id, userRow.id))
      .returning();

    const response: ClientLoginDTO = { userId: userRow.id, clientId: id, email };
    return c.json(response, 201);
  },
);
