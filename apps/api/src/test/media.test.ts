// Tests for the media presign + playback routes (media.ts — Phase 2).
//
// Covers (AC-5 and the G-7 playback endpoint of the Phase 2 spec):
//
//   POST /media/presign (FR-A1 / AC-5)
//     - 400 when contentType is disallowed (not in ALLOWED_CONTENT_TYPES).
//     - 400 when contentType is absent from the body.
//     - 404 when eventId refers to a non-existent behavior_event.
//     - 503 when R2 is unconfigured (presignPutUrl throws).
//     - 200 PresignResponse with all required fields when everything is valid.
//     - The presignPutUrl mock-success branch (both allowed content types).
//     - method is always "PUT" in the response.
//     - headers contains Content-Type echoed from the request.
//     - key and expiresInSeconds are present.
//
//   GET /media/:id/url (G-7 playback endpoint)
//     - 404 when the media row does not exist.
//     - 503 when R2 is unconfigured (presignGetUrl throws).
//     - 200 MediaPlaybackUrlDTO when configured (url + expiresInSeconds).
//     - The key round-trip: the blobUrl stored in the media row must map back to
//       the same key that was passed to presignGetUrl (asserts the keyFromBlobUrl
//       → presignGetUrl path in the route handler — the AC-5 round-trip concern).
//
// Strategy: vi.hoisted() + vi.mock('../db/client.js') for DB, and
// vi.mock('../lib/r2.js') to inject success / throw behaviour.
// The tests for the 503 unconfigured branch simulate the throw by having the mock
// presignPutUrl/presignGetUrl functions throw (which the route handler catches
// and maps to 503). This is the cleanest approach because the route imports the
// helpers directly and calls them inside the handler.

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoist mock helpers ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const selectResultQueue: Array<unknown[]> = [];

  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  // Presign mock fns — can be made to throw to simulate unconfigured R2.
  const mockPresignPutUrl = vi.fn();
  const mockPresignGetUrl = vi.fn();

  return {
    selectResultQueue,
    mockLimit,
    mockWhere,
    mockFrom,
    mockSelect,
    mockPresignPutUrl,
    mockPresignGetUrl,
  };
});
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('dotenv/config', () => ({}));

vi.mock('../db/client.js', () => ({
  db: {
    select: mocks.mockSelect,
  },
}));

vi.mock('../lib/r2.js', () => ({
  ALLOWED_CONTENT_TYPES: ['video/mp4', 'video/quicktime'] as const,
  PRESIGN_EXPIRES_IN_SECONDS: 600,
  presignPutUrl: mocks.mockPresignPutUrl,
  presignGetUrl: mocks.mockPresignGetUrl,
  getR2Config: vi.fn(() => ({
    accountId: 'test-account',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucket: 'test-bucket',
  })),
  blobUrlForKey: vi.fn((_cfg: unknown, key: string) =>
    `https://test-account.r2.cloudflarestorage.com/test-bucket/${key}`,
  ),
  buildKey: vi.fn(),
}));

import { app } from '../app.js';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────
const SESSION_ID = 'dd000000-0000-0000-0000-000000000001';
const EVENT_ID   = 'ee000000-0000-0000-0000-000000000001';
const MEDIA_ID   = 'ff000000-0000-0000-0000-000000000001';
const OBJECT_KEY = `events/${EVENT_ID}/test-uuid.mp4`;
const BLOB_URL   = `https://test-account.r2.cloudflarestorage.com/test-bucket/${OBJECT_KEY}`;

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
  blobUrl: BLOB_URL,
  type: 'video',
  uploadedAt: new Date('2026-06-20T10:10:00Z'),
};

// A canonical PresignResponse returned by the mock.
const MOCK_PRESIGN_RESPONSE = {
  uploadUrl: `https://test-account.r2.cloudflarestorage.com/test-bucket/${OBJECT_KEY}?X-Amz-Algorithm=AWS4-HMAC-SHA256&mock=1`,
  method: 'PUT' as const,
  headers: { 'Content-Type': 'video/mp4' },
  key: OBJECT_KEY,
  expiresInSeconds: 600,
};

// ── beforeEach ────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResultQueue.length = 0;

  mocks.mockLimit.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

  // Default: presign succeeds.
  mocks.mockPresignPutUrl.mockResolvedValue(MOCK_PRESIGN_RESPONSE);
  mocks.mockPresignGetUrl.mockResolvedValue(
    `https://test-account.r2.cloudflarestorage.com/test-bucket/${OBJECT_KEY}?signed=1`,
  );
});

// ── POST /media/presign ───────────────────────────────────────────────────────
describe('POST /media/presign', () => {
  function postPresign(body: Record<string, unknown>) {
    return app.request('/media/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 400 when contentType is disallowed (e.g. video/avi)', async () => {
    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/avi' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when contentType is an image type (not in allow-set)', async () => {
    const res = await postPresign({ eventId: EVENT_ID, contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when contentType is missing from the body', async () => {
    const res = await postPresign({ eventId: EVENT_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when eventId is missing from the body', async () => {
    const res = await postPresign({ contentType: 'video/mp4' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the eventId does not match any behavior_event', async () => {
    mocks.selectResultQueue.push([]); // event lookup returns empty

    const res = await postPresign({
      eventId: '00000000-0000-0000-0000-deadbeef0010',
      contentType: 'video/mp4',
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'event not found' });
  });

  it('returns 503 when R2 is unconfigured (presignPutUrl throws)', async () => {
    mocks.selectResultQueue.push([EVENT_ROW]); // event found
    mocks.mockPresignPutUrl.mockRejectedValueOnce(
      new Error('Missing required environment variable: R2_ACCOUNT_ID'),
    );

    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/mp4' });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: 'media storage not configured' });
  });

  it('returns 200 PresignResponse when the event exists and R2 is configured (video/mp4)', async () => {
    mocks.selectResultQueue.push([EVENT_ROW]);

    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/mp4' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.uploadUrl).toBe('string');
    expect(body.uploadUrl.startsWith('https://')).toBe(true);
    expect(body.method).toBe('PUT');
    expect(typeof body.key).toBe('string');
    expect(body.key.startsWith('events/')).toBe(true);
    expect(typeof body.expiresInSeconds).toBe('number');
    expect(body.expiresInSeconds).toBeGreaterThan(0);
    expect(body.headers).toBeDefined();
  });

  it('returns 200 PresignResponse for video/quicktime (the other allowed type)', async () => {
    mocks.selectResultQueue.push([EVENT_ROW]);
    mocks.mockPresignPutUrl.mockResolvedValueOnce({
      ...MOCK_PRESIGN_RESPONSE,
      headers: { 'Content-Type': 'video/quicktime' },
      key: `events/${EVENT_ID}/test-uuid.mov`,
    });

    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/quicktime' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method).toBe('PUT');
    expect(body.headers['Content-Type']).toBe('video/quicktime');
  });

  it('method is always "PUT" in the presign response', async () => {
    mocks.selectResultQueue.push([EVENT_ROW]);

    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/mp4' });
    const body = await res.json();

    expect(body.method).toBe('PUT');
  });

  it('headers contains Content-Type echoing the request contentType', async () => {
    mocks.selectResultQueue.push([EVENT_ROW]);

    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/mp4' });
    const body = await res.json();

    expect(body.headers).toHaveProperty('Content-Type', 'video/mp4');
  });

  it('key in the response starts with events/<eventId>/', async () => {
    mocks.selectResultQueue.push([EVENT_ROW]);

    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/mp4' });
    const body = await res.json();

    // The key scheme is events/<eventId>/<uuid>.<ext> (G-6).
    expect(body.key).toMatch(new RegExp(`^events/${EVENT_ID}/`));
  });

  it('expiresInSeconds is 600 in the presign response', async () => {
    mocks.selectResultQueue.push([EVENT_ROW]);

    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/mp4' });
    const body = await res.json();

    expect(body.expiresInSeconds).toBe(600);
  });

  it('responds with Content-Type application/json on 200', async () => {
    mocks.selectResultQueue.push([EVENT_ROW]);

    const res = await postPresign({ eventId: EVENT_ID, contentType: 'video/mp4' });
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});

// ── GET /media/:id/url ────────────────────────────────────────────────────────
describe('GET /media/:id/url', () => {
  it('returns 404 when the media row does not exist', async () => {
    mocks.selectResultQueue.push([]); // media lookup returns empty

    const res = await app.request('/media/00000000-0000-0000-0000-deadbeef0020/url');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'media not found' });
  });

  it('returns 503 when R2 is unconfigured (presignGetUrl throws)', async () => {
    mocks.selectResultQueue.push([MEDIA_ROW]);
    mocks.mockPresignGetUrl.mockRejectedValueOnce(
      new Error('Missing required environment variable: R2_ACCOUNT_ID'),
    );

    const res = await app.request(`/media/${MEDIA_ID}/url`);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: 'media storage not configured' });
  });

  it('returns 200 MediaPlaybackUrlDTO when configured', async () => {
    mocks.selectResultQueue.push([MEDIA_ROW]);
    const playbackUrl = `https://test-account.r2.cloudflarestorage.com/test-bucket/${OBJECT_KEY}?signed=1`;
    mocks.mockPresignGetUrl.mockResolvedValueOnce(playbackUrl);

    const res = await app.request(`/media/${MEDIA_ID}/url`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.url).toBe('string');
    expect(body.url).toBe(playbackUrl);
    expect(body.expiresInSeconds).toBe(600);
  });

  it('url in the response is a valid https URL', async () => {
    mocks.selectResultQueue.push([MEDIA_ROW]);
    const playbackUrl = `https://test-account.r2.cloudflarestorage.com/test-bucket/${OBJECT_KEY}?signed=1`;
    mocks.mockPresignGetUrl.mockResolvedValueOnce(playbackUrl);

    const res = await app.request(`/media/${MEDIA_ID}/url`);
    const body = await res.json();

    expect(body.url.startsWith('https://')).toBe(true);
  });

  it('key round-trip: presignGetUrl is called with the key derived from the blobUrl', async () => {
    // This test validates the keyFromBlobUrl → presignGetUrl path inside the route.
    // blobUrl format: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
    // The extracted key should be `events/<EVENT_ID>/test-uuid.mp4` (OBJECT_KEY).
    mocks.selectResultQueue.push([MEDIA_ROW]); // blobUrl = BLOB_URL
    mocks.mockPresignGetUrl.mockResolvedValueOnce('https://signed-url.example.com/test');

    await app.request(`/media/${MEDIA_ID}/url`);

    // The presignGetUrl should have been called with the extracted key.
    expect(mocks.mockPresignGetUrl).toHaveBeenCalledWith(OBJECT_KEY);
  });

  it('expiresInSeconds is 600 in the playback URL response', async () => {
    mocks.selectResultQueue.push([MEDIA_ROW]);
    mocks.mockPresignGetUrl.mockResolvedValueOnce('https://signed-url.example.com/test');

    const res = await app.request(`/media/${MEDIA_ID}/url`);
    const body = await res.json();

    expect(body.expiresInSeconds).toBe(600);
  });

  it('responds with Content-Type application/json on 200', async () => {
    mocks.selectResultQueue.push([MEDIA_ROW]);
    mocks.mockPresignGetUrl.mockResolvedValueOnce('https://signed-url.example.com/test');

    const res = await app.request(`/media/${MEDIA_ID}/url`);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
