// Dog read + session-start routes (design P2.3.1–P2.3.4) — Unit B.
//
//   GET  /trainers/:trainerId/dogs   — DogSummaryDTO[] (unknown trainer → []).
//   GET  /dogs/:id                    — DogDetailDTO (404 if missing).
//   GET  /dogs/:id/timeline           — DogTimelineDTO reverse-chron (404).
//   POST /dogs/:id/sessions           — start a session (404, 201 SessionSummaryDTO).
//
// All reads use plain Drizzle select() + joins + inArray batching — NO relations()
// and NO migration (R-7). The nested reverse-chronological timeline (sessions desc,
// events desc within each) is exactly why select() is used over the relational
// query builder (P2.6). Two queries total for the timeline regardless of size
// (NFR-7, no N+1).

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { count, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type {
  BehaviorEventDTO,
  DogDetailDTO,
  DogSummaryDTO,
  DogTimelineDTO,
  SessionSummaryDTO,
  TimelineSessionDTO,
} from '@tailsup/shared';
import { db } from '../db/client.js';
import { behaviorEvent, client, dog, session } from '../db/schema.js';

export const dogs = new Hono();

// ── Row → DTO mappers ──────────────────────────────────────────────────────────

type DogRow = typeof dog.$inferSelect;
type SessionRow = typeof session.$inferSelect;
type BehaviorEventRow = typeof behaviorEvent.$inferSelect;

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

function toBehaviorEventDTO(row: BehaviorEventRow): BehaviorEventDTO {
  return {
    id: row.id,
    sessionId: row.sessionId,
    occurredAt: row.occurredAt.toISOString(),
    triggerType: row.triggerType as BehaviorEventDTO['triggerType'],
    thresholdMeters: row.thresholdMeters,
    intensity: row.intensity,
    outcome: row.outcome as BehaviorEventDTO['outcome'],
    intervention: row.intervention,
    note: row.note,
    tags: row.tags ?? null,
  };
}

// ── GET /trainers/:trainerId/dogs (FR-A3) ───────────────────────────────────────
// Unknown/empty trainer → 200 [] (G-1 — unauthenticated read returns the empty
// set, not 404; the join simply matches nothing for an unknown id).
dogs.get('/trainers/:trainerId/dogs', async (c) => {
  const trainerId = c.req.param('trainerId');

  const rows = await db
    .select({
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
      ageMonths: dog.ageMonths,
      clientId: dog.clientId,
      protocolId: dog.protocolId,
    })
    .from(dog)
    .innerJoin(client, eq(dog.clientId, client.id))
    .where(eq(client.trainerId, trainerId));

  const result: DogSummaryDTO[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    breed: row.breed,
    ageMonths: row.ageMonths,
    clientId: row.clientId,
    protocolId: row.protocolId ?? null,
  }));

  return c.json(result, 200);
});

// ── GET /dogs/:id (FR-A4) ───────────────────────────────────────────────────────
dogs.get('/dogs/:id', async (c) => {
  const id = c.req.param('id');

  const [dogRow] = await db.select().from(dog).where(eq(dog.id, id)).limit(1);
  if (!dogRow) {
    return c.json({ error: 'dog not found' }, 404);
  }

  // Sessions with a grouped event count (left join → 0 for an empty session).
  // Uses session_dog_started_idx; newest-first.
  const sessionRows = await db
    .select({
      id: session.id,
      startedAt: session.startedAt,
      location: session.location,
      eventCount: count(behaviorEvent.id),
    })
    .from(session)
    .leftJoin(behaviorEvent, eq(behaviorEvent.sessionId, session.id))
    .where(eq(session.dogId, id))
    .groupBy(session.id)
    .orderBy(desc(session.startedAt));

  const sessions: SessionSummaryDTO[] = sessionRows.map((row) => ({
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    location: row.location ?? null,
    eventCount: Number(row.eventCount),
  }));

  const result: DogDetailDTO = { ...toDogSummary(dogRow), sessions };
  return c.json(result, 200);
});

// ── GET /dogs/:id/timeline (FR-A6) — the nested reverse-chron read ──────────────
dogs.get('/dogs/:id/timeline', async (c) => {
  const id = c.req.param('id');

  const [dogRow] = await db.select().from(dog).where(eq(dog.id, id)).limit(1);
  if (!dogRow) {
    return c.json({ error: 'dog not found' }, 404);
  }

  // (1) sessions newest-first (uses session_dog_started_idx).
  const sessionRows: SessionRow[] = await db
    .select()
    .from(session)
    .where(eq(session.dogId, id))
    .orderBy(desc(session.startedAt));

  // (2) ONE query for all events across the dog's sessions, newest-first
  //     (uses behavior_event_session_occurred_idx — no N+1, NFR-7).
  const sessionIds = sessionRows.map((s) => s.id);
  const eventRows: BehaviorEventRow[] = sessionIds.length
    ? await db
        .select()
        .from(behaviorEvent)
        .where(inArray(behaviorEvent.sessionId, sessionIds))
        .orderBy(desc(behaviorEvent.occurredAt))
    : [];

  // (3) group events by sessionId in TS, preserving the desc order.
  const eventsBySession = new Map<string, BehaviorEventDTO[]>();
  for (const row of eventRows) {
    const list = eventsBySession.get(row.sessionId);
    const dto = toBehaviorEventDTO(row);
    if (list) {
      list.push(dto);
    } else {
      eventsBySession.set(row.sessionId, [dto]);
    }
  }

  const sessions: TimelineSessionDTO[] = sessionRows.map((s) => ({
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    location: s.location ?? null,
    events: eventsBySession.get(s.id) ?? [],
  }));

  const result: DogTimelineDTO = { dog: toDogSummary(dogRow), sessions };
  return c.json(result, 200);
});

// ── POST /dogs/:id/sessions (G-2 / OQ-7) — the one borderline write ─────────────
const startSessionBody = z.object({
  startedAt: z.iso.datetime().optional(), // ISO; defaults to now (zod v4: z.iso.datetime)
  location: z.string().optional(),
});

dogs.post('/dogs/:id/sessions', zValidator('json', startSessionBody), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  // Verify the dog exists (404).
  const [dogRow] = await db.select().from(dog).where(eq(dog.id, id)).limit(1);
  if (!dogRow) {
    return c.json({ error: 'dog not found' }, 404);
  }

  // bookingId left null — a trainer-initiated session is not tied to a booking.
  const [created] = await db
    .insert(session)
    .values({
      dogId: id,
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
      location: body.location ?? null,
    })
    .returning();

  const dto: SessionSummaryDTO = {
    id: created.id,
    startedAt: created.startedAt.toISOString(),
    location: created.location ?? null,
    eventCount: 0, // a freshly started session has no events
  };

  return c.json(dto, 201);
});
