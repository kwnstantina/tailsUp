# Plan 002 — TailsUp Phase 2: Trainer View

> **Status:** Plan for review at the **design gate**. This is the Claude-executable implementation plan for **Phase 2 — Trainer View** of TailsUp. It is grounded in the actual committed Phase 1 code (not just the design docs) and follows the investigation's version-pinned recommendations verbatim.
>
> **Build scope: Phase 2 ONLY** — the three trainer-facing Expo Router screens + the supporting read/media API + the new `@tailsup/shared` DTOs. **No** auth, **no** public site, **no** client view, **no** AI, **no** leads/bookings, **no** schema migration.
>
> **Inputs (authoritative — read in full before executing):**
> - Refined spec: `docs/reference/refined-request-phase2.md` (scope, endpoint shapes, OQ-1..OQ-10, AC-1..AC-13)
> - Investigation: `docs/reference/investigation-phase2.md` (the HOW + critical pitfalls — FOLLOW its recommendations)
> - Codebase scan: `docs/reference/codebase-scan-phase2.md` (exact integration points + anomalies)
> - Phase 1 design: `docs/design/project-design.md` · Functional ledger: `docs/design/project-functions.md`

---

## ⛔ DESIGN GATE — load-bearing decisions needing user sign-off BEFORE execution

These choices change the data written, the dependencies installed, and the endpoint surface. Execution must **not** start until the user approves these (or names changes). Each restates the refined-request open question and the recommended default this plan bakes in.

| # | Decision (OQ) | This plan assumes | Impact if changed |
| --- | --- | --- | --- |
| **G-1** | **OQ-1 — Trainer context without auth** | **`EXPO_PUBLIC_TRAINER_ID`** (static dot-access) holds a seeded trainer id; reads are path-scoped (`GET /trainers/:trainerId/dogs`). Swaps cleanly to BetterAuth in Phase 3 (drop the env var, read `c.get('trainer').id`). | Changes how the dog-list screen (FR-M6) resolves "my dogs"; alternative is a `GET /trainers` list-all + in-app picker (Unit B + C surface both grows). |
| **G-2** | **OQ-7 — Starting a session** | **Add a minimal `POST /dogs/:id/sessions`** (`{ startedAt?, location? }`, defaults `startedAt=now`) → `201 SessionSummaryDTO`. This is the one borderline write beyond pure reads; it unblocks the 4-tap screen (you cannot log events without a session). | If excluded, sessions must be pre-seeded and the app only logs into seeded sessions (FR-M1 entry path changes; Unit B drops one route, Unit C drops the "start session" action). |
| **G-3** | **OQ-2 — Media persistence flow** | **Two-step: presign issues the URL only; a follow-up `POST /events/:id/media` records the row** after the device confirms the direct upload succeeded. Presign creates **no** `media` row. | Alternative (presign inserts a `pending` row) adds state/cleanup with no upload-status column — rejected. Changing this reshapes `POST /media/presign` and `POST /events/:id/media`. |
| **G-4** | **OQ-3 — Video picker** | **`expo-image-picker`** (`launchImageLibraryAsync({ mediaTypes: ['videos'] })`), installed via `npx expo install`. | Alternative `expo-document-picker` changes the mobile dependency + the pick code path. |
| **G-5** | **OQ-5 — Presign expiry** | **`expiresIn: 600` (10 min).** Response returns `expiresInSeconds` so the client can re-request on expiry. | Shorter expiry risks large-video timeouts on phone networks; longer increases URL-leak window. |
| **G-6** | **OQ-6 — Allowed content types / size** | Allow **`video/mp4`** and **`video/quicktime`** only (reject others → 400). **No hard server size cap** in Phase 2; client soft-warns above **200 MB**. | Changing the allow-set changes the presign validation + the picker mime check + the ext map (`mp4`/`mov`). |
| **G-7** | **OQ-9 — R2 public-vs-private bucket for the stored `blobUrl`** | **Private / key-only:** store the canonical S3-style reference `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>` as `blobUrl`. Playback in the trainer UI is **not** a Phase 2 requirement, so no public base URL / presigned-GET is built. | **If the detail screen must PLAY the uploaded video back**, this flips: add a `R2_PUBLIC_BASE_URL` env var (store `${R2_PUBLIC_BASE_URL}/<key>`) **or** add a `GET /media/:id/url` presigned-GET endpoint. This is the one OQ that changes the data written — **confirm explicitly.** |
| **G-8** | **OQ-10 — CORS for web uploads** | The R2 **bucket CORS policy** (allow `PUT` + `Content-Type` from the Expo web origin `http://localhost:8081`) is a **bucket setting, not API code**. This plan **documents** it as an AC-9-on-web prerequisite. **Confirm whether web upload must be demonstrated** — if yes, the R2 CORS rule is a hard prerequisite; if no, the picker/upload is verified on a native simulator instead. | Determines whether the R2 dashboard CORS step is a blocking task or a documented note. |

**Resume signal:** reply **"approved"** to proceed with all G-1..G-8 defaults, or name the ones to change (e.g. "G-7 → add R2_PUBLIC_BASE_URL, screen must play video", "G-1 → list-all picker", "G-8 → web upload must be demonstrated").

---

## Objective

Deliver Phase 2 of TailsUp: a trainer can, on a running seeded system, open the app, see their dogs, start a session, **log behavior events in ≤ 4 taps**, open a dog's **reverse-chronological timeline**, open an **event detail** screen to edit note/tags and **upload a video directly to R2** (presign → direct PUT → persist), with all of it type-checked under `strict` across `@tailsup/shared`, `apps/api`, and `apps/mobile`, and **no schema migration**.

**Why now:** Phase 1 shipped the schema (incl. `media`, `behavior_event.note`, `behavior_event.tags`), `GET /health`, and `POST /sessions/:id/events`. Phase 2 builds the trainer's actual day-to-day surface on top of that foundation.

---

## Context (read before executing)

@docs/reference/refined-request-phase2.md
@docs/reference/investigation-phase2.md
@docs/reference/codebase-scan-phase2.md
@docs/design/project-design.md
@docs/design/project-functions.md

**Ground-truth facts confirmed against the live code (do not re-derive):**
- `apps/api/src/app.ts` mounts `app.route('/', health)` + `app.route('/', sessions)`, applies `app.use('*', cors())` (allow-all), and installs `onError` (HTTPException pass-through + 500) + `notFound` (`{ error: 'not found' }`). **Mount new sub-apps here.**
- `apps/api/src/routes/sessions.ts` exports `export const sessions = new Hono()` and currently holds only `POST /sessions/:id/events`. Pattern: `zValidator('json', zObj)` → `db.select().from(...).where(eq(...))` → `{ error }` JSON on domain failures → `c.json(dto, 201)`. Imports DB tables from `../db/schema.js`, `db` from `../db/client.js`, enums/types from `@tailsup/shared`, uses **ESM `.js` import specifiers**.
- `apps/api/src/config.ts` exports `config` + `required()` (throws on missing). **Do NOT add R2 vars here** (NFR-4 lazy-config rule — see Unit B).
- `packages/shared/src/dtos.ts` exists (plural filename) and imports `from './enums'` (no `.js`). Barrel `packages/shared/src/index.ts` is `export * from './enums'; export * from './dtos';` — **new DTOs auto-export, no barrel edit needed.**
- `apps/mobile/app/` has only `_layout.tsx` (Stack in `SafeAreaProvider`) and `index.tsx` (the `/health` screen; uses `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'` static dot-access, a discriminated-union `Status` state, `StyleSheet.create`). **Imitate this exactly.**
- Schema columns already exist: `behaviorEvent.note` (text nullable), `behaviorEvent.tags` (jsonb `$type<string[]>()`, GIN), `media{ id, eventId, blobUrl, type, uploadedAt(defaultNow) }`. Composite indexes `session_dog_started_idx (dogId, startedAt)` and `behavior_event_session_occurred_idx (sessionId, occurredAt)` exist. **No migration.**

---

## Unit breakdown, parallelization & dependency ordering

```
        ┌───────────────────────────────────────────────────────────┐
        │  UNIT A — packages/shared : the Phase 2 DTO contract         │
        │  LANDS FIRST + is committed before B/C start                 │
        └───────────────┬───────────────────────────┬─────────────────┘
                        │ (B & C type-check against A) │
        ┌───────────────▼──────────────┐   ┌──────────▼────────────────┐
        │ UNIT B — apps/api             │   │ UNIT C — apps/mobile        │
        │ presign + lazy R2 + reads +   │   │ 3 screens + dog list +      │
        │ PATCH + media + start-session │   │ fetch client + nav/layout   │
        │ (depends on A)                │   │ (depends on A)              │
        └───────────────────────────────┘   └─────────────────────────────┘
                  DISJOINT FILE SETS — run B and C in parallel
```

**Ordering rule:** **Unit A lands and is committed first.** B and C both `import` from `@tailsup/shared`; they will not type-check until A exists. After A is committed, dispatch **B and C in parallel** (independent coder agents / fresh contexts).

**Disjointness check (confirmed):**
- Unit A writes **only** `packages/shared/src/dtos.ts` (append). No other unit touches `packages/shared`.
- Unit B writes **only** under `apps/api/` (new route files + `package.json` + one R2-config module + tests). No other unit touches `apps/api`.
- Unit C writes **only** under `apps/mobile/` (new screens + `lib/api.ts` + `_layout.tsx` + `package.json` + `.env.example`). No other unit touches `apps/mobile`.
- **The README / run-docs update (AC-13) is owned by Unit B** (single owner, no conflict) since it documents the API + env setup; Unit C contributes its mobile env vars to that doc via Unit B's section (or, if parallelism makes this awkward, README lands in a brief Unit D-doc step after B+C — see Verification).
- **`docs/design/project-functions.md`** is updated by the **planner (this step), not by a build unit** — see end of this plan.

**Why all mobile work is ONE unit:** the three screens share `app/_layout.tsx`, the Expo Router navigation graph, and `apps/mobile/lib/api.ts`. Splitting them across agents would race on those shared files. Keep mobile atomic.

> **Scope-control note (create-plans):** Units B and C are each larger than the skill's ideal 2–3-task plan. When executing, run each unit via a **fresh subagent context** (or split B into B1=reads+mutations / B2=presign+media at execution time, and C into C1=client+list+timeline / C2=log+detail+upload) to stay under ~50% context. The unit boundaries below are the file-ownership contract; the sub-split is an execution convenience that does not change ownership.

---

## Interface contract (Unit A) — the exact `@tailsup/shared` exports B and C consume

**File:** `packages/shared/src/dtos.ts` (APPEND below the existing Phase 1 DTOs — do not modify existing ones). **Pure TS only** — no runtime imports; reuse `MediaType` from `./enums`.

```ts
// ── append to packages/shared/src/dtos.ts ─────────────────────────────────
import type { MediaType } from './enums'; // (add MediaType to the existing import line)

// Media row (R2 URL only — never the file).
export interface MediaDTO {
  id: string;
  eventId: string;
  blobUrl: string;
  type: MediaType;          // 'video' | 'image' (Phase 2 ships 'video')
  uploadedAt: string;       // ISO
}

// A behavior event plus its media — returned by GET /events/:id (FR-A8).
export interface BehaviorEventWithMediaDTO extends BehaviorEventDTO {
  media: MediaDTO[];
}

// A dog in a trainer's list (FR-A3). protocolId null => no default intervention.
export interface DogSummaryDTO {
  id: string;
  name: string;
  breed: string;
  ageMonths: number;
  clientId: string;
  protocolId: string | null;
}

// One session under a dog (FR-A4).
export interface SessionSummaryDTO {
  id: string;
  startedAt: string;        // ISO
  location: string | null;
  eventCount: number;
}

// A dog with its sessions (FR-A4).
export interface DogDetailDTO extends DogSummaryDTO {
  sessions: SessionSummaryDTO[];
}

// One session with its events, for the timeline (FR-A6).
export interface TimelineSessionDTO {
  id: string;
  startedAt: string;        // ISO
  location: string | null;
  events: BehaviorEventDTO[]; // reverse-chronological within the session
}

// The dog timeline (FR-A6): sessions reverse-chronological by startedAt.
export interface DogTimelineDTO {
  dog: DogSummaryDTO;
  sessions: TimelineSessionDTO[];
}

// POST /media/presign request/response (FR-A1).
export interface PresignRequest {
  eventId: string;
  contentType: string;      // must be in the allowed set (G-6)
}
export interface PresignResponse {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>; // e.g. { 'Content-Type': 'video/mp4' } — client MUST echo
  key: string;
  expiresInSeconds: number;
}

// POST /events/:id/media request (FR-A2). Records the row after upload confirm.
export interface CreateMediaInput {
  key: string;
  contentType: string;
}

// PATCH /events/:id request (FR-A7). Partial; tap fields/intervention immutable.
export interface UpdateBehaviorEventInput {
  note?: string | null;
  tags?: string[] | null;
}
```

> Optional list-endpoint augmentation (OQ-3): `GET /sessions/:id/events` returns `BehaviorEventDTO[]` with a `mediaCount: number` appended per row. Because adding `mediaCount` to the base `BehaviorEventDTO` would change the existing Phase 1 shape, the plan instead defines list rows as `BehaviorEventDTO & { mediaCount: number }` inline in the API and adds **no** field to the existing DTO. If a named type is wanted, add `export interface BehaviorEventListItemDTO extends BehaviorEventDTO { mediaCount: number }` to Unit A. **Recommended:** add the named type for clarity; both B and C reference it.

**Endpoint request/response shapes** (the wire contract B implements and C consumes — all JSON, base `EXPO_PUBLIC_API_URL`, ISO timestamps, `{ error }` bodies, status: 200 reads / 201 creates / 400 validation / 404 unknown id / 5xx R2):

| Method + path | Request | Response | FR / AC |
| --- | --- | --- | --- |
| `GET /trainers/:trainerId/dogs` | — | `200 DogSummaryDTO[]` (unknown trainer → `[]`) | FR-A3 / AC-3 |
| `GET /dogs/:id` | — | `200 DogDetailDTO` · `404` | FR-A4 / AC-3 |
| `GET /sessions/:id/events` | — | `200 (BehaviorEventListItemDTO)[]` chronological · `404` | FR-A5 / AC-3 |
| `GET /dogs/:id/timeline` | — | `200 DogTimelineDTO` (sessions+events reverse-chron) · `404` | FR-A6 / AC-3 |
| `GET /events/:id` | — | `200 BehaviorEventWithMediaDTO` · `404` | FR-A8 / AC-3 |
| `PATCH /events/:id` | `UpdateBehaviorEventInput` | `200 BehaviorEventDTO` · `404` | FR-A7 / AC-4 |
| `POST /media/presign` | `PresignRequest` | `200 PresignResponse` · `404` unknown event · `400` bad type · `5xx` R2 unconfigured | FR-A1 / AC-5 |
| `POST /events/:id/media` | `CreateMediaInput` | `201 MediaDTO` · `404` unknown event | FR-A2 / AC-7 |
| `POST /dogs/:id/sessions` | `{ startedAt?: string; location?: string }` | `201 SessionSummaryDTO` · `404` unknown dog | OQ-7/G-2 |

---

## UNIT A — `packages/shared` Phase 2 DTOs (LANDS FIRST)

**Owns (exclusive):** `packages/shared/src/dtos.ts` (append-only). **No barrel edit** (the `export *` picks them up).

**Tasks:**
1. **type:** Append the DTO block above to `packages/shared/src/dtos.ts`. Add `MediaType` to the existing `import type { TriggerType, Outcome } from './enums';` line. Add `BehaviorEventListItemDTO` (recommended). **Action:** edit only; keep existing DTOs byte-for-byte.
   - **verify:** `npm run typecheck -w packages/shared` (or `tsc --noEmit -p packages/shared`) → 0 errors.
   - **verify (purity):** `grep -REn "from 'drizzle|from \"drizzle|require\(|from 'pg|aws|node:" packages/shared/src` → **no matches** (AC-2 purity).
   - **done:** all 11 (+1) DTO names from FR-A11 are exported from the barrel; `import { PresignResponse } from '@tailsup/shared'` resolves.

**Acceptance (Unit A → AC):** **AC-2** (shared DTOs present + pure). Partial **AC-1** (shared workspace type-checks). Enables AC-11 (typed client) downstream.

**Commit Unit A before dispatching B and C.**

---

## UNIT B — `apps/api` (presign + lazy R2 + reads + mutations + start-session)

**Owns (exclusive):**
- `apps/api/package.json` (add `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
- `apps/api/src/routes/dogs.ts` (new) — `GET /trainers/:trainerId/dogs`, `GET /dogs/:id`, `GET /dogs/:id/timeline`, `POST /dogs/:id/sessions`
- `apps/api/src/routes/events.ts` (new) — `GET /events/:id`, `PATCH /events/:id`, `POST /events/:id/media`
- `apps/api/src/routes/media.ts` (new) — `POST /media/presign`
- `apps/api/src/r2.ts` (new) — **lazy** R2 config accessor + S3 client factory
- `apps/api/src/routes/sessions.ts` (extend — add `GET /sessions/:id/events`)
- `apps/api/src/app.ts` (extend — mount `dogs`, `events`, `media`)
- New tests under `apps/api/src/test/` (dogs/events/media/r2-config)
- `README.md` (Phase 2 run/verify section — AC-13)

**Hard requirements baked in (from the investigation — do not deviate):**

1. **R2 presign (`r2.ts` + `media.ts`):**
   - Install **`@aws-sdk/client-s3`** + **`@aws-sdk/s3-request-presigner`** **pinned to the SAME exact version** (current `~3.937.x`; any matched ≥3.729 pair). Add to **`apps/api` only** (NFR-5 — never `@tailsup/shared`/mobile).
   - `S3Client({ region: 'auto', endpoint: \`https://${accountId}.r2.cloudflarestorage.com\`, credentials: { accessKeyId, secretAccessKey }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' })`. **The two checksum flags are MANDATORY** — without them AWS SDK ≥3.729 bakes an `x-amz-checksum-crc32` requirement that **R2 rejects** (`NotImplemented`/`SignatureDoesNotMatch`). `forcePathStyle` is **NOT** needed for R2.
   - Presign: `getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: 600 })`. Key scheme `events/{eventId}/{crypto.randomUUID()}.{ext}` where ext = `mp4` for `video/mp4`, `mov` for `video/quicktime`.
   - **ContentType is signed and echoed:** include `ContentType` in `PutObjectCommand` AND return it in `headers['Content-Type']`. Mismatch on the client PUT → 403.
   - Response: `{ uploadUrl, method: 'PUT', headers: { 'Content-Type': contentType }, key, expiresInSeconds: 600 }`.

2. **Lazy R2 config (`r2.ts`):**
   - A `getR2Config()` that calls the existing `required()` pattern **at call time** (or at module-eval of `media.ts`, which is only loaded when that route is mounted) — read `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
   - **DO NOT** add R2 vars to the top-level `config.ts` via `required()` — that would break API boot + the entire vitest suite for read-endpoint tests (which need no R2 creds). Eager validation is explicitly rejected (investigation Area 3, Option 3B).
   - Still throws clearly on missing vars (NFR-4 — no silent fallback, no fabricated URL). The presign handler wraps the throw as `c.json({ error: 'media storage not configured' }, 503)`.

3. **Reads — plain Drizzle `select()` + joins, NO `relations()`, NO migration:**
   - `GET /trainers/:trainerId/dogs`: `dog` join `client` where `client.trainerId = :trainerId` → `DogSummaryDTO[]`. Unknown trainer → `[]` (G-1/OQ-1).
   - `GET /dogs/:id`: dog row (404 if absent) + sessions, each with `eventCount` via grouped `count(behaviorEvent.id)` (left join + `groupBy`). Uses `session_dog_started_idx`.
   - `GET /sessions/:id/events`: events `where sessionId` `orderBy asc(occurredAt)` (chronological, matches index) + a `mediaCount` per event (batch `media` count by `inArray(eventIds)`). 404 if session absent.
   - `GET /dogs/:id/timeline`: **one** query for the dog's sessions `orderBy desc(startedAt)`, **one** query for all events of those session ids via `inArray(sessionIds)` `orderBy desc(occurredAt)`, then group in TS → `DogTimelineDTO` (sessions desc, events desc within). **This nested ordering is exactly why `select()` is required** (the relational builder can't express nested orderBy cleanly). 404 if dog absent.
   - `GET /events/:id`: event (404) + its `media[]` (`where eventId`) → `BehaviorEventWithMediaDTO`.
   - **NFR-7:** batch with `inArray` to avoid N+1; use existing composite indexes; **no new index**.

4. **Mutations:**
   - `PATCH /events/:id`: zod body of **ONLY** `{ note?: string | null, tags?: string[] | null }` — tap fields + `intervention` are NOT in the schema, so they are immutable (AC-4). `.set()` only the provided keys (partial); `.returning()` → `BehaviorEventDTO`. 404 if event absent.
   - `POST /events/:id/media`: validate event exists (404); zod body `{ key, contentType }` (`contentType` in allow-set); derive `blobUrl` from key + R2 account/bucket (`https://<account>.r2.cloudflarestorage.com/<bucket>/<key>` — G-7 private/key-only); insert `media { eventId, blobUrl, type: 'video' }`; return `201 MediaDTO`. **No R2 call here** (the device already uploaded).
   - `POST /dogs/:id/sessions` (G-2/OQ-7): validate dog exists (404); zod body `{ startedAt?: string, location?: string }`; insert `session { dogId, startedAt: startedAt ?? now, location: location ?? null }`; return `201 SessionSummaryDTO` (with `eventCount: 0`).

5. **Routing/validation (FR-A9/A10):** each new file is `export const <name> = new Hono()` (mirror `health.ts`/`sessions.ts`); mount in `app.ts` via `app.route('/', dogs)`, `app.route('/', events)`, `app.route('/', media)`. Reuse the existing `cors()`/`onError`/`notFound`. Validate every body/param with `@hono/zod-validator` + Zod, reusing `@tailsup/shared` arrays where applicable (`MEDIA_TYPES` for the media type; the content-type allow-set is a literal `['video/mp4','video/quicktime']` per G-6). ESM `.js` import specifiers throughout.

6. **Tests (mirror Phase 1 `vi.hoisted` + `vi.mock('../db/client.js')` + `app.request()`):**
   - Read endpoints: seed mock select-queues; assert shapes + 404s + reverse-chron ordering of the timeline.
   - `PATCH /events/:id`: assert tap fields are not settable (only note/tags reach `.set()`).
   - `POST /media/presign`: **mock the AWS SDK** OR assert the handler returns **503** when `getR2Config()` throws (the payoff of lazy config) — tests need no real R2 creds.
   - R2-config throw test: mirror `config.test.ts` (`vi.resetModules` + delete env var + expect throw of the exact var name).

**Tasks (execution order):**
1. **deps:** `npm i @aws-sdk/client-s3@<v> @aws-sdk/s3-request-presigner@<v> -w apps/api` (same `<v>`). **verify:** both at identical version in `apps/api/package.json`; `npm run typecheck -w apps/api` still resolves.
2. **reads + mutations + start-session** (`dogs.ts`, `events.ts`, extend `sessions.ts`, mount in `app.ts`) — these need **no R2**, so they are testable immediately. **verify:** vitest for the new read/mutate routes pass; `app.request('/dogs/<id>')` etc. return documented shapes.
3. **lazy R2 + presign + media persist** (`r2.ts`, `media.ts`, mount in `app.ts`). **verify:** presign test (mock SDK or 503-on-missing-config); media-persist test inserts a `video` row and `GET /events/:id` shows it.
4. **README Phase 2 section** (AC-13): seed graph, run API + mobile, set `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_TRAINER_ID`, the presign→PUT→persist curl flow, **the required R2 bucket CORS rule for web upload (G-8)**, and how to verify AC-3..AC-10.

**Acceptance (Unit B → AC):** **AC-3** (reads), **AC-4** (PATCH note/tags only), **AC-5** (presign usable + 503 on unconfigured + no media row), **AC-7** (media persisted), **AC-12** (no migration; no Phase 3/4 routes; `/health` + `POST /sessions/:id/events` unchanged), **AC-13** (run/test docs). Partial **AC-1** (api type-checks), **AC-6** (no file-receiving route on the API). Implements G-2/G-3/G-5/G-6/G-7.

---

## UNIT C — `apps/mobile` (three screens + dog list + fetch client + navigation)

**Owns (exclusive):**
- `apps/mobile/package.json` (add `expo-image-picker`, ensure `expo-file-system` present — via `npx expo install`)
- `apps/mobile/lib/api.ts` (new) — typed fetch client over `EXPO_PUBLIC_API_URL`
- `apps/mobile/app/_layout.tsx` (extend — register screens / titles; file-based routes auto-register, edit only for custom titles)
- `apps/mobile/app/dogs/index.tsx` (new) — dog list / entry point (FR-M6)
- `apps/mobile/app/dogs/[id]/timeline.tsx` (new) — dog timeline (FR-M5)
- `apps/mobile/app/sessions/[id]/log.tsx` (new) — 4-tap quick-log (FR-M1/M2)
- `apps/mobile/app/events/[id].tsx` (new) — post-session detail + video upload (FR-M3/M4)
- `apps/mobile/.env.example` (extend — add `EXPO_PUBLIC_TRAINER_ID`)
- (optional) `apps/mobile/app/index.tsx` — add a link to `dogs/index` so the dog list is reachable; **do not remove** the health screen.

**Hard requirements baked in (from the investigation — do not deviate):**

1. **Video pick + upload (`events/[id].tsx`) — the riskiest path:**
   - Pick with **`expo-image-picker`**: `launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 })`. **SDK 54 `mediaTypes` is a STRING ARRAY** (`['videos']`), NOT `MediaTypeOptions.Videos`. Returns `{ uri, mimeType, fileSize }`.
   - **Validate the picked `mimeType` against the allow-set (`video/mp4`/`video/quicktime`) before presigning**; soft-warn above 200 MB (G-6).
   - Upload via a **`Platform.OS` branch** (NEVER the deprecated legacy `uploadAsync`, which **throws at runtime in SDK 54**):
     - **native:** new `expo-file-system` File API — `new File(asset.uri).createUploadTask(uploadUrl, { httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT, headers: { 'Content-Type': contentType }, onProgress })` then `await task.uploadAsync()`. (Streams `file://` correctly → avoids the 0-byte bug; gives progress for FR-M4.)
     - **web:** `fetch(uploadUrl, { method: 'PUT', body: asset.file ?? blob, headers: { 'Content-Type': contentType } })`.
   - **The Content-Type sent on the PUT MUST equal the presign's ContentType** — thread the same value end-to-end: picker `mimeType` → `POST /media/presign` body → PUT header. Mismatch → 403.
   - After a 2xx upload: `POST /events/:id/media` with `{ key, contentType }`, then refetch `GET /events/:id` so the new media shows (FR-M4).
   - **Escape hatch (validate on first run):** if the new File API symbol surface misbehaves, fall back to `import * as FileSystem from 'expo-file-system/legacy'` with `uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, httpMethod: 'PUT'`. Low risk; both paths known.

2. **Typed fetch client (`lib/api.ts`, FR-M7/AC-11):**
   - A tiny typed `fetch` wrapper over `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'` (**static dot-access only** — Metro inlines `EXPO_PUBLIC_*` only via static dot-access; mirror `app/index.tsx:54`).
   - Functions returning `@tailsup/shared` DTOs (no `any` on responses): `getDogs(trainerId)`, `getDog(id)`, `getDogTimeline(id)`, `getSessionEvents(id)`, `getEvent(id)`, `patchEvent(id, body)`, `presign(body)`, `createMedia(eventId, body)`, `postEvent(sessionId, body)`, `startSession(dogId, body)`.
   - **No data-fetching library** (no TanStack Query) — `useState`/`useEffect`, mirror the Phase 1 `Status` discriminated-union pattern.

3. **4-tap quick-log (`sessions/[id]/log.tsx`, FR-M1/M2/NFR-1) — keep it FAST:**
   - Tap targets: `triggerType` (5 from `TRIGGER_TYPES`), `outcome` (3 from `OUTCOMES`), `intensity` (1–10), `thresholdMeters` (stepper/preset chips). **All four pre-defaulted** so an unchanged field needs no tap; one submit posts `POST /sessions/:id/events` **OMITTING `intervention`** (server defaults it).
   - On `201`: **immediate optimistic reset** for the next capture + lightweight confirmation. On failure: **retry without re-tapping** (do not lose in-progress selections — FR-M2). Surface `404` (unknown session) and `400` (no-protocol-default) with actionable messages; detect the no-default `400` and offer a one-time intervention entry (OQ-8) — do not bake a 5th tap into the common path.
   - No blocking dialogs / no scrolling between selecting fields and submit (NFR-1).

4. **Timeline (`dogs/[id]/timeline.tsx`, FR-M5/AC-10):** render `GET /dogs/:id/timeline` — sessions newest-first (header: `startedAt`/`location`), events newest-first under each, each row showing tap fields + `intervention` + note/tag/media indicators; tapping a row → `router.push('/events/'+id)`.

5. **Detail (`events/[id].tsx`, FR-M3/AC-9):** load `GET /events/:id`; edit `note` (multiline) + manage `tags` (add free-text / remove); persist via `PATCH /events/:id`; tap fields shown read-only; plus the video flow (#1). Show upload progress + success/failure.

6. **Dog list (`dogs/index.tsx`, FR-M6):** read `EXPO_PUBLIC_TRAINER_ID` (static dot-access); `GET /trainers/:trainerId/dogs`; route into a dog's timeline and into "start a session" (`POST /dogs/:id/sessions` → then navigate to `sessions/[id]/log`).

7. **Navigation (FR-M8):** Expo Router file-based routes; `useLocalSearchParams<{ id: string }>()`; `useRouter().push()` / `<Link>`. Must work on **Expo web** (Phase 1 verification target) and not be web-only.

**Tasks (execution order):**
1. **deps:** `npx expo install expo-image-picker` (+ confirm `expo-file-system`). **verify:** versions resolved by Expo for SDK ~54.0.35; `npm run typecheck -w apps/mobile` resolves the imports.
2. **`lib/api.ts`** typed client + extend `_layout.tsx` + `.env.example` (`EXPO_PUBLIC_TRAINER_ID`). **verify:** typecheck; functions typed against shared DTOs.
3. **dog list + timeline** screens. **verify:** typecheck; `expo export -p web` builds; web render shows seeded data.
4. **4-tap log + detail/upload** screens. **verify:** typecheck; web render; 4-tap submit posts (omitting intervention) and resets; detail edits note/tag + runs pick→presign→PUT→persist.

**Acceptance (Unit C → AC):** **AC-8** (4-tap logs an event in ≤4 taps + reset), **AC-9** (detail edits + full upload flow), **AC-10** (timeline grouped reverse-chron + row→detail nav), **AC-11** (typed client + static env access). Partial **AC-1** (mobile type-checks), **AC-6** (upload targets the R2 host, not the API). Implements G-1/G-4/G-6.

---

## Verification (overall — maps to AC-1..AC-13)

Run from repo root. Steps marked **(live-DB)** require a real Postgres + R2 (the demo path); the rest are static/unit gates.

```bash
# ── AC-1, AC-2: type-check ALL workspaces under strict ──────────────────────
npm install
npm run typecheck --workspaces --if-present      # 0 errors in shared, api, mobile

# AC-2 purity: shared imports no runtime/server modules
grep -REn "drizzle|from 'pg|aws|node:|require\(" packages/shared/src   # -> no matches

# ── AC-12: no migration, phase boundary respected ──────────────────────────
git status --porcelain apps/api/drizzle           # -> empty (no new migration)
grep -REn "leads|bookings|/summary|betterAuth|auth\(" apps/api/src/routes  # -> no Phase 3/4 routes
#   confirm app.ts still mounts health + sessions (+ new dogs/events/media only)

# ── api unit tests (vitest) — no R2 creds needed thanks to lazy config ──────
npm run test -w apps/api                          # all pass incl. new dogs/events/media/r2-config tests

# ── (live-DB) demo path: docker postgres + migrate + seed + curl ───────────
docker run -d --name tailsup-pg -e POSTGRES_PASSWORD=pg -p 5432:5432 postgres:16
export DATABASE_URL=postgres://postgres:pg@localhost:5432/postgres
npm run db:migrate -w apps/api                    # existing Phase 1 migration applies; NO new migration
#   seed: trainer -> client -> dog (WITH protocol+defaultIntervention, OQ-8) -> session
#         (use a seed script or documented psql inserts; capture TRAINER_ID, DOG_ID, SESSION_ID)
npm run dev -w apps/api &                          # PORT 3000

# AC-3 reads
curl -s localhost:3000/trainers/$TRAINER_ID/dogs            # 200 DogSummaryDTO[]
curl -s localhost:3000/dogs/$DOG_ID                         # 200 DogDetailDTO (+sessions[].eventCount)
curl -s localhost:3000/dogs/$DOG_ID/timeline                # 200 DogTimelineDTO (reverse-chron)
curl -s localhost:3000/sessions/$SESSION_ID/events          # 200 [] chronological
curl -s localhost:3000/dogs/00000000-0000-0000-0000-000000000000   # 404

# AC-8-equivalent at the API: log an event WITHOUT intervention (server defaults it)
EVENT=$(curl -s -X POST localhost:3000/sessions/$SESSION_ID/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"dog","thresholdMeters":5,"intensity":7,"outcome":"recovered_slowly"}')   # 201
EVENT_ID=$(echo "$EVENT" | jq -r .id)

# AC-4 PATCH note/tags only
curl -s -X PATCH localhost:3000/events/$EVENT_ID -H 'Content-Type: application/json' \
  -d '{"note":"near the gate","tags":["reactive","leash"]}'   # 200, note+tags persisted; tap fields unchanged

# AC-5 presign (needs R2 env set; else 503)
curl -s -X POST localhost:3000/media/presign -H 'Content-Type: application/json' \
  -d "{\"eventId\":\"$EVENT_ID\",\"contentType\":\"video/mp4\"}"   # 200 PresignResponse (PUT url for R2_BUCKET)
curl -s -X POST localhost:3000/media/presign -H 'Content-Type: application/json' \
  -d "{\"eventId\":\"$EVENT_ID\",\"contentType\":\"image/png\"}"   # 400 disallowed type
#   with R2 env UNSET -> 503 (lazy-config fail-fast, no fabricated URL)

# AC-6 + AC-7 direct upload + persist (uploadUrl host == R2, NOT the API host)
curl -s -X PUT "$UPLOAD_URL" -H 'Content-Type: video/mp4' --data-binary @clip.mp4   # 200 from R2
curl -s -X POST localhost:3000/events/$EVENT_ID/media -H 'Content-Type: application/json' \
  -d "{\"key\":\"$KEY\",\"contentType\":\"video/mp4\"}"            # 201 MediaDTO
curl -s localhost:3000/events/$EVENT_ID                           # media[] now includes the video

# ── AC-8/9/10: Expo web render ─────────────────────────────────────────────
npm run web -w apps/mobile          # dog list -> start session -> 4-tap log (resets); timeline; detail edit+upload
#   (G-8) web upload requires the R2 bucket CORS rule allowing PUT from http://localhost:8081;
#         else verify the picker/upload on a native simulator.
expo export -p web                  # (in apps/mobile) web bundle builds clean
```

**Success criteria (measurable):**
- `npm run typecheck --workspaces` → 0 errors (AC-1).
- All 12 FR-A11 DTOs exported + shared stays pure (AC-2).
- All 9 endpoints return the documented shapes + status codes (AC-3..AC-7).
- No new file under `apps/api/drizzle/`; `/health` + `POST /sessions/:id/events` unchanged; no Phase 3/4 routes (AC-12).
- Expo web exercises all three screens incl. the upload flow (AC-8..AC-10).
- README documents seed + run + env + presign/upload + R2 CORS + verification (AC-13).

---

## Risk table

| ID | Risk | Likelihood / Impact | Mitigation (baked into the plan) |
| --- | --- | --- | --- |
| **R-1** | **AWS SDK CRC32 checksum** — SDK ≥3.729 auto-adds `x-amz-checksum-crc32`; **R2 rejects the PUT** (`NotImplemented`/`SignatureDoesNotMatch`). | High if missed / High | **Mandatory** `requestChecksumCalculation:'WHEN_REQUIRED'` + `responseChecksumValidation:'WHEN_REQUIRED'` on the `S3Client` (Unit B, req #1). Also pin both AWS pkgs to the **same** version (mismatch breaks `getSignedUrl`). |
| **R-2** | **Expo upload native-vs-web 0-byte bug** — `fetch` PUT of a `file://`-derived Blob on native yields 0-byte/large-video failures; legacy `uploadAsync` throws at runtime in SDK 54. | Med-High on native / High | **`Platform.OS` branch:** native = new `expo-file-system` File API `createUploadTask` (`BINARY_CONTENT`, PUT, onProgress); web = `fetch` PUT. Never legacy `uploadAsync`. `/legacy` escape hatch documented (Unit C, req #1). |
| **R-3** | **R2 bucket CORS for web uploads** — browser PUT to R2 is cross-origin; without a bucket CORS rule the web upload fails (AC-9-on-web). | Med / Med (web only) | Document the required R2 bucket CORS rule (allow PUT + `Content-Type` from `http://localhost:8081`) in the README as an AC-9-on-web prerequisite (G-8). Native uploads unaffected — verify on simulator if CORS not set. |
| **R-4** | **Lazy-config correctness** — adding R2 vars eagerly to `config.ts` would break API boot + the whole vitest suite for read-endpoint tests (which need no R2). | Med / High (DX/CI) | R2 vars read **only** via `getR2Config()` at call time in `r2.ts`/`media.ts`; **never** in `config.ts`. Presign handler maps the throw → 503. Tests assert 503-on-missing-config without real creds (Unit B, req #2 + tests). |
| **R-5** | **4-tap screen too slow** — extra taps/dialogs/round-trips break the "4 taps" promise (NFR-1). | Med / Med | All four fields pre-defaulted (unchanged = no tap); single submit omitting `intervention`; optimistic reset on 201; retry-without-retap on failure; no blocking dialogs/scroll between fields and submit (Unit C, req #3). |
| **R-6** | **ContentType mismatch** between presign and PUT → 403. | Med / Med | Thread one value end-to-end (picker mimeType → presign body → PUT header); presign signs `ContentType` and returns it in `headers`; client echoes it (Unit B req #1, Unit C req #1). |
| **R-7** | **`relations()` / migration creep** — reaching for `db.query` would need schema `relations()` and still can't do nested timeline ordering. | Low / Med | Plain `select()` + `inArray` batching everywhere; **no `relations()`, no migration** (Unit B, req #3). `git status apps/api/drizzle` empty (AC-12 verify). |
| **R-8** | **Shared package impurity** — an AWS/server import leaking into `@tailsup/shared` breaks Metro. | Low / High | Unit A is types-only; AWS SDK lives only in `apps/api`; grep-purity check in AC-2 verify (Unit A verify). |
| **R-9** | **G-7 flips (video playback wanted)** — if the detail screen must play the video, `blobUrl` must be publicly fetchable. | Decision-gated / Med | Surfaced at the design gate (G-7). If approved-to-flip: add `R2_PUBLIC_BASE_URL` env var + store `${R2_PUBLIC_BASE_URL}/<key>`, OR add `GET /media/:id/url` presigned-GET (Unit B), and a `<Video>` player (Unit C). Default plan stores key-only. |

---

## Output (SUMMARY.md spec for the executor)

On completion, the executing agent writes a summary covering: the exact files created/modified per unit; the AWS SDK + expo-image-picker versions actually installed; confirmation that `git status apps/api/drizzle` is empty (no migration); the typecheck/vitest/expo-export results; the live-DB demo transcript (curl outputs for AC-3..AC-7); whether web upload was demonstrated (G-8) or deferred to a simulator; and any deviations (per the 5 deviation rules) with rule + rationale. Map each AC-1..AC-13 to its evidence.

---

_Refined spec: `docs/reference/refined-request-phase2.md` · Investigation: `docs/reference/investigation-phase2.md` · Codebase scan: `docs/reference/codebase-scan-phase2.md` · Phase 1 design: `docs/design/project-design.md` · Functional ledger: `docs/design/project-functions.md`._
