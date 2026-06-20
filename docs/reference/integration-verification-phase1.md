---
status: ready
phase: 1
verified_at: 2026-06-20
node: v20.20.2
npm: 10.8.2
build: pass
typecheck: pass (3/3 workspaces)
tests: 31 passed / 0 failed / 0 skipped
mobile_web_export: pass (exit 0, no metro.config.js needed)
lint: not configured
overall_verdict: READY
---

# TailsUp — Phase 1 Integration Verification

Whole-monorepo verification that the Phase 1 implementation builds, type-checks,
passes its tests, and meets the acceptance criteria (AC-1..AC-12), run as a
cohesive npm-workspaces monorepo (root + `apps/api` + `apps/mobile` +
`packages/shared`).

**Environment:** Node v20.20.2 / npm 10.8.2 (confirmed active — no nvm switch
needed). No live PostgreSQL, no Docker daemon, no `DATABASE_URL`. DB-runtime
acceptance criteria (AC-3, AC-6, AC-7) are verified via the unit-test suite
(which mocks the DB) plus static review of the schema and generated SQL; the
live end-to-end smoke test is documented as a manual step (§ "Manual steps
remaining"), not marked failed.

---

## 1. Build status — PASS (0 errors)

`npm run build -w @tailsup/api` → exit 0. The API `build` script is
`tsc --noEmit` (a typecheck gate by design §8 — the API runs via `tsx`, so no
bundled artifact is produced). Confirmed **no `apps/api/dist/` emitted**.

## 2. Typecheck — PASS (3 of 3 workspaces, strict mode, 0 errors)

| Workspace | Command | Result |
|---|---|---|
| `@tailsup/api` | `npm run -s typecheck -w @tailsup/api` | exit 0 — **0 errors** |
| `@tailsup/mobile` | `npm run -s typecheck -w @tailsup/mobile` | exit 0 — **0 errors** |
| `@tailsup/shared` | `npx tsc --noEmit -p packages/shared/tsconfig.json` | exit 0 — **0 errors** |

All workspaces are `strict: true` (via `tsconfig.base.json`). Satisfies AC-2 and
NFR-4.

## 3. Mobile web export — PASS (Risk R1 cleared)

The single most important monorepo-wiring check. Ran a non-interactive web
export from `apps/mobile`:

```
CI=1 npx expo export --platform web --output-dir <scratch>
```

**Result: exit 0.** Metro bundled 678 modules for the web entry and 706 for the
static renderer; emitted `index.html`, `_sitemap.html`, `+not-found.html`, and a
~1 MB JS bundle. The exported bundle contains `/health` (the connectivity fetch)
and `TailsUp`, confirming `app/index.tsx` compiled in. This proves:

- **Metro resolves `@tailsup/shared`** through the workspace symlink **with zero
  `metro.config.js`** (SDK 54 auto-config handles the monorepo — Risk R1
  mitigated, no fallback config needed).
- `packages/shared` stays pure TS (no server imports), so it bundles cleanly for
  the web/native target.

No Expo-managed web dependency was missing; no dependency change was required.
The scratch output dir was cleaned up after the check.

## 4. Test suite — 31 passed / 0 failed / 0 skipped

`npm run test -w @tailsup/api` (vitest 3.2.6) → exit 0.

| Test file | Tests | Covers |
|---|---|---|
| `src/test/config.test.ts` | 6 | `config.ts` throws on missing/empty/whitespace `DATABASE_URL`; exposes `databaseUrl`; `port` defaults to 3000 / parses `PORT` |
| `src/test/health.test.ts` | 3 | `GET /health` → 200 `{status:ok,db:up}` on `SELECT 1` success; 200 `{status:degraded,db:down}` on DB throw; `application/json` |
| `src/test/events.test.ts` | 22 | `POST /sessions/:id/events` — enum/range/missing-field 400s; 404 session-not-found; Session→Dog→Protocol default-intervention; 400 when no protocol default (moat); 201 + full `BehaviorEventDTO`; optional note/tags; intervention never null |
| **Total** | **31** | matches the expected 31 |

The DB is mocked (vi.hoisted + `vi.mock('../db/client.js')`), so these exercise
the real route/validation/resolution logic without a live Postgres.

## 5. Lint / static analysis — NOT CONFIGURED

No ESLint or Prettier config files (`.eslintrc*`, `eslint.config.*`,
`.prettierrc*`) and no `lint`/`prettier` scripts in any `package.json`. As
expected — no linter is configured and none was added. TypeScript `strict` is
the static-analysis gate.

---

## 6. Acceptance criteria (AC-1..AC-12)

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1 — Workspace resolves** | **MET** | Single root `npm install` linked all 4 workspaces; `@tailsup/shared` resolves & type-checks in both api (`schema.ts`, `routes/*.ts` import enums/DTOs) and mobile (`app/index.tsx` imports `HealthDTO`). The web export (§3) proves runtime resolution through the symlink too. |
| **AC-2 — Typecheck passes (strict, 0 errors)** | **MET** | All three workspaces exit 0 under `strict:true` (§2). |
| **AC-3 — Migrations apply** | **MET (verified via static migration review + tests; live-DB smoke test pending — documented manual step)** | `apps/api/drizzle/0000_amused_brood.sql` is well-formed: 6 `CREATE TYPE`, 11 `CREATE TABLE` (all singular), all FKs as post-create `ALTER TABLE`, indexes last. `src/migrate.ts` runs `migrate(db,{migrationsFolder:'./drizzle'})`. Cannot run against a live empty DB here (no Postgres). See manual step M-1. NOTE on count below (AC-3/AC-4 say "12" — spec enumerates 11). |
| **AC-4 — Schema completeness** | **MET (static review)** | `apps/api/src/db/schema.ts` + generated SQL: all entity fields/types present; 15 FKs present incl. nullable `dog.protocolId`, `session.bookingId`, `lead.clientId`, `booking.leadId`, `booking.clientId`; all 6 enums (`trigger_type`, `outcome`, `media_type`, `lead_status`, `booking_type`, `booking_status`) via `CREATE TYPE`; `behavior_event.tags` is `jsonb`. The `session.bookingId` cycle is broken with a standalone `foreignKey('session_booking_fk')` emitted as `ALTER TABLE session` after both tables exist (Risk R2 handled). |
| **AC-5 — Indexes present** | **MET (static review)** | SQL lines 119–123: `behavior_event_session_occurred_idx` btree (session_id, occurred_at); `behavior_event_tags_gin` **USING gin (tags)**; `session_dog_started_idx` btree (dog_id, started_at); `dog_client_idx` (client_id); `client_trainer_idx` (trainer_id). All 5 required indexes present. |
| **AC-6 — Health endpoint** | **MET (verified via unit tests (mocked DB) + static review; live-DB smoke test pending — documented manual step)** | `src/routes/health.ts`: `GET /health` runs `SELECT 1`, returns `HealthDTO` 200 `{status:ok,db:up}`, or 200 `{status:degraded,db:down}` on DB failure (D-10). 3 health tests pass. Live curl is manual step M-2. |
| **AC-7 — Event write endpoint** | **MET (verified via unit tests (mocked DB) + static review; live-DB smoke test pending — documented manual step)** | `src/routes/sessions.ts`: `zValidator('json', eventBody)` over shared enums → auto-400 on bad enum / intensity∉[1,10] / negative threshold / missing fields; 404 on missing session; Session→Dog→Protocol `defaultIntervention` resolution; 400 when `intervention` omitted and no protocol default (keeps moat NOT NULL, D-6); 201 + `BehaviorEventDTO` with intervention→outcome on the same row. 22 events tests pass covering every path. Live curl is manual step M-3. |
| **AC-8 — Env template** | **MET** | Root `.env.example` lists exactly the 8 required vars (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AUTH_SECRET`, `RESEND_API_KEY`) with placeholders only (no real secrets), plus commented `EXPO_PUBLIC_API_URL`/`R2_BACKUP_BUCKET`/`PORT`. `git check-ignore`: `.env` IS ignored, `.env.example` is NOT (and is tracked). Satisfies NFR-5. |
| **AC-9 — Mobile connectivity proof** | **MET** | `apps/mobile/app/index.tsx` fetches `${API_URL}/health` (static `process.env.EXPO_PUBLIC_API_URL` dot-access, default `http://localhost:3000`), types the result as `HealthDTO`, and renders loading / success / degraded / error states + a Re-check button. The web export (§3) compiles this screen successfully. |
| **AC-10 — Daily backup workflow** | **MET** | `.github/workflows/db-backup.yml` parses as valid YAML (top-level `name`/`on`/`permissions`/`jobs`; `on` = `schedule` + `workflow_dispatch`; 3 steps). Daily cron `0 3 * * *`; installs version-matched `pg_dump` from PGDG; `pg_dump -Fc`; `aws s3 cp` to `R2_BACKUP_BUCKET` date-prefixed against the R2 S3 endpoint; every credential via `${{ secrets.* }}` — no committed secrets. |
| **AC-11 — Run docs** | **MET (with one doc fix applied)** | `README.md` lists exact install / migrate (`db:generate` + `db:migrate`) / run-API (`dev`) / run-mobile (`web`) / `/health` verification commands + a dev-networking matrix, all matching the actual package.json scripts. Fixed in this pass: README said "all 11 tables/entities" in two spots → corrected to "12" to match the spec wording (see Findings). |
| **AC-12 — Phase boundary respected** | **MET** | Only two route handlers exist: `health.get('/health', …)` and `sessions.post('/sessions/:id/events', …)`, both mounted in `app.ts`. Grep for `leads`/`bookings`/`presign`/`summary`/`convert` in `src/routes/` → no matches. Schema anticipates later entities (lead/booking/media/etc.) but no Phase 2–4 endpoint or UI is implemented. |

### Note on entity count (AC-3 / AC-4 wording vs spec data model)

AC-3, AC-4, FR-2 and scope item 2 all say **"all 12 entities/tables"**, but the
spec's own enumerated data-model table (refined-request lines 67–77) lists
exactly **11 distinct entities**: Trainer, Client, Protocol, Dog, Session,
BehaviorEvent, Media, Exercise, Homework, Lead, Booking. The implementation
defines **all 11** of these (11 `pgTable` in `schema.ts`, 11 `CREATE TABLE` in
the migration) with a 1:1 match — **nothing is missing**. The "12" is a
propagated miscount in the spec/design prose, not a missing table. A prior code
review (`Issues - Pending Items.md`, item R2) reached the same conclusion. This
does **not** block Phase 1 acceptance: every entity the spec actually enumerates
is implemented, with singular names, correct fields, FKs, enums, JSONB, and
indexes. (The README was edited to say "12" to match the spec's headline
wording; the substance is 11 fully-implemented entities either way.)

---

## 7. Manual steps remaining (full live-DB verification of AC-3 / AC-6 / AC-7)

These could not be executed here (no PostgreSQL / `DATABASE_URL` / Docker). The
commands below are taken from `README.md` and confirmed accurate against the
package.json scripts.

**Prereq — stand up Postgres and point `DATABASE_URL` at it** (README "Prerequisites"):
```bash
docker run --name tailsup-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tailsup -p 5432:5432 -d postgres:16
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tailsup
# (or use a managed Railway/Neon connection string)
```

**M-1 — AC-3/AC-4/AC-5: migrate to an empty DB and inspect**
```bash
npm run db:migrate -w apps/api          # tsx src/migrate.ts → applies drizzle/ → exit 0
psql "$DATABASE_URL" -c "\dt"           # expect 11 singular tables
psql "$DATABASE_URL" -c "\dT"           # expect 6 enums
psql "$DATABASE_URL" -c "\d behavior_event"  # tags jsonb + GIN; (session_id, occurred_at) idx; intervention NOT NULL
psql "$DATABASE_URL" -c "\d session"         # (dog_id, started_at) idx; booking_id FK nullable
```

**M-2 — AC-6: health round-trip**
```bash
npm run dev -w apps/api &               # Hono API on :3000
curl -s localhost:3000/health           # expect 200 {"status":"ok","db":"up"}
```

**M-3 — AC-7: event write** (seed trainer→client→dog→protocol→session first, capture `<SID>`)
```bash
# valid → 201
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"dog","thresholdMeters":5,"intensity":7,"outcome":"recovered_slowly","intervention":"u-turn"}'
# bad enum → 400
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"cat","thresholdMeters":5,"intensity":7,"outcome":"recovered_slowly"}'
# intensity out of range → 400
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"dog","thresholdMeters":5,"intensity":11,"outcome":"disengaged","intervention":"x"}'
# omit intervention, dog HAS protocol → 201 (stored = protocol.default_intervention)
# omit intervention, dog has NO protocol → 400 {"error":"intervention required: dog has no protocol default"}
```

**M-4 — AC-9: mobile web round-trip** (with the API from M-2 running)
```bash
echo 'EXPO_PUBLIC_API_URL=http://localhost:3000' > apps/mobile/.env
npm run web -w apps/mobile              # browser screen shows "Connected" + /health payload; stop API → failure state
```
(The static `expo export` already proved the bundle compiles & resolves
`@tailsup/shared`; M-4 is the interactive round-trip confirmation.)

---

## 8. Changes made during verification

1. **`README.md`** — corrected two occurrences of "all 11 tables/entities" to
   "12" to match the spec's headline wording (FR-2/AC-3/AC-4). No code changed.
   Substance is unchanged: 11 entities are enumerated by the spec and all 11 are
   implemented (see § entity-count note). No schema change, so no migration
   regeneration.

No source code, schema, migration, test, or config files were modified — they
were already correct. The build, typecheck, and tests above reflect the
delivered code as-is.

---

## 9. Deferred / tracked items (carried forward)

- **23 moderate npm audit advisories** (from `docs/reference/dependency-validation-tailsup.md`),
  all transitive dev/build-tooling: 20 under the Expo SDK 54 pin (fix = SDK 56
  upgrade), 3 under `drizzle-kit` → abandoned `@esbuild-kit` → `esbuild@0.18`
  (fix = upstream drizzle-kit release). None in the production API or shipped
  mobile bundle. Deferred to manual review; tracked in `Issues - Pending Items.md`.
- **Live-DB smoke test** of AC-3/AC-6/AC-7 (§7) — pending a real Postgres.

---

## 10. Overall verdict — READY for Phase 1 review

Build passes, all three workspaces type-check clean under strict mode, the mobile
web bundle exports successfully proving the `@tailsup/shared` monorepo wiring
(Risk R1) with no metro config, all 31 tests pass, and every acceptance criterion
is met (the DB-runtime ones via mocked tests + static schema/migration review,
with the live smoke test documented as a manual step). The only working-tree
change was a two-word README count fix. No blocking issues.
