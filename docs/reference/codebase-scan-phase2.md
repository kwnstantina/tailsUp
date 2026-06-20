---
language: typescript
framework: hono (api), expo-router (mobile)
package_manager: npm workspaces
build_command: "npm run build --workspaces --if-present  # each workspace: tsc --noEmit (typecheck gate only; runtime is tsx / Expo bundler)"
test_command: "npm run test --workspaces --if-present  # api: vitest run; mobile/shared: no test script"
lint_command: null
entry_points:
  - apps/api/src/index.ts
  - apps/api/src/app.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/index.tsx
  - packages/shared/src/index.ts
last_scanned_commit: 687a7fe5e14dc253884b8590efe91a2c61ca5267
scanned_for_request: refined-request-phase2.md
scanned_at: "2026-06-20T00:00:00Z"
---

# Codebase Scan — TailsUp (Phase 2 narrowing)

## 1. Project Overview

TailsUp is a TypeScript-strict npm-workspaces monorepo (Node 20) with three
packages: `apps/api` (Hono 4 + Drizzle ORM + node-postgres, ESM, served via
`tsx`), `apps/mobile` (Expo Router SDK 54, React Native + web), and
`packages/shared` (pure-TS enums + DTOs, no build step, resolved from source via
path aliases by both consumers). Phase 1 delivered `GET /health`,
`POST /sessions/:id/events`, a 12-table Drizzle schema, and a single Expo health
screen. Phase 2 adds three mobile screens and ~8 new API endpoints without any
schema migration.

---

## 2. Module Map

### Monorepo top level

| Path | Purpose | Key exports / notes |
|---|---|---|
| `apps/api/` | Hono REST API, Node runtime | `@tailsup/api` (private) |
| `apps/mobile/` | Expo Router app (iOS/Android/web) | `@tailsup/mobile` (private) |
| `packages/shared/` | Pure-TS shared types, no build | `@tailsup/shared` |
| `tsconfig.base.json` | Root TS config (`strict: true`, path aliases) | inherited by all workspaces |
| `.env.example` | Full secret surface (R2, DB, Auth, AI) | R2 vars reserved for Phase 2 |

### `apps/api/src/`

| Path | Purpose | Key symbols |
|---|---|---|
| `index.ts` | Server entry — `serve()` on `config.port` | — |
| `app.ts` | Hono app factory — mounts routes, CORS, error handlers | `app` |
| `config.ts` | Throw-on-missing env loader | `config`, `required()` |
| `db/client.ts` | Drizzle + pg Pool, `casing:'snake_case'` | `db`, `pool`, `schema` |
| `db/schema.ts` | 12-table, 6-pgEnum Drizzle schema | `trainer`, `client`, `dog`, `protocol`, `session`, `behaviorEvent`, `media`, `homework`, `exercise`, `lead`, `booking`, `*Enum` |
| `routes/health.ts` | `GET /health` liveness + DB check | `health` (Hono instance) |
| `routes/sessions.ts` | `POST /sessions/:id/events` | `sessions` (Hono instance) |
| `test/health.test.ts` | Vitest unit tests — health route | vi.mock pattern |
| `test/events.test.ts` | Vitest unit tests — sessions route | vi.hoisted queue pattern |
| `test/config.test.ts` | Vitest unit tests — config throw | vi.resetModules pattern |

### `packages/shared/src/`

| Path | Purpose | Key exports |
|---|---|---|
| `enums.ts` | 6 const arrays + union types | `TRIGGER_TYPES`, `OUTCOMES`, `MEDIA_TYPES`, `LEAD_STATUSES`, `BOOKING_TYPES`, `BOOKING_STATUSES`; matching `TriggerType`, `Outcome`, `MediaType`, … |
| `dtos.ts` | Phase 1 request/response interfaces | `CreateBehaviorEventInput`, `BehaviorEventDTO`, `HealthDTO` |
| `index.ts` | Barrel re-export | `export * from './enums'; export * from './dtos'` |

### `apps/mobile/app/`

| Path | Purpose |
|---|---|
| `_layout.tsx` | Root Stack navigator, `SafeAreaProvider`, header theme |
| `index.tsx` | `/` route — health check screen (single Phase 1 screen) |

---

## 3. Conventions

- **Route module pattern** (`apps/api/src/routes/sessions.ts:37`): each route
  file creates `export const <name> = new Hono()` and registers handlers on it;
  `app.ts` mounts with `app.route('/', <name>)`. Phase 2 route files must follow
  this exact pattern and be mounted in `app.ts`.

- **Zod validation with shared arrays** (`apps/api/src/routes/sessions.ts:27-35`):
  `zValidator('json', z.object({ triggerType: z.enum(TRIGGER_TYPES), ... }))` is
  the first middleware on every mutating route. Enums are always sourced from
  `@tailsup/shared` arrays so the DB enum, Zod schema, and mobile types stay in
  sync. Invalid input auto-returns `400`; no manual validation code needed.

- **Throw-on-missing config** (`apps/api/src/config.ts:8-13`): the `required()`
  helper throws `Error('Missing required environment variable: <NAME>')` at module
  load time. Phase 2 must add R2 vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) using the same helper — only inside the
  presign route module, not at startup unless consumed there.

- **Static `EXPO_PUBLIC_*` dot-access** (`apps/mobile/app/index.tsx:54`):
  `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'` — Metro inlines
  `EXPO_PUBLIC_*` only via static dot-access. No destructuring or dynamic keys.
  Phase 2 must access `EXPO_PUBLIC_TRAINER_ID` the same way.

- **Test strategy** (`apps/api/src/test/events.test.ts:21-64`): `vi.hoisted()`
  creates mock fns before `vi.mock()` factories run (TDZ-safe); `vi.mock('../db/client.js', ...)` replaces the Drizzle client with a mock chain; the app is
  exercised via `app.request(...)` (no HTTP server); `vi.mock('dotenv/config', () => ({}))`
  neutralises the side-effect import. Phase 2 tests must follow this exact
  hoisting/isolation pattern.

- **JSON error bodies** (`apps/api/src/app.ts:23-32`, `routes/sessions.ts:77`):
  all error responses are `{ error: '...' }`. `onError` catches unhandled
  throws; `notFound` returns `{ error: 'not found' }`. Route handlers use
  `c.json({ error: '...' }, 4xx)` for domain errors.

---

## 4. Integration Points

### In Scope — files Phase 2 directly extends or imitates

#### API — routing and app composition

| File | Lines / Symbols | Phase 2 interaction |
|---|---|---|
| `apps/api/src/app.ts` | `app`, `app.route('/', ...)` lines 19-20 | **Mount point**: add `app.route('/', dogs)`, `app.route('/', events)`, `app.route('/', media)`, `app.route('/', trainers)` (and/or extend sessions) here after importing from new route files |
| `apps/api/src/routes/sessions.ts` | `sessions` Hono instance, line 37 | **Extend**: add `GET /sessions/:id/events` handler to this file (disjoint ownership; or split — implementation choice) |
| `apps/api/src/routes/health.ts` | `health` Hono instance, line 12 | **Read-only reference** — imitate the `new Hono()` + `export const` pattern for new route modules |

#### API — database access

| File | Lines / Symbols | Phase 2 interaction |
|---|---|---|
| `apps/api/src/db/client.ts` | `db`, `pool`, `schema` (line 14-16) | **Import as-is** in all new route modules: `import { db } from '../db/client.js'` |
| `apps/api/src/db/schema.ts` | `trainer` (73), `client` (91), `dog` (107), `protocol` (82), `session` (178), `behaviorEvent` (205), `media` (230) | **Query targets** for all read endpoints. Key columns: `behaviorEvent.note` (text, nullable, line 218), `behaviorEvent.tags` (jsonb `$type<string[]>()`, GIN-indexed, line 219), `media.blobUrl` (text, line 235), `media.type` (mediaTypeEnum, line 236), `media.eventId` (FK, line 232). Composite indexes already exist: `session_dog_started_idx` on `(dogId, startedAt)`, `behavior_event_session_occurred_idx` on `(sessionId, occurredAt)` — use these for timeline/list reads |
| `apps/api/src/db/schema.ts` | `mediaTypeEnum` (line 53), `MEDIA_TYPES` import | **Reuse**: `POST /events/:id/media` inserts `type: 'video'`; `POST /media/presign` validates `contentType` against `MEDIA_TYPES` / `['video/mp4','video/quicktime']` |

#### API — config (R2 credentials)

| File | Lines / Symbols | Phase 2 interaction |
|---|---|---|
| `apps/api/src/config.ts` | `required()` (line 8), `config` object (line 16) | **Extend**: add `r2AccountId: required('R2_ACCOUNT_ID')`, `r2AccessKeyId: required('R2_ACCESS_KEY_ID')`, `r2SecretAccessKey: required('R2_SECRET_ACCESS_KEY')`, `r2Bucket: required('R2_BUCKET')` to the `config` export. These throw at startup once consumed. Only add when the presign route module imports `config`. |
| `.env.example` | R2 block (lines ~40-50) | **Already present**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=tailsup-media`. No new secret names required unless `R2_PUBLIC_BASE_URL` is added for video playback (OQ-9). |

#### Shared package — DTOs and enums

| File | Lines / Symbols | Phase 2 interaction |
|---|---|---|
| `packages/shared/src/dtos.ts` | `BehaviorEventDTO` (line 18), `CreateBehaviorEventInput` (line 8), `HealthDTO` (line 32) | **Extend (do not modify existing)**: append Phase 2 interfaces — `DogSummaryDTO`, `DogDetailDTO`, `SessionSummaryDTO`, `DogTimelineDTO`, `TimelineSessionDTO`, `BehaviorEventWithMediaDTO`, `MediaDTO`, `PresignRequest`, `PresignResponse`, `CreateMediaInput`, `UpdateBehaviorEventInput`. Import `MediaType` from `./enums` for `MediaDTO.type`. |
| `packages/shared/src/enums.ts` | `MEDIA_TYPES` (line 7), `TRIGGER_TYPES` (line 5), `OUTCOMES` (line 6) | **Reuse as-is**: `PresignRequest.contentType` validation uses `MEDIA_TYPES`; `CreateBehaviorEventInput` already uses `TRIGGER_TYPES`/`OUTCOMES`. No new enums needed for Phase 2. |
| `packages/shared/src/index.ts` | `export * from './enums'; export * from './dtos'` | **Auto-exports all new DTOs** via existing barrel — no changes needed to this file |

#### Mobile — layout and screen pattern

| File | Lines / Symbols | Phase 2 interaction |
|---|---|---|
| `apps/mobile/app/_layout.tsx` | `RootLayout`, `Stack`, `Stack.Screen` (line 17-27) | **Extend**: register new screens by adding `<Stack.Screen name="...">` entries for `sessions/[id]/log`, `events/[id]`, `dogs/[id]/timeline`, `dogs/index` — or rely on Expo Router file-based auto-registration (no explicit declaration needed for file-based routes) |
| `apps/mobile/app/index.tsx` | `HealthScreen`, `API_URL` (line 54), `StyleSheet.create` (line 173) | **Imitate**: static `process.env.EXPO_PUBLIC_API_URL` access pattern, `useState`/`useCallback`/`useEffect` for async fetch, `StyleSheet.create` for all styles, `SafeAreaView` + `ScrollView` layout, discriminated-union `Status` type for loading/success/error states |

#### Tests

| File | Lines / Symbols | Phase 2 interaction |
|---|---|---|
| `apps/api/vitest.config.ts` | `resolve.alias` for `@tailsup/shared` (line 20-22), `isolate: true` | **Reuse config as-is** — Phase 2 test files live under `apps/api/src/test/` and resolve `@tailsup/shared` via the alias automatically |
| `apps/api/src/test/events.test.ts` | `vi.hoisted` mock queue pattern (lines 21-50), `vi.mock('../db/client.js', ...)` (lines 58-64), `app.request(...)` invocation (lines 74-80) | **Template**: Phase 2 tests for new routes (dogs, events, media, trainers) copy this exact `vi.hoisted` + select-queue + insert-result pattern; new routes add a `vi.mock('../db/client.js', ...)` block covering the Drizzle methods they use |
| `apps/api/src/test/config.test.ts` | `vi.resetModules()` + dynamic `import('../config.js')` | **Template for R2 config tests**: same pattern — delete R2 env vars, expect throw with the exact var name |

### New Integration Points (do not exist yet — landing locations)

| What | Where to add | Notes |
|---|---|---|
| `routes/dogs.ts` — `GET /trainers/:trainerId/dogs`, `GET /dogs/:id`, `GET /dogs/:id/timeline`, `POST /dogs/:id/sessions` | New file `apps/api/src/routes/dogs.ts`; mount in `app.ts` | Joins: dog→client→trainer for list; dog→session for detail; dog→session→behaviorEvent for timeline |
| `routes/events.ts` — `GET /events/:id`, `PATCH /events/:id`, `POST /events/:id/media` | New file `apps/api/src/routes/events.ts`; mount in `app.ts` | `PATCH` must not accept tap fields; `POST /events/:id/media` derives `blobUrl` from key + R2 account id |
| `routes/media.ts` — `POST /media/presign` | New file `apps/api/src/routes/media.ts`; mount in `app.ts` | Adds `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` to `apps/api` only; R2 credentials via extended `config` |
| `routes/trainers.ts` — `GET /trainers/:trainerId/dogs` (or colocate in `dogs.ts`) | New file or part of `dogs.ts` | Trainer-scoped dog list for FR-M6 |
| `apps/mobile/app/dogs/index.tsx` | New file — dog list screen (FR-M6) | Reads `EXPO_PUBLIC_TRAINER_ID`; calls `GET /trainers/:trainerId/dogs` |
| `apps/mobile/app/sessions/[id]/log.tsx` | New file — 4-tap quick-log screen (FR-M1) | Posts to existing `POST /sessions/:id/events`; omits `intervention` |
| `apps/mobile/app/events/[id].tsx` | New file — post-session detail screen (FR-M3/M4) | `GET /events/:id`, `PATCH /events/:id`, presign→PUT→`POST /events/:id/media` |
| `apps/mobile/app/dogs/[id]/timeline.tsx` | New file — dog timeline screen (FR-M5) | `GET /dogs/:id/timeline`; reverse-chronological grouped sessions |
| `apps/mobile/lib/api.ts` (or similar) | New file — typed API client wrapper (FR-M7) | Wraps `EXPO_PUBLIC_API_URL` via static dot-access; types responses with `@tailsup/shared` DTOs |
| `expo-image-picker` dependency | `apps/mobile/package.json` | Not present in Phase 1; needed for video picker (FR-M4, OQ-3 recommendation) |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | `apps/api/package.json` | Not present in Phase 1; needed for presigned PUT URL generation (FR-A1) |
| `EXPO_PUBLIC_TRAINER_ID` env var | `apps/mobile/.env` (gitignored) + document in `.env.example` | Trainer context without auth (OQ-1 recommended default) |

### Out of Scope for Phase 2 (explicitly — do not touch)

| Module | Reason |
|---|---|
| `apps/api/src/db/schema.ts` — `lead`, `booking`, `homework`, `exercise` tables | Phase 3/4 entities; no Phase 2 read or write endpoints touch these |
| `apps/api/src/routes/health.ts` | Existing endpoint — must keep working unchanged (AC-12) |
| BetterAuth / auth middleware | Phase 3 only; Phase 2 endpoints are unauthenticated |
| `apps/api/drizzle/` migrations | No schema change in Phase 2 (media/note/tags already exist); add only if a genuine gap is found |
| Public website / client dashboard routes | Phase 3 |
| `ANTHROPIC_API_KEY` / AI summary | Phase 4 |
| `R2_BACKUP_BUCKET` / DB backup workflow | CI-only, unrelated to Phase 2 |

---

## 5. Notes

- **No test command in `apps/mobile` or `packages/shared`** — `vitest` lives only
  in `apps/api`. Phase 2 mobile screens have no test infrastructure yet; if
  tests are added they need a new `vitest.config.ts` in `apps/mobile` mirroring
  the API's config.

- **`apps/mobile` has no video/file picker, no data-fetching layer, no navigation
  beyond one route** — all of these are Phase 2 new-integration-point additions.
  The mobile dependency count will grow significantly (`expo-image-picker` at
  minimum; possibly `expo-document-picker`).

- **`build_command` is effectively a typecheck gate** — `tsc --noEmit` is the
  `build` script for `apps/api`; there is no compiled output. The API runs
  directly via `tsx src/index.ts`. No transpile output path exists to worry about.

- **R2 vars in `.env.example` are stubs (Phase 1 left them placeholder)** — the
  config module does not yet read them. Adding them to `config.ts` via
  `required()` will cause startup failure until real `.env` values are set; this
  is the intended behavior per NFR-4, but developers must set R2 vars before
  starting the API once the presign route is mounted.
