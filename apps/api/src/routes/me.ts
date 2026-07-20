// Client dashboard routes (Phase 3b-2 — FR-C1..C4, AC-3b-6/10) — Unit B.
//
//   GET   /me/progress      — ClientProgressDTO[] (one per client dog; threshold series).
//   GET   /me/homework      — HomeworkDTO[] (joined to exercise; incomplete-first).
//   PATCH /me/homework/:id   — mark (in)complete (200 HomeworkDTO; the ONLY client write).
//   GET   /me/bookings      — BookingDTO[] (the client's bookings, newest-first).
//
// AUTH: the whole `/me/*` prefix is gated by the app-level `requireClient` guard, so
// `user` is always a client here. Every handler still reads `getUser(c)` and 403s
// defensively if `clientId` is somehow null — the client id ALWAYS comes from the
// session (never a path param to spoof — DG-2), so a client only ever sees their
// own data (AC-3b-6).
//
// NO N+1: the progress read mirrors the dogs.ts timeline batching — one query for
// the client's dogs, one for their sessions, then ONE `inArray` query for all
// behavior events across those sessions, grouped in TS by dog (NFR-7, no new index).
// The moat is READ-ONLY here — behavior_event is never mutated; the only write is
// homework.completed / completedAt.
//
// Follows routes/dogs.ts verbatim: `new Hono<AppEnv>()`, zValidator, plain
// select()/inArray batching, row→DTO mappers, `.toISOString()`, ESM `.js` specifiers.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type {
  BookingDTO,
  ClientProgressDTO,
  DogSummaryDTO,
  HomeworkDTO,
  ProgressPointDTO,
} from '@tailsup/shared';
import { db } from '../db/client.js';
import { behaviorEvent, booking, dog, exercise, homework, session } from '../db/schema.js';
import { getUser, type AppEnv } from '../middleware/auth.js';

export const me = new Hono<AppEnv>();

// ── Row → DTO mappers ──────────────────────────────────────────────────────────

type DogRow = typeof dog.$inferSelect;
type BookingRow = typeof booking.$inferSelect;

function toDogSummary(row: DogRow): DogSummaryDTO {
  return {
    id: row.id,
    name: row.name,
    breed: row.breed,
    ageMonths: row.ageMonths,
    clientId: row.clientId,
    protocolId: row.protocolId ?? null,
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

// ── GET /me/progress (FR-C1 / DG-6 / AC-3b-10) ──────────────────────────────────
// One ClientProgressDTO per client dog. `points` = threshold-over-time, chronological
// (oldest → newest) so ProgressCurve draws them left-to-right. A dog with no events
// gets `points: []` (the dashboard shows a friendly empty card, never a broken curve).
me.get('/me/progress', async (c) => {
  const user = getUser(c);
  if (!user?.clientId) return c.json({ error: 'forbidden' }, 403);

  // (1) the client's dogs.
  const dogRows: DogRow[] = await db
    .select()
    .from(dog)
    .where(eq(dog.clientId, user.clientId))
    .orderBy(asc(dog.name));
  if (dogRows.length === 0) return c.json([] as ClientProgressDTO[], 200);

  // (2) sessions across those dogs.
  const dogIds = dogRows.map((d) => d.id);
  const sessionRows = await db
    .select()
    .from(session)
    .where(inArray(session.dogId, dogIds))
    .orderBy(asc(session.startedAt));

  // (3) ONE query for all events across those sessions, chronological (no N+1).
  const sessionIds = sessionRows.map((s) => s.id);
  const eventRows = sessionIds.length
    ? await db
        .select()
        .from(behaviorEvent)
        .where(inArray(behaviorEvent.sessionId, sessionIds))
        .orderBy(asc(behaviorEvent.occurredAt))
    : [];

  // (4) group events → dog (via session→dog), preserving chronological order.
  const dogIdBySession = new Map(sessionRows.map((s) => [s.id, s.dogId]));
  const pointsByDog = new Map<string, ProgressPointDTO[]>();
  for (const ev of eventRows) {
    const dogId = dogIdBySession.get(ev.sessionId);
    if (!dogId) continue;
    const point: ProgressPointDTO = {
      occurredAt: ev.occurredAt.toISOString(),
      thresholdMeters: ev.thresholdMeters,
      intensity: ev.intensity,
      outcome: ev.outcome as ProgressPointDTO['outcome'],
    };
    const list = pointsByDog.get(dogId);
    if (list) list.push(point);
    else pointsByDog.set(dogId, [point]);
  }

  const result: ClientProgressDTO[] = dogRows.map((d) => ({
    dog: toDogSummary(d),
    points: pointsByDog.get(d.id) ?? [],
  }));
  return c.json(result, 200);
});

// ── GET /me/homework (FR-C2 / AC-3b-10) ──────────────────────────────────────────
// Homework across the client's dogs, joined to its exercise for title/instructions.
// Ordered incomplete-first (completed asc → false before true) then by exercise title.
me.get('/me/homework', async (c) => {
  const user = getUser(c);
  if (!user?.clientId) return c.json({ error: 'forbidden' }, 403);

  const dogRows = await db
    .select({ id: dog.id })
    .from(dog)
    .where(eq(dog.clientId, user.clientId))
    .orderBy(asc(dog.name));
  if (dogRows.length === 0) return c.json([] as HomeworkDTO[], 200);

  const dogIds = dogRows.map((d) => d.id);
  const rows = await db
    .select({
      id: homework.id,
      dogId: homework.dogId,
      exerciseId: homework.exerciseId,
      completed: homework.completed,
      completedAt: homework.completedAt,
      title: exercise.title,
      instructions: exercise.instructions,
    })
    .from(homework)
    .innerJoin(exercise, eq(homework.exerciseId, exercise.id))
    .where(inArray(homework.dogId, dogIds))
    .orderBy(asc(homework.completed), asc(exercise.title));

  const result: HomeworkDTO[] = rows.map((row) => ({
    id: row.id,
    dogId: row.dogId,
    exerciseId: row.exerciseId,
    title: row.title,
    instructions: row.instructions,
    completed: row.completed,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  }));
  return c.json(result, 200);
});

// ── PATCH /me/homework/:id (FR-C2 / AC-3b-10) — the only client write ─────────────
// Marks the homework (in)complete. Verifies the homework's dog belongs to the
// session client (→ 404 otherwise — never touch another client's homework).
const updateHomeworkBody = z.object({ completed: z.boolean() });

me.patch('/me/homework/:id', zValidator('json', updateHomeworkBody), async (c) => {
  const user = getUser(c);
  if (!user?.clientId) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.param('id');
  const { completed } = c.req.valid('json');

  const [hwRow] = await db.select().from(homework).where(eq(homework.id, id)).limit(1);
  if (!hwRow) return c.json({ error: 'homework not found' }, 404);

  const [dogRow] = await db.select().from(dog).where(eq(dog.id, hwRow.dogId)).limit(1);
  if (!dogRow || dogRow.clientId !== user.clientId) {
    return c.json({ error: 'homework not found' }, 404);
  }

  const [updated] = await db
    .update(homework)
    .set({ completed, completedAt: completed ? new Date() : null })
    .where(eq(homework.id, id))
    .returning();

  // Re-join the exercise for the DTO's title/instructions.
  const [exerciseRow] = await db
    .select({ title: exercise.title, instructions: exercise.instructions })
    .from(exercise)
    .where(eq(exercise.id, updated.exerciseId))
    .limit(1);

  const dto: HomeworkDTO = {
    id: updated.id,
    dogId: updated.dogId,
    exerciseId: updated.exerciseId,
    title: exerciseRow?.title ?? '',
    instructions: exerciseRow?.instructions ?? '',
    completed: updated.completed,
    completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
  };
  return c.json(dto, 200);
});

// ── GET /me/bookings (FR-C3 / DG-3 / AC-3b-10) ───────────────────────────────────
// The client's bookings, newest-first. Feeds the in-app derived reminders (DG-3).
me.get('/me/bookings', async (c) => {
  const user = getUser(c);
  if (!user?.clientId) return c.json({ error: 'forbidden' }, 403);

  const rows = await db
    .select()
    .from(booking)
    .where(eq(booking.clientId, user.clientId))
    .orderBy(desc(booking.createdAt));

  return c.json(rows.map(toBookingDTO), 200);
});
