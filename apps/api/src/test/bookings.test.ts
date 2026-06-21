// Tests for the public POST /bookings route (bookings.ts — Phase 3a) — Unit B.
//
// Covers (AC-3a-1 / AC-3a-7 + investigation 6a–6b):
//   - 201 + correct BookingDTO (status 'requested', leadId null, clientId null)
//     on a valid body; captured name/contact folded into `notes`.
//   - 400 on a bad `type` (∉ BOOKING_TYPES).
//   - 400 on a non-ISO `requestedAt`.
//   - 400 on a missing required field (name).
//   - 503 when no practice trainer is resolvable (resolveTrainerId throws).
//
// Strategy mirrors media.test.ts / leads.test.ts: vi.hoisted() +
// vi.mock('../db/client.js') (a select queue feeds resolveTrainerId; an insert
// queue feeds returning()).

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const selectResultQueue: Array<unknown[]> = [];
  const insertResultQueue: Array<unknown[]> = [];

  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere, orderBy: mockOrderBy, limit: mockLimit }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  const mockReturning = vi.fn(() => Promise.resolve(insertResultQueue.shift() ?? []));
  // Typed parameter so `mockValues.mock.calls[0][0]` is the inserted row payload
  // (the route folds name/contact into `notes`) rather than the empty tuple `[]`.
  const mockValues = vi.fn((_row: { notes: string }) => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  return {
    selectResultQueue,
    insertResultQueue,
    mockLimit,
    mockOrderBy,
    mockWhere,
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

import { app } from '../app.js';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TRAINER_ID = 'aa000000-0000-0000-0000-000000000001';
const BOOKING_ID = 'cc000000-0000-0000-0000-000000000001';

const TRAINER_ROW = { id: TRAINER_ID, email: 'trainer@example.com' };

const BOOKING_ROW = {
  id: BOOKING_ID,
  trainerId: TRAINER_ID,
  leadId: null,
  clientId: null,
  type: 'assessment',
  requestedAt: new Date('2026-07-01T10:00:00Z'),
  status: 'requested',
  notes: '[Maria P. · maria@example.com] Mornings preferred.',
  createdAt: new Date('2026-06-21T09:00:00Z'),
};

const VALID_BODY = {
  type: 'assessment',
  requestedAt: '2026-07-01T10:00:00.000Z',
  name: 'Maria P.',
  contact: 'maria@example.com',
  notes: 'Mornings preferred.',
};

// Each request gets a unique x-forwarded-for so the in-memory rate limiter
// (keyed by client IP) never throttles across this file's tests.
let ipCounter = 0;
function postBooking(body: Record<string, unknown>) {
  ipCounter += 1;
  return app.request('/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.0.1.${ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

// ── beforeEach ────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResultQueue.length = 0;
  mocks.insertResultQueue.length = 0;

  mocks.mockLimit.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockFrom.mockReturnValue({
    where: mocks.mockWhere,
    orderBy: mocks.mockOrderBy,
    limit: mocks.mockLimit,
  });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

  mocks.mockReturning.mockImplementation(() =>
    Promise.resolve(mocks.insertResultQueue.shift() ?? []),
  );
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

  delete process.env.PRACTICE_TRAINER_ID;
});

describe('POST /bookings', () => {
  it('returns 201 + a BookingDTO (status "requested", leadId/clientId null) on a valid body', async () => {
    mocks.selectResultQueue.push([TRAINER_ROW]); // resolveTrainerId → trainer row
    mocks.insertResultQueue.push([BOOKING_ROW]); // insert .returning()

    const res = await postBooking(VALID_BODY);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: BOOKING_ID,
      trainerId: TRAINER_ID,
      leadId: null,
      clientId: null,
      type: 'assessment',
      status: 'requested',
    });
    expect(body.requestedAt).toBe('2026-07-01T10:00:00.000Z');
    expect(typeof body.createdAt).toBe('string');
    // Captured name/contact folded into notes.
    expect(body.notes).toContain('Maria P.');
    expect(body.notes).toContain('maria@example.com');
  });

  it('folds the captured name/contact into the inserted notes', async () => {
    mocks.selectResultQueue.push([TRAINER_ROW]);
    mocks.insertResultQueue.push([BOOKING_ROW]);

    await postBooking(VALID_BODY);

    const insertedValues = mocks.mockValues.mock.calls[0][0];
    expect(insertedValues.notes).toBe('[Maria P. · maria@example.com] Mornings preferred.');
  });

  it('returns 400 when type is not in BOOKING_TYPES', async () => {
    const res = await postBooking({ ...VALID_BODY, type: 'consultation' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when requestedAt is not a valid ISO datetime', async () => {
    const res = await postBooking({ ...VALID_BODY, requestedAt: 'next tuesday' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a required field is missing (name)', async () => {
    const { name, ...noName } = VALID_BODY;
    void name;
    const res = await postBooking(noName);
    expect(res.status).toBe(400);
  });

  it('returns 503 when no practice trainer is resolvable', async () => {
    mocks.selectResultQueue.push([]); // resolveTrainerId trainer lookup → empty

    const res = await postBooking(VALID_BODY);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: 'practice not configured' });
  });

  it('responds with Content-Type application/json on 201', async () => {
    mocks.selectResultQueue.push([TRAINER_ROW]);
    mocks.insertResultQueue.push([BOOKING_ROW]);

    const res = await postBooking(VALID_BODY);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
