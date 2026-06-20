# TailsUp — Issues & Pending Items

Phase 1 (Foundations). Code review of Units B/C/D on top of Unit A, then a
whole-monorepo **integration verification** (2026-06-20, Node v20.20.2 /
npm 10.8.2). Integration verification confirmed: API build exit 0; all 3
workspaces typecheck clean (strict); Expo web export exit 0 (Metro resolves
`@tailsup/shared`, no metro.config.js — Risk R1 cleared); 31/31 API tests pass;
no linter configured (expected); all AC-1..AC-12 met (DB-runtime ones via mocked
tests + static schema/migration review). Full report:
`docs/reference/integration-verification-phase1.md`. The only working-tree change
from this pass was a two-word README count fix. All changes are in the working
tree (not committed — the orchestrator commits).

---

## UNRESOLVED ISSUES

### Critical
_None._ All three workspace typechecks pass with zero errors under `strict: true`,
the schema/migration are complete and correct, both endpoints are wired and
correct, no secrets are committed, the API builds, all 31 API tests pass, and the
Expo web bundle exports successfully (proving the `@tailsup/shared` monorepo
wiring through Metro with no metro.config.js — Risk R1 cleared).

### Important
1. **Live-DB smoke test pending (AC-3 / AC-6 / AC-7).** These DB-runtime criteria
   were verified via the mocked-DB unit tests (31 passing) plus static review of
   `apps/api/drizzle/0000_amused_brood.sql` and `src/db/schema.ts`. They have NOT
   been exercised against a real PostgreSQL (none available — no Docker daemon, no
   `DATABASE_URL`). Before deploy, run the documented manual steps M-1..M-4 in
   `docs/reference/integration-verification-phase1.md` §7:
   set `DATABASE_URL`, `npm run db:migrate -w apps/api`, start the API, `curl
   /health`, POST the events examples, and confirm the Expo web round-trip. The
   migration SQL and route logic are well-formed, so confidence is high.
2. **23 moderate npm audit advisories — deferred (from
   `docs/reference/dependency-validation-tailsup.md`).** All are transitive
   dev/build-tooling vulnerabilities, none in the production API or shipped mobile
   bundle:
   - **MR-1 (20 advisories)** — under the Expo SDK 54 pin (`postcss` XSS, `uuid`
     bounds in `xcode`, `js-yaml` DoS in test tooling). Fix = coordinated Expo SDK
     56 upgrade (`npx expo install expo@^56 --fix`); guarded by the SDK 54 pin.
   - **MR-2 (3 advisories)** — `drizzle-kit` → abandoned `@esbuild-kit` →
     `esbuild@~0.18.20` (GHSA-67mh-4wv8-2f99, dev-server CORS). npm's suggested
     downgrade to `drizzle-kit@0.18.1` is a breaking regression — do NOT apply.
     Fix = upstream drizzle-kit release (monitor changelog for `@esbuild-kit`
     removal). Resolve both before public launch.

### Minor / follow-ups (non-blocking, deferred to later phases or environment)
1. **`apps/api` has no emitting `build`.** Intentional (no-build shared package +
   `tsx` runtime; design §8). The `build` script is `tsc --noEmit` (a typecheck
   gate). If a bundled production artifact is ever wanted (e.g. esbuild), that is a
   later-phase decision; `tsx src/index.ts` is the documented Railway start path.
2. **Spec/design "12 entities" vs implemented 11 (documentation inconsistency).**
   FR-2 / AC-3 / AC-4 and the design prose say "12 entities/tables", but the spec's
   own enumerated data-model table (refined-request lines 67–77) lists exactly
   **11** distinct entities (Trainer, Client, Protocol, Dog, Session, BehaviorEvent,
   Media, Exercise, Homework, Lead, Booking). The implementation defines **all 11**
   (11 `pgTable`, 11 `CREATE TABLE`) with a 1:1 match — **nothing is missing**; the
   "12" is a propagated headline miscount. README was set to "12" to match the
   spec's headline wording; `docs/` still say "12" in places. Harmless, optional to
   reconcile — no code/schema impact.

---

## RESOLVED ITEMS

### R1 — TS6059 blocked `apps/api` typecheck (Known Issue #1) — FIXED
- **Symptom:** `npm run typecheck -w @tailsup/api` failed:
  `error TS6059: File '.../packages/shared/src/index.ts' is not under 'rootDir'
  '.../apps/api'`.
- **Cause:** `apps/api/tsconfig.json` set `noEmit:false` + `outDir:"dist"` +
  `rootDir:"."`, which made `tsc` require all program files under `apps/api`. But
  `@tailsup/shared` is consumed as SOURCE from `packages/shared/src` (a deliberate
  no-build shared package, design §8), which is outside that rootDir.
- **Fix:**
  - `apps/api/tsconfig.json` → `noEmit:true`; removed `outDir` and `rootDir`
    (now purely typecheck-oriented, consistent with `tsconfig.base.json`).
  - `apps/api/package.json` `build` script changed from `tsc` to `tsc --noEmit`
    (a typecheck gate; no emit — the API runs via `tsx`, dev/start unchanged).
- **Verified:** `npm run -s typecheck -w @tailsup/api` now exits 0; `npm run build
  -w @tailsup/api` exits 0 and produces no `apps/api/dist`.

### R2 — "11 vs 12 entities" (Known Issue #2) — VERIFIED, NOT A DEFECT
- The data model has exactly **11** entities (trainer, client, protocol, dog,
  session, behavior_event, media, exercise, homework, lead, booking).
- Confirmed **11 `pgTable`** definitions in `apps/api/src/db/schema.ts` and **11
  `CREATE TABLE`** statements in `apps/api/drizzle/0000_amused_brood.sql`.
- The "12" figure was a propagated miscount in the spec/plan/design. No table is
  missing. No schema change made (and therefore no migration regeneration).
- README's two "12" mentions corrected to "11" (optional polish).

### R3 — Mobile SafeAreaProvider missing (Known Issue #3) — FIXED
- **Symptom:** `apps/mobile/app/index.tsx` renders `<SafeAreaView>` from
  `react-native-safe-area-context`, which requires a `<SafeAreaProvider>` ancestor
  (insets never resolve / can throw on native without it). `app/_layout.tsx` did
  not provide one.
- **Fix:** wrapped the root layout in `<SafeAreaProvider>` in
  `apps/mobile/app/_layout.tsx` (imported from `react-native-safe-area-context`,
  already a dependency).
- **Verified:** `npm run -s typecheck -w @tailsup/mobile` exits 0.

---

## REVIEW VERIFICATIONS (all passed)

- **AC-2 typecheck (all 3 workspaces, strict):** shared ✅ (0), api ✅ (0 after fix),
  mobile ✅ (0). Root fan-out `npm run typecheck` ✅ (0).
- **AC-3/4/5 schema/migration:** 11 singular tables; 6 pgEnums; UUID PKs
  (`gen_random_uuid()`); `behavior_event.intervention` NOT NULL (the moat);
  `tags` `jsonb` + `USING gin (tags)` index; composite indexes
  `behavior_event(session_id, occurred_at)` and `session(dog_id, started_at)`;
  `dog(client_id)` and `client(trainer_id)` indexes; all FKs emitted as
  post-`CREATE` `ALTER TABLE` (handles the `session.bookingId↔booking` cycle via
  the standalone `foreignKey('session_booking_fk')`).
- **AC-6/7 endpoints:** `GET /health` does `SELECT 1`, returns `HealthDTO`, 200
  degraded on DB down (D-10). `POST /sessions/:id/events` validates via
  `@hono/zod-validator` over shared enums (auto-400), 404 on missing session,
  Session→Dog→Protocol default-intervention resolution, 400 when no protocol
  default and `intervention` omitted (keeps moat NOT NULL, D-6), 201 +
  `BehaviorEventDTO`. Both routes mounted in `app.ts`; only these two handlers
  exist (AC-12).
- **Config:** `config.ts` throws on missing `DATABASE_URL` (no fallback); `PORT`
  is the only optional var.
- **Shared package:** pure TS, zero server imports (Metro-safe); enums/DTOs match
  what api + mobile import.
- **Security (NFR-5):** `.env` git-ignored, only `.env.example` tracked; the only
  `sk-ant-`/`re_` matches are placeholders; backup workflow references secrets
  only via `${{ secrets.* }}`; SQL/route code uses parameterized Drizzle queries
  (no injection).
- **Consistency:** `type:module` + ESM with `.js` import specifiers across api;
  `@tailsup/shared` path alias resolves in both api and mobile tsconfigs.
