// Tests for POST /sessions/:id/events (FR-6, AC-7, design §3.2).
//
// Covers:
//  - Input validation: invalid enum → 400, intensity out-of-range → 400,
//    thresholdMeters < 0 → 400, missing required fields → 400.
//  - Session not found → 404.
//  - Default-intervention resolution: Session→Dog→Protocol→defaultIntervention.
//  - 400 when intervention omitted AND dog has no protocol (the moat).
//  - 400 when intervention omitted AND dog has protocol but defaultIntervention is empty.
//  - 201 with BehaviorEventDTO when all inputs are valid (intervention provided).
//  - 201 with BehaviorEventDTO when intervention is defaulted from protocol.
//
// Strategy: vi.hoisted() creates the mock functions before the vi.mock() factory
// runs, avoiding TDZ issues. The Drizzle db client is replaced with a mock whose
// `.select().from().where().limit()` chain and `.insert(...).values(...).returning()`
// are driven by per-test queues. The Hono app is exercised via `app.request(...)`.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers (must come before vi.mock calls) ───────────────────────
const mocks = vi.hoisted(() => {
  // Queue of results for each db.select call within a single request.
  const selectResultQueue: Array<unknown[]> = [];
  let insertResult: unknown[] = [];

  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  const mockReturning = vi.fn(() => Promise.resolve(insertResult));
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockExecute = vi.fn().mockResolvedValue([]);

  return {
    selectResultQueue,
    get insertResult() { return insertResult; },
    set insertResult(v: unknown[]) { insertResult = v; },
    mockLimit,
    mockWhere,
    mockFrom,
    mockSelect,
    mockReturning,
    mockValues,
    mockInsert,
    mockExecute,
  };
});
// ──────────────────────────────────────────────────────────────────────────────

// ── Hoist mocks ────────────────────────────────────────────────────────────────
// dotenv/config has a side-effect import in config.ts; neutralise it.
vi.mock('dotenv/config', () => ({}));

// Replace the Drizzle db client with the mock built above.
vi.mock('../db/client.js', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    execute: mocks.mockExecute,
  },
}));
// ──────────────────────────────────────────────────────────────────────────────

import { app } from '../app.js';

// Satisfy config.ts' required() check (runs when client.ts imports config.ts).
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Helper: build a JSON POST request to the events endpoint.
function postEvent(sessionId: string, body: Record<string, unknown>) {
  return app.request(`/sessions/${sessionId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Fixture UUIDs (not real — just recognisable in test output).
const SESSION_ID = '00000000-0000-0000-0000-000000000001';
const DOG_ID     = '00000000-0000-0000-0000-000000000002';
const PROTOCOL_ID = '00000000-0000-0000-0000-000000000003';
const EVENT_ID   = '00000000-0000-0000-0000-000000000004';

// A minimal valid request body (intervention provided explicitly).
const VALID_BODY = {
  triggerType: 'dog',
  thresholdMeters: 5,
  intensity: 7,
  outcome: 'recovered_slowly',
  intervention: 'u-turn',
};

// A mock session row returned from the first db.select call.
const SESSION_ROW = {
  id: SESSION_ID,
  dogId: DOG_ID,
  bookingId: null,
  startedAt: new Date('2026-06-20T10:00:00Z'),
  location: null,
};

// Builds a mock behavior_event row (returned by INSERT … RETURNING).
function makeBehaviorEventRow(overrides: {
  intervention?: string;
  note?: unknown;
  tags?: unknown;
} = {}) {
  return {
    id: EVENT_ID,
    sessionId: SESSION_ID,
    occurredAt: new Date('2026-06-20T10:00:00.000Z'),
    triggerType: 'dog',
    thresholdMeters: 5,
    intensity: 7,
    outcome: 'recovered_slowly',
    intervention: overrides.intervention ?? 'u-turn',
    note: overrides.note ?? null,
    tags: overrides.tags ?? null,
  };
}

describe('POST /sessions/:id/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Drain the queue and reset insert result.
    mocks.selectResultQueue.length = 0;
    mocks.insertResult = [];
    // Re-wire the mock implementations (cleared by clearAllMocks).
    mocks.mockLimit.mockImplementation(() =>
      Promise.resolve(mocks.selectResultQueue.shift() ?? []),
    );
    mocks.mockReturning.mockImplementation(() =>
      Promise.resolve(mocks.insertResult),
    );
    // Re-wire the chain helpers.
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
    mocks.mockExecute.mockResolvedValue([]);
  });

  // ── Input validation ─────────────────────────────────────────────────────────

  it('returns 400 for an invalid triggerType enum value', async () => {
    const res = await postEvent(SESSION_ID, { ...VALID_BODY, triggerType: 'cat' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid outcome enum value', async () => {
    const res = await postEvent(SESSION_ID, { ...VALID_BODY, outcome: 'panicked' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when intensity is above the max (> 10)', async () => {
    const res = await postEvent(SESSION_ID, { ...VALID_BODY, intensity: 11 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when intensity is below the min (< 1)', async () => {
    const res = await postEvent(SESSION_ID, { ...VALID_BODY, intensity: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when thresholdMeters is negative', async () => {
    const res = await postEvent(SESSION_ID, { ...VALID_BODY, thresholdMeters: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when triggerType is missing from the body', async () => {
    const { triggerType: _omit, ...bodyWithout } = VALID_BODY;
    const res = await postEvent(SESSION_ID, bodyWithout);
    expect(res.status).toBe(400);
  });

  it('returns 400 when outcome is missing from the body', async () => {
    const { outcome: _omit, ...bodyWithout } = VALID_BODY;
    const res = await postEvent(SESSION_ID, bodyWithout);
    expect(res.status).toBe(400);
  });

  it('returns 400 when thresholdMeters is missing from the body', async () => {
    const { thresholdMeters: _omit, ...bodyWithout } = VALID_BODY;
    const res = await postEvent(SESSION_ID, bodyWithout);
    expect(res.status).toBe(400);
  });

  it('returns 400 when intensity is missing from the body', async () => {
    const { intensity: _omit, ...bodyWithout } = VALID_BODY;
    const res = await postEvent(SESSION_ID, bodyWithout);
    expect(res.status).toBe(400);
  });

  it('accepts intensity exactly at the minimum boundary (1)', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.insertResult = [makeBehaviorEventRow()];

    const res = await postEvent(SESSION_ID, { ...VALID_BODY, intensity: 1 });
    expect(res.status).toBe(201);
  });

  it('accepts intensity exactly at the maximum boundary (10)', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.insertResult = [makeBehaviorEventRow()];

    const res = await postEvent(SESSION_ID, { ...VALID_BODY, intensity: 10 });
    expect(res.status).toBe(201);
  });

  it('accepts thresholdMeters = 0 (boundary — nonnegative)', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.insertResult = [makeBehaviorEventRow()];

    const res = await postEvent(SESSION_ID, { ...VALID_BODY, thresholdMeters: 0 });
    expect(res.status).toBe(201);
  });

  it('accepts every valid triggerType enum value', async () => {
    const triggerTypes = ['dog', 'human', 'noise', 'vehicle', 'other'] as const;
    for (const tt of triggerTypes) {
      mocks.selectResultQueue.push([SESSION_ROW]);
      mocks.insertResult = [makeBehaviorEventRow()];

      const res = await postEvent(SESSION_ID, { ...VALID_BODY, triggerType: tt });
      expect(res.status, `expected 201 for triggerType=${tt}`).toBe(201);
    }
  });

  it('accepts every valid outcome enum value', async () => {
    const outcomes = ['disengaged', 'recovered_slowly', 'over_threshold'] as const;
    for (const o of outcomes) {
      mocks.selectResultQueue.push([SESSION_ROW]);
      mocks.insertResult = [makeBehaviorEventRow()];

      const res = await postEvent(SESSION_ID, { ...VALID_BODY, outcome: o });
      expect(res.status, `expected 201 for outcome=${o}`).toBe(201);
    }
  });

  // ── Session not found ────────────────────────────────────────────────────────

  it('returns 404 with error message when the session id does not exist', async () => {
    // Session lookup returns empty array → not found.
    mocks.selectResultQueue.push([]);

    const res = await postEvent('nonexistent-session-id', VALID_BODY);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'session not found' });
  });

  // ── Default-intervention resolution ──────────────────────────────────────────

  it('returns 400 when intervention is omitted and the dog has no protocol (protocolId null)', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]); // session lookup
    mocks.selectResultQueue.push([{              // dog lookup
      id: DOG_ID,
      clientId: '00000000-0000-0000-0000-000000000010',
      protocolId: null, // no protocol
      name: 'Buddy',
      breed: 'Labrador',
      ageMonths: 24,
      backgroundNotes: null,
    }]);

    const { intervention: _omit, ...bodyWithout } = VALID_BODY;
    const res = await postEvent(SESSION_ID, bodyWithout);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'intervention required: dog has no protocol default' });
  });

  it('returns 400 when intervention is omitted and protocol defaultIntervention is empty string', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([{
      id: DOG_ID,
      clientId: '00000000-0000-0000-0000-000000000010',
      protocolId: PROTOCOL_ID,
      name: 'Max',
      breed: 'Poodle',
      ageMonths: 12,
      backgroundNotes: null,
    }]);
    mocks.selectResultQueue.push([{
      id: PROTOCOL_ID,
      name: 'Basic',
      defaultIntervention: '', // empty — treated as missing by the handler
    }]);

    const { intervention: _omit, ...bodyWithout } = VALID_BODY;
    const res = await postEvent(SESSION_ID, bodyWithout);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'intervention required: dog has no protocol default' });
  });

  it('defaults intervention from protocol.defaultIntervention when omitted and protocol exists', async () => {
    const defaultIntervention = 'emergency-u-turn';

    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.selectResultQueue.push([{
      id: DOG_ID,
      clientId: '00000000-0000-0000-0000-000000000010',
      protocolId: PROTOCOL_ID,
      name: 'Rex',
      breed: 'GSD',
      ageMonths: 36,
      backgroundNotes: null,
    }]);
    mocks.selectResultQueue.push([{
      id: PROTOCOL_ID,
      name: 'Advanced',
      defaultIntervention,
    }]);
    mocks.insertResult = [makeBehaviorEventRow({ intervention: defaultIntervention })];

    const { intervention: _omit, ...bodyWithout } = VALID_BODY;
    const res = await postEvent(SESSION_ID, bodyWithout);

    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto.intervention).toBe(defaultIntervention);
  });

  // ── Successful 201 ───────────────────────────────────────────────────────────

  it('returns 201 with a complete BehaviorEventDTO when all required fields are provided', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    const eventRow = makeBehaviorEventRow();
    mocks.insertResult = [eventRow];

    const res = await postEvent(SESSION_ID, VALID_BODY);

    expect(res.status).toBe(201);
    const dto = await res.json();

    // Verify every BehaviorEventDTO field.
    expect(dto.id).toBe(EVENT_ID);
    expect(dto.sessionId).toBe(SESSION_ID);
    // occurredAt is serialised as an ISO timestamp string.
    expect(typeof dto.occurredAt).toBe('string');
    expect(new Date(dto.occurredAt).toISOString()).toBe('2026-06-20T10:00:00.000Z');
    expect(dto.triggerType).toBe('dog');
    expect(dto.thresholdMeters).toBe(5);
    expect(dto.intensity).toBe(7);
    expect(dto.outcome).toBe('recovered_slowly');
    expect(dto.intervention).toBe('u-turn');
    expect(dto.note).toBeNull();
    expect(dto.tags).toBeNull();
  });

  it('includes optional note and tags in the 201 response when provided', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.insertResult = [makeBehaviorEventRow({
      note: 'near the park gate',
      tags: ['reactive', 'leash'],
    })];

    const res = await postEvent(SESSION_ID, {
      ...VALID_BODY,
      note: 'near the park gate',
      tags: ['reactive', 'leash'],
    });

    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto.note).toBe('near the park gate');
    expect(dto.tags).toEqual(['reactive', 'leash']);
  });

  it('intervention in 201 response is never null (the moat)', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.insertResult = [makeBehaviorEventRow({ intervention: 'u-turn' })];

    const res = await postEvent(SESSION_ID, VALID_BODY);
    const dto = await res.json();

    // The moat: intervention must be a non-empty string, never null/undefined.
    expect(dto.intervention).not.toBeNull();
    expect(dto.intervention).not.toBeUndefined();
    expect(typeof dto.intervention).toBe('string');
    expect(dto.intervention.length).toBeGreaterThan(0);
  });

  it('responds with Content-Type application/json on success', async () => {
    mocks.selectResultQueue.push([SESSION_ROW]);
    mocks.insertResult = [makeBehaviorEventRow()];

    const res = await postEvent(SESSION_ID, VALID_BODY);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
