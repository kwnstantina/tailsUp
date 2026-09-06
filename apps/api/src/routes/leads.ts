// POST /leads (Phase 3 — public site lead capture, Contact page form).
//
// The business job of the website is capturing leads, so this endpoint is the
// one write the public site depends on. It is UNAUTHENTICATED by design (a
// visitor has no account), which drives two rules:
//
//   1. `trainerId` is NEVER read from the body — it comes from config
//      (config.defaultTrainerId). Accepting it from the request would let a
//      caller attribute leads to an arbitrary trainer.
//   2. `status` is NEVER read from the body — every public lead starts 'new'.
//      The trainer moves it through contacted/converted/lost from the trainer
//      view; a visitor must not be able to post a lead as already 'converted'.
//
// Enums come ONLY from @tailsup/shared so validation == DB enum == app types (FR-9).

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { LeadDTO } from '@tailsup/shared';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { lead } from '../db/schema.js';

// Bounded lengths: this is a public, unauthenticated write — an unbounded text
// column reachable by anyone is an easy way to fill the database.
const leadBody = z.object({
  name: z.string().trim().min(1).max(200),
  contact: z.string().trim().min(1).max(200), // free-text email/phone
  source: z.string().trim().min(1).max(100),
  message: z.string().trim().max(5000).optional(),
});

export const leads = new Hono();

leads.post('/leads', zValidator('json', leadBody), async (c) => {
  const body = c.req.valid('json');

  const [created] = await db
    .insert(lead)
    .values({
      trainerId: config.defaultTrainerId, // from config, never the body
      name: body.name,
      contact: body.contact,
      source: body.source,
      message: body.message ?? null,
      // status defaults to 'new' in the schema; clientId stays null until
      // conversion (POST /leads/:id/convert).
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

  return c.json(dto, 201);
});
