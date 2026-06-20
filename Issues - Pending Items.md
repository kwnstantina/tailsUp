# TailsUp — Issues & Pending Items

Phase 1 (Foundations) code review. Reviewed commits `0ed0e8f` (Units B/C/D) on top
of `6ce5f11` (Unit A). Node 20.20.2 active. All fixes applied to the working tree
(not committed — the orchestrator commits).

---

## UNRESOLVED ISSUES

### Critical
_None._ All three workspace typechecks pass with zero errors under `strict: true`,
the schema/migration are complete and correct, both endpoints are wired and
correct, and no secrets are committed.

### Important
_None blocking Phase 1 acceptance._

### Minor / follow-ups (non-blocking, deferred to later phases or environment)
1. **Runtime DB verification not performed in this review.** AC-3 (migration applies
   to an empty Postgres) and AC-6/AC-7 (live endpoint behavior) were verified by
   static inspection only — no `DATABASE_URL` / live Postgres was available in the
   review environment. The migration SQL is well-formed (11 `CREATE TABLE`, 6
   `CREATE TYPE`, FKs as post-create `ALTER TABLE`, GIN on `tags`) and the route
   logic matches the design, so confidence is high, but a one-time `db:migrate` +
   `curl` smoke test against a real DB is recommended before deploy.
2. **`apps/api` has no emitting `build`.** Intentional (no-build shared package +
   `tsx` runtime; design §8). The `build` script is now `tsc --noEmit` (a typecheck
   gate). If a bundled production artifact is ever wanted (e.g. esbuild), that is a
   later-phase decision; `tsx src/index.ts` is the documented Railway start path.
3. **Doc miscount (cosmetic).** The spec/plan/design and (originally) the README said
   "12 entities". The true count is **11**. README corrected to 11 in this review;
   the docs under `docs/` still say 12 in places — harmless, optional to correct.

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
