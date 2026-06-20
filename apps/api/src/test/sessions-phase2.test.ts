// Tests for GET /sessions/:id/events (sessions.ts — Phase 2 addition, FR-A5).
//
// Covers:
//   - 404 when the session id does not exist.
//   - 200 BehaviorEventListItemDTO[] (empty when the session has no events).
//   - 200 with events when the session has events (chronological ascending).
//   - mediaCount is included per event (defaults to 0 when no media).
//   - mediaCount reflects the actual media count from the batch query.
//   - All BehaviorEventDTO fields are present in each list item.
//   - Note and tags are included in each list item.
//
// The query pattern in sessions.ts (Phase 2 addition) uses:
//   1. db.select().from(session).where(eq(...)).limit(1)    → session row
//   2. db.select().from(behaviorEvent).where(eq(...)).orderBy(asc(...))  → events
//   3. db.select({eventId, c}).from(media).where(inArray(...)).groupBy(...)  → counts
//
// Strategy: The mock must handle three distinct db.select calls. The existing
// vi.hoisted pattern is reused from events.test.ts. The third query (counts) uses
// groupBy() which resolves through a different chain leg — we wire it to drain the
// queue so all three calls use a single ordered queue.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const selectResultQueue: Array<unknown[]> = [];

  // ── select chain ──────────────────────────────────────────────────────────
  // limit() — used for session existence check.
  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  // orderBy() — used for the event list (chronological).
  const mockOrderBy = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockWhere = vi.fn(() => ({ limit: mockLimit, orderBy: mockOrderBy, groupBy: mockGroupBy }));

  // groupBy() + where() for the media count query.
  const mockGroupBy = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockWhereCount = vi.fn(() => ({ groupBy: mockGroupBy }));

  // from() — must accommodate both plain where() and the inArray where().
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  return {
    selectResultQueue,
    mockLimit,
    mockOrderBy,
    mockWhere,
    mockGroupBy,
    mockWhereCount,
    mockFrom,
    mockSelect,
  };
});
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('dotenv/config', () => ({}));

vi.mock('../db/client.js', () => ({
  db: {
    select: mocks.mockSelect,
  },
}));

import { app } from '../app.js';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────
const SESSION_ID = '77000000-0000-0000-0000-000000000001';
const EVENT_ID_1 = '88000000-0000-0000-0000-000000000001';
const EVENT_ID_2 = '88000000-0000-0000-0000-000000000002';

// ── Row fixtures ──────────────────────────────────────────────────────────────
const SESSION_ROW = {
  id: SESSION_ID,
  dogId: '99000000-0000-0000-0000-000000000001',
  bookingId: null,
  startedAt: new Date('2026-06-20T10:00:00Z'),
  location: 'park',
};

function makeEventRow(overrides: Partial<{
  id: string;
  sessionId: string;
  occurredAt: Date;
  note: string | null;
  tags: string[] | null;
}> = {}) {
  return {
    id: overrides.id ?? EVENT_ID_1,
    sessionId: overrides.sessionId ?? SESSION_ID,
    occurredAt: overrides.occurredAt ?? new Date('2026-06-20T10:05:00Z'),
    triggerType: 'dog',
    thresholdMeters: 5,
    intensity: 7,
    outcome: 'recovered_slowly',
    intervention: 'u-turn',
    note: overrides.note ?? null,
    tags: overrides.tags ?? null,
  };
}

// ── beforeEach ────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResultQueue.length = 0;

  mocks.mockLimit.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockOrderBy.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockGroupBy.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockWhere.mockReturnValue({
    limit: mocks.mockLimit,
    orderBy: mocks.mockOrderBy,
    groupBy: mocks.mockGroupBy,
  });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
});

// ── GET /sessions/:id/events ──────────────────────────────────────────────────
describe('GET /sessions/:id/events', () => {
  function getSessionEvents(sessionId: string) {
    return app.request(`/sessions/${sessionId}/events`);
  }

  it('returns 404 with error body when the session does not exist', async () => {
    mocks.selectResultQueue.push([]); // session lookup empty

    const res = await getSessionEvents('00000000-0000-0000-0000-deadbeef0004');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'session not found' });
  });

  it('returns 200 with an empty array when the session has no events', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]); // session exists
    mocks.selectResultQueue.push([]); // no events
    // No count query runs when eventIds is empty.

    const res = await getSessionEvents(SESSION_ID);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('returns 200 BehaviorEventListItemDTO[] with events', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([makeEventRow()]);
    mocks.selectResultQueue.push([]); // no media counts for this event

    const res = await getSessionEvents(SESSION_ID);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('each list item includes all BehaviorEventDTO fields plus mediaCount', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([makeEventRow()]);
    mocks.selectResultQueue.push([]); // no media

    const res = await getSessionEvents(SESSION_ID);
    const body = await res.json();
    const item = body[0];

    // All standard BehaviorEventDTO fields.
    expect(item.id).toBe(EVENT_ID_1);
    expect(item.sessionId).toBe(SESSION_ID);
    expect(typeof item.occurredAt).toBe('string');
    expect(item.triggerType).toBe('dog');
    expect(item.thresholdMeters).toBe(5);
    expect(item.intensity).toBe(7);
    expect(item.outcome).toBe('recovered_slowly');
    expect(item.intervention).toBe('u-turn');
    expect(item.note).toBeNull();
    expect(item.tags).toBeNull();
    // Plus the mediaCount extension.
    expect(typeof item.mediaCount).toBe('number');
    expect(item.mediaCount).toBe(0);
  });

  it('mediaCount defaults to 0 when the event has no media', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([makeEventRow()]);
    mocks.selectResultQueue.push([]); // no count rows

    const res = await getSessionEvents(SESSION_ID);
    const [item] = await res.json();

    expect(item.mediaCount).toBe(0);
  });

  it('mediaCount reflects the actual count from the batched media query', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([makeEventRow()]);
    // Count row for EVENT_ID_1: 3 media files.
    mocks.selectResultQueue.push([{ eventId: EVENT_ID_1, c: 3 }]);

    const res = await getSessionEvents(SESSION_ID);
    const [item] = await res.json();

    expect(item.mediaCount).toBe(3);
  });

  it('mediaCount is a number even when Drizzle count() returns a string', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([makeEventRow()]);
    // Drizzle COUNT can return a BigInt/string — test that the route coerces it.
    mocks.selectResultQueue.push([{ eventId: EVENT_ID_1, c: '5' }]);

    const res = await getSessionEvents(SESSION_ID);
    const [item] = await res.json();

    expect(typeof item.mediaCount).toBe('number');
    expect(item.mediaCount).toBe(5);
  });

  it('returns multiple events with their own mediaCounts', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([
      makeEventRow({ id: EVENT_ID_1, occurredAt: new Date('2026-06-20T10:05:00Z') }),
      makeEventRow({ id: EVENT_ID_2, occurredAt: new Date('2026-06-20T10:10:00Z') }),
    ]);
    mocks.selectResultQueue.push([
      { eventId: EVENT_ID_1, c: 1 },
      { eventId: EVENT_ID_2, c: 0 },
    ]);

    const res = await getSessionEvents(SESSION_ID);
    const body = await res.json();

    expect(body).toHaveLength(2);
    const ev1 = body.find((e: { id: string }) => e.id === EVENT_ID_1);
    const ev2 = body.find((e: { id: string }) => e.id === EVENT_ID_2);
    expect(ev1.mediaCount).toBe(1);
    expect(ev2.mediaCount).toBe(0);
  });

  it('events include note and tags when they are set', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([
      makeEventRow({ note: 'near the fence', tags: ['reactive'] }),
    ]);
    mocks.selectResultQueue.push([]);

    const res = await getSessionEvents(SESSION_ID);
    const [item] = await res.json();

    expect(item.note).toBe('near the fence');
    expect(item.tags).toEqual(['reactive']);
  });

  it('responds with Content-Type application/json', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([]);

    const res = await getSessionEvents(SESSION_ID);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
