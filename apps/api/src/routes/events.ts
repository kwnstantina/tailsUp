// Event read + mutation + media-persist routes (design P2.3.6–P2.3.8) — Unit B.
//
//   GET   /events/:id          — BehaviorEventWithMediaDTO (404 if missing).
//   PATCH /events/:id          — update note/tags ONLY (404; AC-4 moat protected).
//   POST  /events/:id/media    — record a media row after upload (404; 201 MediaDTO).
//
// AC-4: the PATCH body schema contains ONLY note + tags, so the four tap fields
// and `intervention` are structurally un-settable — they can never be mutated.
//
// POST /events/:id/media records the row AFTER the device confirms the direct R2
// upload (G-3). It makes NO R2 network call; it only derives the canonical
// blobUrl (G-7 key-only reference) from the key + R2 account/bucket and inserts.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type {
  BehaviorEventDTO,
  BehaviorEventWithMediaDTO,
  MediaDTO,
} from '@tailsup/shared';
import { db } from '../db/client.js';
import { behaviorEvent, media } from '../db/schema.js';
import { ALLOWED_CONTENT_TYPES, blobUrlForKey, getR2Config } from '../lib/r2.js';

export const events = new Hono();

type BehaviorEventRow = typeof behaviorEvent.$inferSelect;
type MediaRow = typeof media.$inferSelect;

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

function toMediaDTO(row: MediaRow): MediaDTO {
  return {
    id: row.id,
    eventId: row.eventId,
    blobUrl: row.blobUrl,
    type: row.type as MediaDTO['type'],
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

// ── GET /events/:id (FR-A8) ─────────────────────────────────────────────────────
events.get('/events/:id', async (c) => {
  const id = c.req.param('id');

  const [eventRow] = await db
    .select()
    .from(behaviorEvent)
    .where(eq(behaviorEvent.id, id))
    .limit(1);

  if (!eventRow) {
    return c.json({ error: 'event not found' }, 404);
  }

  const mediaRows = await db.select().from(media).where(eq(media.eventId, id));

  const dto: BehaviorEventWithMediaDTO = {
    ...toBehaviorEventDTO(eventRow),
    media: mediaRows.map(toMediaDTO),
  };

  return c.json(dto, 200);
});

// ── PATCH /events/:id (FR-A7 / AC-4) — note/tags only ───────────────────────────
// ONLY these two keys exist in the schema, so the tap fields + intervention are
// structurally un-settable (AC-4 — the moat is protected).
const patchEventBody = z.object({
  note: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

events.patch('/events/:id', zValidator('json', patchEventBody), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  // Verify the event exists (404).
  const [eventRow] = await db
    .select()
    .from(behaviorEvent)
    .where(eq(behaviorEvent.id, id))
    .limit(1);

  if (!eventRow) {
    return c.json({ error: 'event not found' }, 404);
  }

  // Build a partial set object with ONLY the keys present in the body — omitting
  // a key leaves its column untouched; sending `null` clears it.
  const patch: Partial<Pick<BehaviorEventRow, 'note' | 'tags'>> = {};
  if ('note' in body) patch.note = body.note ?? null;
  if ('tags' in body) patch.tags = body.tags ?? null;

  // Empty body → return the current row unchanged.
  if (Object.keys(patch).length === 0) {
    return c.json(toBehaviorEventDTO(eventRow), 200);
  }

  const [updated] = await db
    .update(behaviorEvent)
    .set(patch)
    .where(eq(behaviorEvent.id, id))
    .returning();

  return c.json(toBehaviorEventDTO(updated), 200);
});

// ── POST /events/:id/media (FR-A2 / AC-7) — records the row, no R2 call ──────────
const createMediaBody = z.object({
  key: z.string().min(1),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
});

events.post('/events/:id/media', zValidator('json', createMediaBody), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  // Verify the event exists (404).
  const [eventRow] = await db
    .select()
    .from(behaviorEvent)
    .where(eq(behaviorEvent.id, id))
    .limit(1);

  if (!eventRow) {
    return c.json({ error: 'event not found' }, 404);
  }

  // Derive the canonical blobUrl (G-7 key-only/private reference) from the key +
  // R2 account/bucket. getR2Config() throws if R2 is unconfigured → 503 (NFR-4).
  let blobUrl: string;
  try {
    blobUrl = blobUrlForKey(getR2Config(), body.key);
  } catch {
    return c.json({ error: 'media storage not configured' }, 503);
  }

  const [created] = await db
    .insert(media)
    .values({
      eventId: id,
      blobUrl,
      type: 'video', // Phase 2 ships video; contentType is the allow-set video/*
    })
    .returning();

  return c.json(toMediaDTO(created), 201);
});
