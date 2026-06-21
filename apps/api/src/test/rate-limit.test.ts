// Tests for the publicWriteLimiter (app.ts — Phase 3a / AC-3a-9 / D-8).
//
// Covers:
//   - Sending 11 POST /leads requests from the SAME IP yields 429
//     { error: 'too many requests' } on the 11th (limit = 10 / 60 s window).
//   - A DIFFERENT IP is not throttled: its 1st request gets through normally.
//   - Same assertions for POST /bookings (the limiter is applied to both paths).
//
// Strategy: same vi.hoisted() + vi.mock('../db/client.js') + vi.mock('dotenv/config')
// pattern as leads.test.ts / bookings.test.ts. The rate limiter is in-memory and
// keyed by IP; vitest's `isolate: true` means this file gets its own module
// instances (fresh MemoryStore), so the counts here do NOT interfere with any
// other test file.
//
// IMPORTANT: uses dedicated IP ranges that do NOT overlap with any other test
// file (leads.test.ts uses 10.0.0.*, bookings.test.ts uses 10.0.1.*):
//   rate-limit /leads tests   → 10.9.0.*
//   rate-limit /bookings tests→ 10.9.1.*

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
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockSendLeadNotification = vi.fn();

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
    mockSendLeadNotification,
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

// Mock the email module so fire-and-forget never hits a real network path.
vi.mock('../lib/email.js', () => ({
  sendLeadNotification: mocks.mockSendLeadNotification,
}));

import { app } from '../app.js';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TRAINER_ID = 'aa000000-0000-0000-0000-000000000099';
const TRAINER_ROW = { id: TRAINER_ID, email: 'trainer@example.com' };

const LEAD_ROW = {
  id: 'bb000000-0000-0000-0000-000000000099',
  trainerId: TRAINER_ID,
  name: 'Rate Test',
  contact: 'rate@example.com',
  source: 'website-contact',
  message: null,
  status: 'new',
  clientId: null,
  createdAt: new Date('2026-06-21T09:00:00Z'),
};

const BOOKING_ROW = {
  id: 'cc000000-0000-0000-0000-000000000099',
  trainerId: TRAINER_ID,
  leadId: null,
  clientId: null,
  type: 'assessment',
  requestedAt: new Date('2026-07-01T10:00:00Z'),
  status: 'requested',
  notes: '[Rate Test · rate@example.com]',
  createdAt: new Date('2026-06-21T09:00:00Z'),
};

const VALID_LEAD = {
  name: 'Rate Test',
  contact: 'rate@example.com',
  source: 'website-contact',
};

const VALID_BOOKING = {
  type: 'assessment',
  requestedAt: '2026-07-01T10:00:00.000Z',
  name: 'Rate Test',
  contact: 'rate@example.com',
};

// ── Helper: reset mocks before each test ─────────────────────────────────────
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

  mocks.mockSendLeadNotification.mockResolvedValue(undefined);

  delete process.env.PRACTICE_TRAINER_ID;
  process.env.PRACTICE_TRAINER_ID = TRAINER_ID;
});

// ── Rate limiting — POST /leads ───────────────────────────────────────────────
describe('publicWriteLimiter — POST /leads', () => {
  const THROTTLE_IP = '10.9.0.1';
  const UNTHROTTLED_IP = '10.9.0.2';

  it('responds 429 { error: "too many requests" } on the 11th request from the same IP', async () => {
    // Requests 1-10: feed DB mocks for each so they all resolve as 201.
    for (let i = 0; i < 10; i++) {
      mocks.insertResultQueue.push([LEAD_ROW]);
    }

    // Requests 1-10 should all succeed (201).
    for (let i = 0; i < 10; i++) {
      const res = await app.request('/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': THROTTLE_IP,
        },
        body: JSON.stringify(VALID_LEAD),
      });
      expect(res.status).toBe(201);
    }

    // 11th request: rate limiter should kick in → 429.
    const limited = await app.request('/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': THROTTLE_IP,
      },
      body: JSON.stringify(VALID_LEAD),
    });

    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body).toEqual({ error: 'too many requests' });
  });

  it('does NOT throttle a different IP when the first IP is exhausted', async () => {
    // Exhaust the first IP (10 requests).
    for (let i = 0; i < 10; i++) {
      mocks.insertResultQueue.push([LEAD_ROW]);
    }
    for (let i = 0; i < 10; i++) {
      await app.request('/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': THROTTLE_IP,
        },
        body: JSON.stringify(VALID_LEAD),
      });
    }

    // A different IP should still get 201 on its first request.
    mocks.insertResultQueue.push([LEAD_ROW]);
    const res = await app.request('/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': UNTHROTTLED_IP,
      },
      body: JSON.stringify(VALID_LEAD),
    });

    expect(res.status).toBe(201);
  });
});

// ── Rate limiting — POST /bookings ────────────────────────────────────────────
describe('publicWriteLimiter — POST /bookings', () => {
  const THROTTLE_IP = '10.9.1.1';
  const UNTHROTTLED_IP = '10.9.1.2';

  it('responds 429 { error: "too many requests" } on the 11th request from the same IP', async () => {
    // Feed DB mocks for requests 1-10.
    for (let i = 0; i < 10; i++) {
      mocks.insertResultQueue.push([BOOKING_ROW]);
    }

    for (let i = 0; i < 10; i++) {
      const res = await app.request('/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': THROTTLE_IP,
        },
        body: JSON.stringify(VALID_BOOKING),
      });
      expect(res.status).toBe(201);
    }

    // 11th request → 429.
    const limited = await app.request('/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': THROTTLE_IP,
      },
      body: JSON.stringify(VALID_BOOKING),
    });

    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body).toEqual({ error: 'too many requests' });
  });

  it('does NOT throttle a different IP when the first IP is exhausted', async () => {
    // Exhaust the first IP (10 requests).
    for (let i = 0; i < 10; i++) {
      mocks.insertResultQueue.push([BOOKING_ROW]);
    }
    for (let i = 0; i < 10; i++) {
      await app.request('/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': THROTTLE_IP,
        },
        body: JSON.stringify(VALID_BOOKING),
      });
    }

    // A different IP's first request should succeed.
    mocks.insertResultQueue.push([BOOKING_ROW]);
    const res = await app.request('/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': UNTHROTTLED_IP,
      },
      body: JSON.stringify(VALID_BOOKING),
    });

    expect(res.status).toBe(201);
  });
});
