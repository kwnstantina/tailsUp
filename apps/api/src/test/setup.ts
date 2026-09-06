// Vitest setup file — runs before every test module is evaluated.
//
// config.ts THROWS at import time on any missing required var (D-11), and the
// app/route modules pull it in transitively (app.ts -> routes -> db/client.ts
// -> config.ts). ESM hoists those imports above any statement in the test file,
// so a test file cannot reliably set the env itself before config evaluates —
// it has to be set here, before the module graph loads.
//
// These are placeholders: every test that touches the DB mocks db/client.js, so
// nothing connects to the URL below. config.test.ts deliberately deletes and
// overrides these values to exercise the fail-fast behaviour.

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.DEFAULT_TRAINER_ID ??= '00000000-0000-0000-0000-0000000000ff';
process.env.CORS_ORIGINS ??= 'http://localhost:8081';
