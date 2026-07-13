// Tests for the dog + session-start routes (dogs.ts — Phase 2 Unit B).
//
// Covers (per the scope + AC-3, AC-5 of the Phase 2 spec):
//
//   GET  /trainers/:trainerId/dogs
//     - 200 [] for an unknown trainer (empty-set semantics, FR-A3).
//     - 200 DogSummaryDTO[] for a known trainer.
//     - DogSummaryDTO shape fields are all present and typed correctly.
//
//   GET  /dogs/:id
//     - 404 for an unknown dog id.
//     - 200 DogDetailDTO (dog + sessions[]) for a known id.
//     - sessions[] is populated; eventCount is a number.
//     - 200 with empty sessions[] when the dog has no sessions.
//
//   GET  /dogs/:id/timeline
//     - 404 for an unknown dog id.
//     - 200 DogTimelineDTO (dog + sessions[]) for a known id.
//     - sessions[] reverse-chronological (latest startedAt first).
//     - events within each session reverse-chronological (latest occurredAt first).
//     - 200 with empty sessions[] when the dog has no sessions.
//
//   POST /dogs/:id/sessions
//     - 404 for an unknown dog id.
//     - 201 SessionSummaryDTO (eventCount 0) for a known dog.
//     - Optional startedAt and location round-trip into the response.
//     - eventCount is always 0 on the freshly created session.
//
// Strategy: vi.hoisted() + vi.mock('../db/client.js') replicates the Phase 1
// events.test.ts queue pattern. The Drizzle chain is more varied here (joins,
// groupBy, inArray) so the mock must accommodate both single-table and
// multi-table selects by queue position.
//
// The Hono app is exercised via `app.request(...)` (no HTTP server).
// R2 env vars are NOT needed by these routes; no r2.ts mock required.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers (must come before vi.mock calls) ───────────────────────
const mocks = vi.hoisted(() => {
  // Each db.select() call drains one entry from this queue.
  const selectResultQueue: Array<unknown[]> = [];

  // insert() returns the first (and only) inserted row.
  let insertResult: unknown[] = [];

  // ── select chain (covers both plain and joined queries) ──────────────────
  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockWhere = vi.fn(() => ({ limit: mockLimit, orderBy: mockOrderBy }));
  const mockOrderBy = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockGroupBy = vi.fn(() => ({ orderBy: mockGroupByOrderBy }));
  const mockGroupByOrderBy = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockLeftJoin = vi.fn(() => ({ where: mockWhereAfterJoin }));
  const mockWhereAfterJoin = vi.fn(() => ({ groupBy: mockGroupBy }));
  const mockInnerJoin = vi.fn(() => ({ where: mockWhereInnerJoin }));
  const mockWhereInnerJoin = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockFrom = vi.fn(() => ({
    where: mockWhere,
    innerJoin: mockInnerJoin,
    leftJoin: mockLeftJoin,
  }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  // ── insert chain ─────────────────────────────────────────────────────────
  const mockReturning = vi.fn(() => Promise.resolve(insertResult));
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  return {
    selectResultQueue,
    get insertResult() {
      return insertResult;
    },
    set insertResult(v: unknown[]) {
      insertResult = v;
    },
    mockLimit,
    mockWhere,
    mockOrderBy,
    mockGroupBy,
    mockGroupByOrderBy,
    mockLeftJoin,
    mockWhereAfterJoin,
    mockInnerJoin,
    mockWhereInnerJoin,
    mockFrom,
    mockSelect,
    mockReturning,
    mockValues,
    mockInsert,
  };
});
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('dotenv/config', () => ({}));

vi.mock('../db/client.js', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
  },
}));

// Phase 3b: the trainer routes are now guarded. Mock BetterAuth so a trainer
// session is present (set in beforeEach); avoids constructing real BetterAuth.
vi.mock('../lib/auth.js', () => import('./authMock.js'));
import { authState, trainerSession } from './authMock.js';

import { app } from '../app.js';

// Satisfy config.ts required() at module load time.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────
const TRAINER_ID  = '10000000-0000-0000-0000-000000000001';
const CLIENT_ID   = '20000000-0000-0000-0000-000000000001';
const DOG_ID      = '30000000-0000-0000-0000-000000000001';
const PROTOCOL_ID = '40000000-0000-0000-0000-000000000001';
const SESSION_ID_1 = '50000000-0000-0000-0000-000000000001';
const SESSION_ID_2 = '50000000-0000-0000-0000-000000000002';
const EVENT_ID_1  = '60000000-0000-0000-0000-000000000001';
const EVENT_ID_2  = '60000000-0000-0000-0000-000000000002';

// ── Row fixtures ──────────────────────────────────────────────────────────────
const DOG_ROW = {
  id: DOG_ID,
  clientId: CLIENT_ID,
  protocolId: PROTOCOL_ID,
  name: 'Rex',
  breed: 'GSD',
  ageMonths: 36,
  backgroundNotes: null,
};

const SESSION_ROW_1 = {
  id: SESSION_ID_1,
  dogId: DOG_ID,
  bookingId: null,
  startedAt: new Date('2026-06-20T10:00:00Z'),
  location: 'park',
};
const SESSION_ROW_2 = {
  id: SESSION_ID_2,
  dogId: DOG_ID,
  bookingId: null,
  startedAt: new Date('2026-06-19T09:00:00Z'),
  location: null,
};

function makeBehaviorEventRow(overrides: Partial<{
  id: string;
  sessionId: string;
  occurredAt: Date;
  triggerType: string;
  thresholdMeters: number;
  intensity: number;
  outcome: string;
  intervention: string;
  note: string | null;
  tags: string[] | null;
}> = {}) {
  return {
    id: overrides.id ?? EVENT_ID_1,
    sessionId: overrides.sessionId ?? SESSION_ID_1,
    occurredAt: overrides.occurredAt ?? new Date('2026-06-20T10:05:00Z'),
    triggerType: overrides.triggerType ?? 'dog',
    thresholdMeters: overrides.thresholdMeters ?? 5,
    intensity: overrides.intensity ?? 7,
    outcome: overrides.outcome ?? 'recovered_slowly',
    intervention: overrides.intervention ?? 'u-turn',
    note: overrides.note ?? null,
    tags: overrides.tags ?? null,
  };
}

// ── beforeEach: drain the queue and reset mock chains ────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // Authenticated as the fixture trainer (matches TRAINER_ID so the
  // /trainers/:trainerId/* ownership guard passes).
  authState.session = trainerSession(TRAINER_ID);
  mocks.selectResultQueue.length = 0;
  mocks.insertResult = [];

  // Re-wire the mock implementations after clearAllMocks().
  mocks.mockLimit.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockOrderBy.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockGroupByOrderBy.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockWhereInnerJoin.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit, orderBy: mocks.mockOrderBy });
  mocks.mockGroupBy.mockReturnValue({ orderBy: mocks.mockGroupByOrderBy });
  mocks.mockWhereAfterJoin.mockReturnValue({ groupBy: mocks.mockGroupBy });
  mocks.mockLeftJoin.mockReturnValue({ where: mocks.mockWhereAfterJoin });
  mocks.mockWhereInnerJoin.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockInnerJoin.mockReturnValue({ where: mocks.mockWhereInnerJoin });
  mocks.mockFrom.mockReturnValue({
    where: mocks.mockWhere,
    innerJoin: mocks.mockInnerJoin,
    leftJoin: mocks.mockLeftJoin,
  });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
  mocks.mockReturning.mockImplementation(() => Promise.resolve(mocks.insertResult));
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
});

// ── GET /trainers/:trainerId/dogs ─────────────────────────────────────────────
describe('GET /trainers/:trainerId/dogs', () => {
  it('returns 200 with an empty array when the trainer has no dogs', async () => {
    // The inner-join finds no matching rows.
    mocks.selectResultQueue.push([]);

    const res = await app.request(`/trainers/${TRAINER_ID}/dogs`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('returns 403 when the path trainerId does not match the session trainer (Phase 3b ownership guard)', async () => {
    // A trainer may only read their OWN data (OQ-10). The session trainer is
    // TRAINER_ID; requesting another trainer's id is forbidden.
    const res = await app.request('/trainers/00000000-0000-0000-0000-000000000000/dogs');

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'forbidden' });
  });

  it('returns 200 with a DogSummaryDTO array for a trainer with dogs', async () => {
    mocks.selectResultQueue.push([
      {
        id: DOG_ID,
        name: 'Rex',
        breed: 'GSD',
        ageMonths: 36,
        clientId: CLIENT_ID,
        protocolId: PROTOCOL_ID,
      },
    ]);

    const res = await app.request(`/trainers/${TRAINER_ID}/dogs`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    const dog = body[0];
    expect(dog.id).toBe(DOG_ID);
    expect(dog.name).toBe('Rex');
    expect(dog.breed).toBe('GSD');
    expect(dog.ageMonths).toBe(36);
    expect(dog.clientId).toBe(CLIENT_ID);
    expect(dog.protocolId).toBe(PROTOCOL_ID);
  });

  it('sets protocolId to null in the DTO when the dog has no protocol', async () => {
    mocks.selectResultQueue.push([
      {
        id: DOG_ID,
        name: 'Buddy',
        breed: 'Lab',
        ageMonths: 24,
        clientId: CLIENT_ID,
        protocolId: null, // nullable in schema
      },
    ]);

    const res = await app.request(`/trainers/${TRAINER_ID}/dogs`);

    expect(res.status).toBe(200);
    const [dog] = await res.json();
    expect(dog.protocolId).toBeNull();
  });

  it('returns multiple dogs in the array', async () => {
    mocks.selectResultQueue.push([
      { id: DOG_ID, name: 'Rex', breed: 'GSD', ageMonths: 36, clientId: CLIENT_ID, protocolId: PROTOCOL_ID },
      { id: '31000000-0000-0000-0000-000000000002', name: 'Max', breed: 'Poodle', ageMonths: 12, clientId: CLIENT_ID, protocolId: null },
    ]);

    const res = await app.request(`/trainers/${TRAINER_ID}/dogs`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Rex');
    expect(body[1].name).toBe('Max');
  });

  it('responds with Content-Type application/json', async () => {
    mocks.selectResultQueue.push([]);

    const res = await app.request(`/trainers/${TRAINER_ID}/dogs`);

    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});

// ── GET /dogs/:id ─────────────────────────────────────────────────────────────
describe('GET /dogs/:id', () => {
  it('returns 404 with error body when dog id does not exist', async () => {
    // First select (dog lookup) returns empty.
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([]));

    const res = await app.request('/dogs/00000000-0000-0000-0000-deadbeef0001');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'dog not found' });
  });

  it('returns 200 with DogDetailDTO for a known dog', async () => {
    // dog lookup
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    // sessions with event counts (left-join groupBy → groupByOrderBy chain)
    mocks.selectResultQueue.push([
      { id: SESSION_ID_1, startedAt: new Date('2026-06-20T10:00:00Z'), location: 'park', eventCount: 3 },
    ]);

    const res = await app.request(`/dogs/${DOG_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(DOG_ID);
    expect(body.name).toBe('Rex');
    expect(body.breed).toBe('GSD');
    expect(body.ageMonths).toBe(36);
    expect(body.clientId).toBe(CLIENT_ID);
    expect(body.protocolId).toBe(PROTOCOL_ID);
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.sessions).toHaveLength(1);
  });

  it('DogDetailDTO sessions contain the correct SessionSummaryDTO fields', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([
      { id: SESSION_ID_1, startedAt: new Date('2026-06-20T10:00:00Z'), location: 'park', eventCount: 7 },
    ]);

    const res = await app.request(`/dogs/${DOG_ID}`);
    const body = await res.json();
    const sess = body.sessions[0];

    expect(sess.id).toBe(SESSION_ID_1);
    expect(typeof sess.startedAt).toBe('string'); // ISO string
    expect(new Date(sess.startedAt).toISOString()).toBe('2026-06-20T10:00:00.000Z');
    expect(sess.location).toBe('park');
    expect(sess.eventCount).toBe(7);
  });

  it('returns eventCount as a number (not a string) in the session DTO', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([
      { id: SESSION_ID_1, startedAt: new Date('2026-06-20T10:00:00Z'), location: null, eventCount: '3' }, // Drizzle count() can return string
    ]);

    const res = await app.request(`/dogs/${DOG_ID}`);
    const body = await res.json();
    // The route coerces via Number(row.eventCount).
    expect(typeof body.sessions[0].eventCount).toBe('number');
    expect(body.sessions[0].eventCount).toBe(3);
  });

  it('returns 200 with an empty sessions array when the dog has no sessions', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([]); // no sessions

    const res = await app.request(`/dogs/${DOG_ID}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessions).toEqual([]);
  });

  it('sets location to null in the session DTO when it is null in the DB', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([
      { id: SESSION_ID_1, startedAt: new Date('2026-06-20T10:00:00Z'), location: null, eventCount: 0 },
    ]);

    const res = await app.request(`/dogs/${DOG_ID}`);
    const body = await res.json();
    expect(body.sessions[0].location).toBeNull();
  });
});

// ── GET /dogs/:id/timeline ────────────────────────────────────────────────────
describe('GET /dogs/:id/timeline', () => {
  it('returns 404 with error body when dog id does not exist', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([]));

    const res = await app.request('/dogs/00000000-0000-0000-0000-deadbeef0002/timeline');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'dog not found' });
  });

  it('returns 200 with DogTimelineDTO for a known dog', async () => {
    // dog lookup
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    // sessions (orderBy desc)
    mocks.selectResultQueue.push([SESSION_ROW_1, SESSION_ROW_2]);
    // events for all sessions (inArray → orderBy chain; note: inArray uses a
    // different query path — but it resolves via the mock queue)
    mocks.selectResultQueue.push([
      makeBehaviorEventRow({ id: EVENT_ID_1, sessionId: SESSION_ID_1, occurredAt: new Date('2026-06-20T10:10:00Z') }),
      makeBehaviorEventRow({ id: EVENT_ID_2, sessionId: SESSION_ID_2, occurredAt: new Date('2026-06-19T09:05:00Z') }),
    ]);

    const res = await app.request(`/dogs/${DOG_ID}/timeline`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dog.id).toBe(DOG_ID);
    expect(body.dog.name).toBe('Rex');
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.sessions).toHaveLength(2);
  });

  it('maps the dog to a correct DogSummaryDTO in the timeline', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([SESSION_ROW_1]);
    mocks.selectResultQueue.push([makeBehaviorEventRow()]);

    const res = await app.request(`/dogs/${DOG_ID}/timeline`);
    const body = await res.json();
    const d = body.dog;

    expect(d.id).toBe(DOG_ID);
    expect(d.name).toBe('Rex');
    expect(d.breed).toBe('GSD');
    expect(d.ageMonths).toBe(36);
    expect(d.clientId).toBe(CLIENT_ID);
    expect(d.protocolId).toBe(PROTOCOL_ID);
  });

  it('sessions are ordered newest-first (reverse-chronological)', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    // The route queries with `desc(session.startedAt)` — mock returns them already
    // in descending order to confirm the response preserves that ordering.
    mocks.selectResultQueue.push([SESSION_ROW_1, SESSION_ROW_2]); // newest first
    mocks.selectResultQueue.push([]); // no events

    const res = await app.request(`/dogs/${DOG_ID}/timeline`);
    const body = await res.json();
    const [first, second] = body.sessions;

    expect(new Date(first.startedAt) >= new Date(second.startedAt)).toBe(true);
  });

  it('events within a session are ordered newest-first (reverse-chronological)', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([SESSION_ROW_1]);
    // Events returned by the query in desc(occurredAt) order.
    const newerEvent = makeBehaviorEventRow({ id: EVENT_ID_1, sessionId: SESSION_ID_1, occurredAt: new Date('2026-06-20T10:10:00Z') });
    const olderEvent = makeBehaviorEventRow({ id: EVENT_ID_2, sessionId: SESSION_ID_1, occurredAt: new Date('2026-06-20T10:05:00Z') });
    mocks.selectResultQueue.push([newerEvent, olderEvent]); // desc order

    const res = await app.request(`/dogs/${DOG_ID}/timeline`);
    const body = await res.json();
    const events = body.sessions[0].events;

    expect(events).toHaveLength(2);
    // Confirm the newer event is first.
    expect(new Date(events[0].occurredAt) >= new Date(events[1].occurredAt)).toBe(true);
  });

  it('groups events correctly into their parent session', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([SESSION_ROW_1, SESSION_ROW_2]);
    mocks.selectResultQueue.push([
      makeBehaviorEventRow({ id: EVENT_ID_1, sessionId: SESSION_ID_1 }),
      makeBehaviorEventRow({ id: EVENT_ID_2, sessionId: SESSION_ID_2 }),
    ]);

    const res = await app.request(`/dogs/${DOG_ID}/timeline`);
    const body = await res.json();
    const sess1 = body.sessions.find((s: { id: string }) => s.id === SESSION_ID_1);
    const sess2 = body.sessions.find((s: { id: string }) => s.id === SESSION_ID_2);

    expect(sess1.events).toHaveLength(1);
    expect(sess1.events[0].id).toBe(EVENT_ID_1);
    expect(sess2.events).toHaveLength(1);
    expect(sess2.events[0].id).toBe(EVENT_ID_2);
  });

  it('returns 200 with empty sessions[] when the dog has no sessions', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([]); // no sessions
    // No events query runs when there are no sessions.

    const res = await app.request(`/dogs/${DOG_ID}/timeline`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessions).toEqual([]);
  });

  it('returns an empty events array for a session that has no events', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([SESSION_ROW_1]);
    mocks.selectResultQueue.push([]); // no events for this session

    const res = await app.request(`/dogs/${DOG_ID}/timeline`);
    const body = await res.json();

    expect(body.sessions[0].events).toEqual([]);
  });

  it('event DTO in the timeline has all required BehaviorEventDTO fields', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.selectResultQueue.push([SESSION_ROW_1]);
    mocks.selectResultQueue.push([
      makeBehaviorEventRow({
        id: EVENT_ID_1,
        sessionId: SESSION_ID_1,
        note: 'reactive near gate',
        tags: ['leash', 'reactive'],
      }),
    ]);

    const res = await app.request(`/dogs/${DOG_ID}/timeline`);
    const body = await res.json();
    const ev = body.sessions[0].events[0];

    expect(ev.id).toBe(EVENT_ID_1);
    expect(ev.sessionId).toBe(SESSION_ID_1);
    expect(typeof ev.occurredAt).toBe('string');
    expect(ev.triggerType).toBe('dog');
    expect(ev.thresholdMeters).toBe(5);
    expect(ev.intensity).toBe(7);
    expect(ev.outcome).toBe('recovered_slowly');
    expect(ev.intervention).toBe('u-turn');
    expect(ev.note).toBe('reactive near gate');
    expect(ev.tags).toEqual(['leash', 'reactive']);
  });
});

// ── POST /dogs/:id/sessions ───────────────────────────────────────────────────
describe('POST /dogs/:id/sessions', () => {
  function postSession(dogId: string, body: Record<string, unknown> = {}) {
    return app.request(`/dogs/${dogId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 404 with error body when the dog does not exist', async () => {
    // dog lookup returns empty.
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([]));

    const res = await postSession('00000000-0000-0000-0000-deadbeef0003');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'dog not found' });
  });

  it('returns 201 with SessionSummaryDTO (eventCount 0) on success', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    const createdAt = new Date('2026-06-20T11:00:00Z');
    mocks.insertResult = [
      {
        id: SESSION_ID_1,
        dogId: DOG_ID,
        bookingId: null,
        startedAt: createdAt,
        location: null,
      },
    ];

    const res = await postSession(DOG_ID);

    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto.id).toBe(SESSION_ID_1);
    expect(typeof dto.startedAt).toBe('string');
    expect(dto.location).toBeNull();
    expect(dto.eventCount).toBe(0); // freshly created session has no events
  });

  it('eventCount is always 0 in the 201 response (a new session has no events)', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.insertResult = [
      {
        id: SESSION_ID_1,
        dogId: DOG_ID,
        bookingId: null,
        startedAt: new Date(),
        location: null,
      },
    ];

    const res = await postSession(DOG_ID);
    const dto = await res.json();

    expect(dto.eventCount).toBe(0);
  });

  it('echoes the provided startedAt as an ISO string in the response', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    const startedAt = '2026-06-18T08:30:00.000Z';
    mocks.insertResult = [
      {
        id: SESSION_ID_1,
        dogId: DOG_ID,
        bookingId: null,
        startedAt: new Date(startedAt),
        location: null,
      },
    ];

    const res = await postSession(DOG_ID, { startedAt });
    const dto = await res.json();

    expect(new Date(dto.startedAt).toISOString()).toBe(startedAt);
  });

  it('echoes the provided location in the response', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.insertResult = [
      {
        id: SESSION_ID_1,
        dogId: DOG_ID,
        bookingId: null,
        startedAt: new Date(),
        location: 'training field',
      },
    ];

    const res = await postSession(DOG_ID, { location: 'training field' });
    const dto = await res.json();

    expect(dto.location).toBe('training field');
  });

  it('responds with Content-Type application/json on 201', async () => {
    mocks.mockLimit.mockImplementationOnce(() => Promise.resolve([DOG_ROW]));
    mocks.insertResult = [
      { id: SESSION_ID_1, dogId: DOG_ID, bookingId: null, startedAt: new Date(), location: null },
    ];

    const res = await postSession(DOG_ID);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
