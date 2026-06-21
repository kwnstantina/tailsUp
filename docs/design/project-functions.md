# TailsUp — Functional Requirements Ledger

> Project-level functional-requirements ledger for **TailsUp**, a data-driven dog-training platform.
> Source of truth: `docs/reference/refined-request-tailsup.md` (refined spec) and `docs/reference/investigation-tailsup-phase1.md` (wiring investigation).
> This ledger records the **functional requirements** and the **full 12-entity data model**. It spans the whole product; the **Phase** column marks when each item is delivered. **Phase 1 (FR-1..FR-11) is shipped; Phase 2 — Trainer View (FR-M1..FR-M8, FR-A1..FR-A12) is in active scope.**

Status legend: `done` (shipped) · `planned` (in active scope now) · `context` (later phase, recorded only).

> **Phase 1 is shipped.** Its FR-1..FR-11 below are marked `done`. **Phase 2 — Trainer View is now in active scope** (plan: `docs/design/plan-002-tailsup-phase2-trainer-view.md`); its requirements are recorded as FR-M1..FR-M8 (mobile) and FR-A1..FR-A11 (API) in the new Phase 2 section.

---

## Functional Requirements (Phase 1 — shipped)

| ID | Requirement | Phase | Status | Maps to AC |
| --- | --- | --- | --- | --- |
| **FR-1** | **Monorepo workspaces.** Root `package.json` declares npm workspaces covering `apps/*` and `packages/*` (at minimum `apps/api`, `apps/mobile`, `packages/shared`). Cross-package imports resolve: `apps/api` and `apps/mobile` can both import from `packages/shared`. | 1 | done | AC-1 |
| **FR-2** | **Full database schema.** All 12 entities from the data model are defined in Drizzle with the exact fields, types, foreign keys, nullability, enums, and JSONB columns specified. Table names use **SINGULAR** form. | 1 | done | AC-3, AC-4 |
| **FR-3** | **Migrations.** Drizzle migrations are generated for the full schema and apply cleanly to an empty PostgreSQL database, producing all tables, foreign keys, enums, and indexes. | 1 | done | AC-3 |
| **FR-4** | **Indexes.** After migration these exist: composite index on `behavior_event(sessionId, occurredAt)`; composite index on `session(dogId, startedAt)`; **GIN** index on `behavior_event.tags`; index on `dog(clientId)`; index on `client(trainerId)`. | 1 | done | AC-5 |
| **FR-5** | **`GET /health`.** Returns HTTP 200 with a small JSON body indicating the service is up (and, ideally, that the database is reachable). | 1 | done | AC-6 |
| **FR-6** | **`POST /sessions/:id/events`.** Accepts JSON `{ triggerType, thresholdMeters, intensity, outcome, intervention }`; validates against shared enums and numeric ranges; inserts a `BehaviorEvent` linked to the session `:id`; persists the `intervention → outcome` linkage; returns the created event (or its id) with a 2xx. `intervention` defaults from the owning dog's `Protocol.defaultIntervention` when omitted. | 1 | done | AC-7 |
| **FR-7** | **Environment template.** `.env.example` lists every required variable with placeholder values and brief inline comments, and **no real secrets**. | 1 | done | AC-8 |
| **FR-8** | **Mobile connectivity screen.** The Expo Router app launches and renders one screen that performs a request to `GET /health` against a configurable API base URL and displays success/failure plus the returned payload. | 1 | done | AC-9 |
| **FR-9** | **Shared types consumed by both ends.** The enums for `triggerType` and `outcome` (and any DTOs used by the Phase 1 endpoint) are defined once in `packages/shared` and imported by both `apps/api` (validation) and `apps/mobile`. | 1 | done | AC-1, AC-7 |
| **FR-10** | **Automated daily backup.** A GitHub Actions workflow runs on a daily schedule, executes `pg_dump` against the configured database, and uploads the dump to the configured R2 bucket. Credentials come from GitHub Secrets, not committed. | 1 | done | AC-10 |
| **FR-11** | **Local run/test docs.** A README (or equivalent) documents the exact commands to: install dependencies, run migrations, start the API, start the mobile app, and verify the `/health` round-trip end to end. | 1 | done | AC-11 |

### Non-functional requirements (cross-cutting, honored in Phase 1)

| ID | Requirement |
| --- | --- |
| NFR-1 | Cost discipline — priority order: (1) low maintenance, (2) low cost, (3) no vendor lock-in. Favor scale-to-zero (Railway), managed Postgres, R2 (no egress fees). |
| NFR-2 | Low maintenance — simplest thing that works; backup runs unattended. (Drives: no-build-step shared package, `pg` driver, path aliases over project references.) |
| NFR-3 | No vendor lock-in — standard PostgreSQL via Drizzle, S3-compatible R2, self-hosted auth, Hono (multi-runtime), plain `pg_dump` artifacts. |
| NFR-4 | TypeScript **strict** mode in every workspace; zero type errors; no implicit `any`. |
| NFR-5 | Secrets hygiene — no secret values committed; `.env` git-ignored; only `.env.example` committed; CI uses GitHub Secrets. |
| NFR-6 | Offline-capable later — the 4-tap write must not be architecturally precluded from future offline queueing. (Drives: **UUID** client-generatable PKs.) |
| NFR-7 | Web-capable single codebase — Expo Router serves iOS/Android/web from one codebase; no separate Next.js site. |

---

## Functional Requirements (Phase 2 — Trainer View, active scope)

> Source: `docs/reference/refined-request-phase2.md` · Plan: `docs/design/plan-002-tailsup-phase2-trainer-view.md`. Builds the trainer-facing Expo Router screens + the supporting read/media API + new `@tailsup/shared` DTOs. **No** auth, public site, client view, AI, leads/bookings, or schema migration (the `media`/`note`/`tags` columns already exist from Phase 1). All Phase 2 endpoints remain **unauthenticated**.

### Mobile (trainer-facing Expo Router screens)

| ID | Requirement | Phase | Status | Maps to AC |
| --- | --- | --- | --- | --- |
| **FR-M1** | **4-tap quick-logging screen** (`app/sessions/[id]/log.tsx`). Tap targets for `triggerType` (5 from `TRIGGER_TYPES`), `outcome` (3 from `OUTCOMES`), `intensity` (1–10), `thresholdMeters`; single submit posts `POST /sessions/:id/events` **omitting `intervention`** (server defaults it); resets immediately on success. ≤ 4 deliberate taps + submit, sensible defaults pre-selected. | 2 | planned | AC-8 |
| **FR-M2** | **Quick-log resilience.** Clear pending/success/error states; in-progress selections survive a failed request (retry without re-tapping); `404` (unknown session) and `400` (no protocol default + intervention omitted) surfaced with actionable messages (OQ-8 one-time intervention prompt). | 2 | planned | AC-8 |
| **FR-M3** | **Post-session detail screen** (`app/events/[id].tsx`). Loads one `BehaviorEvent` (note/tags/media); edits `note` (multiline) and manages `tags` (add/remove); persists via `PATCH /events/:id`; the four tap fields shown read-only. | 2 | planned | AC-9 |
| **FR-M4** | **Video upload (direct-to-R2).** Pick video (`expo-image-picker`, `mediaTypes:['videos']`) → `POST /media/presign` → upload bytes **directly to R2** (native: new `expo-file-system` File API `createUploadTask` BINARY_CONTENT PUT; web: `fetch` PUT; `Platform.OS` branch; never legacy `uploadAsync`) → `POST /events/:id/media` to persist. Progress + success/failure shown; never streams through the API. | 2 | planned | AC-6, AC-9 |
| **FR-M5** | **Dog timeline** (`app/dogs/[id]/timeline.tsx`). `GET /dogs/:id/timeline` rendered **reverse-chronological, grouped by session** (header `startedAt`/`location`); each event row shows tap fields + `intervention` + note/tag/media indicators; row tap → detail screen. | 2 | planned | AC-10 |
| **FR-M6** | **Dog list / entry point** (`app/dogs/index.tsx`). Lists the current trainer's dogs (`GET /trainers/:trainerId/dogs`); routes into a dog timeline and into starting a session (`POST /dogs/:id/sessions`) for quick-logging. Trainer resolved via `EXPO_PUBLIC_TRAINER_ID` (OQ-1). | 2 | planned | AC-3, AC-8 |
| **FR-M7** | **Typed API client** (`apps/mobile/lib/api.ts`). Wraps `EXPO_PUBLIC_API_URL` (static dot-access, Metro rule); types every request/response with the new `@tailsup/shared` DTOs; no hard-coded base URL beyond the dev default; no data-fetching library. | 2 | planned | AC-11 |
| **FR-M8** | **Navigation.** Expo Router connects dog list → timeline → event detail, and dog list/session → quick-log; works on Expo **web** and is not architecturally web-only. | 2 | planned | AC-8, AC-9, AC-10 |

### API (supporting endpoints the screens require)

| ID | Requirement | Phase | Status | Maps to AC |
| --- | --- | --- | --- | --- |
| **FR-A1** | **`POST /media/presign`.** Body `{ eventId, contentType }`; 404 unknown event, 400 disallowed type (allow `video/mp4`/`video/quicktime`); generates key `events/{eventId}/{uuid}.{ext}`; presigned **PUT** URL for `R2_BUCKET`, `expiresIn:600`, signed `ContentType`; returns `{ uploadUrl, method, headers, key, expiresInSeconds }`; **creates no `media` row**; 5xx/503 when R2 unconfigured. **`requestChecksumCalculation`/`responseChecksumValidation:'WHEN_REQUIRED'` mandatory** (else R2 rejects). | 2 | planned | AC-5 |
| **FR-A2** | **Media persistence flow.** `POST /events/:id/media` body `{ key, contentType }` records the row after upload confirm: derives `blobUrl` from key (key-only/private, OQ-9), `type` from content type, inserts `media`, returns `201 MediaDTO`. Presign creates nothing (two-step, OQ-2). | 2 | planned | AC-7 |
| **FR-A3** | **`GET /trainers/:trainerId/dogs`** → `200 DogSummaryDTO[]` (dog→client→trainer join); unknown trainer → `[]`. | 2 | planned | AC-3 |
| **FR-A4** | **`GET /dogs/:id`** → `200 DogDetailDTO` (= `DogSummaryDTO` + `sessions: SessionSummaryDTO[]` each with `eventCount`); 404 unknown. | 2 | planned | AC-3 |
| **FR-A5** | **`GET /sessions/:id/events`** → `200` events chronological (with `mediaCount` per OQ-3); 404 unknown. | 2 | planned | AC-3 |
| **FR-A6** | **`GET /dogs/:id/timeline`** → `200 DogTimelineDTO` (`{ dog, sessions: TimelineSessionDTO[] }`), sessions + events reverse-chronological, grouped by session; 404 unknown. Built with plain `select()` + `inArray` (nested ordering). | 2 | planned | AC-3 |
| **FR-A7** | **`PATCH /events/:id`** updates **only** `note` (string\|null) and `tags` (string[]\|null); tap fields + `intervention` immutable (moat); partial; returns `200 BehaviorEventDTO`; 404 unknown. | 2 | planned | AC-4 |
| **FR-A8** | **`GET /events/:id`** → `200 BehaviorEventWithMediaDTO` (= `BehaviorEventDTO` + `media: MediaDTO[]`); 404 unknown. | 2 | planned | AC-3 |
| **FR-A9** | **Routing/registration.** New routes mounted in `apps/api/src/app.ts` following the Hono sub-app pattern (`export const <name> = new Hono()`, `app.route('/', ...)`); reuse existing `cors()`/`onError`/`notFound`. Modules: `routes/dogs.ts`, `routes/events.ts`, `routes/media.ts`, extend `routes/sessions.ts`. | 2 | planned | AC-3, AC-12 |
| **FR-A10** | **Validation.** All bodies/params validated with `@hono/zod-validator` + Zod, reusing `@tailsup/shared` arrays where applicable; invalid → 400, unknown id → 404 `{ error }`. | 2 | planned | AC-3, AC-4, AC-5 |
| **FR-A11** | **Shared DTOs.** Add to `packages/shared/src/dtos.ts` (pure TS, barrel re-export): `DogSummaryDTO`, `DogDetailDTO`, `SessionSummaryDTO`, `DogTimelineDTO`, `TimelineSessionDTO`, `BehaviorEventWithMediaDTO`, `MediaDTO`, `PresignRequest`, `PresignResponse`, `CreateMediaInput`, `UpdateBehaviorEventInput` (+ `BehaviorEventListItemDTO`). | 2 | planned | AC-1, AC-2 |
| **FR-A12** | **Start a session (OQ-7).** Minimal `POST /dogs/:id/sessions` body `{ startedAt?, location? }` (default `startedAt=now`) → `201 SessionSummaryDTO`; 404 unknown dog. Unblocks FR-M1 (cannot log events without a session). | 2 | planned | AC-3 |

### Phase 2 non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-P2-1 | Keep the 4-tap promise — pre-defaulted fields, server-defaulted intervention, ≤ 4 deliberate taps + submit, no blocking dialogs/round-trips/scroll between selection and submit. |
| NFR-P2-2 | Direct-to-R2 upload — device PUTs bytes straight to R2; the API never receives/proxies the file (no Railway egress). |
| NFR-P2-3 | TypeScript strict everywhere — zero errors across shared/api/mobile; new DTOs are the single shared source of truth. |
| NFR-P2-4 | No config fallbacks — R2 creds read via lazy throw-on-missing accessor; presign returns explicit 5xx/503 when unconfigured, never a fabricated URL. R2 vars are **not** added to startup `config.ts`. |
| NFR-P2-5 | Shared package stays pure — only types/const arrays; no `drizzle-orm`/`pg`/AWS SDK/Node built-ins. AWS SDK lives only in `apps/api`. |
| NFR-P2-6 | Consistency with Phase 1 — singular tables; camelCase→snake_case; Zod over shared arrays; ESM `.js` specifiers; static `EXPO_PUBLIC_*` dot-access; `{ error }` bodies; reverse-chron reads use existing composite indexes. |
| NFR-P2-7 | Read performance — existing indexes; avoid N+1 via `inArray` batching; no new index. |
| NFR-P2-8 | Offline-capable later (no regression) — UUID PKs preserve future offline queueing; no offline implementation now. |

---

## Functional Requirements (Phase 3a — Public business website + public capture, active scope)

> Source: `docs/reference/refined-request-phase3.md` (Phase 3a scope, AC-3a-*) · Investigation: `docs/reference/investigation-phase3a.md` · SEO research: `docs/research/expo-router-static-head-sdk54.md` · Plan: `docs/design/plan-003-tailsup-phase3a-public-site.md`. Builds the **6 public website pages** (one Expo Router codebase, web-first) on the kickoff's **Design System** + the **2 PUBLIC capture endpoints** (`POST /leads` with a Resend email stub, `POST /bookings`) + new pure-TS `@tailsup/shared` DTOs. **No auth, no dashboards, no management/convert endpoints, no schema migration** (the `lead`/`booking` tables already exist from Phase 1). BetterAuth, the client/trainer dashboards, and the trainer-auth endpoints are **Phase 3b**. AI/multi-tenant are **Phase 4**.

### Website (public Expo Router `(site)` route group, no auth)

| ID | Requirement | Phase | Status | Maps to AC |
| --- | --- | --- | --- | --- |
| **FR-W1** | **Route structure in ONE Expo Router tree.** New public `app/(site)/*` route group (Design-System chrome: Greek nav + deep-green footer, **no** auth guard); existing screens move under `app/(app)/*`; root `_layout.tsx` → `<Slot>`. Home owns `/`; the health screen moves to `/health`. Renders on Expo **web**; native still builds. | 3a | planned | AC-3a-3, AC-3a-10 |
| **FR-W2** | **Home / Αρχική is business-first.** Communicates the dog-training **practice** (who we are, the promise, book/contact CTAs). Does **NOT** lead with "an app"/"a data platform"; one bold/proof moment max; **no progress-curve on Home**. | 3a | planned | AC-3a-2 |
| **FR-W3** | **About / Ποιοι είμαστε.** Practice, method, trainer(s), credentials; "proof not promises" tone; in-code Greek copy. | 3a | planned | AC-3a-3, AC-3a-4 |
| **FR-W4** | **Services / Υπηρεσίες with tracking-as-a-service.** Services as peers (assessment/private/group ↔ `BOOKING_TYPES`); the data-driven progress-tracking is **ONE** premium service and the **only** place the signature progress-curve appears. | 3a | planned | AC-3a-2 |
| **FR-W5** | **Results / Αποτελέσματα.** Case studies from clearly-structured in-code placeholder data (`{ dogName, summary, before, after, curveData }[]`); may reuse the progress-curve for an outcome arc. | 3a | planned | AC-3a-3 |
| **FR-W6** | **Contact / Επικοινωνία.** Address, hours, phone, email (in-code) + a **keyless embedded map** + the **lead form** (`name`, `contact`, optional `message`; page sets `source`) → `POST /leads`; pending/success/error states; visible focus + reduced-motion. | 3a | planned | AC-3a-5 |
| **FR-W7** | **Booking page.** Form: `type` (`BOOKING_TYPES`), requested date/time → ISO `requestedAt`, contact, optional `notes` → `POST /bookings` (server defaults `status='requested'`); pending/success/error states. | 3a | planned | AC-3a-7 |
| **FR-W8** | **Signature progress-curve component.** Hand-rolled `react-native-svg` thin gold line on deep-green with soft gradient fill; per-instance gradient id; respects `prefers-reduced-motion`; renders on web; **Services-only** (optionally Results). | 3a | planned | AC-3a-2, AC-3a-8 |
| **FR-W9** | **Design System theme module.** A single mobile-only `apps/mobile/lib/theme.ts` (DS-1 tokens, DS-2 type scale RN-unit-converted, DS-3 spacing/radii, DS-4 primitives) consumed by all pages + chrome. | 3a | planned | AC-3a-4 |
| **FR-W10** | **Bilingual labels (Greek-first).** Greek nav labels + page headings; in-code Greek body copy; no runtime language switcher / full i18n. | 3a | planned | AC-3a-3 |
| **FR-W11** | **SEO best-effort.** `app/+html.tsx` shell (`<html lang="el">`, site defaults, favicon) + per-page `<Head>`; static emission **verified** via `expo export` with a documented graceful fallback (React-19 tags → client-side only). Not a blocker. | 3a | planned | AC-3a-3 |

### API for 3a (PUBLIC capture)

| ID | Requirement | Phase | Status | Maps to AC |
| --- | --- | --- | --- | --- |
| **FR-A1·3a** | **`POST /leads` (PUBLIC).** Body `CreateLeadInput` `{ name, contact, source, message? }` (Zod, non-empty + `.max()` caps); `trainerId` via `resolveTrainerId()`; insert `lead` (`status='new'`, `clientId=null`); **then fire-and-forget** Resend notification to the trainer's `email` (stub-not-throw when keyless; **never** blocks/fails the 201); returns `201 LeadDTO`. | 3a | planned | AC-3a-6 |
| **FR-A2·3a** | **`POST /bookings` (PUBLIC).** Body `CreateBookingInput` `{ type, requestedAt, name, contact, notes? }` (Zod: `type ∈ BOOKING_TYPES`, ISO `requestedAt`); `trainerId` via `resolveTrainerId()`; insert `booking` (`status='requested'`, `leadId=null`, captured name/contact folded into `notes`); returns `201 BookingDTO`. Invalid `type`/`requestedAt` → `400`. | 3a | planned | AC-3a-7 |
| **FR-A3·3a** | **`resolveTrainerId()` (single-practice).** `PRACTICE_TRAINER_ID` env → else sole/oldest `trainer` row → else **throw → 503** "practice not configured"; never insert empty `trainerId`. New optional `PRACTICE_TRAINER_ID` documented in `.env.example`. Read lazily (not in `config.ts`). | 3a | planned | AC-3a-6, AC-3a-7 |
| **FR-A4·3a** | **Email service module.** `apps/api/src/lib/email.ts` wraps Resend with the lazy stub-not-throw discipline (mirrors `lib/r2.ts`, inverts missing-key); `RESEND_API_KEY`/`RESEND_FROM` read lazily; SDK lives only in `apps/api`. | 3a | planned | AC-3a-6 |
| **FR-A5·3a** | **Public-endpoint hardening.** `hono-rate-limiter` per-IP throttle scoped to the two routes (→ `429 { error }`) + Zod input-size caps; no internal leakage; CORS left allow-all in 3a (tightening is 3b). | 3a | planned | AC-3a-9 |
| **FR-A6·3a** | **Routing/registration.** `routes/leads.ts` + `routes/bookings.ts` as Hono sub-apps mounted via `app.route('/', …)` in `app.ts`; reuse `cors()`/`onError`/`notFound`; ESM `.js` specifiers; `{ error }` bodies. | 3a | planned | AC-3a-1 |
| **FR-A7·3a** | **Shared DTOs.** Add to `packages/shared/src/dtos.ts` (pure TS, barrel auto-export): `CreateLeadInput`, `LeadDTO`, `CreateBookingInput`, `BookingDTO`. Reuse `BookingType`/`LeadStatus`/`BookingStatus` enums unchanged — **no new enum**. | 3a | planned | AC-3a-1 |

### Phase 3a non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-P3a-1 | Premium quality floor on every page — responsive (web breakpoints via `useWindowDimensions`), **visible focus** states (`Pressable` `focused`), respect **`prefers-reduced-motion`** (`AccessibilityInfo`); subtle motion only. |
| NFR-P3a-2 | Email is best-effort, insert is source of truth — a failed/stubbed Resend send **never** fails `POST /leads`; the lead row is always persisted and returned (fire-and-forget + `.catch()`). |
| NFR-P3a-3 | No config fallbacks except the email stub — `RESEND_API_KEY` and `PRACTICE_TRAINER_ID` read lazily (not in `config.ts`); `RESEND_API_KEY` unset → logged stub (the one intentional graceful degradation); no fabricated keys/URLs. |
| NFR-P3a-4 | `@tailsup/shared` stays pure (Metro-safe) — 3a adds only types to shared; the Resend SDK, `react-native-svg`, fonts, and rate-limiter live only in `apps/api`/`apps/mobile`. |
| NFR-P3a-5 | One codebase, no second framework — the public site builds from `apps/mobile` (Expo Router web); native must still build and the authed screens keep working. |
| NFR-P3a-6 | TypeScript strict everywhere — zero errors across shared/api/mobile; the four new DTOs are the single source of truth for the new shapes. |
| NFR-P3a-7 | Consistency with Phase 1/2 — singular tables; Zod over shared arrays; ESM `.js` specifiers; static `EXPO_PUBLIC_*` dot-access; `{ error }` bodies; **no schema migration** (`git status apps/api/drizzle` stays empty). |

---

## Data Model (full product schema — implemented in full in Phase 1)

All 12 entities are implemented in Drizzle in Phase 1. **Table names are SINGULAR.** Primary keys are **UUID** (`uuid().defaultRandom()`) across all entities (resolves Open Question #1). Timestamps are `timestamp` with timezone. Column names map to **snake_case** via Drizzle `casing: 'snake_case'`; TS keys stay camelCase.

| Entity (singular table) | Fields |
| --- | --- |
| **trainer** | id, name, email |
| **client** | id, trainerId (FK → trainer), name, contact |
| **protocol** | id, name, defaultIntervention |
| **dog** | id, clientId (FK → client), protocolId (FK → protocol, **nullable**), name, breed, ageMonths, backgroundNotes |
| **session** | id, dogId (FK → dog), bookingId (FK → booking, **nullable**), startedAt, location |
| **behavior_event** (core) | id, sessionId (FK → session), occurredAt, triggerType (enum `dog`\|`human`\|`noise`\|`vehicle`\|`other`), thresholdMeters (int), intensity (int 1–10), outcome (enum `disengaged`\|`recovered_slowly`\|`over_threshold`), intervention (text, **notNull**, defaults from Protocol), note (text, optional), tags (jsonb `string[]`, optional, **GIN**) |
| **media** | id, eventId (FK → behavior_event), blobUrl (R2 reference only), type (enum `video`\|`image`), uploadedAt |
| **exercise** | id, protocolId (FK → protocol), title, instructions |
| **homework** | id, dogId (FK → dog), exerciseId (FK → exercise), completed (bool), completedAt (nullable) |
| **lead** | id, trainerId (FK → trainer), name, contact, source, message, status (enum `new`\|`contacted`\|`converted`\|`lost`), clientId (FK → client, **nullable**; set on conversion), createdAt |
| **booking** | id, trainerId (FK → trainer), leadId (FK → lead, **nullable**), clientId (FK → client, **nullable**), type (enum `assessment`\|`private`\|`group`), requestedAt, status (enum `requested`\|`confirmed`\|`declined`\|`completed`\|`cancelled`), notes, createdAt |

### Enums (6 — defined once in `packages/shared`, reused by Drizzle pgEnum + Zod)

| Enum | DB name | Values |
| --- | --- | --- |
| triggerType | `trigger_type` | `dog`, `human`, `noise`, `vehicle`, `other` |
| outcome | `outcome` | `disengaged`, `recovered_slowly`, `over_threshold` |
| mediaType | `media_type` | `video`, `image` |
| leadStatus | `lead_status` | `new`, `contacted`, `converted`, `lost` |
| bookingType | `booking_type` | `assessment`, `private`, `group` |
| bookingStatus | `booking_status` | `requested`, `confirmed`, `declined`, `completed`, `cancelled` |

### Data rules (must be honored)

- The "tap" fields (`triggerType`, `intensity`, `outcome`) are constrained to enums / numeric ranges so logging is button-based and analytics stay clean.
- `intervention` **defaults from `Protocol.defaultIntervention`** so session logging stays 4 taps.
- `tags` is JSONB (string array) with a **GIN index** — filterable, no migration needed to add new tag values.
- `media` stores **only the R2 URL**, never the file.
- Every `behavior_event` MUST retain the `intervention → outcome` linkage — this is the dataset moat and must never be dropped. (`intervention` is `notNull`.)
- The **session ↔ booking** cross-reference (plus `lead.clientId` / `booking.leadId` / `booking.clientId`) forms a FK cycle; at least one circular FK is declared with the standalone `foreignKey()` builder so types do not collapse to `any`.

---

## Endpoint Catalog

> Phase 1 endpoints are shipped; Phase 2 endpoints are in active scope (plan 002). Phase 2 endpoints remain **unauthenticated** (auth deferred to Phase 3).

| Endpoint | Auth | Phase | Status |
| --- | --- | --- | --- |
| `GET /health` | none | 1 | **shipped** |
| `POST /sessions/:id/events` | none enforced in P1 | 1 | **shipped** |
| `GET /trainers/:trainerId/dogs` | none (P2) | 2 | **planned** |
| `GET /dogs/:id` | none (P2) | 2 | **planned** |
| `GET /dogs/:id/timeline` | none (P2) | 2 | **planned** |
| `POST /dogs/:id/sessions` | none (P2) | 2 | **planned** (OQ-7) |
| `GET /sessions/:id/events` | none (P2) | 2 | **planned** |
| `GET /events/:id` | none (P2) | 2 | **planned** |
| `PATCH /events/:id` | none (P2) | 2 | **planned** |
| `POST /media/presign` | none (P2; client/app from P3) | 2 | **planned** |
| `POST /events/:id/media` | none (P2) | 2 | **planned** |
| `POST /leads` | public | 3a | **planned** |
| `POST /bookings` | public | 3a | **planned** |
| `PATCH /bookings/:id/status` | trainer | 3b | No |
| `POST /leads/:id/convert` | trainer | 3b | No |
| `POST /dogs/:id/summary` | trainer | 4 | No |

---

## Later-phase functional scope (context only — NOT built now)

> **Phase 2 — Trainer view** shipped (FR-M1..FR-M8 + FR-A1..FR-A12; plan: `docs/design/plan-002-tailsup-phase2-trainer-view.md`). **Phase 3a — Public site + capture is now in active scope** and detailed above as FR-W1..FR-W11 + FR-A1·3a..FR-A7·3a (plan: `docs/design/plan-003-tailsup-phase3a-public-site.md`).

- **Phase 3b — App auth + dashboards (NOT this cycle):** BetterAuth with `trainer`/`client` roles; `/login` + auth guards; CORS tightening; replace `EXPO_PUBLIC_TRAINER_ID`; client dashboard (threshold-over-time graph, homework, reminders); trainer lead/booking management; `PATCH /bookings/:id/status`, `POST /leads/:id/convert`, trainer/client read endpoints.
- **Phase 4 — AI & scale:** `POST /dogs/:id/summary` (Anthropic `claude-haiku-4-5`); AI spend-cap reminder; multi-tenant SaaS prep.

---

_Phase 1 implementation plan: `docs/design/plan-001-tailsup-phase1-foundations.md` · Phase 2 implementation plan: `docs/design/plan-002-tailsup-phase2-trainer-view.md` · Phase 3a implementation plan: `docs/design/plan-003-tailsup-phase3a-public-site.md`._
