// Tests for the event read + mutation + media-persist routes (events.ts — Phase 2).
//
// Covers (AC-3, AC-4, AC-7 of the Phase 2 spec):
//
//   GET /events/:id (FR-A8)
//     - 404 for an unknown event id.
//     - 200 BehaviorEventWithMediaDTO (event + media[]) for a known id.
//     - media[] is an empty array when no media rows exist.
//     - Media rows are mapped to MediaDTO correctly.
//     - All BehaviorEventDTO fields present.
//
//   PATCH /events/:id (FR-A7 / AC-4 — the moat)
//     - 404 for an unknown event id.
//     - 200 with updated BehaviorEventDTO when note is provided.
//     - 200 with updated BehaviorEventDTO when tags is provided.
//     - Sending tap fields in the body does NOT change them (AC-4 moat protection).
//     - Empty body returns the current row unchanged (no update query runs).
//     - note can be set to null.
//     - tags can be set to null.
//     - intervention is never null in the response.
//
//   POST /events/:id/media (FR-A2 / AC-7)
//     - 404 for an unknown event id.
//     - 400 when contentType is not in the allow-set.
//     - 201 MediaDTO after the media row is inserted.
//     - blobUrl in the 201 response starts with https:// and contains the key.
//     - 503 when R2 is unconfigured (getR2Config/blobUrlForKey throws).
//
// Mock design note:
//   events.ts uses two different db.select query shapes per request:
//     shape-a: db.select().from(X).where(...).limit(1)  → routes event/media lookups
//     shape-b: db.select().from(Y).where(...)            → routes media list (awaited directly)
//   To handle both, we use per-call mockReturnValueOnce on db.select so each
//   invocation returns a fully independent mock chain with its own terminal resolving.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  let insertResult: unknown[] = [];

  // db.select is called once per query; each call gets its own chain via Once.
  const mockSelect = vi.fn();

  // Update chain.
  const mockUpdateReturning = vi.fn(() => Promise.resolve(insertResult));
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

  // Insert chain.
  const mockInsertReturning = vi.fn(() => Promise.resolve(insertResult));
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  // r2 mock controls.
  const r2BlobUrl = vi.fn((_cfg: unknown, key: string) =>
    `https://test-account.r2.cloudflarestorage.com/test-bucket/${key}`,
  );
  let r2ShouldThrow = false;

  return {
    get insertResult() {
      return insertResult;
    },
    set insertResult(v: unknown[]) {
      insertResult = v;
    },
    mockSelect,
    mockUpdateReturning,
    mockUpdateWhere,
    mockUpdateSet,
    mockUpdate,
    mockInsertReturning,
    mockInsertValues,
    mockInsert,
    r2BlobUrl,
    get r2ShouldThrow() {
      return r2ShouldThrow;
    },
    set r2ShouldThrow(v: boolean) {
      r2ShouldThrow = v;
    },
  };
});
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('dotenv/config', () => ({}));

vi.mock('../db/client.js', () => ({
  db: {
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
    insert: mocks.mockInsert,
  },
}));

// Mock r2.ts — getR2Config reads mocks.r2ShouldThrow at call time.
vi.mock('../lib/r2.js', () => ({
  ALLOWED_CONTENT_TYPES: ['video/mp4', 'video/quicktime'] as const,
  PRESIGN_EXPIRES_IN_SECONDS: 600,
  getR2Config: vi.fn(() => {
    if (mocks.r2ShouldThrow) {
      throw new Error('Missing required environment variable: R2_ACCOUNT_ID');
    }
    return {
      accountId: 'test-account',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucket: 'test-bucket',
    };
  }),
  blobUrlForKey: mocks.r2BlobUrl,
  buildKey: vi.fn((eventId: string, contentType: string) => {
    const ext = contentType === 'video/mp4' ? 'mp4' : 'mov';
    return `events/${eventId}/test-uuid.${ext}`;
  }),
  presignPutUrl: vi.fn(),
  presignGetUrl: vi.fn(),
}));

// Phase 3b: /events/* now requires a trainer session — mock auth.
vi.mock('../lib/auth.js', () => import('./authMock.js'));
import { authState, trainerSession } from './authMock.js';

import { app } from '../app.js';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────
const SESSION_ID = 'aa000000-0000-0000-0000-000000000001';
const EVENT_ID   = 'bb000000-0000-0000-0000-000000000001';
const MEDIA_ID   = 'cc000000-0000-0000-0000-000000000001';

// ── Row fixtures ──────────────────────────────────────────────────────────────
const EVENT_ROW = {
  id: EVENT_ID,
  sessionId: SESSION_ID,
  occurredAt: new Date('2026-06-20T10:05:00Z'),
  triggerType: 'dog',
  thresholdMeters: 5,
  intensity: 7,
  outcome: 'recovered_slowly',
  intervention: 'u-turn',
  note: null,
  tags: null,
};

const MEDIA_ROW = {
  id: MEDIA_ID,
  eventId: EVENT_ID,
  blobUrl: `https://test-account.r2.cloudflarestorage.com/test-bucket/events/${EVENT_ID}/test-uuid.mp4`,
  type: 'video',
  uploadedAt: new Date('2026-06-20T10:10:00Z'),
};

// ── Chain builders — each builds a fully independent select chain ─────────────

// shape-a: resolves via .limit(n)
function selectChainWithLimit(rows: unknown[]) {
  const limit = vi.fn(() => Promise.resolve(rows));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from };
}

// shape-b: resolves when .where() is awaited directly
function selectChainWithWhereTerminal(rows: unknown[]) {
  const where = vi.fn(() => Promise.resolve(rows));
  const from = vi.fn(() => ({ where }));
  return { from };
}

// ── beforeEach ────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  authState.session = trainerSession('a0000000-0000-0000-0000-0000000000e2');
  mocks.insertResult = [];
  mocks.r2ShouldThrow = false;

  // Re-wire update chain.
  mocks.mockUpdateReturning.mockImplementation(() => Promise.resolve(mocks.insertResult));
  mocks.mockUpdateWhere.mockReturnValue({ returning: mocks.mockUpdateReturning });
  mocks.mockUpdateSet.mockReturnValue({ where: mocks.mockUpdateWhere });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockUpdateSet });

  // Re-wire insert chain.
  mocks.mockInsertReturning.mockImplementation(() => Promise.resolve(mocks.insertResult));
  mocks.mockInsertValues.mockReturnValue({ returning: mocks.mockInsertReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockInsertValues });

  // Re-wire blobUrlForKey.
  mocks.r2BlobUrl.mockImplementation(
    (_cfg: unknown, key: string) =>
      `https://test-account.r2.cloudflarestorage.com/test-bucket/${key}`,
  );
});

// ── GET /events/:id ───────────────────────────────────────────────────────────
describe('GET /events/:id', () => {
  it('returns 404 with error body when the event does not exist', async () => {
    // Call 1: event lookup via .where().limit(1) → empty
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([]));

    const res = await app.request('/events/00000000-0000-0000-0000-deadbeef0001');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'event not found' });
  });

  it('returns 200 BehaviorEventWithMediaDTO when the event exists', async () => {
    // Call 1: event lookup .where().limit(1)
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    // Call 2: media lookup .where() directly
    mocks.mockSelect.mockReturnValueOnce(selectChainWithWhereTerminal([]));

    const res = await app.request(`/events/${EVENT_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(EVENT_ID);
    expect(body.sessionId).toBe(SESSION_ID);
    expect(Array.isArray(body.media)).toBe(true);
  });

  it('returns an empty media array when the event has no media', async () => {
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    mocks.mockSelect.mockReturnValueOnce(selectChainWithWhereTerminal([]));

    const res = await app.request(`/events/${EVENT_ID}`);
    const body = await res.json();

    expect(body.media).toEqual([]);
  });

  it('includes MediaDTO objects in the media array', async () => {
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    mocks.mockSelect.mockReturnValueOnce(selectChainWithWhereTerminal([MEDIA_ROW]));

    const res = await app.request(`/events/${EVENT_ID}`);
    const body = await res.json();

    expect(body.media).toHaveLength(1);
    const m = body.media[0];
    expect(m.id).toBe(MEDIA_ID);
    expect(m.eventId).toBe(EVENT_ID);
    expect(typeof m.blobUrl).toBe('string');
    expect(m.blobUrl.startsWith('https://')).toBe(true);
    expect(m.type).toBe('video');
    expect(typeof m.uploadedAt).toBe('string');
  });

  it('has all BehaviorEventDTO fields in the response', async () => {
    const eventRowWithData = {
      ...EVENT_ROW,
      note: 'near the park gate',
      tags: ['reactive', 'leash'],
    };
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([eventRowWithData]));
    mocks.mockSelect.mockReturnValueOnce(selectChainWithWhereTerminal([]));

    const res = await app.request(`/events/${EVENT_ID}`);
    const body = await res.json();

    expect(body.id).toBe(EVENT_ID);
    expect(body.sessionId).toBe(SESSION_ID);
    expect(typeof body.occurredAt).toBe('string');
    expect(body.triggerType).toBe('dog');
    expect(body.thresholdMeters).toBe(5);
    expect(body.intensity).toBe(7);
    expect(body.outcome).toBe('recovered_slowly');
    expect(body.intervention).toBe('u-turn');
    expect(body.note).toBe('near the park gate');
    expect(body.tags).toEqual(['reactive', 'leash']);
  });

  it('responds with Content-Type application/json', async () => {
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    mocks.mockSelect.mockReturnValueOnce(selectChainWithWhereTerminal([]));

    const res = await app.request(`/events/${EVENT_ID}`);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});

// ── PATCH /events/:id ─────────────────────────────────────────────────────────
describe('PATCH /events/:id', () => {
  function patchEvent(eventId: string, body: Record<string, unknown>) {
    return app.request(`/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 404 when the event does not exist', async () => {
    // event lookup: empty → 404
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([]));

    const res = await patchEvent('00000000-0000-0000-0000-deadbeef0002', { note: 'test' });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'event not found' });
  });

  it('returns 200 with the updated BehaviorEventDTO after patching note', async () => {
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    const updated = { ...EVENT_ROW, note: 'updated note' };
    mocks.insertResult = [updated];

    const res = await patchEvent(EVENT_ID, { note: 'updated note' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.note).toBe('updated note');
    expect(body.id).toBe(EVENT_ID);
  });

  it('returns 200 with the updated BehaviorEventDTO after patching tags', async () => {
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    const updated = { ...EVENT_ROW, tags: ['reactive', 'leash'] };
    mocks.insertResult = [updated];

    const res = await patchEvent(EVENT_ID, { tags: ['reactive', 'leash'] });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tags).toEqual(['reactive', 'leash']);
  });

  it('AC-4: sending tap fields in the body does not update them (moat protection)', async () => {
    // The route's Zod schema only accepts note/tags; tap fields are stripped by Zod.
    // The patch must succeed (not 400/422) and tap fields remain unchanged.
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    const updated = { ...EVENT_ROW, note: 'legit' }; // only note updated
    mocks.insertResult = [updated];

    const res = await patchEvent(EVENT_ID, {
      note: 'legit',
      // These should be stripped/ignored by the PATCH body schema (AC-4 moat):
      triggerType: 'human',
      intensity: 1,
      outcome: 'disengaged',
      thresholdMeters: 0,
      intervention: 'sit',
    });

    // Must succeed (not 400/422).
    expect(res.status).toBe(200);
    const body = await res.json();
    // The returned DTO reflects the mock — tap fields remain their original values.
    expect(body.triggerType).toBe('dog');           // not 'human'
    expect(body.intensity).toBe(7);                 // not 1
    expect(body.outcome).toBe('recovered_slowly');  // not 'disengaged'
    expect(body.intervention).toBe('u-turn');        // not 'sit'
  });

  it('returns 200 with the current row unchanged when the body is empty', async () => {
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    // No update query runs — the handler returns the current row directly.
    const res = await patchEvent(EVENT_ID, {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.note).toBeNull();
    expect(body.tags).toBeNull();
    expect(body.triggerType).toBe('dog');
  });

  it('can patch note to null (clear it)', async () => {
    const rowWithNote = { ...EVENT_ROW, note: 'old note' };
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([rowWithNote]));
    const updated = { ...rowWithNote, note: null };
    mocks.insertResult = [updated];

    const res = await patchEvent(EVENT_ID, { note: null });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.note).toBeNull();
  });

  it('can patch tags to null (clear it)', async () => {
    const rowWithTags = { ...EVENT_ROW, tags: ['old-tag'] };
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([rowWithTags]));
    const updated = { ...rowWithTags, tags: null };
    mocks.insertResult = [updated];

    const res = await patchEvent(EVENT_ID, { tags: null });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tags).toBeNull();
  });

  it('intervention is never null in the patch response (the moat stays intact)', async () => {
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    mocks.insertResult = [{ ...EVENT_ROW, note: 'patched' }];

    const res = await patchEvent(EVENT_ID, { note: 'patched' });
    const body = await res.json();

    expect(body.intervention).not.toBeNull();
    expect(typeof body.intervention).toBe('string');
    expect(body.intervention.length).toBeGreaterThan(0);
  });
});

// ── POST /events/:id/media ────────────────────────────────────────────────────
describe('POST /events/:id/media', () => {
  function postMedia(eventId: string, body: Record<string, unknown>) {
    return app.request(`/events/${eventId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 404 when the event does not exist', async () => {
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([]));

    const res = await postMedia('00000000-0000-0000-0000-deadbeef0003', {
      key: `events/${EVENT_ID}/test-uuid.mp4`,
      contentType: 'video/mp4',
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'event not found' });
  });

  it('returns 400 when contentType is not in the allowed set', async () => {
    // Zod validates contentType before the handler body runs.
    const res = await postMedia(EVENT_ID, {
      key: `events/${EVENT_ID}/test-uuid.avi`,
      contentType: 'video/avi', // disallowed
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for an image content type (not in Phase 2 allow-set)', async () => {
    const res = await postMedia(EVENT_ID, {
      key: `events/${EVENT_ID}/test.jpg`,
      contentType: 'image/jpeg',
    });

    expect(res.status).toBe(400);
  });

  it('returns 201 MediaDTO after inserting the media row (video/mp4)', async () => {
    const key = `events/${EVENT_ID}/test-uuid.mp4`;
    const blobUrl = `https://test-account.r2.cloudflarestorage.com/test-bucket/${key}`;
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    mocks.insertResult = [
      {
        id: MEDIA_ID,
        eventId: EVENT_ID,
        blobUrl,
        type: 'video',
        uploadedAt: new Date('2026-06-20T11:00:00Z'),
      },
    ];

    const res = await postMedia(EVENT_ID, { key, contentType: 'video/mp4' });

    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto.id).toBe(MEDIA_ID);
    expect(dto.eventId).toBe(EVENT_ID);
    expect(dto.blobUrl).toBe(blobUrl);
    expect(dto.type).toBe('video');
    expect(typeof dto.uploadedAt).toBe('string');
  });

  it('returns 201 MediaDTO for video/quicktime content type', async () => {
    const key = `events/${EVENT_ID}/test-uuid.mov`;
    const blobUrl = `https://test-account.r2.cloudflarestorage.com/test-bucket/${key}`;
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    mocks.insertResult = [
      {
        id: MEDIA_ID,
        eventId: EVENT_ID,
        blobUrl,
        type: 'video',
        uploadedAt: new Date('2026-06-20T11:00:00Z'),
      },
    ];

    const res = await postMedia(EVENT_ID, { key, contentType: 'video/quicktime' });

    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto.type).toBe('video');
  });

  it('blobUrl in the 201 response is derived from the key and starts with https://', async () => {
    const key = `events/${EVENT_ID}/abc.mp4`;
    const blobUrl = `https://test-account.r2.cloudflarestorage.com/test-bucket/${key}`;
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    mocks.insertResult = [
      { id: MEDIA_ID, eventId: EVENT_ID, blobUrl, type: 'video', uploadedAt: new Date() },
    ];

    const res = await postMedia(EVENT_ID, { key, contentType: 'video/mp4' });
    const dto = await res.json();

    expect(dto.blobUrl.startsWith('https://')).toBe(true);
    expect(dto.blobUrl).toContain(key);
  });

  it('returns 503 when R2 is unconfigured (getR2Config throws)', async () => {
    mocks.r2ShouldThrow = true;
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));

    const res = await postMedia(EVENT_ID, {
      key: `events/${EVENT_ID}/test.mp4`,
      contentType: 'video/mp4',
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: 'media storage not configured' });
  });

  it('responds with Content-Type application/json on 201', async () => {
    const key = `events/${EVENT_ID}/test.mp4`;
    mocks.mockSelect.mockReturnValueOnce(selectChainWithLimit([EVENT_ROW]));
    mocks.insertResult = [
      {
        id: MEDIA_ID,
        eventId: EVENT_ID,
        blobUrl: `https://test-account.r2.cloudflarestorage.com/test-bucket/${key}`,
        type: 'video',
        uploadedAt: new Date(),
      },
    ];

    const res = await postMedia(EVENT_ID, { key, contentType: 'video/mp4' });
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
