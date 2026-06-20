// POST /sessions/:id/events (FR-6, AC-7).
// The 4-tap behavior-logging write — the core Phase 1 mutation.
//
// Flow (design §3.2 / §6.1), in order:
//   1. zValidator('json', eventBody) — invalid enum / out-of-range intensity /
//      negative thresholdMeters / wrong types -> automatic 400.
//   2. Session existence: look up session by :id -> 404 if not found.
//   3. Default-intervention resolution when `intervention` omitted:
//        Session -> Dog -> Protocol -> defaultIntervention.
//      If the dog has no protocol (or the protocol's defaultIntervention is empty)
//      AND the body omitted intervention -> 400 (D-6, keeps intervention NOT NULL
//      so the moat is never dropped).
//   4. Insert the behavior_event row; return 201 with BehaviorEventDTO.
//
// Enums come ONLY from @tailsup/shared so validation == DB enum == app types (FR-9).

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { OUTCOMES, TRIGGER_TYPES } from '@tailsup/shared';
import type { BehaviorEventDTO } from '@tailsup/shared';
import { db } from '../db/client.js';
import { behaviorEvent, dog, protocol, session } from '../db/schema.js';

// Built from the shared arrays — exact same literals the pgEnum + app use (FR-9).
const eventBody = z.object({
  triggerType: z.enum(TRIGGER_TYPES),
  thresholdMeters: z.number().int().nonnegative(),
  intensity: z.number().int().min(1).max(10),
  outcome: z.enum(OUTCOMES),
  intervention: z.string().min(1).optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const sessions = new Hono();

sessions.post('/sessions/:id/events', zValidator('json', eventBody), async (c) => {
  const sessionId = c.req.param('id');
  const body = c.req.valid('json');

  // 2. Session existence.
  const [sessionRow] = await db
    .select()
    .from(session)
    .where(eq(session.id, sessionId))
    .limit(1);

  if (!sessionRow) {
    return c.json({ error: 'session not found' }, 404);
  }

  // 3. Resolve the intervention (moat — must end up non-empty).
  let intervention: string;
  if (body.intervention) {
    intervention = body.intervention;
  } else {
    // Session -> Dog -> Protocol -> defaultIntervention.
    const [dogRow] = await db
      .select()
      .from(dog)
      .where(eq(dog.id, sessionRow.dogId))
      .limit(1);

    let resolved: string | undefined;
    if (dogRow?.protocolId) {
      const [protocolRow] = await db
        .select()
        .from(protocol)
        .where(eq(protocol.id, dogRow.protocolId))
        .limit(1);
      resolved = protocolRow?.defaultIntervention;
    }

    if (!resolved) {
      return c.json(
        { error: 'intervention required: dog has no protocol default' },
        400,
      );
    }
    intervention = resolved;
  }

  // 4. Insert the behavior_event row (occurredAt left to DB defaultNow()).
  const [created] = await db
    .insert(behaviorEvent)
    .values({
      sessionId,
      triggerType: body.triggerType,
      thresholdMeters: body.thresholdMeters,
      intensity: body.intensity,
      outcome: body.outcome,
      intervention, // NOT NULL — moat linkage preserved
      note: body.note ?? null,
      tags: body.tags ?? null,
    })
    .returning();

  const dto: BehaviorEventDTO = {
    id: created.id,
    sessionId: created.sessionId,
    occurredAt: created.occurredAt.toISOString(),
    triggerType: created.triggerType as BehaviorEventDTO['triggerType'],
    thresholdMeters: created.thresholdMeters,
    intensity: created.intensity,
    outcome: created.outcome as BehaviorEventDTO['outcome'],
    intervention: created.intervention,
    note: created.note,
    tags: created.tags ?? null,
  };

  return c.json(dto, 201);
});
