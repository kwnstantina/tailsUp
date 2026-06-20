# TailsUp — Issues & Pending Items

---

# PHASE 2 — Trainer View (integration verification)

Whole-monorepo **integration verification** (2026-06-20, Node v20.20.2 / npm
10.8.2, Windows 11). Verified against `refined-request-phase2.md` (AC-1..AC-13)
and the Phase 2 section of `project-design.md`. **No live PostgreSQL / no R2
credentials** (user chose "no R2 yet") — DB-runtime + R2 ACs verified via the
mocked unit tests + static review; live smoke tests documented as manual steps.
Full report: `docs/reference/integration-verification-phase2.md`.

**Verdict: READY** (for the user's Phase 2 review). Gates: shared/api/mobile
typecheck exit 0 (strict, 0 errors); API build (`tsc --noEmit`) exit 0; **133/133
tests pass** (31 Phase 1 + 102 Phase 2, credential-free); `git status --porcelain
apps/api/drizzle` empty + `schema.ts` unchanged since Phase 1 commit `0ed0e8f`
(AC-12, no migration); Expo **web export** exit 0 (7 routes incl. all four Phase 2
screens — Metro resolves the new routes + `lib/api.ts` + `lib/upload.ts` +
`@tailsup/shared` DTOs + `expo-image-picker`/`expo-video`/`expo-file-system`); no
linter configured (expected). AC-1..AC-13 all **met**. One gap (AC-13 README) was
**fixed** in this pass — see Resolved. The only working-tree change is `README.md`
(not committed).

## PHASE 2 (integration) — UNRESOLVED ISSUES

### Critical
_None._

### Important
1. **Live DB + R2 smoke test pending (AC-3, AC-5..AC-10).** The read endpoints,
   presign PUT, direct device→R2 upload, `POST /events/:id/media` persist, and the
   `GET /media/:id/url` playback were verified by mocked tests + static review only
   (lazy `getR2Config()` is exactly what lets the suite run credential-free — R-4).
   Before demo/deploy run the manual steps in
   `docs/reference/integration-verification-phase2.md` §7:
   set `DATABASE_URL` → `npm run db:migrate -w apps/api` (already applied in Phase 1;
   **idempotent**, no Phase 2 migration) → seed trainer→client→dog→protocol→session
   → start the API → curl the read/start-session endpoints; then set the four `R2_*`
   vars → presign → direct PUT → `POST /events/:id/media` → `GET /events/:id` →
   `GET /media/:id/url`. Confidence high (logic well-formed, round-trip parse sound);
   the SDK-against-real-R2 path is the one unexercised edge.
2. **R2 bucket CORS is a HARD prerequisite for web upload (G-8 / OQ-10 / AC-9 on web).**
   The browser PUT to R2 on Expo **web** is blocked unless the **R2 bucket's CORS
   policy** allows `PUT` (+ the `content-type` header) from the Expo web origin
   (`http://localhost:8081` in dev). It is a **Cloudflare bucket setting, NOT API
   code** — `lib/upload.ts` already surfaces a clear CORS error. Native uploads are
   unaffected. Now documented in the README Phase 2 section (with an example CORS
   JSON) per AC-13. Must be configured in Cloudflare before AC-9 passes on web.

### Minor / follow-ups (non-blocking)
1. **No seed script — manual inserts documented instead.** There is no
   `apps/api` seed script; the spec's "[Seed data exists]" assumption permits "a
   seed script **or** documented manual inserts." The README Phase 2 section now
   provides the manual `psql` inserts (trainer→client→dog→protocol→session). A
   reusable `db:seed` script is an optional future convenience, not an AC gap.
2. **Deferred dependency advisories (carried from Phase 1, unchanged).** No new
   advisories from the Phase 2 deps. The two AWS SDK packages are matched-version
   (R-5 footgun absent) with the mandatory R2 checksum flags set; the Expo native
   modules (`expo-image-picker`, `expo-video`, `expo-file-system`) were installed
   via the SDK-54-compatible pins. The pre-existing 23 moderate npm-audit
   advisories (MR-1 Expo SDK 54 transitive; MR-2 `drizzle-kit`→`esbuild@0.18`)
   remain deferred — all transitive dev/build tooling, none in the production API
   or shipped mobile bundle. Resolve MR-1/MR-2 before public launch.

## PHASE 2 (integration) — RESOLVED THIS PASS

### AC-13 — README had no Phase 2 run/test docs — FIXED
- **Symptom:** `README.md` still described the repo as "Phase 1 — Foundations"
  with only two endpoints and **listed Phase 2 as NOT built**. It contained none
  of the Phase 2 run/seed/flow/CORS documentation AC-13 requires. (Per the design's
  unit ownership, the README Phase 2 section was Unit B's deliverable and had not
  landed.)
- **Fix (working tree only — not committed):** updated the intro + Phase boundary
  to reflect Phase 1+2 shipped, and added a **"Phase 2 — Trainer view"** section:
  the endpoint table, manual seed inserts, run commands, `EXPO_PUBLIC_TRAINER_ID`,
  the R2 env block, the **R2 bucket CORS prerequisite** (with example JSON), the
  presign→PUT→persist→playback curl flow, and an AC-3..AC-10 verification table.
- **Verified:** mobile typecheck still exits 0 after the edit (README is not
  compiled); the documented commands match `apps/api/package.json` scripts,
  `apps/mobile/.env.example`, and the design §P2.

---

# PHASE 2 — Trainer View (code review)

Code review of the Phase 2 implementation (commits `2be5fb7` Unit A shared DTOs,
`1d30170` Units B/C api + mobile), 2026-06-20, Node v20.20.2. Reviewed against
`refined-request-phase2.md` (AC-1..AC-13), the `project-design.md` Phase 2
section, `plan-002-...md` (gates G-1..G-8, incl. the **G-7 USER OVERRIDE =
playback via presigned-GET**), and `investigation-phase2.md` (pitfalls R-1..R-7).

**Verdict: PASS — no code changes required.** All three workspaces typecheck
clean (strict, 0 errors), all 31 Phase 1 API tests still pass, no DB migration
introduced, `schema.ts` unchanged. The most-likely-defect (`blobUrl` round-trip
between `POST /events/:id/media` write and `GET /media/:id/url` read) is
**consistent** — see below.

## PHASE 2 — UNRESOLVED ISSUES

### Critical
_None._

### Important
1. **Live-R2 + live-DB smoke test pending (AC-3, AC-5..AC-10).** The R2 presign
   PUT, the direct device→R2 upload, the presigned-GET playback, and all read
   endpoints were verified by **static review only** — no real R2 credentials and
   no live PostgreSQL were available in this environment (lazy R2 config is exactly
   what lets the suite run credential-free, by design — R-4). Before demo/deploy:
   set the four `R2_*` vars + `DATABASE_URL`, seed the trainer→client→dog→protocol
   →session graph, then exercise presign→PUT→`POST /events/:id/media`→`GET
   /events/:id`→`GET /media/:id/url`. Confidence is high (logic is well-formed and
   the round-trip parse is sound), but the SDK-against-real-R2 path is unexercised.
2. **R2 bucket CORS is a hard prerequisite for web upload (G-8 / OQ-10).** The
   browser PUT to R2 on Expo **web** requires an R2 bucket CORS rule allowing `PUT`
   + `Content-Type` from the web origin (`http://localhost:8081` in dev). This is a
   Cloudflare bucket setting, NOT API code; `lib/upload.ts` already surfaces a clear
   CORS error message. Native uploads are unaffected. Must be configured (and
   documented in the README per AC-13) before AC-9 can pass on web.

### Minor / follow-ups (non-blocking)
1. **`POST /events/:id/media` hard-codes `type: 'video'`** (events.ts:159) and does
   not branch on `contentType`. Correct for Phase 2 (video-only allow-set:
   `video/mp4`, `video/quicktime`), and `contentType` is still Zod-validated
   (bad type → 400) and used for the extension on the presign side. If image upload
   is added later, derive `type` from `contentType` then. No action now.
2. **`blobUrl` embeds the bucket name at write time** (`blobUrlForKey`), and
   `keyFromBlobUrl` strips exactly one leading path segment to recover the key. If
   `R2_BUCKET` were ever renamed between an upload and a later playback, the stored
   URL still carries the old bucket; the key is still recovered correctly, but
   `presignGetUrl` signs against the *current* bucket. Acceptable Phase 2 assumption
   (bucket is fixed); noted only for completeness.
3. **AWS SDK declared `^3.937.0`, resolved `3.1073.0`** for BOTH `@aws-sdk/client-s3`
   and `@aws-sdk/s3-request-presigner` (verified identical — the `getSignedUrl`
   version-mismatch footgun R-5 is NOT present). The mandatory R2 checksum flags
   (`requestChecksumCalculation`/`responseChecksumValidation: 'WHEN_REQUIRED'`,
   R-1) ARE set. No action.

## PHASE 2 — RESOLVED ITEMS
_None — the implementation was correct as committed; the review applied no
working-tree changes._

## PHASE 2 — REVIEW VERIFICATIONS (all passed)

- **AC-1 typecheck (strict, 0 errors):** `packages/shared` ✅ · `@tailsup/api` ✅ ·
  `@tailsup/mobile` ✅ (before == after; no fixes needed).
- **Phase 1 regression:** `npm run -s test -w @tailsup/api` → **31/31 pass**
  (config 6, health 3, events 22) — Phase 1 endpoints unchanged (AC-12).
- **AC-12 no migration / phase boundary:** `git status --porcelain apps/api/drizzle`
  empty; `git show --stat 1d30170 -- apps/api/drizzle` empty; `schema.ts` untouched
  in both commits and clean in the working tree. `media` / `behavior_event.note` /
  `behavior_event.tags` columns reused as-is. No auth/public-site/client/leads/AI
  code added.
- **AC-2 shared DTOs present + pure:** all 11 required DTOs exported via the barrel
  (`MediaDTO`, `BehaviorEventWithMediaDTO`, `DogSummaryDTO`, `DogDetailDTO`,
  `SessionSummaryDTO`, `DogTimelineDTO`, `TimelineSessionDTO`, `PresignRequest`,
  `PresignResponse`, `CreateMediaInput`, `UpdateBehaviorEventInput`; plus
  `BehaviorEventListItemDTO` + `MediaPlaybackUrlDTO` for G-7). Grep for
  `drizzle|pg|aws|node:|hono` in `packages/shared/src` → **no matches** (Metro-safe).
- **R2 module (`src/lib/r2.ts`):** checksum flags set (R-1); lazy `getR2Config()`
  reads R2 vars only at call time, NOT in `config.ts` (R-4); key scheme
  `events/<eventId>/<uuid>.<ext>`; PUT presign signs `ContentType` and echoes it in
  `headers` (R-6); `presignGetUrl` issues the playback GET (G-7); AWS SDK isolated
  to `apps/api` (NFR-5).
- **blobUrl round-trip (the flagged likely-defect) — CONSISTENT:** write
  `blobUrlForKey` →
  `https://<acct>.r2.cloudflarestorage.com/<bucket>/events/<eventId>/<uuid>.<ext>`;
  read `keyFromBlobUrl` parses the URL pathname, strips the leading slash + the
  one bucket segment → `events/<eventId>/<uuid>.<ext>`, which exactly equals the
  original `buildKey` output (no leading slash). Has a defensive non-URL fallback.
  Round-trips correctly.
- **Endpoints:** presign → 400 (Zod enum on disallowed contentType) / 404 (missing
  event) / 503 (R2 unconfigured, lazy) / 200 `PresignResponse`. `POST
  /events/:id/media` → 404 / 503 / 201 `MediaDTO`. `GET /media/:id/url` → 404 / 503
  / 200 `MediaPlaybackUrlDTO`. Reads use plain `select()` + joins + `inArray`
  batching (no `relations()`, no N+1 — timeline is 2 queries; `GET /sessions/:id/
  events` batches media counts). `PATCH /events/:id` Zod body is `{ note?, tags? }`
  ONLY — tap fields + `intervention` are structurally un-settable (AC-4 moat).
  `POST /dogs/:id/sessions` → 404 dog / 201 `SessionSummaryDTO`. Validation via
  `@hono/zod-validator` over shared enums throughout.
- **Mobile:** `lib/api.ts` reads `EXPO_PUBLIC_*` via static dot-access (AC-11),
  responses typed with shared DTOs (no `any`). 4-tap screen pre-defaults all four
  fields + omits `intervention` (server defaults it) + optimistic reset + retry-
  without-retap + OQ-8 no-default escape hatch. `lib/upload.ts` branches on
  `Platform.OS`: native uses `expo-file-system/legacy` `createUploadTask` +
  `FileSystemUploadType.BINARY_CONTENT` + `httpMethod:'PUT'` (NOT the deprecated
  main-import path — R-2; the legacy entry avoids the SDK-54 runtime deprecation
  throw), web uses `fetch` PUT; Content-Type threaded presign→PUT identically
  (R-6). G-7 playback: `GET /media/:id/url` → `expo-video` `<VideoView>`.
- **Security:** no committed secrets (`.env.example` only, placeholder trainer id);
  presign validates content type + event existence before signing; `cors()` already
  enabled in `app.ts`.

---

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
