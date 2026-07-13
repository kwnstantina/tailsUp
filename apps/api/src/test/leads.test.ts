// Tests for the public POST /leads route (leads.ts — Phase 3a) — Unit B.
//
// Covers (AC-3a-1 / AC-3a-6 / AC-3a-9 + investigation 6a–6c):
//   - 201 + correct LeadDTO (status 'new', clientId null) on a valid body.
//   - 400 on a missing required field (name) and on an over-cap field.
//   - 503 when no practice trainer is resolvable (no PRACTICE_TRAINER_ID + no
//     trainer row → resolveTrainerId throws PracticeNotConfiguredError).
//   - The FIRE-AND-FORGET email: sendLeadNotification is invoked but NEVER
//     blocks/fails the 201 — including when it REJECTS (transport error) and when
//     it is a STUB (no RESEND_API_KEY). The response is 201 regardless.
//
// Strategy mirrors media.test.ts: vi.hoisted() + vi.mock('../db/client.js') for
// the DB (a select queue feeds resolveTrainerId's trainer lookup + getTrainerEmail;
// an insert queue feeds the returning() row), and vi.mock('../lib/email.js') so we
// assert the send is called and that a rejecting send cannot fail the request.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const selectResultQueue: Array<unknown[]> = [];
  const insertResultQueue: Array<unknown[]> = [];

  // select(...).from(...).where(...).limit(...)  AND  select().from().orderBy().limit()
  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere, orderBy: mockOrderBy, limit: mockLimit }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  // insert(...).values(...).returning()
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

vi.mock('../lib/email.js', () => ({
  sendLeadNotification: mocks.mockSendLeadNotification,
}));

// Phase 3b: mock BetterAuth so real auth isn't constructed (public routes ignore the session).
vi.mock('../lib/auth.js', () => import('./authMock.js'));

import { app } from '../app.js';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TRAINER_ID = 'aa000000-0000-0000-0000-000000000001';
const LEAD_ID = 'bb000000-0000-0000-0000-000000000001';

const TRAINER_ROW = { id: TRAINER_ID, email: 'trainer@example.com' };

const LEAD_ROW = {
  id: LEAD_ID,
  trainerId: TRAINER_ID,
  name: 'Maria P.',
  contact: 'maria@example.com',
  source: 'website-contact',
  message: 'My dog reacts to bikes.',
  status: 'new',
  clientId: null,
  createdAt: new Date('2026-06-21T09:00:00Z'),
};

const VALID_BODY = {
  name: 'Maria P.',
  contact: 'maria@example.com',
  source: 'website-contact',
  message: 'My dog reacts to bikes.',
};

// Each request gets a unique x-forwarded-for so the in-memory rate limiter
// (keyed by client IP) never throttles across this file's tests — these tests
// exercise the route logic, not the limiter.
let ipCounter = 0;
function postLead(body: Record<string, unknown>) {
  ipCounter += 1;
  return app.request('/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.0.0.${ipCounter}`,
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

  // Default: email send resolves (stub/sent — does not matter to the route).
  mocks.mockSendLeadNotification.mockResolvedValue(undefined);

  // Default: PRACTICE_TRAINER_ID unset so resolveTrainerId falls back to the row.
  delete process.env.PRACTICE_TRAINER_ID;
});

describe('POST /leads', () => {
  it('returns 201 + a LeadDTO (status "new", clientId null) on a valid body', async () => {
    mocks.selectResultQueue.push([TRAINER_ROW]); // resolveTrainerId → trainer row
    mocks.selectResultQueue.push([TRAINER_ROW]); // getTrainerEmail → email
    mocks.insertResultQueue.push([LEAD_ROW]); // insert .returning()

    const res = await postLead(VALID_BODY);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: LEAD_ID,
      trainerId: TRAINER_ID,
      name: 'Maria P.',
      contact: 'maria@example.com',
      source: 'website-contact',
      message: 'My dog reacts to bikes.',
      status: 'new',
      clientId: null,
    });
    expect(typeof body.createdAt).toBe('string');
    expect(body.createdAt).toBe('2026-06-21T09:00:00.000Z');
  });

  it('returns 400 when a required field is missing (name)', async () => {
    const { name, ...noName } = VALID_BODY;
    void name;
    const res = await postLead(noName);
    expect(res.status).toBe(400);
  });

  it('returns 400 when contact exceeds the length cap', async () => {
    const res = await postLead({ ...VALID_BODY, contact: 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });

  it('returns 503 when no practice trainer is resolvable', async () => {
    mocks.selectResultQueue.push([]); // resolveTrainerId trainer lookup → empty

    const res = await postLead(VALID_BODY);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: 'practice not configured' });
  });

  it('still returns 201 when the email send REJECTS (fire-and-forget never fails the insert)', async () => {
    mocks.selectResultQueue.push([TRAINER_ROW]);
    mocks.selectResultQueue.push([TRAINER_ROW]);
    mocks.insertResultQueue.push([LEAD_ROW]);
    // Transport-level rejection — the route's .catch() must absorb it.
    mocks.mockSendLeadNotification.mockRejectedValueOnce(new Error('network down'));

    const res = await postLead(VALID_BODY);

    expect(res.status).toBe(201);
    expect(mocks.mockSendLeadNotification).toHaveBeenCalledTimes(1);
  });

  it('passes the resolved trainer email + the LeadDTO to sendLeadNotification', async () => {
    mocks.selectResultQueue.push([TRAINER_ROW]);
    mocks.selectResultQueue.push([TRAINER_ROW]);
    mocks.insertResultQueue.push([LEAD_ROW]);

    await postLead(VALID_BODY);

    expect(mocks.mockSendLeadNotification).toHaveBeenCalledTimes(1);
    const [to, dto] = mocks.mockSendLeadNotification.mock.calls[0];
    expect(to).toBe('trainer@example.com');
    expect(dto).toMatchObject({ id: LEAD_ID, status: 'new' });
  });

  it('uses PRACTICE_TRAINER_ID when set (no trainer-row lookup needed)', async () => {
    process.env.PRACTICE_TRAINER_ID = TRAINER_ID;
    mocks.selectResultQueue.push([TRAINER_ROW]); // getTrainerEmail lookup
    mocks.insertResultQueue.push([LEAD_ROW]);

    const res = await postLead(VALID_BODY);

    expect(res.status).toBe(201);
  });

  it('responds with Content-Type application/json on 201', async () => {
    mocks.selectResultQueue.push([TRAINER_ROW]);
    mocks.selectResultQueue.push([TRAINER_ROW]);
    mocks.insertResultQueue.push([LEAD_ROW]);

    const res = await postLead(VALID_BODY);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
