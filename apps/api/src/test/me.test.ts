// Tests for the client dashboard routes (me.ts — Phase 3b-2 Unit B).
//
// Covers (AC-3b-6/10):
//   GET   /me/progress    — 200 ClientProgressDTO[] (one per dog; grouped points); empty dogs → [].
//   GET   /me/homework    — 200 HomeworkDTO[] (joined to exercise).
//   PATCH /me/homework/:id — 200 own (completedAt set); 404 not-own; 404 missing.
//   GET   /me/bookings    — 200 BookingDTO[] (the client's bookings).
//   Role/authz — a TRAINER session on /me/* → 403; unauthenticated → 401.
//
// Strategy mirrors dogs.test.ts: vi.hoisted() + vi.mock('../db/client.js'). select()
// is driven by a queue (drained by orderBy/limit, incl. the homework innerJoin path);
// update() by its own queue (drained by returning()). Auth is the shared authMock —
// the /me/* prefix guard needs a client session (set per-test).

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers ──────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const selectResultQueue: Array<unknown[]> = [];
  const updateResultQueue: Array<unknown[]> = [];

  // select chain (plain + innerJoin): drained by orderBy() or limit().
  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockOrderBy = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy, limit: mockLimit }));
  const mockWhereJoin = vi.fn(() => ({ orderBy: mockOrderBy }));
  const mockInnerJoin = vi.fn(() => ({ where: mockWhereJoin }));
  const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  // update chain: update().set().where().returning()
  const mockUpdateReturning = vi.fn(() => Promise.resolve(updateResultQueue.shift() ?? []));
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  return {
    selectResultQueue,
    updateResultQueue,
    mockLimit,
    mockOrderBy,
    mockWhere,
    mockWhereJoin,
    mockInnerJoin,
    mockFrom,
    mockSelect,
    mockUpdateReturning,
    mockUpdateWhere,
    mockSet,
    mockUpdate,
  };
});
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('dotenv/config', () => ({}));

vi.mock('../db/client.js', () => ({
  db: {
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
  },
}));

vi.mock('../lib/auth.js', () => import('./authMock.js'));
import { authState, clientSession, trainerSession } from './authMock.js';

import { app } from '../app.js';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixture UUIDs ───────────────────────────────────────────────────────────────
const CLIENT_ID = 'd0000000-0000-0000-0000-000000000001';
const OTHER_CLIENT_ID = 'd0000000-0000-0000-0000-000000000002';
const DOG_ID = '30000000-0000-0000-0000-000000000001';
const SESSION_ID = '50000000-0000-0000-0000-000000000001';
const HOMEWORK_ID = 'e0000000-0000-0000-0000-000000000001';
const EXERCISE_ID = 'f0000000-0000-0000-0000-000000000001';
const BOOKING_ID = 'c0000000-0000-0000-0000-000000000001';

// ── Row fixtures ────────────────────────────────────────────────────────────────
const DOG_ROW = {
  id: DOG_ID,
  clientId: CLIENT_ID,
  protocolId: null,
  name: 'Rex',
  breed: 'GSD',
  ageMonths: 36,
  backgroundNotes: null,
};

const SESSION_ROW = {
  id: SESSION_ID,
  dogId: DOG_ID,
  bookingId: null,
  startedAt: new Date('2026-06-15T10:00:00Z'),
  location: 'park',
};

function eventRow(occurredAt: string, thresholdMeters: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `60000000-0000-0000-0000-0000000000${Math.floor(Math.random() * 90 + 10)}`,
    sessionId: SESSION_ID,
    occurredAt: new Date(occurredAt),
    triggerType: 'dog',
    thresholdMeters,
    intensity: 5,
    outcome: 'recovered_slowly',
    intervention: 'u-turn',
    note: null,
    tags: null,
    ...overrides,
  };
}

function homeworkJoinRow(overrides: Record<string, unknown> = {}) {
  return {
    id: HOMEWORK_ID,
    dogId: DOG_ID,
    exerciseId: EXERCISE_ID,
    completed: false,
    completedAt: null,
    title: 'Engage–Disengage',
    instructions: 'Mark and reward voluntary disengagement.',
    ...overrides,
  };
}

// ── beforeEach: reset queues + re-wire chains + default CLIENT session ───────────
beforeEach(() => {
  vi.clearAllMocks();
  authState.session = clientSession(CLIENT_ID);

  mocks.selectResultQueue.length = 0;
  mocks.updateResultQueue.length = 0;

  mocks.mockLimit.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockOrderBy.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockWhere.mockReturnValue({ orderBy: mocks.mockOrderBy, limit: mocks.mockLimit });
  mocks.mockWhereJoin.mockReturnValue({ orderBy: mocks.mockOrderBy });
  mocks.mockInnerJoin.mockReturnValue({ where: mocks.mockWhereJoin });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere, innerJoin: mocks.mockInnerJoin });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

  mocks.mockUpdateReturning.mockImplementation(() =>
    Promise.resolve(mocks.updateResultQueue.shift() ?? []),
  );
  mocks.mockUpdateWhere.mockReturnValue({ returning: mocks.mockUpdateReturning });
  mocks.mockSet.mockReturnValue({ where: mocks.mockUpdateWhere });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });
});

function patchHomework(id: string, body: Record<string, unknown>) {
  return app.request(`/me/homework/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── GET /me/progress ──────────────────────────────────────────────────────────────
describe('GET /me/progress', () => {
  it('returns 200 with one ClientProgressDTO per dog, points grouped chronologically', async () => {
    mocks.selectResultQueue.push([DOG_ROW]); // dogs
    mocks.selectResultQueue.push([SESSION_ROW]); // sessions
    mocks.selectResultQueue.push([
      eventRow('2026-06-15T10:05:00Z', 20),
      eventRow('2026-06-15T10:45:00Z', 6),
    ]); // events (asc)

    const res = await app.request('/me/progress');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].dog).toMatchObject({ id: DOG_ID, name: 'Rex', clientId: CLIENT_ID });
    expect(body[0].points).toHaveLength(2);
    expect(body[0].points[0]).toMatchObject({ thresholdMeters: 20, intensity: 5, outcome: 'recovered_slowly' });
    expect(body[0].points[1].thresholdMeters).toBe(6);
    expect(typeof body[0].points[0].occurredAt).toBe('string');
  });

  it('returns points:[] for a dog with no events (friendly empty, never a broken curve)', async () => {
    mocks.selectResultQueue.push([DOG_ROW]); // dogs
    mocks.selectResultQueue.push([SESSION_ROW]); // sessions
    mocks.selectResultQueue.push([]); // no events

    const res = await app.request('/me/progress');
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].points).toEqual([]);
  });

  it('returns 200 [] when the client has no dogs', async () => {
    mocks.selectResultQueue.push([]); // no dogs
    const res = await app.request('/me/progress');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 403 for a trainer session (client-only prefix guard)', async () => {
    authState.session = trainerSession('a0000000-0000-0000-0000-000000000001');
    const res = await app.request('/me/progress');
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    authState.session = null;
    const res = await app.request('/me/progress');
    expect(res.status).toBe(401);
  });
});

// ── GET /me/homework ──────────────────────────────────────────────────────────────
describe('GET /me/homework', () => {
  it('returns 200 HomeworkDTO[] joined to the exercise', async () => {
    mocks.selectResultQueue.push([{ id: DOG_ID }]); // dogs (ids)
    mocks.selectResultQueue.push([
      homeworkJoinRow(),
      homeworkJoinRow({
        id: 'e0000000-0000-0000-0000-000000000002',
        completed: true,
        completedAt: new Date('2026-06-20T09:00:00Z'),
        title: 'Pattern games',
      }),
    ]);

    const res = await app.request('/me/homework');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      id: HOMEWORK_ID,
      dogId: DOG_ID,
      exerciseId: EXERCISE_ID,
      title: 'Engage–Disengage',
      completed: false,
      completedAt: null,
    });
    expect(body[1].completed).toBe(true);
    expect(typeof body[1].completedAt).toBe('string');
  });

  it('returns 200 [] when the client has no dogs', async () => {
    mocks.selectResultQueue.push([]); // no dogs
    const res = await app.request('/me/homework');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 403 for a trainer session', async () => {
    authState.session = trainerSession('a0000000-0000-0000-0000-000000000001');
    const res = await app.request('/me/homework');
    expect(res.status).toBe(403);
  });
});

// ── PATCH /me/homework/:id ──────────────────────────────────────────────────────────
describe('PATCH /me/homework/:id', () => {
  it('returns 200 with completedAt set when marking the client-owned homework complete', async () => {
    mocks.selectResultQueue.push([{ id: HOMEWORK_ID, dogId: DOG_ID, exerciseId: EXERCISE_ID, completed: false, completedAt: null }]); // load homework
    mocks.selectResultQueue.push([DOG_ROW]); // load dog (clientId matches)
    mocks.updateResultQueue.push([{ id: HOMEWORK_ID, dogId: DOG_ID, exerciseId: EXERCISE_ID, completed: true, completedAt: new Date('2026-07-20T12:00:00Z') }]); // update.returning
    mocks.selectResultQueue.push([{ title: 'Engage–Disengage', instructions: 'Mark and reward.' }]); // exercise re-join

    const res = await patchHomework(HOMEWORK_ID, { completed: true });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completed).toBe(true);
    expect(typeof body.completedAt).toBe('string');
    expect(body.title).toBe('Engage–Disengage');
    expect(mocks.mockSet).toHaveBeenCalled();
  });

  it('clears completedAt when marking incomplete', async () => {
    mocks.selectResultQueue.push([{ id: HOMEWORK_ID, dogId: DOG_ID, exerciseId: EXERCISE_ID, completed: true, completedAt: new Date() }]);
    mocks.selectResultQueue.push([DOG_ROW]);
    mocks.updateResultQueue.push([{ id: HOMEWORK_ID, dogId: DOG_ID, exerciseId: EXERCISE_ID, completed: false, completedAt: null }]);
    mocks.selectResultQueue.push([{ title: 'Engage–Disengage', instructions: 'Mark and reward.' }]);

    const res = await patchHomework(HOMEWORK_ID, { completed: false });
    const body = await res.json();
    expect(body.completed).toBe(false);
    expect(body.completedAt).toBeNull();
  });

  it("returns 404 when the homework's dog belongs to another client", async () => {
    mocks.selectResultQueue.push([{ id: HOMEWORK_ID, dogId: DOG_ID, exerciseId: EXERCISE_ID, completed: false, completedAt: null }]);
    mocks.selectResultQueue.push([{ ...DOG_ROW, clientId: OTHER_CLIENT_ID }]); // not the client's dog
    const res = await patchHomework(HOMEWORK_ID, { completed: true });
    expect(res.status).toBe(404);
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing homework', async () => {
    mocks.selectResultQueue.push([]); // homework not found
    const res = await patchHomework(HOMEWORK_ID, { completed: true });
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-boolean completed', async () => {
    const res = await patchHomework(HOMEWORK_ID, { completed: 'yes' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for a trainer session', async () => {
    authState.session = trainerSession('a0000000-0000-0000-0000-000000000001');
    const res = await patchHomework(HOMEWORK_ID, { completed: true });
    expect(res.status).toBe(403);
  });
});

// ── GET /me/bookings ────────────────────────────────────────────────────────────────
describe('GET /me/bookings', () => {
  it("returns 200 BookingDTO[] for the client's bookings", async () => {
    mocks.selectResultQueue.push([
      {
        id: BOOKING_ID,
        trainerId: 'a0000000-0000-0000-0000-000000000001',
        leadId: null,
        clientId: CLIENT_ID,
        type: 'private',
        requestedAt: new Date('2026-08-01T10:00:00Z'),
        status: 'confirmed',
        notes: null,
        createdAt: new Date('2026-07-01T10:00:00Z'),
      },
    ]);

    const res = await app.request('/me/bookings');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: BOOKING_ID, clientId: CLIENT_ID, status: 'confirmed' });
    expect(typeof body[0].requestedAt).toBe('string');
  });

  it('returns 403 for a trainer session', async () => {
    authState.session = trainerSession('a0000000-0000-0000-0000-000000000001');
    const res = await app.request('/me/bookings');
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    authState.session = null;
    const res = await app.request('/me/bookings');
    expect(res.status).toBe(401);
  });
});
