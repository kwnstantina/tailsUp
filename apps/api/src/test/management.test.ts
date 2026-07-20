// Tests for the trainer management routes (management.ts — Phase 3b-2 Unit B).
//
// Covers (AC-3b-6/7/8):
//   GET   /trainers/:id/leads|bookings — 200 newest-first; wrong trainer → 403.
//   PATCH /bookings/:id/status         — 200 own; 400 invalid/'requested'; 404 not-theirs.
//   POST  /leads/:id/convert           — 201 (client+lead txn); 409 already-converted; 404 not-theirs.
//   POST  /clients/:id/login           — 201 (role/clientId patch); 409 dup email; 404 not-theirs.
//   Role/authz — a CLIENT session on any trainer mutation → 403; unauthenticated → 401.
//
// Strategy mirrors dogs.test.ts: vi.hoisted() + vi.mock('../db/client.js'). The mock
// drives select() via a queue (drained by orderBy/limit), insert()/update() via their
// own queues (drained by returning()), and transaction() by invoking the callback
// with a tx that reuses the insert/update chains. Auth is the shared authMock; its
// signUpEmail is driven per-test (resolve = created, reject = email exists → 409).

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers ──────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const selectResultQueue: Array<unknown[]> = [];
  const insertResultQueue: Array<unknown[]> = [];
  const updateResultQueue: Array<unknown[]> = [];

  // select chain: select().from().where().{orderBy|limit}
  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockOrderBy = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy, limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  // insert chain: insert().values().returning()
  const mockInsertReturning = vi.fn(() => Promise.resolve(insertResultQueue.shift() ?? []));
  const mockValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  // update chain: update().set().where().returning()
  const mockUpdateReturning = vi.fn(() => Promise.resolve(updateResultQueue.shift() ?? []));
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  // transaction: invoke the callback with a tx exposing the same insert/update chains.
  const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
    cb({ insert: mockInsert, update: mockUpdate }),
  );

  return {
    selectResultQueue,
    insertResultQueue,
    updateResultQueue,
    mockLimit,
    mockOrderBy,
    mockWhere,
    mockFrom,
    mockSelect,
    mockInsertReturning,
    mockValues,
    mockInsert,
    mockUpdateReturning,
    mockUpdateWhere,
    mockSet,
    mockUpdate,
    mockTransaction,
  };
});
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('dotenv/config', () => ({}));

vi.mock('../db/client.js', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    transaction: mocks.mockTransaction,
  },
}));

vi.mock('../lib/auth.js', () => import('./authMock.js'));
import { auth, authState, clientSession, trainerSession } from './authMock.js';

import { app } from '../app.js';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixture UUIDs ───────────────────────────────────────────────────────────────
const TRAINER_ID = 'a0000000-0000-0000-0000-000000000001';
const OTHER_TRAINER_ID = 'a0000000-0000-0000-0000-000000000002';
const LEAD_ID = 'b0000000-0000-0000-0000-000000000001';
const BOOKING_ID = 'c0000000-0000-0000-0000-000000000001';
const CLIENT_ID = 'd0000000-0000-0000-0000-000000000001';

// ── Row fixtures ────────────────────────────────────────────────────────────────
function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LEAD_ID,
    trainerId: TRAINER_ID,
    name: 'Maria P.',
    contact: 'maria@example.com',
    source: 'website-contact',
    message: 'My dog reacts to bikes.',
    status: 'new',
    clientId: null,
    createdAt: new Date('2026-06-21T09:00:00Z'),
    ...overrides,
  };
}

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    trainerId: TRAINER_ID,
    leadId: null,
    clientId: null,
    type: 'assessment',
    requestedAt: new Date('2026-06-25T14:00:00Z'),
    status: 'requested',
    notes: '[Maria P. · maria@example.com]',
    createdAt: new Date('2026-06-21T10:00:00Z'),
    ...overrides,
  };
}

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_ID,
    trainerId: TRAINER_ID,
    name: 'Maria P.',
    contact: 'maria@example.com',
    ...overrides,
  };
}

// ── beforeEach: reset queues + re-wire chains + default trainer session ──────────
beforeEach(() => {
  vi.clearAllMocks();
  authState.session = trainerSession(TRAINER_ID);

  mocks.selectResultQueue.length = 0;
  mocks.insertResultQueue.length = 0;
  mocks.updateResultQueue.length = 0;

  mocks.mockLimit.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockOrderBy.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockWhere.mockReturnValue({ orderBy: mocks.mockOrderBy, limit: mocks.mockLimit });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

  mocks.mockInsertReturning.mockImplementation(() =>
    Promise.resolve(mocks.insertResultQueue.shift() ?? []),
  );
  mocks.mockValues.mockReturnValue({ returning: mocks.mockInsertReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

  mocks.mockUpdateReturning.mockImplementation(() =>
    Promise.resolve(mocks.updateResultQueue.shift() ?? []),
  );
  mocks.mockUpdateWhere.mockReturnValue({ returning: mocks.mockUpdateReturning });
  mocks.mockSet.mockReturnValue({ where: mocks.mockUpdateWhere });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

  mocks.mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({ insert: mocks.mockInsert, update: mocks.mockUpdate }),
  );

  auth.api.signUpEmail.mockReset();
  auth.api.signUpEmail.mockResolvedValue({ user: { id: 'auth-new' } });
});

// helpers
function patchStatus(id: string, body: Record<string, unknown>) {
  return app.request(`/bookings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function convert(id: string) {
  return app.request(`/leads/${id}/convert`, { method: 'POST' });
}
function createLogin(id: string, body: Record<string, unknown>) {
  return app.request(`/clients/${id}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── GET /trainers/:trainerId/leads ───────────────────────────────────────────────
describe('GET /trainers/:trainerId/leads', () => {
  it('returns 200 LeadDTO[] for the session trainer', async () => {
    mocks.selectResultQueue.push([leadRow(), leadRow({ id: 'b0000000-0000-0000-0000-000000000002', status: 'contacted' })]);
    const res = await app.request(`/trainers/${TRAINER_ID}/leads`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ id: LEAD_ID, trainerId: TRAINER_ID, status: 'new' });
    expect(typeof body[0].createdAt).toBe('string');
  });

  it('returns 403 when the path trainerId is not the session trainer (ownership guard)', async () => {
    const res = await app.request(`/trainers/${OTHER_TRAINER_ID}/leads`);
    expect(res.status).toBe(403);
  });
});

// ── GET /trainers/:trainerId/bookings ─────────────────────────────────────────────
describe('GET /trainers/:trainerId/bookings', () => {
  it('returns 200 BookingDTO[] for the session trainer', async () => {
    mocks.selectResultQueue.push([bookingRow()]);
    const res = await app.request(`/trainers/${TRAINER_ID}/bookings`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: BOOKING_ID, trainerId: TRAINER_ID, status: 'requested' });
  });
});

// ── PATCH /bookings/:id/status ────────────────────────────────────────────────────
describe('PATCH /bookings/:id/status', () => {
  it('returns 200 BookingDTO with the new status on a valid transition', async () => {
    mocks.selectResultQueue.push([bookingRow()]); // load
    mocks.updateResultQueue.push([bookingRow({ status: 'confirmed' })]); // update.returning
    const res = await patchStatus(BOOKING_ID, { status: 'confirmed' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('confirmed');
    expect(body.id).toBe(BOOKING_ID);
  });

  it("returns 400 for an invalid status value ('requested' is not a valid target)", async () => {
    const res = await patchStatus(BOOKING_ID, { status: 'requested' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a garbage status value', async () => {
    const res = await patchStatus(BOOKING_ID, { status: 'banana' });
    expect(res.status).toBe(400);
  });

  it("returns 404 for another trainer's booking (never reveals it)", async () => {
    mocks.selectResultQueue.push([bookingRow({ trainerId: OTHER_TRAINER_ID })]);
    const res = await patchStatus(BOOKING_ID, { status: 'confirmed' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'booking not found' });
  });

  it('returns 404 for a missing booking', async () => {
    mocks.selectResultQueue.push([]); // not found
    const res = await patchStatus(BOOKING_ID, { status: 'declined' });
    expect(res.status).toBe(404);
  });

  it('returns 403 for a client session (route-scoped requireTrainer)', async () => {
    authState.session = clientSession(CLIENT_ID);
    const res = await patchStatus(BOOKING_ID, { status: 'confirmed' });
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    authState.session = null;
    const res = await patchStatus(BOOKING_ID, { status: 'confirmed' });
    expect(res.status).toBe(401);
  });
});

// ── POST /leads/:id/convert ───────────────────────────────────────────────────────
describe('POST /leads/:id/convert', () => {
  it('returns 201 with the created client + converted lead (single txn)', async () => {
    mocks.selectResultQueue.push([leadRow()]); // load lead
    mocks.insertResultQueue.push([clientRow()]); // tx.insert(client)
    mocks.updateResultQueue.push([leadRow({ status: 'converted', clientId: CLIENT_ID })]); // tx.update(lead)

    const res = await convert(LEAD_ID);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.client).toMatchObject({ id: CLIENT_ID, trainerId: TRAINER_ID, name: 'Maria P.' });
    expect(body.lead).toMatchObject({ id: LEAD_ID, status: 'converted', clientId: CLIENT_ID });
    expect(mocks.mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when the lead is already converted (no duplicate client)', async () => {
    mocks.selectResultQueue.push([leadRow({ status: 'converted', clientId: CLIENT_ID })]);
    const res = await convert(LEAD_ID);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'lead already converted' });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 404 for another trainer's lead", async () => {
    mocks.selectResultQueue.push([leadRow({ trainerId: OTHER_TRAINER_ID })]);
    const res = await convert(LEAD_ID);
    expect(res.status).toBe(404);
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing lead', async () => {
    mocks.selectResultQueue.push([]);
    const res = await convert(LEAD_ID);
    expect(res.status).toBe(404);
  });

  it('returns 403 for a client session', async () => {
    authState.session = clientSession(CLIENT_ID);
    const res = await convert(LEAD_ID);
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    authState.session = null;
    const res = await convert(LEAD_ID);
    expect(res.status).toBe(401);
  });
});

// ── POST /clients/:id/login ───────────────────────────────────────────────────────
describe('POST /clients/:id/login', () => {
  const VALID = { email: 'maria@example.com', password: 'Sup3rSecret!' };

  it('returns 201 ClientLoginDTO and patches role/clientId', async () => {
    mocks.selectResultQueue.push([clientRow()]); // load client
    mocks.selectResultQueue.push([{ id: 'auth-user-1' }]); // user lookup by email
    mocks.updateResultQueue.push([{ id: 'auth-user-1' }]); // role/clientId patch

    const res = await createLogin(CLIENT_ID, VALID);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ userId: 'auth-user-1', clientId: CLIENT_ID, email: VALID.email });
    expect(auth.api.signUpEmail).toHaveBeenCalledTimes(1);
    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: { email: VALID.email, password: VALID.password, name: 'Maria P.' },
    });
    // role/clientId patch ran with the correct values.
    expect(mocks.mockSet).toHaveBeenCalledWith({ role: 'client', clientId: CLIENT_ID });
  });

  it('returns 409 when the login/email already exists (signUpEmail throws)', async () => {
    mocks.selectResultQueue.push([clientRow()]);
    auth.api.signUpEmail.mockRejectedValueOnce(new Error('user already exists'));
    const res = await createLogin(CLIENT_ID, VALID);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'login already exists' });
  });

  it("returns 404 for another trainer's client (never provisions)", async () => {
    mocks.selectResultQueue.push([clientRow({ trainerId: OTHER_TRAINER_ID })]);
    const res = await createLogin(CLIENT_ID, VALID);
    expect(res.status).toBe(404);
    expect(auth.api.signUpEmail).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing client', async () => {
    mocks.selectResultQueue.push([]);
    const res = await createLogin(CLIENT_ID, VALID);
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid email', async () => {
    const res = await createLogin(CLIENT_ID, { email: 'not-an-email', password: 'Sup3rSecret!' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a password shorter than 8 chars', async () => {
    const res = await createLogin(CLIENT_ID, { email: 'maria@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for a client session', async () => {
    authState.session = clientSession(CLIENT_ID);
    const res = await createLogin(CLIENT_ID, VALID);
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    authState.session = null;
    const res = await createLogin(CLIENT_ID, VALID);
    expect(res.status).toBe(401);
  });
});
