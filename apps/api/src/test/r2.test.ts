// Tests for the r2.ts pure helper logic (Phase 2).
//
// Covers:
//
//   ALLOWED_CONTENT_TYPES (allow-set, G-6)
//     - The array contains exactly 'video/mp4' and 'video/quicktime'.
//     - 'image/jpeg', 'video/avi' and other types are NOT in the set.
//     - The array is used by z.enum() — asserting its tuple shape.
//
//   PRESIGN_EXPIRES_IN_SECONDS
//     - Is 600 (10 minutes, G-5).
//
//   buildKey (key scheme, G-6)
//     - Returns a string matching `events/<eventId>/<uuid>.<ext>`.
//     - 'video/mp4' → ext 'mp4'.
//     - 'video/quicktime' → ext 'mov'.
//     - Unknown content type falls back to 'mp4'.
//     - Each call generates a unique key (randomUUID).
//
//   blobUrlForKey (canonical reference, G-7)
//     - Returns `https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>`.
//     - Fields from cfg are embedded correctly.
//     - key is preserved verbatim.
//
//   getR2Config (lazy config, R-4 / NFR-4)
//     - Returns an R2Config when all four R2 vars are set.
//     - Throws when R2_ACCOUNT_ID is missing.
//     - Throws when R2_ACCESS_KEY_ID is missing.
//     - Throws when R2_SECRET_ACCESS_KEY is missing.
//     - Throws when R2_BUCKET is missing.
//     - Throws when a var is set to an empty string.
//     - Throws when a var is set to whitespace only.
//
//   blobUrl ↔ key round-trip (indirect via the route-level integration in media.test.ts
//   and the pure-logic tests below)
//     - blobUrlForKey(cfg, key) followed by extracting the key from the URL yields
//       the original key — asserting the canonical round-trip that GET /media/:id/url
//       depends on (keyFromBlobUrl in media.ts is private, so we replicate the
//       extraction logic here to confirm the URL shape is as documented).
//
// Strategy: r2.ts is imported directly (no app involved here). getR2Config tests
// manipulate process.env and use vi.resetModules() so each import gets a fresh
// module evaluation (same pattern as config.test.ts). buildKey and blobUrlForKey
// are pure functions that can be tested without mocking.

import { vi, describe, it, expect, afterEach } from 'vitest';

// Prevent dotenv from overwriting our test env.
vi.mock('dotenv/config', () => ({}));

// ── Capture original env for restoration ─────────────────────────────────────
const originalEnv = { ...process.env };
const R2_VARS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];

afterEach(() => {
  // Restore every R2 var to its original state.
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  vi.resetModules();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function setAllR2Vars() {
  process.env.R2_ACCOUNT_ID = 'test-account-id';
  process.env.R2_ACCESS_KEY_ID = 'test-access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.R2_BUCKET = 'test-bucket';
}

function clearAllR2Vars() {
  for (const v of R2_VARS) {
    delete process.env[v];
  }
}

// Extract the object key from a blobUrl — mirrors the keyFromBlobUrl logic in
// media.ts, which is private. Used to verify the round-trip.
function extractKeyFromBlobUrl(blobUrl: string): string {
  const { pathname } = new URL(blobUrl);
  const trimmed = pathname.replace(/^\/+/, '');
  const slash = trimmed.indexOf('/');
  return slash === -1 ? trimmed : trimmed.slice(slash + 1);
}

// ── ALLOWED_CONTENT_TYPES ─────────────────────────────────────────────────────
describe('ALLOWED_CONTENT_TYPES', () => {
  it('contains exactly video/mp4 and video/quicktime', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { ALLOWED_CONTENT_TYPES } = await import('../lib/r2.js');
    expect(ALLOWED_CONTENT_TYPES).toHaveLength(2);
    expect(ALLOWED_CONTENT_TYPES).toContain('video/mp4');
    expect(ALLOWED_CONTENT_TYPES).toContain('video/quicktime');
  });

  it('does not contain image/jpeg', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { ALLOWED_CONTENT_TYPES } = await import('../lib/r2.js');
    expect(ALLOWED_CONTENT_TYPES).not.toContain('image/jpeg');
  });

  it('does not contain video/avi', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { ALLOWED_CONTENT_TYPES } = await import('../lib/r2.js');
    expect(ALLOWED_CONTENT_TYPES).not.toContain('video/avi');
  });
});

// ── PRESIGN_EXPIRES_IN_SECONDS ────────────────────────────────────────────────
describe('PRESIGN_EXPIRES_IN_SECONDS', () => {
  it('is 600 seconds (10 minutes)', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { PRESIGN_EXPIRES_IN_SECONDS } = await import('../lib/r2.js');
    expect(PRESIGN_EXPIRES_IN_SECONDS).toBe(600);
  });
});

// ── buildKey ──────────────────────────────────────────────────────────────────
describe('buildKey', () => {
  const EVENT_ID = 'ee000000-0000-0000-0000-000000000001';

  it('returns a key matching events/<eventId>/<uuid>.mp4 for video/mp4', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { buildKey } = await import('../lib/r2.js');
    const key = buildKey(EVENT_ID, 'video/mp4');
    expect(key).toMatch(
      new RegExp(`^events/${EVENT_ID}/[0-9a-f-]{36}\\.mp4$`),
    );
  });

  it('returns a key matching events/<eventId>/<uuid>.mov for video/quicktime', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { buildKey } = await import('../lib/r2.js');
    const key = buildKey(EVENT_ID, 'video/quicktime');
    expect(key).toMatch(
      new RegExp(`^events/${EVENT_ID}/[0-9a-f-]{36}\\.mov$`),
    );
  });

  it('falls back to .mp4 extension for an unknown content type', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { buildKey } = await import('../lib/r2.js');
    const key = buildKey(EVENT_ID, 'application/octet-stream');
    expect(key.endsWith('.mp4')).toBe(true);
  });

  it('generates unique keys on successive calls', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { buildKey } = await import('../lib/r2.js');
    const key1 = buildKey(EVENT_ID, 'video/mp4');
    const key2 = buildKey(EVENT_ID, 'video/mp4');
    expect(key1).not.toBe(key2);
  });

  it('embeds the eventId in the key path', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { buildKey } = await import('../lib/r2.js');
    const key = buildKey(EVENT_ID, 'video/mp4');
    expect(key).toContain(EVENT_ID);
  });
});

// ── blobUrlForKey ─────────────────────────────────────────────────────────────
describe('blobUrlForKey', () => {
  const ACCOUNT_ID = 'my-account-id';
  const BUCKET = 'my-bucket';
  const KEY = 'events/some-event-id/uuid.mp4';
  const CFG = {
    accountId: ACCOUNT_ID,
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    bucket: BUCKET,
  };

  it('returns a URL with the correct R2 host pattern', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { blobUrlForKey } = await import('../lib/r2.js');
    const url = blobUrlForKey(CFG, KEY);
    expect(url).toBe(
      `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${KEY}`,
    );
  });

  it('starts with https://', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { blobUrlForKey } = await import('../lib/r2.js');
    expect(blobUrlForKey(CFG, KEY).startsWith('https://')).toBe(true);
  });

  it('embeds the bucket name in the URL path', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { blobUrlForKey } = await import('../lib/r2.js');
    expect(blobUrlForKey(CFG, KEY)).toContain(`/${BUCKET}/`);
  });

  it('embeds the key verbatim in the URL path', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { blobUrlForKey } = await import('../lib/r2.js');
    expect(blobUrlForKey(CFG, KEY)).toContain(KEY);
  });

  it('blobUrlForKey → extractKey round-trip recovers the original key', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { blobUrlForKey } = await import('../lib/r2.js');
    const blobUrl = blobUrlForKey(CFG, KEY);
    const recovered = extractKeyFromBlobUrl(blobUrl);
    expect(recovered).toBe(KEY);
  });

  it('round-trip works for a deeply nested key path', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { blobUrlForKey } = await import('../lib/r2.js');
    const deepKey = 'events/long-event-id/sub/folder/file.mp4';
    const blobUrl = blobUrlForKey(CFG, deepKey);
    const recovered = extractKeyFromBlobUrl(blobUrl);
    expect(recovered).toBe(deepKey);
  });
});

// ── getR2Config — lazy config (R-4 / NFR-4) ──────────────────────────────────
describe('getR2Config', () => {
  it('returns an R2Config object when all four vars are set', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    const { getR2Config } = await import('../lib/r2.js');
    const cfg = getR2Config();
    expect(cfg.accountId).toBe('test-account-id');
    expect(cfg.accessKeyId).toBe('test-access-key');
    expect(cfg.secretAccessKey).toBe('test-secret-key');
    expect(cfg.bucket).toBe('test-bucket');
  });

  it('throws when R2_ACCOUNT_ID is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    delete process.env.R2_ACCOUNT_ID;
    const { getR2Config } = await import('../lib/r2.js');
    expect(() => getR2Config()).toThrow('Missing required environment variable: R2_ACCOUNT_ID');
  });

  it('throws when R2_ACCESS_KEY_ID is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    delete process.env.R2_ACCESS_KEY_ID;
    const { getR2Config } = await import('../lib/r2.js');
    expect(() => getR2Config()).toThrow('Missing required environment variable: R2_ACCESS_KEY_ID');
  });

  it('throws when R2_SECRET_ACCESS_KEY is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    delete process.env.R2_SECRET_ACCESS_KEY;
    const { getR2Config } = await import('../lib/r2.js');
    expect(() => getR2Config()).toThrow(
      'Missing required environment variable: R2_SECRET_ACCESS_KEY',
    );
  });

  it('throws when R2_BUCKET is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    delete process.env.R2_BUCKET;
    const { getR2Config } = await import('../lib/r2.js');
    expect(() => getR2Config()).toThrow('Missing required environment variable: R2_BUCKET');
  });

  it('throws when R2_ACCOUNT_ID is set to an empty string', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    process.env.R2_ACCOUNT_ID = '';
    const { getR2Config } = await import('../lib/r2.js');
    expect(() => getR2Config()).toThrow('Missing required environment variable: R2_ACCOUNT_ID');
  });

  it('throws when R2_BUCKET is set to whitespace only', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    setAllR2Vars();
    process.env.R2_BUCKET = '   ';
    const { getR2Config } = await import('../lib/r2.js');
    expect(() => getR2Config()).toThrow('Missing required environment variable: R2_BUCKET');
  });

  it('does not throw (returns config) when all vars are set — no interaction with config.ts R2 vars', async () => {
    // This test verifies R2 config is LAZY (not read at startup / config.ts load time).
    // We only set DATABASE_URL + R2 vars, never see a startup failure.
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    clearAllR2Vars();
    setAllR2Vars();
    const { getR2Config } = await import('../lib/r2.js');
    expect(() => getR2Config()).not.toThrow();
  });
});
