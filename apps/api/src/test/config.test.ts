// Tests for src/config.ts (design §5, D-8/D-11).
//
// The config module is an env-validated reader. It THROWS on any missing
// required variable at module load time (fail-fast / no-silent-fallback rule).
// The required set is DATABASE_URL, DEFAULT_TRAINER_ID and CORS_ORIGINS; the
// baseline values come from src/test/setup.ts and each test deletes or
// overrides the one it is exercising.
// PORT is the only intentionally optional var (defaults to 3000 via the `??`
// operator in the module — no throw for PORT absence).
//
// Strategy: vi.mock('dotenv/config') neutralises the side-effect import.
// vi.resetModules() + dynamic import re-evaluates config.ts from scratch in
// each test so we can freely mutate process.env between assertions.

import { vi, describe, it, expect, afterEach } from 'vitest';

// Prevent dotenv from overwriting our test env values.
vi.mock('dotenv/config', () => ({}));

// Capture the original env so we can restore it after each test.
const originalEnv = { ...process.env };

afterEach(() => {
  // Restore process.env to its original state.
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  // Reset the module registry so the next test gets a fresh evaluation.
  vi.resetModules();
});

describe('config.ts — environment validation', () => {
  it('throws when DATABASE_URL is absent', async () => {
    delete process.env.DATABASE_URL;

    await expect(import('../config.js')).rejects.toThrow(
      'Missing required environment variable: DATABASE_URL',
    );
  });

  it('throws when DATABASE_URL is set to an empty string', async () => {
    process.env.DATABASE_URL = '';

    await expect(import('../config.js')).rejects.toThrow(
      'Missing required environment variable: DATABASE_URL',
    );
  });

  it('throws when DATABASE_URL is set to whitespace only', async () => {
    process.env.DATABASE_URL = '   ';

    await expect(import('../config.js')).rejects.toThrow(
      'Missing required environment variable: DATABASE_URL',
    );
  });

  it('throws when DEFAULT_TRAINER_ID is absent', async () => {
    delete process.env.DEFAULT_TRAINER_ID;

    await expect(import('../config.js')).rejects.toThrow(
      'Missing required environment variable: DEFAULT_TRAINER_ID',
    );
  });

  it('throws when CORS_ORIGINS is absent', async () => {
    delete process.env.CORS_ORIGINS;

    await expect(import('../config.js')).rejects.toThrow(
      'Missing required environment variable: CORS_ORIGINS',
    );
  });

  it('exports DEFAULT_TRAINER_ID as config.defaultTrainerId', async () => {
    vi.resetModules();
    const trainerId = '11111111-2222-3333-4444-555555555555';
    process.env.DEFAULT_TRAINER_ID = trainerId;

    const mod = await import('../config.js');
    expect(mod.config.defaultTrainerId).toBe(trainerId);
  });

  it('splits CORS_ORIGINS on commas, trimming whitespace and empty entries', async () => {
    vi.resetModules();
    process.env.CORS_ORIGINS = ' https://tailsup.app , http://localhost:8081 ,, ';

    const mod = await import('../config.js');
    expect(mod.config.corsOrigins).toEqual([
      'https://tailsup.app',
      'http://localhost:8081',
    ]);
  });

  it('exports the DATABASE_URL value as config.databaseUrl when present', async () => {
    vi.resetModules();
    const url = 'postgresql://user:pass@localhost:5432/tailsup';
    process.env.DATABASE_URL = url;

    const mod = await import('../config.js');
    expect(mod.config.databaseUrl).toBe(url);
  });

  it('defaults config.port to 3000 when PORT is not set', async () => {
    vi.resetModules();
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/tailsup';
    delete process.env.PORT;

    const mod = await import('../config.js');
    expect(mod.config.port).toBe(3000);
  });

  it('parses config.port from PORT env var when set', async () => {
    vi.resetModules();
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/tailsup';
    process.env.PORT = '4200';

    const mod = await import('../config.js');
    expect(mod.config.port).toBe(4200);
  });
});
