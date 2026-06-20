// Tests for src/config.ts (design §5, D-8/D-11).
//
// The config module is an env-validated reader. It THROWS on any missing
// required variable at module load time (fail-fast / no-silent-fallback rule).
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
