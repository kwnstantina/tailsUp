// Auth guard unit tests (Phase 3b — FR-AUTH5). Exercises the guard middleware in
// isolation on a minimal Hono app so the behaviour is asserted independent of the
// real routes/DB: sessionMiddleware reads the (mocked) BetterAuth session into
// c.var.user, and each guard admits/denies by role. Covers 401 (unauthenticated),
// 403 (wrong role / wrong trainer), and the pass-through case.

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authState, trainerSession, clientSession } from './authMock.js';

// Mock BetterAuth: sessionMiddleware calls auth.api.getSession → authState.session.
vi.mock('../lib/auth.js', () => import('./authMock.js'));

import {
  requireAuth,
  requireClient,
  requireTrainer,
  requireTrainerOwnsParam,
  sessionMiddleware,
  type AppEnv,
} from '../middleware/auth.js';

// A tiny app wired exactly like app.ts: session first, then a guarded route each.
function makeApp() {
  const app = new Hono<AppEnv>();
  app.use('*', sessionMiddleware);
  app.get('/any', requireAuth, (c) => c.json({ ok: true }));
  app.get('/trainer', requireTrainer, (c) => c.json({ ok: true }));
  app.get('/client', requireClient, (c) => c.json({ ok: true }));
  app.get('/trainers/:trainerId/x', requireTrainerOwnsParam, (c) => c.json({ ok: true }));
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.session = null;
});

describe('requireAuth', () => {
  it('401 when unauthenticated', async () => {
    const res = await makeApp().request('/any');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('200 with any authenticated session (client)', async () => {
    authState.session = clientSession('c1');
    const res = await makeApp().request('/any');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('requireTrainer', () => {
  it('401 when unauthenticated', async () => {
    const res = await makeApp().request('/trainer');
    expect(res.status).toBe(401);
  });

  it('403 for a client session', async () => {
    authState.session = clientSession('c1');
    const res = await makeApp().request('/trainer');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('200 for a trainer session', async () => {
    authState.session = trainerSession('t1');
    const res = await makeApp().request('/trainer');
    expect(res.status).toBe(200);
  });
});

describe('requireClient', () => {
  it('401 when unauthenticated', async () => {
    const res = await makeApp().request('/client');
    expect(res.status).toBe(401);
  });

  it('403 for a trainer session', async () => {
    authState.session = trainerSession('t1');
    const res = await makeApp().request('/client');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('200 for a client session', async () => {
    authState.session = clientSession('c1');
    const res = await makeApp().request('/client');
    expect(res.status).toBe(200);
  });
});

describe('requireTrainerOwnsParam', () => {
  it('401 when unauthenticated', async () => {
    const res = await makeApp().request('/trainers/t1/x');
    expect(res.status).toBe(401);
  });

  it('403 for a client session', async () => {
    authState.session = clientSession('c1');
    const res = await makeApp().request('/trainers/t1/x');
    expect(res.status).toBe(403);
  });

  it('403 when the trainer session id does not match the path param', async () => {
    authState.session = trainerSession('t1');
    const res = await makeApp().request('/trainers/t2/x');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('200 when the trainer session id matches the path param', async () => {
    authState.session = trainerSession('t1');
    const res = await makeApp().request('/trainers/t1/x');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
