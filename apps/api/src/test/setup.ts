// Vitest global setup (registered in vitest.config.ts). Phase 3b made AUTH_SECRET
// a REQUIRED var (config.ts throws without it), and app.ts imports config at
// module load — so set the required env BEFORE any test module imports app.ts.
// Uses ??= so a real env value (CI) is never overridden. Auth itself is mocked
// per-file via ./authMock.ts, so no real secret/DB is used.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.AUTH_SECRET ??= 'test-auth-secret-not-used-min-length-000000';
