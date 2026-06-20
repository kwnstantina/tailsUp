# TailsUp — Functional Requirements Ledger

> Project-level functional-requirements ledger for **TailsUp**, a data-driven dog-training platform.
> Source of truth: `docs/reference/refined-request-tailsup.md` (refined spec) and `docs/reference/investigation-tailsup-phase1.md` (wiring investigation).
> This ledger records the **functional requirements (FR-1..FR-11)** and the **full 12-entity data model**. It spans the whole product; the **Phase** column marks when each item is delivered. Only Phase 1 items are in active scope now.

Status legend: `planned` (in active Phase 1 scope) · `context` (later phase, recorded only).

---

## Functional Requirements

| ID | Requirement | Phase | Status | Maps to AC |
| --- | --- | --- | --- | --- |
| **FR-1** | **Monorepo workspaces.** Root `package.json` declares npm workspaces covering `apps/*` and `packages/*` (at minimum `apps/api`, `apps/mobile`, `packages/shared`). Cross-package imports resolve: `apps/api` and `apps/mobile` can both import from `packages/shared`. | 1 | planned | AC-1 |
| **FR-2** | **Full database schema.** All 12 entities from the data model are defined in Drizzle with the exact fields, types, foreign keys, nullability, enums, and JSONB columns specified. Table names use **SINGULAR** form. | 1 | planned | AC-3, AC-4 |
| **FR-3** | **Migrations.** Drizzle migrations are generated for the full schema and apply cleanly to an empty PostgreSQL database, producing all tables, foreign keys, enums, and indexes. | 1 | planned | AC-3 |
| **FR-4** | **Indexes.** After migration these exist: composite index on `behavior_event(sessionId, occurredAt)`; composite index on `session(dogId, startedAt)`; **GIN** index on `behavior_event.tags`; index on `dog(clientId)`; index on `client(trainerId)`. | 1 | planned | AC-5 |
| **FR-5** | **`GET /health`.** Returns HTTP 200 with a small JSON body indicating the service is up (and, ideally, that the database is reachable). | 1 | planned | AC-6 |
| **FR-6** | **`POST /sessions/:id/events`.** Accepts JSON `{ triggerType, thresholdMeters, intensity, outcome, intervention }`; validates against shared enums and numeric ranges; inserts a `BehaviorEvent` linked to the session `:id`; persists the `intervention → outcome` linkage; returns the created event (or its id) with a 2xx. `intervention` defaults from the owning dog's `Protocol.defaultIntervention` when omitted. | 1 | planned | AC-7 |
| **FR-7** | **Environment template.** `.env.example` lists every required variable with placeholder values and brief inline comments, and **no real secrets**. | 1 | planned | AC-8 |
| **FR-8** | **Mobile connectivity screen.** The Expo Router app launches and renders one screen that performs a request to `GET /health` against a configurable API base URL and displays success/failure plus the returned payload. | 1 | planned | AC-9 |
| **FR-9** | **Shared types consumed by both ends.** The enums for `triggerType` and `outcome` (and any DTOs used by the Phase 1 endpoint) are defined once in `packages/shared` and imported by both `apps/api` (validation) and `apps/mobile`. | 1 | planned | AC-1, AC-7 |
| **FR-10** | **Automated daily backup.** A GitHub Actions workflow runs on a daily schedule, executes `pg_dump` against the configured database, and uploads the dump to the configured R2 bucket. Credentials come from GitHub Secrets, not committed. | 1 | planned | AC-10 |
| **FR-11** | **Local run/test docs.** A README (or equivalent) documents the exact commands to: install dependencies, run migrations, start the API, start the mobile app, and verify the `/health` round-trip end to end. | 1 | planned | AC-11 |

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

## Endpoint Catalog (context — only the two Phase-1 endpoints are implemented now)

| Endpoint | Auth | Phase | In Phase 1? |
| --- | --- | --- | --- |
| `GET /health` | none | 1 | **Yes** |
| `POST /sessions/:id/events` | none enforced in P1 | 1 | **Yes** |
| `POST /leads` | public | 3 | No |
| `POST /bookings` | public | 3 | No |
| `PATCH /bookings/:id/status` | trainer | 3 | No |
| `POST /leads/:id/convert` | trainer | 3 | No |
| `POST /media/presign` | client/app | 2 | No |
| `POST /dogs/:id/summary` | trainer | 4 | No |

---

## Later-phase functional scope (context only — NOT built now)

- **Phase 2 — Trainer view:** 4-tap quick-logging UI writing BehaviorEvents; post-session detail (note, tags, video upload via R2 presign); dog timeline; `POST /media/presign`.
- **Phase 3 — Public site + Client view:** website pages (Home, About, Services, Results, Contact + lead form, Booking) with the Design System; BetterAuth with `trainer`/`client` roles; client dashboard (threshold-over-time graph, homework, reminders); trainer lead/booking management; `POST /leads`, `POST /bookings`, `PATCH /bookings/:id/status`, `POST /leads/:id/convert`.
- **Phase 4 — AI & scale:** `POST /dogs/:id/summary` (Anthropic `claude-haiku-4-5`); AI spend-cap reminder; multi-tenant SaaS prep.

---

_Phase 1 implementation plan: `docs/design/plan-001-tailsup-phase1-foundations.md`._
