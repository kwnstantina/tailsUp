// Tests for GET /health (FR-5, AC-6, design §3.1).
//
// Strategy: vi.hoisted() creates the mock function before the vi.mock() factory
// runs, avoiding TDZ issues. The mock is placed before imports so it's in scope
// when Hono's health route imports `../db/client.js`.
//
// The Hono app is exercised via `app.request(...)` — no HTTP server is started.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers ─────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockExecute = vi.fn();
  return { mockExecute };
});
// ──────────────────────────────────────────────────────────────────────────────

// Neutralise the dotenv side-effect import in config.ts.
vi.mock('dotenv/config', () => ({}));

// Replace the Drizzle db client; health.ts only calls `db.execute(sql`select 1`)`.
vi.mock('../db/client.js', () => ({
  db: { execute: mocks.mockExecute },
}));

// Satisfy config.ts' required() check (runs at import of client.ts → config.ts).
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Phase 3b: mock BetterAuth so real auth isn't constructed (public routes ignore the session).
vi.mock('../lib/auth.js', () => import('./authMock.js'));

import { app } from '../app.js';

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with { status: "ok", db: "up" } when the DB query succeeds', async () => {
    // db.execute resolves without error — DB is reachable.
    mocks.mockExecute.mockResolvedValueOnce([]);

    const res = await app.request('/health');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', db: 'up' });
  });

  it('returns 200 with { status: "degraded", db: "down" } when the DB query throws', async () => {
    // db.execute rejects — simulate a connectivity failure.
    mocks.mockExecute.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await app.request('/health');

    // Still 200: the process is alive; 200 lets mobile distinguish
    // "API up, DB down" from "API unreachable" (design decision D-10 / AC-9).
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'degraded', db: 'down' });
  });

  it('responds with Content-Type application/json', async () => {
    mocks.mockExecute.mockResolvedValueOnce([]);

    const res = await app.request('/health');

    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
