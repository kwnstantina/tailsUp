---
status: completed
mode: write-and-run
scope_slug: phase3a-api-gap-coverage
language: typescript
framework: vitest (hono app via app.request())
test_command_full: npm run -s test -w @tailsup/api
test_command_scope: npm run -s test -w @tailsup/api
test_dir: apps/api/src/test
target_path: C:/Users/KonstantinaKirtsia/source/repos/tailsUp
test_files_owned:
  - apps/api/src/test/rate-limit.test.ts
  - apps/api/src/test/email.test.ts
  - apps/api/src/test/trainer.test.ts
tests_added: 25
tests_updated: 0
tests_run: 173
tests_passed: 173
tests_failed: 0
implementation_gaps: 0
built_at: "2026-06-21T22:11:00Z"
last_built_commit: 5dc73d3ed12cfd0d357640569acbbd80532ed53f
---

# Test Build — apps/api Phase 3a gap coverage

## 1. Summary

Status: **completed**. Three new test files were added to `apps/api/src/test/` covering the
three genuine gaps not addressed by the Unit-B Phase 3a tests: rate-limiter 429 behaviour
(`rate-limit.test.ts`, 4 tests), email lazy-stub/keyed paths (`email.test.ts`, 11 tests),
and `resolveTrainerId()` precedence rules (`trainer.test.ts`, 10 tests). All 173 tests in
the suite pass (148 pre-existing + 25 new); `npm run -s typecheck -w @tailsup/api` exits 0.
No implementation gaps were found.

---

## 2. Scope Resolved

**Source files exercised by the new tests:**

- `apps/api/src/app.ts` — `publicWriteLimiter` middleware (rate-limit tests exercise the
  `rateLimiter()` middleware applied to `/leads` + `/bookings`).
- `apps/api/src/lib/email.ts` — `sendLeadNotification` (all code paths: stub, null
  recipient, blank key, keyed path with success, API error, HTML escaping, RESEND_FROM).
- `apps/api/src/lib/trainer.ts` — `resolveTrainerId()` (env precedence, DB fallback,
  whitespace trimming, `PracticeNotConfiguredError`). `getTrainerEmail` is already covered
  via the leads.test.ts integration path and is not duplicated here.

---

## 3. Existing Coverage

| Symbol | Existing test files |
|---|---|
| `publicWriteLimiter` (app.ts) | None — the existing tests route around it with unique IPs |
| `sendLeadNotification` (lib/email.ts) | `leads.test.ts` — mocked at module level; the happy-path stub call and fire-and-forget rejection absorption are asserted there, but the *function itself* (stub log, null recipient, HTML escaping, keyed Resend call) has no direct tests |
| `resolveTrainerId()` (lib/trainer.ts) | `leads.test.ts` / `bookings.test.ts` — exercised indirectly via the route; env-var and `PracticeNotConfiguredError` paths are covered at the route level, but no direct unit tests of the function's internal precedence logic exist |
| `PracticeNotConfiguredError` | `leads.test.ts`, `bookings.test.ts` — the 503 route response is asserted; the error class itself is not independently verified |

---

## 4. Plan

| target_symbol | category | test_file | test_name | intent |
|---|---|---|---|---|
| `publicWriteLimiter` (app.ts) | `integration` | rate-limit.test.ts | `responds 429 on the 11th /leads request from the same IP` | Proves the window=10 in-memory bucket trips on the 11th hit |
| `publicWriteLimiter` (app.ts) | `integration` | rate-limit.test.ts | `does NOT throttle a different /leads IP when the first is exhausted` | Proves separate buckets per IP (different IPs are independent) |
| `publicWriteLimiter` (app.ts) | `integration` | rate-limit.test.ts | `responds 429 on the 11th /bookings request from the same IP` | Same window/limit guarantee on the /bookings path |
| `publicWriteLimiter` (app.ts) | `integration` | rate-limit.test.ts | `does NOT throttle a different /bookings IP` | Separate bucket proof for bookings |
| `sendLeadNotification` stub | `unit` | email.test.ts | `resolves without throwing when key is absent` | Stub path never rejects |
| `sendLeadNotification` stub | `unit` | email.test.ts | `logs one [email:stub] line via console.log` | Stub logs exactly once with the [email:stub] prefix |
| `sendLeadNotification` stub | `unit` | email.test.ts | `does NOT call resend emails.send on the stub path` | No network attempt when key is absent |
| `sendLeadNotification` stub | `unit` | email.test.ts | `resolves without throwing when recipient is null` | null `to` → stub, no throw |
| `sendLeadNotification` stub | `unit` | email.test.ts | `logs [email:stub] with a null recipient` | null recipient gets the same stub log |
| `sendLeadNotification` stub | `unit` | email.test.ts | `stubs when key is blank/whitespace` | Whitespace-only key treated as absent |
| `sendLeadNotification` keyed | `unit` | email.test.ts | `calls emails.send with correct shape when key is set` | Resend call receives correct to/subject/from/html |
| `sendLeadNotification` keyed | `unit` | email.test.ts | `resolves to void when send succeeds` | Happy path returns void |
| `sendLeadNotification` keyed | `error_path` | email.test.ts | `resolves to void on Resend API error (non-fatal)` | Resend `{ data: null, error }` is swallowed |
| `sendLeadNotification` keyed | `unit` | email.test.ts | `HTML-escapes user-supplied lead fields` | XSS characters escaped before HTML interpolation |
| `sendLeadNotification` keyed | `config_validation` | email.test.ts | `uses RESEND_FROM env var when set` | Custom from address respected |
| `resolveTrainerId` env | `unit` | trainer.test.ts | `returns env var value without querying the DB` | Env short-circuits the DB |
| `resolveTrainerId` env | `unit` | trainer.test.ts | `trims whitespace from the env var value` | Padded UUID still works |
| `resolveTrainerId` env | `unit` | trainer.test.ts | `takes env-var precedence over any DB trainer row` | DB row irrelevant when env is set |
| `resolveTrainerId` DB | `unit` | trainer.test.ts | `returns trainer row id when env is unset and row exists` | Normal fallback path |
| `resolveTrainerId` DB | `unit` | trainer.test.ts | `queries asc(id) + limit(1)` | Oldest trainer selected deterministically |
| `resolveTrainerId` DB | `unit` | trainer.test.ts | `falls back to DB when env var is empty string` | Empty string treated as absent |
| `resolveTrainerId` DB | `unit` | trainer.test.ts | `falls back to DB when env var is whitespace-only` | Whitespace-only treated as absent |
| `resolveTrainerId` error | `error_path` | trainer.test.ts | `throws PracticeNotConfiguredError (no env, no row)` | Third arm: clean 503-mappable error |
| `resolveTrainerId` error | `error_path` | trainer.test.ts | `thrown error has message "practice not configured"` | Message matches the 503 body |
| `resolveTrainerId` error | `error_path` | trainer.test.ts | `thrown error name is PracticeNotConfiguredError` | Error identity preserved |

---

## 5. Files Owned

| File | Reason |
|---|---|
| `apps/api/src/test/rate-limit.test.ts` | new — rate-limiter gap coverage |
| `apps/api/src/test/email.test.ts` | new — sendLeadNotification unit tests |
| `apps/api/src/test/trainer.test.ts` | new — resolveTrainerId() unit tests |

---

## 6. Test Run Results

**Command:** `npm run -s test -w @tailsup/api`
**Exit code:** 0

| Test file | Tests | Result |
|---|---|---|
| `src/test/config.test.ts` | 6 | all pass |
| `src/test/email.test.ts` | 11 | all pass |
| `src/test/trainer.test.ts` | 10 | all pass |
| `src/test/r2.test.ts` | 23 | all pass |
| `src/test/media.test.ts` | 20 | all pass |
| `src/test/events-phase2.test.ts` | 22 | all pass |
| `src/test/health.test.ts` | 3 | all pass |
| `src/test/bookings.test.ts` | 7 | all pass |
| `src/test/leads.test.ts` | 8 | all pass |
| `src/test/rate-limit.test.ts` | 4 | all pass |
| `src/test/sessions-phase2.test.ts` | 10 | all pass |
| `src/test/events.test.ts` | 22 | all pass |
| `src/test/dogs.test.ts` | 27 | all pass |
| **Total** | **173** | **173 passed / 0 failed** |

One expected `stderr` line appeared in the run (pre-existing): the `leads.test.ts` "fire-and-forget rejects" test emits `[email] send failed (non-fatal) Error: network down` — this is the route's intentional `.catch()` logging and is not a failure.

**Typecheck:** `npm run -s typecheck -w @tailsup/api` — exit 0 (no errors).

### Notable design observations

- **Rate-limit test isolation:** `vitest.config.ts` sets `isolate: true`, so each test file
  gets its own module instances (including a fresh `MemoryStore`). The rate-limit file uses
  dedicated IPs (`10.9.0.*`, `10.9.1.*`) that do not overlap with the ranges used by
  `leads.test.ts` (`10.0.0.*`) or `bookings.test.ts` (`10.0.1.*`), preventing any
  cross-file interference.
- **email.ts module cache:** `email.ts` has a module-level `let client: Resend | null = null`.
  The `email.test.ts` file calls `vi.resetModules()` in `afterEach` and uses dynamic
  `import('../lib/email.js')` inside each test, so every test gets a fresh `client = null`
  and a fresh `Resend` mock invocation count — no stale state bleeds across assertions.
- **resend module mock:** `vi.mock('resend', ...)` with `vi.hoisted()` replaces the `Resend`
  class so no real SMTP/HTTP call is ever attempted. The mock constructor returns an object
  with `emails.send`, matching the real Resend API surface used in `email.ts`.

---

## 7. Implementation Gaps

None. All 25 new tests pass against the current implementation. The production code
behaves exactly as designed for all three scopes.

---

## 8. Manual Review Needed

None. All tests were written without touching shared infrastructure
(`vitest.config.ts`, `conftest.py` equivalents, fixture helpers).

**Note (per orchestrator instruction):** Mobile site-page tests (the public Phase 3a Expo
Router web routes) are intentionally deferred. No mobile test runner exists yet; coverage
is delegated to the integration verifier's Expo web export pass.

---

## 9. Commands Run

| # | Command | Exit code |
|---|---|---|
| 1 | `node --version` | 0 — v20.20.2 confirmed |
| 2 | `npm run -s test -w @tailsup/api` (after writing all 3 test files) | 0 — 173/173 pass |
| 3 | `npm run -s typecheck -w @tailsup/api` | 0 — no type errors |
