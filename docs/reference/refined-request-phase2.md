# Refined Request: TailsUp — Phase 2: Trainer View

## Category
Development

## Objective
Build **Phase 2 — Trainer View** of TailsUp: the trainer-facing mobile experience for capturing and reviewing structured behavior data, plus the supporting read/media API the screens require. Concretely, deliver three Expo Router mobile screens — a **4-tap quick-logging screen** (fast in-session capture that writes a `BehaviorEvent`), a **post-session detail screen** (edit/add `note`, manage `tags`, and upload a video for an event via R2 presigned **direct** upload), and a **dog timeline** (chronological longitudinal view of a dog's sessions and their events) — together with the new API endpoints those screens depend on: `POST /media/presign` (presigned R2 upload URL) plus a media-record persistence path, and the **read endpoints** that do not yet exist (list a trainer's dogs, get a dog with its sessions, get a session's events, get a dog's timeline, plus the event mutation needed by the detail screen). New DTOs are added to `@tailsup/shared`. **The decided architecture is fixed and must not be re-opened.** Phase 3 (auth/roles, public site, client view, leads/bookings) and Phase 4 (AI summary) are out of scope; Phase 2 endpoints remain unauthenticated.

## Phase 1 ground truth (what already exists — do not rebuild)
This refinement is grounded in the actual committed Phase 1 codebase, not just the design docs. The real layout differs from the Phase 1 design doc in a few names; use the **real** paths below.

- **API app:** `apps/api/src/app.ts` builds the Hono app, applies `cors()` (currently allow-all), mounts routes via `app.route('/', ...)`, and installs a JSON `onError` + `notFound`. Entry/serve is `apps/api/src/index.ts` (Node, `process.env.PORT` default 3000).
- **Existing routes:** `apps/api/src/routes/health.ts` (exports `health`) and `apps/api/src/routes/sessions.ts` (exports a Hono instance `sessions`, currently holding only `POST /sessions/:id/events`).
- **DB client:** `apps/api/src/db/client.ts` exports `db` (Drizzle + `pg` Pool, `casing: 'snake_case'`) and `pool`.
- **Schema:** `apps/api/src/db/schema.ts` defines **11** singular tables and 6 pgEnums. Relevant exports: `trainer`, `client`, `dog`, `protocol`, `session`, `behaviorEvent`, `media`, plus `mediaTypeEnum` (`media_type`: `video`|`image`). The `media` table already exists: `id`, `eventId` (FK → `behavior_event`), `blobUrl` (text, R2 URL only), `type` (`media_type` enum), `uploadedAt` (timestamptz, `defaultNow()`). The `behavior_event` row already carries `note` (text, nullable) and `tags` (`jsonb $type<string[]>()`, nullable, GIN-indexed). `intervention` is `NOT NULL` (the moat).
- **Config:** `apps/api/src/config.ts` reads env through a `required()` helper that **throws** on any missing required var (no fallbacks); `PORT` is the only optional var. Phase 2 must add R2 config to this module the same way (throw-on-missing) — only when the presign endpoint actually consumes it.
- **Env template (`.env.example`):** R2 vars already present and reserved for "media presign in Phase 2": `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (media bucket `tailsup-media`). Endpoint host pattern documented: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. No new secret names should be required unless a public object base URL is needed (see open questions).
- **Shared package:** `packages/shared/src/enums.ts` (6 const arrays + union types, incl. `MEDIA_TYPES`/`MediaType`), `packages/shared/src/dtos.ts` (`CreateBehaviorEventInput`, `BehaviorEventDTO`, `HealthDTO`), barrel `packages/shared/src/index.ts`. **Pure TS only — zero server/runtime imports** (Metro-safe). New Phase 2 DTOs go here. NOTE: the file is `dtos.ts` (plural), not `dto.ts`.
- **Mobile:** `apps/mobile` is Expo Router SDK ~54, currently a single screen `app/index.tsx` (the `/health` check) and `app/_layout.tsx` (Stack wrapped in `SafeAreaProvider`). Reads `process.env.EXPO_PUBLIC_API_URL` via static dot-access (default `http://localhost:3000`). Current deps include `expo-router`, `expo-constants`, `expo-linking`, `expo-status-bar`, `react-native-safe-area-context`, `react-native-screens`, `react-native-web`. **No video/file picker, no data-fetching layer, no navigation beyond one route** exist yet — Phase 2 adds these.
- **Existing write endpoint contract (reuse as-is):** `POST /sessions/:id/events` accepts `{ triggerType, thresholdMeters, intensity (1..10), outcome, intervention?, note?, tags? }`, resolves `intervention` from Session→Dog→Protocol when omitted (400 if no protocol default), returns `201` + `BehaviorEventDTO`, `404` on unknown session. The 4-tap screen consumes this verbatim.

## Scope

### In scope (Phase 2 — the deliverable being built now)

**Mobile (trainer-facing Expo Router screens):**
1. **4-tap quick-logging screen** — fast in-session capture that writes a `BehaviorEvent` via the existing `POST /sessions/:id/events`, using tap targets (buttons/segmented controls) for the three enum/numeric "tap" fields (`triggerType`, `intensity` 1–10, `outcome`) plus `thresholdMeters`. `intervention` is left to the server default (from the dog's protocol) so the path stays genuinely 4-tap. Must remain fast (the "4 taps" promise).
2. **Post-session detail screen** — for a chosen `BehaviorEvent`: add/edit `note`, manage `tags` (add/remove string tags), and **upload a video** for the event via the R2 presigned-URL flow (request a presigned URL from the API, upload the file **directly to R2 from the device**, then persist a `Media` record). Never stream the file through the API.
3. **Dog timeline** — a chronological longitudinal view of a dog's sessions and their `BehaviorEvent`s.
4. **Mobile data + media plumbing** — a typed API client wrapper over `EXPO_PUBLIC_API_URL`, navigation between the three screens, and a video-picker integration (Expo) feeding the presign→upload→persist flow.

**API (supporting endpoints the screens require):**
5. **`POST /media/presign`** — returns a presigned R2 PUT URL (+ the final object key/URL) for a given `eventId` + `contentType`. R2 credentials read via the throw-on-missing config module; uses the existing `R2_BUCKET` (media bucket) and `R2_ACCOUNT_ID` endpoint.
6. **Media record persistence** — a path to persist a `media` row after the direct upload completes (see decision in Requirements: a follow-up `POST /events/:id/media` records it; presign does **not** create the row).
7. **Read endpoints** (none exist yet) — exactly the reads the three screens need: list a trainer's dogs, get a dog (with its sessions), list a session's events, get a dog's timeline (events across sessions), and get a single event with its media. Defined with explicit request/response shapes below.
8. **Event mutation for the detail screen** — `PATCH /events/:id` to persist `note` and `tags` edits.
9. **Shared DTOs** — add the Phase 2 request/response types to `@tailsup/shared`, reusing existing enums.

### Out of scope (deferred — NOT built in Phase 2)
- **Authentication / authorization (BetterAuth, `trainer`/`client` roles).** Deferred to Phase 3. **All Phase 2 endpoints remain unauthenticated.** How the app picks the "current trainer" and its dogs without auth is an **open question with a recommended default** (see Open Questions OQ-1).
- **Public website** (Home, About, Services, Results, Contact, Booking) and the Phase 3 Design System application.
- **Client view / client dashboard** (threshold-over-time graph, homework, reminders).
- **Lead / booking endpoints** (`POST /leads`, `POST /bookings`, `PATCH /bookings/:id/status`, `POST /leads/:id/convert`).
- **AI summary** (`POST /dogs/:id/summary`, claude-haiku-4-5) — Phase 4.
- **Creating trainers/clients/dogs/protocols/sessions through the UI.** Phase 2 reads and logs against **seeded** entities; CRUD for the org graph is not required. Creating a `Session` (the container the 4-tap screen logs into) is a borderline case — see OQ-7 (recommended: a minimal `POST /dogs/:id/sessions` to start a session, since you cannot log events without a session).
- **Offline logging / write queue.** The architecture must not preclude it (UUID PKs already enable client-minted ids), but no offline implementation is required now.
- **Editing the four "tap" fields after creation, deleting events/media, image (non-video) capture.** Video upload only for Phase 2; `media.type` supports `image` in schema but the UI ships video. (Image upload may be a trivial extension but is not a Phase 2 requirement.)
- **Production deploy to Railway.** Acceptance is local-run + tests, consistent with Phase 1.

## Requirements

### Functional requirements — Mobile

**FR-M1 — 4-tap quick-logging screen.** A screen (e.g. `app/sessions/[id]/log.tsx`) renders tap targets for: `triggerType` (5 options from `TRIGGER_TYPES`), `outcome` (3 options from `OUTCOMES`), `intensity` (1–10), and `thresholdMeters` (numeric, fast entry — stepper/preset chips acceptable). A single primary action submits `POST /sessions/:id/events` with those four fields and **omits `intervention`** (server defaults it). On success the screen resets immediately for the next capture (in-session rapid logging) and shows lightweight confirmation. The submit path must require **no more than 4 deliberate taps** in the common case (one per field selection) plus the submit, with sensible defaults pre-selected so an unchanged field needs no tap.

**FR-M2 — Quick-log resilience.** Submission shows a clear pending/success/error state and does not lose the trainer's in-progress selections on a failed request (retry without re-tapping). A `404` (unknown session) and a `400` (no protocol default + `intervention` omitted) are surfaced with actionable messages. (The 400-no-default case is possible because the 4-tap screen omits `intervention`; see OQ-8 for how the screen avoids/handles it.)

**FR-M3 — Post-session detail screen.** A screen (e.g. `app/events/[id].tsx`) loads a single `BehaviorEvent` (with its existing `note`, `tags`, and any `media`), lets the trainer edit `note` (multiline text) and manage `tags` (add free-text tag, remove tag), and persists changes via `PATCH /events/:id`. The four tap fields are shown read-only.

**FR-M4 — Video upload (direct-to-R2).** From the detail screen, the trainer picks a video from the device. The app then: (1) calls `POST /media/presign` with `{ eventId, contentType }` to get a presigned PUT URL + object key; (2) uploads the file bytes **directly to R2** via an HTTP `PUT` to the presigned URL (never through the API); (3) on a successful upload, calls `POST /events/:id/media` to persist the `media` row (`{ key, contentType }` → row with `blobUrl`, `type='video'`). Upload progress/spinner and success/failure states are shown. The uploaded video appears in the event's media list after persistence.

**FR-M5 — Dog timeline.** A screen (e.g. `app/dogs/[id]/timeline.tsx`) shows a dog's `BehaviorEvent`s in **reverse-chronological** order, grouped by session (each session header shows `startedAt`/`location`; events list under it). Each event row shows the tap fields (`triggerType`, `intensity`, `outcome`, `thresholdMeters`), `intervention`, a note indicator, tag chips, and a media indicator. Tapping an event row navigates to the detail screen (FR-M3). (Grouping vs flat ordering is OQ-4; default = grouped by session, reverse-chronological.)

**FR-M6 — Dog list / entry point.** A screen lists the current trainer's dogs (`GET /trainers/:trainerId/dogs`) and routes into a dog (timeline) and into starting/continuing a session for quick-logging. The "current trainer" is resolved per OQ-1 (recommended default: `EXPO_PUBLIC_TRAINER_ID` seeded id).

**FR-M7 — Typed API client.** A small mobile API module wraps `EXPO_PUBLIC_API_URL` (static dot-access, per the Phase 1 Metro rule) and types every request/response with the new `@tailsup/shared` DTOs. No hard-coded base URL beyond the documented dev default.

**FR-M8 — Navigation.** Expo Router navigation connects: dog list → dog timeline → event detail, and dog list/session → quick-log. Works on Expo **web** (the Phase 1 verification target) and is not architecturally web-only.

### Functional requirements — API

**FR-A1 — `POST /media/presign`.** Body `{ eventId: string, contentType: string }`. Validates `eventId` is a known `behavior_event` (404 if not) and `contentType` is in the allowed set (OQ-6; recommended `video/mp4`, `video/quicktime`). Generates a unique object **key** (recommended `events/{eventId}/{uuid}.{ext}`), produces a presigned **PUT** URL against the R2 S3 endpoint for `R2_BUCKET` with an expiry (OQ-5; recommended 600s), and returns `{ uploadUrl, key, expiresInSeconds }` plus the `method` and any required `headers` (e.g. `Content-Type`) the client must echo on the PUT. **Does not** create a `media` row (decision below). R2 credentials are read via the throw-on-missing config module; the endpoint returns 5xx if R2 is unconfigured rather than silently degrading.

**FR-A2 — Media persistence flow (decided).** The presign endpoint **does not** persist the `media` row; a separate **`POST /events/:id/media`** records it after the client confirms the direct upload succeeded. Body `{ key: string, contentType: string }` (or `{ key, type }`). The server derives `blobUrl` from the key, sets `type` from the content type (or explicit `type`), inserts a `media` row (`eventId` from the path), and returns the created `MediaDTO`. Rationale: keeps the moat/data clean (no orphan media rows for uploads that never completed) and avoids the API needing R2 callbacks/webhooks; the device is the only party that knows the upload succeeded. (Trade-off and alternative captured in Assumptions/OQ-2.)

**FR-A3 — `GET /trainers/:trainerId/dogs`.** Returns the dogs belonging to the trainer (joined Dog→Client→Trainer). Response: `DogSummaryDTO[]` (`id`, `name`, `breed`, `ageMonths`, `clientId`, `protocolId | null`). Unknown trainer → empty array (or 404 — see OQ-1; recommended empty array for an unauthenticated read).

**FR-A4 — `GET /dogs/:id`.** Returns a single dog with its sessions (no events). Response: `DogDetailDTO` = `DogSummaryDTO` + `sessions: SessionSummaryDTO[]` (each `id`, `startedAt`, `location | null`, `eventCount`). 404 if the dog does not exist.

**FR-A5 — `GET /sessions/:id/events`.** Returns the events for a session in chronological order. Response: `BehaviorEventDTO[]` (existing DTO, with media counts/ids — see FR-A8 for whether media embeds). 404 if the session does not exist.

**FR-A6 — `GET /dogs/:id/timeline`.** Returns the dog's events across all its sessions for the timeline screen, ordered reverse-chronological, grouped by session. Response: `DogTimelineDTO` = `{ dog: DogSummaryDTO, sessions: TimelineSessionDTO[] }` where each `TimelineSessionDTO` = `{ id, startedAt, location | null, events: BehaviorEventDTO[] }` (events reverse-chronological within session; sessions reverse-chronological by `startedAt`). 404 if the dog does not exist. (Shape supports OQ-4's grouped default; a flat list is a client-side flatten.)

**FR-A7 — `PATCH /events/:id`.** Updates the mutable fields of a `BehaviorEvent`: `note` (string | null) and `tags` (string[] | null) only. The four tap fields and `intervention` are **immutable** via this endpoint (protects the moat). Body `{ note?: string | null, tags?: string[] | null }`; partial — only provided keys change. Returns the updated `BehaviorEventDTO`. 404 if the event does not exist.

**FR-A8 — `GET /events/:id`.** Returns a single event with its media. Response: `BehaviorEventWithMediaDTO` = `BehaviorEventDTO` + `media: MediaDTO[]`. 404 if the event does not exist. (Whether list endpoints embed media or just a count is OQ-3; recommended: list endpoints return `mediaCount: number`, the single-event endpoint returns the full `media` array.)

**FR-A9 — Routing/registration.** New routes are mounted in `apps/api/src/app.ts` alongside the existing two, following the established pattern (Hono sub-apps exported from `apps/api/src/routes/*`, `app.route('/', ...)`). The existing `cors()`, `onError`, and `notFound` behavior is reused. Suggested route modules: extend `routes/sessions.ts` (add `GET /sessions/:id/events`), add `routes/dogs.ts`, `routes/events.ts`, `routes/media.ts`, `routes/trainers.ts` (exact split is an implementation choice; keep file ownership disjoint if parallelized).

**FR-A10 — Validation.** All new request bodies/params are validated with `@hono/zod-validator` + Zod (the Phase 1 pattern), reusing `@tailsup/shared` arrays where applicable (e.g. `MEDIA_TYPES`). Invalid input → `400` with the standard error body; unknown ids → `404` `{ error: '...' }`, consistent with the existing endpoints.

**FR-A11 — Shared DTOs.** Add to `packages/shared/src/dtos.ts` (pure TS, no runtime imports), re-exported via the barrel:
- `DogSummaryDTO`, `DogDetailDTO`, `SessionSummaryDTO`
- `DogTimelineDTO`, `TimelineSessionDTO`
- `BehaviorEventWithMediaDTO`
- `MediaDTO`
- `PresignRequest`, `PresignResponse`
- `CreateMediaInput` (body for `POST /events/:id/media`)
- `UpdateBehaviorEventInput` (body for `PATCH /events/:id`)
Existing DTOs (`BehaviorEventDTO`, `CreateBehaviorEventInput`, `HealthDTO`) are reused unchanged.

### Proposed API contracts (request/response shapes)

> All JSON, base URL `EXPO_PUBLIC_API_URL` (dev `http://localhost:3000`). Timestamps are ISO strings. Shapes below are the contract; field-for-field they map to the existing schema. Status codes: `200` reads, `201` creates, `400` validation, `404` unknown id, `5xx` R2/internal.

```jsonc
// GET /trainers/:trainerId/dogs   -> 200 DogSummaryDTO[]
{
  "id": "uuid", "name": "Rex", "breed": "GSD", "ageMonths": 30,
  "clientId": "uuid", "protocolId": "uuid|null"
}

// GET /dogs/:id   -> 200 DogDetailDTO
{
  "id": "uuid", "name": "Rex", "breed": "GSD", "ageMonths": 30,
  "clientId": "uuid", "protocolId": "uuid|null",
  "sessions": [
    { "id": "uuid", "startedAt": "ISO", "location": "park|null", "eventCount": 7 }
  ]
}

// GET /sessions/:id/events   -> 200 BehaviorEventDTO[] (+ mediaCount per OQ-3)
// (BehaviorEventDTO is the existing Phase 1 shape; mediaCount appended)

// GET /dogs/:id/timeline   -> 200 DogTimelineDTO
{
  "dog": { /* DogSummaryDTO */ },
  "sessions": [
    {
      "id": "uuid", "startedAt": "ISO", "location": "park|null",
      "events": [ /* BehaviorEventDTO[] reverse-chronological */ ]
    }
  ]
}

// GET /events/:id   -> 200 BehaviorEventWithMediaDTO
{
  "id": "uuid", "sessionId": "uuid", "occurredAt": "ISO",
  "triggerType": "dog", "thresholdMeters": 5, "intensity": 7,
  "outcome": "recovered_slowly", "intervention": "u-turn",
  "note": "string|null", "tags": ["..."]|null,
  "media": [ { "id": "uuid", "eventId": "uuid", "blobUrl": "https://...",
              "type": "video", "uploadedAt": "ISO" } ]
}

// PATCH /events/:id   body UpdateBehaviorEventInput   -> 200 BehaviorEventDTO
{ "note": "near the gate", "tags": ["reactive","leash"] }   // partial; tap fields immutable

// POST /media/presign   body PresignRequest   -> 200 PresignResponse
// request:
{ "eventId": "uuid", "contentType": "video/mp4" }
// response:
{
  "uploadUrl": "https://<acct>.r2.cloudflarestorage.com/<bucket>/events/<eventId>/<uuid>.mp4?X-Amz-...",
  "method": "PUT",
  "headers": { "Content-Type": "video/mp4" },
  "key": "events/<eventId>/<uuid>.mp4",
  "expiresInSeconds": 600
}

// POST /events/:id/media   body CreateMediaInput   -> 201 MediaDTO
// request:
{ "key": "events/<eventId>/<uuid>.mp4", "contentType": "video/mp4" }
// response:
{ "id": "uuid", "eventId": "uuid", "blobUrl": "https://...", "type": "video", "uploadedAt": "ISO" }
```

### Non-functional requirements

**NFR-1 — Keep the 4-tap promise.** The quick-log capture stays minimal: tap fields default to sensible values, `intervention` is server-defaulted (never asked in-session), and a logged event takes ≤ 4 deliberate taps plus submit in the common case. No blocking dialogs, network round-trips, or scrolling between selecting fields and submitting.

**NFR-2 — Direct-to-R2 upload (no egress through API).** Video bytes are uploaded by the device straight to R2 via the presigned URL. The API never receives or proxies the file (avoids Railway egress/cost and matches the decided architecture). The API only issues the presign and records the resulting `blobUrl`.

**NFR-3 — TypeScript strict everywhere.** All new code type-checks under `strict: true` with zero errors across `@tailsup/shared`, `apps/api`, `apps/mobile`. New DTOs are the single source of truth shared by both ends (FR-9 carryover).

**NFR-4 — No config fallbacks.** R2 credentials are read through the existing throw-on-missing `config.ts` pattern; the presign endpoint fails fast / returns an explicit 5xx when R2 is unconfigured, never a silent default or a fake URL. (`PORT` remains the only intentionally-optional var.)

**NFR-5 — Shared package stays pure.** `@tailsup/shared` gains only types/const arrays — **no** `drizzle-orm`, `pg`, AWS SDK, or Node built-ins (Metro-safe). The AWS/S3 presign SDK lives only in `apps/api`.

**NFR-6 — Consistency with Phase 1 conventions.** Singular table names; camelCase TS → snake_case columns; Zod validation reusing shared arrays; ESM `.js` import specifiers in `apps/api`; static `EXPO_PUBLIC_*` dot-access in mobile; JSON error bodies `{ error: '...' }`; reverse-chronological reads use the existing composite indexes (`session(dog_id, started_at)`, `behavior_event(session_id, occurred_at)`).

**NFR-7 — Read performance / indexing.** Timeline and list reads use the existing indexes; avoid N+1 by batching event/media lookups (single grouped query or a small fixed number of queries per screen load). No new indexes are required for Phase 2 (existing composite indexes cover the access paths); add one only if a query plan proves it necessary.

**NFR-8 — Offline-capable later (no regression).** The mobile write path must not architecturally preclude future offline queueing (UUID PKs already allow client-minted event ids). No offline implementation required now.

## Constraints

### Architecture — DECIDED and NON-NEGOTIABLE (do not re-open)
- **App + Site = ONE Expo Router codebase** (iOS/Android/web). Phase 2 screens are Expo Router routes; no separate framework.
- **API = Hono + TypeScript** on Railway (scale-to-zero); accessed via the existing Hono app composition.
- **Database = PostgreSQL via Drizzle ORM**; the 11-table schema already exists. Phase 2 adds **no schema changes** (the `media`, `behavior_event.note`, and `behavior_event.tags` columns already exist) unless a genuine gap is found — if one is, it requires a new Drizzle migration committed under `apps/api/drizzle/`.
- **Media = Cloudflare R2** with **presigned URLs**; the device uploads **directly to R2, never through the API**.
- **Auth = BetterAuth (deferred to Phase 3)** — Phase 2 endpoints are unauthenticated; do not add auth middleware now.
- **AI / Email** — not touched in Phase 2.

### Process / convention constraints
- Build proceeds **phase by phase**; this is **Phase 2 only** — do not implement Phase 3/4 features (no auth, no public site, no client view, no leads/bookings, no AI summary).
- **No schema migration** unless a real gap is found; reuse existing tables/columns.
- TypeScript strict; shared enums/DTOs in `packages/shared`, imported by both ends.
- Secrets only in `.env`; the R2 vars already exist in `.env.example`. Add an env var only if a new one is genuinely needed (e.g. a public object base URL — see OQ-9) and document it in `.env.example`.
- Reuse the existing R2 vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (media bucket, distinct from the backups bucket `R2_BACKUP_BUCKET`).
- Provide exact run/test commands for the new screens and endpoints before declaring Phase 2 done.

## Acceptance Criteria (Phase 2 — concrete, verifier-checkable)

**AC-1 — Type check passes.** `npm run typecheck --workspaces --if-present` (or per-workspace `tsc --noEmit`) passes with zero errors in `@tailsup/shared`, `apps/api`, and `apps/mobile` under `strict: true`, including all new DTOs and screens.

**AC-2 — Shared DTOs present and pure.** `packages/shared` exports `DogSummaryDTO`, `DogDetailDTO`, `SessionSummaryDTO`, `DogTimelineDTO`, `TimelineSessionDTO`, `BehaviorEventWithMediaDTO`, `MediaDTO`, `PresignRequest`, `PresignResponse`, `CreateMediaInput`, and `UpdateBehaviorEventInput` from its barrel. `packages/shared` imports **no** runtime/server modules (grep finds no `drizzle`, `pg`, `aws`, `node:` imports).

**AC-3 — Read endpoints exist and return the documented shapes.** With seeded data and the API running:
- `GET /trainers/:trainerId/dogs` returns `200` and an array of the trainer's dogs.
- `GET /dogs/:id` returns `200` with the dog and its `sessions[]` (each with `eventCount`); unknown id → `404`.
- `GET /sessions/:id/events` returns `200` chronological events; unknown id → `404`.
- `GET /dogs/:id/timeline` returns `200` with `sessions[]` grouped, sessions and events reverse-chronological; unknown id → `404`.
- `GET /events/:id` returns `200` with the event and its `media[]`; unknown id → `404`.

**AC-4 — `PATCH /events/:id` updates only note/tags.** Patching `note`/`tags` returns `200` with the updated `BehaviorEventDTO` and persists the change. Attempting to change a tap field or `intervention` via this endpoint has no effect on those columns (they are not in the accepted body / are rejected). Unknown id → `404`.

**AC-5 — `POST /media/presign` returns a usable presigned PUT.** For a known `eventId` and an allowed `contentType`, returns `200` with `uploadUrl` (an R2 S3 PUT URL for `R2_BUCKET`), `key`, `method: "PUT"`, the required `headers`, and `expiresInSeconds`. Unknown `eventId` → `404`. Disallowed `contentType` → `400`. With R2 env unset, the endpoint fails fast (5xx / startup throw) rather than returning a fabricated URL. **No `media` row is created by this call.**

**AC-6 — Direct-to-R2 upload works end to end (no API egress).** A real video uploaded via `PUT` to the presigned `uploadUrl` succeeds (R2 stores the object), and the bytes do **not** transit the API (verifiable: the API has no file-receiving route; the upload target host is the R2 endpoint, not the API host).

**AC-7 — Media record persisted after upload.** After a successful direct upload, `POST /events/:id/media` with the returned `key` + `contentType` returns `201` `MediaDTO`, inserts a `media` row (`type='video'`, `blobUrl` derived from the key), and the new media then appears in `GET /events/:id`'s `media[]`.

**AC-8 — 4-tap quick-log screen logs an event.** On Expo web, the quick-log screen renders tap targets for `triggerType`, `intensity` (1–10), `outcome`, and `thresholdMeters`, and a single submit posts to `POST /sessions/:id/events` **without** sending `intervention`. A successful submit yields a `201`, the screen resets for the next capture, and the event is retrievable via `GET /sessions/:id/events`. The common-case capture is achievable in ≤ 4 deliberate field taps + submit.

**AC-9 — Detail screen edits and uploads.** On Expo web, the detail screen loads an event (note/tags/media), edits note and adds/removes a tag (persisted via `PATCH /events/:id`), and runs the full video flow (pick → presign → direct PUT → `POST /events/:id/media`) with visible progress and a success state; the uploaded video then shows in the event's media.

**AC-10 — Dog timeline renders grouped, reverse-chronological.** On Expo web, the timeline screen for a dog shows its sessions newest-first with their events newest-first under each session header, each event row showing the tap fields + intervention + note/tag/media indicators, and tapping a row navigates to the detail screen.

**AC-11 — Typed mobile API client.** The mobile API calls are typed with the `@tailsup/shared` DTOs (no `any` on responses), and the base URL comes from `process.env.EXPO_PUBLIC_API_URL` via static dot-access (Metro-inlined).

**AC-12 — No schema migration / phase boundary respected.** No new Drizzle migration is added unless a genuine gap was found and documented; the `media`/`note`/`tags` columns are reused. No Phase 3/4 features are implemented: no auth middleware, no public-site routes, no client dashboard, no lead/booking endpoints, no `POST /dogs/:id/summary`. Existing endpoints (`GET /health`, `POST /sessions/:id/events`) keep working unchanged.

**AC-13 — Run/test docs updated.** The README (or a Phase 2 section) documents seeding the trainer/client/dog/protocol/session graph, the exact commands to run the API and the mobile app, how to set `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_TRAINER_ID` (or the chosen trainer-context mechanism), how to exercise the presign→upload→persist flow, and how to verify AC-3..AC-10. R2 env setup for presign is documented.

## Assumptions
- **[Seed data exists]** — Phase 2 reads/logs against a seeded org graph (at least one trainer → client → dog → protocol → session). A seed script or documented manual inserts are provided so the screens have data. Basis: there is no UI to create the org graph in Phase 2 (out of scope), and `POST /sessions/:id/events` already requires a real session id.
- **[Media persistence = two-step]** — Presign issues the URL only; a follow-up `POST /events/:id/media` records the row after the client confirms upload success. Basis: avoids orphan rows and keeps the API free of R2 webhooks; the device is the only party that knows the PUT succeeded. (Alternative in OQ-2.)
- **[No schema change needed]** — `media`, `behavior_event.note`, `behavior_event.tags` already exist with the right shapes; Phase 2 needs no migration. Basis: confirmed in `apps/api/src/db/schema.ts`.
- **[Presign SDK]** — The API uses an S3-compatible presign client (AWS SDK v3 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, or equivalent) against the R2 S3 endpoint, added only to `apps/api`. Basis: R2 is S3-compatible; the SDK must not leak into `@tailsup/shared`/mobile.
- **[Video picker]** — The mobile app uses an Expo picker to obtain the file (recommended `expo-image-picker` for camera-roll videos; see OQ-3-picker). It is added to `apps/mobile/package.json`. Basis: no picker dependency exists today.
- **[Web verification sufficient]** — As in Phase 1, Expo **web** is acceptable for verifying the screens (AC-8..AC-10); native simulators are optional. Basis: Phase 1 precedent (D-5). Note: native file-picker/upload nuances differ from web; flag if web cannot exercise the picker (then verify on a simulator).
- **[`occurredAt` is server-set]** — The quick-log screen does not send `occurredAt`; the DB default stamps it. Basis: existing endpoint behavior.
- **[Reverse-chronological is the trainer default]** — Newest activity first for the timeline; the per-session events read (`GET /sessions/:id/events`) stays chronological (ascending) to match the composite index's natural order and the in-session reading order. Basis: trainers review the latest session first but read a single session top-to-bottom.

## Open Questions (with recommended defaults)
1. **OQ-1 — Trainer context without auth.** How does the app know the "current trainer" and which dogs are theirs, with auth deferred? **Recommended default:** a seeded/known trainer id exposed to the app via `EXPO_PUBLIC_TRAINER_ID` (and the read endpoints scope by `:trainerId` in the path, e.g. `GET /trainers/:trainerId/dogs`). This keeps the eventual auth swap to "replace `:trainerId` with the session's trainer." Alternative: a `GET /trainers` list-all + in-app picker (more demo-friendly, less production-shaped). Pick one before building FR-M6.
2. **OQ-2 — Media persistence flow.** Does presign create the `media` row, or does a follow-up record it? **Recommended default (and the spec's working decision):** follow-up `POST /events/:id/media` records it after upload confirmation; presign creates nothing. Alternative: presign inserts a `pending` row updated on confirm — rejected for Phase 2 (adds state/cleanup with no payoff while there is no upload-status field on `media`).
3. **OQ-3 — Video picker library.** `expo-image-picker` vs `expo-document-picker`? **Recommended default:** `expo-image-picker` (`launchImageLibraryAsync` with `mediaTypes: Videos`, plus optional `launchCameraAsync` to record) — natural for camera-roll/recorded training clips, returns a uri + mime type. Use `expo-document-picker` only if arbitrary file selection (e.g. files app) is required. Confirm before adding the dependency.
4. **OQ-4 — Timeline grouping.** Group events by session vs one flat chronological stream? **Recommended default:** **grouped by session** (session header + its events), reverse-chronological — matches how trainers think ("what happened in the last session"). The `DogTimelineDTO` shape supports both; a flat view is a client-side flatten if desired later.
5. **OQ-5 — Presign expiry.** How long is the presigned PUT valid? **Recommended default:** **600 seconds (10 min)** — long enough for a large video on a phone connection, short enough to limit URL leakage. Return `expiresInSeconds` so the client can re-request on expiry.
6. **OQ-6 — Allowed content types / size cap.** Which video types and what max size? **Recommended default:** allow `video/mp4` and `video/quicktime` (iOS `.mov`); reject others with 400. Size: no hard server cap in Phase 2 (R2 accepts the PUT), but the client warns/blocks above a soft limit (recommended **200 MB**) to avoid stuck mobile uploads. Revisit once usage is known.
7. **OQ-7 — Starting a session.** The 4-tap screen logs into an existing `session`, but Phase 2 has no UI to create one. **Recommended default:** add a minimal **`POST /dogs/:id/sessions`** (body `{ startedAt?, location? }`, defaults `startedAt=now`) returning `SessionSummaryDTO`, so a trainer can "start a session" then log into it. This is small and unblocks FR-M1; it is the one borderline write beyond the listed scope. Confirm inclusion. (If excluded, sessions must be seeded and the app only logs into pre-seeded sessions.)
8. **OQ-8 — 4-tap screen vs the no-protocol-default 400.** Since the quick-log omits `intervention`, a dog without a protocol default produces a `400`. **Recommended default:** ensure seeded dogs have a protocol with a `defaultIntervention`; in the app, detect this 400 and prompt the trainer to enter an intervention once (degrading gracefully to a 5th tap only in the rare unconfigured case). Confirm whether the screen should ever allow a manual `intervention` override.
9. **OQ-9 — Public object URL vs key-only.** Is the R2 bucket served via a public base URL (so `blobUrl` is publicly fetchable for later playback), or are objects private (requiring a presigned GET to view)? **Recommended default for Phase 2:** store the canonical object reference (the S3-style URL/key) as `blobUrl`; since playback/viewing media in the trainer UI is *not* a stated Phase 2 requirement, defer public-read/presigned-GET. If the detail screen must *play* the uploaded video back, add a public bucket base URL env var (e.g. `R2_PUBLIC_BASE_URL`) or a `GET /media/:id/url` presigned-GET endpoint — flag which is wanted.
10. **OQ-10 — CORS for direct browser uploads.** On Expo **web**, the browser PUT to R2 is cross-origin and requires the **R2 bucket's CORS policy** to allow PUT from the web origin (this is an R2 bucket setting, not API code). **Recommended default:** document the required R2 bucket CORS configuration in the README; native uploads are unaffected. Confirm whether web upload must be demonstrated (if so, the R2 CORS rule is a prerequisite for AC-9 on web).

## Original Request
> Refine **Phase 2 — Trainer view** of the TailsUp platform into a structured, development-oriented specification.
>
> Context to read first (all in `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/`):
> - `prompts/001-tailsup-kickoff.md` — the authoritative kickoff. Phase 2 is defined as: "the 4-tap quick-logging screen writing BehaviorEvents; a post-session 'detail' screen (note, tags, video upload via R2 presign); a dog timeline."
> - `docs/reference/refined-request-tailsup.md` — the Phase 1 spec (full data model, decided architecture, the endpoint catalog where `POST /media/presign` is mapped to Phase 2).
> - `docs/design/project-design.md` — what Phase 1 actually built (api on Hono+Drizzle, schema, `GET /health` + `POST /sessions/:id/events`, `@tailsup/shared` enums/DTOs, Expo Router mobile with one screen).
>
> **The architecture is still DECIDED/fixed** (Expo Router, Hono+Drizzle, R2 presigned DIRECT upload, etc.) — do not re-open it.
>
> Scope **Phase 2 ONLY** as the deliverable being built now. Phase 2 is mostly trainer-facing mobile screens PLUS the supporting API they require. Capture:
>
> **In scope (Phase 2):**
> 1. **Mobile — 4-tap quick-logging screen** (trainer): the fast in-session capture that writes a BehaviorEvent via `POST /sessions/:id/events` using tap targets for the enum fields (triggerType, intensity 1–10, outcome) + thresholdMeters; intervention defaults from the dog's protocol (already implemented server-side). Must stay genuinely fast (the "4 taps" promise).
> 2. **Mobile — post-session detail screen**: edit/add `note`, manage `tags`, and **upload a video** for an event via the R2 presigned-URL flow (request a presigned URL from the API, then upload the file DIRECTLY to R2 from the device — never through the API), then persist a Media record.
> 3. **Mobile — dog timeline**: a chronological view of a dog's sessions and their BehaviorEvents (the longitudinal view).
> 4. **API — `POST /media/presign`**: returns a presigned R2 upload URL (+ the final object URL/key) for a given event + content type. Plus whatever is needed to **persist a Media row** after upload (decide: does presign create the row, or a follow-up `POST /events/:id/media` records it?).
> 5. **API — read endpoints the screens require** (these do not exist yet): e.g. list a trainer's dogs, get a dog with its sessions, list sessions for a dog, get a session's events, get a dog's timeline (events across sessions). Define exactly which read endpoints the three screens need, with shapes. Add any needed DTOs to `@tailsup/shared`.
>
> **Out of scope (defer):** BetterAuth/role enforcement (Phase 3 — Phase 2 endpoints remain unauthenticated for now; note how the app picks the "current trainer"/dogs without auth — e.g. a seeded/known trainer id, or list-all — flag as an open question with a recommended default). The public website, client dashboard, lead/booking endpoints, and the AI summary are NOT Phase 2.
>
> Produce: clear in/out scope, functional requirements, the new API endpoints with request/response shapes, the new shared DTOs, non-functional requirements (keep the 4-tap fast; direct-to-R2 upload to avoid egress; TS strict; no config fallbacks), constraints (fixed architecture; singular tables; auth deferred), assumptions, open questions with recommended defaults (trainer-context-without-auth; media persistence flow; which video picker — expo-image-picker vs expo-document-picker; timeline grouping by session vs flat chronological; presign expiry; allowed content types/size), and concrete verifier-checkable acceptance criteria for Phase 2.
>
> Write the refined spec to `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/docs/reference/refined-request-phase2.md`.

### Authoritative source documents
- Kickoff: `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/prompts/001-tailsup-kickoff.md`
- Phase 1 refined spec: `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/docs/reference/refined-request-tailsup.md`
- Phase 1 technical design: `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/docs/design/project-design.md`
- Implemented Phase 1 code referenced above (`apps/api/src/db/schema.ts`, `apps/api/src/routes/sessions.ts`, `apps/api/src/app.ts`, `apps/api/src/config.ts`, `packages/shared/src/dtos.ts`, `apps/mobile/app/index.tsx`, `.env.example`).
