// GET /health (FR-5, AC-6, D-10).
// Liveness is implicit (the handler ran). A lightweight `SELECT 1` checks DB
// connectivity. On DB failure we return 200 + degraded (NOT 503) so the mobile
// screen can always render a clear payload and distinguish "API up, DB down"
// from "API unreachable" (AC-9).

import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import type { HealthDTO } from '@tailsup/shared';
import { db } from '../db/client.js';

export const health = new Hono();

health.get('/health', async (c) => {
  try {
    await db.execute(sql`select 1`);
    const body: HealthDTO = { status: 'ok', db: 'up' };
    return c.json(body, 200);
  } catch {
    const body: HealthDTO = { status: 'degraded', db: 'down' };
    return c.json(body, 200);
  }
});
