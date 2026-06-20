# Refined Request: TailsUp — Data-Driven Dog-Training Platform (Phase 1 Foundations)

## Category
Development

## Objective
Build the foundational layer of **TailsUp**, a data-driven dog-training platform delivered as an npm-workspaces monorepo. The full product lets a trainer record structured behavior data during sessions, lets clients track their dog's progress and do homework, captures leads/bookings through a public website, and produces cheap AI progress summaries — with structured behavior data as the long-term proprietary dataset moat. **The current deliverable is Phase 1 only**: a working monorepo with an API (Hono + Drizzle) exposing the complete database schema and two endpoints, a minimal Expo Router app proving app↔API connectivity, environment scaffolding, and an automated daily database backup. The architecture is already decided and must not be re-opened; later phases are described here for context only.

## Scope

### In scope (Phase 1 — Foundations, the deliverable being built now)
1. **Monorepo scaffold** using npm workspaces with the structure: `apps/mobile`, `apps/api`, `packages/shared`, and a root `package.json` declaring the workspaces.
2. **`apps/api`** built on Hono + TypeScript, using Drizzle ORM against PostgreSQL, implementing:
   - The **FULL database schema — all 12 entities** listed in the Data Model section below, with foreign keys, enums, JSONB columns, and the specified indexes.
   - **Drizzle migrations** generated for the full schema.
   - Endpoint **`GET /health`** — liveness/readiness probe.
   - Endpoint **`POST /sessions/:id/events`** — the 4-tap behavior-logging write (body: `triggerType`, `thresholdMeters`, `intensity`, `outcome`, `intervention`).
3. **`.env.example`** at the API (and/or root) listing all required environment variables: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AUTH_SECRET`, `RESEND_API_KEY`.
4. **`apps/mobile`** scaffolded with Expo Router (targets iOS, Android, web), containing **one screen** that calls the API's `GET /health` and visibly displays the result to prove app↔API connectivity.
5. **`packages/shared`** containing the shared TypeScript enums and DTOs (at minimum the enums used by `BehaviorEvent` and the entity types relevant to Phase 1), imported by both `apps/api` and `apps/mobile`.
6. **GitHub Action** that runs a **daily `pg_dump`** and uploads the dump to Cloudflare R2 (database backup from day one).
7. **Run/test documentation**: exact commands to install, migrate, run the API locally, run the mobile app, and verify the `/health` round-trip.

### Out of scope (Phases 2–4 — context only, NOT built now)
- **Phase 2 — Trainer view**: 4-tap quick-logging UI writing `BehaviorEvent`s; post-session detail screen (note, tags, video upload via R2 presign); dog timeline.
- **Phase 3 — Public site + Client view**: all website pages (Home, About, Services, Results, Contact + lead form, Booking) with the Design System applied; auth with `trainer`/`client` roles; client dashboard (threshold-over-time graph, homework, reminders); trainer view to list/approve leads & bookings and convert leads. The remaining endpoints (`POST /leads`, `POST /bookings`, `PATCH /bookings/:id/status`, `POST /leads/:id/convert`, `POST /media/presign`) are implemented here, not in Phase 1.
- **Phase 4 — AI & scale**: `POST /dogs/:id/summary` Haiku summary endpoint; AI spend-cap reminder; multi-tenant SaaS preparation.
- Authentication/authorization enforcement (BetterAuth) — schema may anticipate it, but role-gated behavior is not required in Phase 1 endpoints.
- Production deployment to Railway (the deploy target is fixed, but the Phase 1 acceptance is local-run + automated backup, not a live deploy).

## Requirements

### Functional requirements (Phase 1)

**FR-1 — Monorepo workspaces.** Root `package.json` declares npm workspaces covering `apps/*` and `packages/*` (at minimum `apps/api`, `apps/mobile`, `packages/shared`). Cross-package imports resolve (e.g., `apps/api` and `apps/mobile` can import from `packages/shared`).

**FR-2 — Full database schema.** All 12 entities from the Data Model section are defined in Drizzle with the exact fields, types, foreign keys, nullability, enums, and JSONB columns specified. Table names use **SINGULAR** form.

**FR-3 — Migrations.** Drizzle migrations are generated for the full schema and apply cleanly to an empty PostgreSQL database, producing all tables, foreign keys, enums, and indexes.

**FR-4 — Indexes.** The following indexes exist after migration:
- composite index on `behavior_event (sessionId, occurredAt)`
- composite index on `session (dogId, startedAt)`
- **GIN** index on `behavior_event.tags`
- index on `dog (clientId)`
- index on `client (trainerId)`

**FR-5 — `GET /health`.** Returns HTTP 200 with a small JSON body indicating the service is up (and, ideally, that the database is reachable).

**FR-6 — `POST /sessions/:id/events`.** Accepts a JSON body with `triggerType`, `thresholdMeters`, `intensity`, `outcome`, `intervention`; validates inputs against the shared enums and numeric ranges; inserts a `BehaviorEvent` linked to the session identified by `:id`; persists the `intervention → outcome` linkage; returns the created event (or its id) with an appropriate 2xx status. The `intervention` value defaults from the owning dog's `Protocol.defaultIntervention` when not provided.

**FR-7 — Environment template.** `.env.example` lists every variable named in scope item 3, with placeholder values and brief inline comments, and **no real secrets**.

**FR-8 — Mobile connectivity screen.** The Expo Router app launches and renders one screen that performs a request to `GET /health` against a configurable API base URL and displays success/failure plus the returned payload.

**FR-9 — Shared types consumed by both ends.** The enums for `triggerType` and `outcome` (and any DTOs used by the Phase 1 endpoint) are defined once in `packages/shared` and imported by both `apps/api` (for validation) and `apps/mobile`.

**FR-10 — Automated daily backup.** A GitHub Action workflow runs on a daily schedule, executes `pg_dump` against the configured database, and uploads the resulting dump to the configured R2 bucket. Credentials are sourced from GitHub Secrets, not committed.

**FR-11 — Local run/test docs.** A README (or equivalent) documents the exact commands to: install dependencies, run migrations, start the API, start the mobile app, and verify the `/health` round-trip end to end.

### Data model (full product schema — a Phase 1 requirement)
All entities below MUST be implemented in Drizzle in Phase 1. Table names are **singular**.

| Entity | Fields |
| --- | --- |
| **Trainer** | id, name, email |
| **Client** | id, trainerId (FK → Trainer), name, contact |
| **Protocol** | id, name, defaultIntervention |
| **Dog** | id, clientId (FK → Client), protocolId (FK → Protocol, nullable), name, breed, ageMonths, backgroundNotes |
| **Session** | id, dogId (FK → Dog), bookingId (FK → Booking, nullable), startedAt, location |
| **BehaviorEvent** (core) | id, sessionId (FK → Session), occurredAt, triggerType (enum: `dog`\|`human`\|`noise`\|`vehicle`\|`other`), thresholdMeters (int), intensity (int 1–10), outcome (enum: `disengaged`\|`recovered_slowly`\|`over_threshold`), intervention (text, defaults from Protocol), note (text, optional), tags (jsonb string[], optional) |
| **Media** | id, eventId (FK → BehaviorEvent), blobUrl (R2 reference), type (enum: `video`\|`image`), uploadedAt |
| **Exercise** | id, protocolId (FK → Protocol), title, instructions |
| **Homework** | id, dogId (FK → Dog), exerciseId (FK → Exercise), completed (bool), completedAt (nullable) |
| **Lead** | id, trainerId (FK → Trainer), name, contact, source, message, status (enum: `new`\|`contacted`\|`converted`\|`lost`), clientId (FK → Client, nullable; set on conversion), createdAt |
| **Booking** | id, trainerId (FK → Trainer), leadId (FK → Lead, nullable), clientId (FK → Client, nullable), type (enum: `assessment`\|`private`\|`group`), requestedAt, status (enum: `requested`\|`confirmed`\|`declined`\|`completed`\|`cancelled`), notes, createdAt |

> Note: `Session.bookingId` references `Booking` and `Booking.leadId`/`clientId` reference `Lead`/`Client`; FK ordering in migrations must account for these cross-references.

#### Data rules (must be honored)
- The "tap" fields (`triggerType`, `intensity`, `outcome`) are constrained to enums / numeric ranges so logging is button-based and analytics stay clean.
- `intervention` **defaults from `Protocol.defaultIntervention`** so session logging stays 4 taps.
- `tags` is JSONB (string array) with a **GIN index** — filterable, no migration needed to add new tag values.
- `Media` stores **only the R2 URL**, never the file.
- Every `BehaviorEvent` MUST retain the `intervention → outcome` linkage — this is the dataset moat and must never be dropped.

### Full endpoint catalog (context; only the two below are in Phase 1)
| Endpoint | Auth | Phase | In Phase 1? |
| --- | --- | --- | --- |
| `GET /health` | none | 1 | **Yes** |
| `POST /sessions/:id/events` | (none enforced in P1) | 1 | **Yes** |
| `POST /leads` | PUBLIC | 3 | No |
| `POST /bookings` | PUBLIC | 3 | No |
| `PATCH /bookings/:id/status` | TRAINER | 3 | No |
| `POST /leads/:id/convert` | TRAINER | 3 | No |
| `POST /media/presign` | (client/app) | 2 | No |
| `POST /dogs/:id/summary` | (trainer) | 4 | No |

### Non-functional requirements
**NFR-1 — Cost discipline (priority 1: low maintenance, 2: low cost, 3: no vendor lock-in, in that order).** Favor scale-to-zero (Railway), managed Postgres, R2 (no egress fees), and avoid services that incur idle cost. The architecture choices already reflect this ordering.

**NFR-2 — Low maintenance.** Prefer the simplest thing that works; add complexity only when needed. Automated backup runs without manual intervention.

**NFR-3 — No vendor lock-in.** Standard PostgreSQL (portable via Drizzle), S3-compatible object storage (R2), self-hosted auth (BetterAuth), and an HTTP framework (Hono) that runs on multiple runtimes. Backups are plain `pg_dump` artifacts.

**NFR-4 — TypeScript strict mode everywhere.** `strict: true` in every workspace's `tsconfig`; no implicit `any`; builds/type-checks pass with zero type errors.

**NFR-5 — Secrets hygiene.** No secret values committed. `.env` is git-ignored; only `.env.example` is committed. CI uses GitHub Secrets.

**NFR-6 — Offline-capable later.** The mobile app should not architecturally preclude future offline logging (the 4-tap write is designed to eventually queue offline). No offline implementation is required in Phase 1, but choices should not block it.

**NFR-7 — Web-capable single codebase.** The mobile workspace uses Expo Router so the same codebase later serves the public website (no separate Next.js project).

## Constraints

### Architecture — DECIDED and NON-NEGOTIABLE (do not re-open unless a genuine blocker is proven)
- **App + Site = ONE Expo (Expo Router) codebase** targeting iOS, Android, and web. **No separate Next.js site.**
- **API = Hono + TypeScript**, deployed to **Railway** (scale-to-zero) — fixed.
- **Database = PostgreSQL** (Railway-managed), accessed exclusively via **Drizzle ORM** — fixed.
- **Media = Cloudflare R2** with **presigned upload URLs**; the app uploads **directly to R2**, never through the API — fixed.
- **Auth = BetterAuth, self-hosted**, roles `trainer` and `client` — fixed.
- **AI = Anthropic API, model `claude-haiku-4-5`** for summaries — fixed.
- **Email = Resend** (stub when no key) — fixed.

### Process / convention constraints
- Build proceeds **phase by phase**; **STOP after Phase 1** for review. Do not implement Phase 2–4 features.
- TypeScript strict mode everywhere.
- Shared enums/types live in `packages/shared` and are imported by both `api` and `mobile`.
- Secrets in `.env`, never committed; provide `.env.example`.
- Database tables use **SINGULAR** names.
- Each phase must provide exact commands to run and test before moving on.

## Acceptance Criteria (Phase 1 — concrete, verifier-checkable)

**AC-1 — Workspace resolves.** From a clean checkout, a single install at the repo root installs all workspaces, and a trivial symbol imported from `packages/shared` resolves and type-checks in both `apps/api` and `apps/mobile`.

**AC-2 — Type check passes.** `tsc --noEmit` (or the project's type-check script) passes in every workspace with `strict: true` and zero errors.

**AC-3 — Migrations apply.** Running the Drizzle migration command against an empty PostgreSQL database succeeds and creates **all 12 tables** with singular names.

**AC-4 — Schema completeness.** Inspecting the migrated database confirms: all entity fields and types present; foreign keys present (`Client.trainerId`, `Dog.clientId`, `Dog.protocolId` nullable, `Session.dogId`, `Session.bookingId` nullable, `BehaviorEvent.sessionId`, `Media.eventId`, `Exercise.protocolId`, `Homework.dogId`, `Homework.exerciseId`, `Lead.trainerId`, `Lead.clientId` nullable, `Booking.trainerId`, `Booking.leadId` nullable, `Booking.clientId` nullable); all enums created (`triggerType`, `outcome`, media `type`, lead `status`, booking `type`, booking `status`); `BehaviorEvent.tags` is JSONB.

**AC-5 — Indexes present.** After migration, the database contains: composite index on `behavior_event(sessionId, occurredAt)`, composite index on `session(dogId, startedAt)`, a **GIN** index on `behavior_event.tags`, an index on `dog(clientId)`, and an index on `client(trainerId)`.

**AC-6 — Health endpoint.** With the API running, `GET /health` returns HTTP 200 and a JSON body indicating the service is up.

**AC-7 — Event write endpoint.** Given a valid session id, `POST /sessions/:id/events` with a body containing valid `triggerType`, `thresholdMeters`, `intensity` (1–10), `outcome`, and `intervention` returns a 2xx and persists a `BehaviorEvent` row with the `intervention → outcome` linkage intact. Invalid enum values or out-of-range `intensity` are rejected with a 4xx. When `intervention` is omitted, it is populated from the dog's `Protocol.defaultIntervention`.

**AC-8 — Env template.** `.env.example` exists and lists exactly: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AUTH_SECRET`, `RESEND_API_KEY` — with placeholders only, no real secret values. `.env` is git-ignored.

**AC-9 — Mobile connectivity proof.** The Expo app starts (at least on web for verification) and the single screen calls `GET /health`, then displays a clear success state with the returned payload (and a clear failure state if unreachable).

**AC-10 — Daily backup workflow.** A GitHub Actions workflow file exists, is scheduled daily (cron), runs `pg_dump`, and uploads the artifact to the configured R2 bucket using credentials from GitHub Secrets. Workflow YAML is valid and references no committed secrets.

**AC-11 — Run docs.** Documentation lists the exact commands to install, migrate, run the API, run the mobile app, and verify the `/health` round-trip; following them reproduces AC-6 and AC-9.

**AC-12 — Phase boundary respected.** No Phase 2–4 endpoints or UI features are implemented beyond what Phase 1 requires (schema may exist for all entities, but only `GET /health` and `POST /sessions/:id/events` are implemented as endpoints).

## Assumptions
- **[Primary keys]**: All `id` fields use a single consistent key strategy (e.g., UUID or auto-increment) chosen at implementation time; the kickoff does not mandate one. — Basis: not specified; an implementation-phase decision left open by the spec.
- **[Timestamps]**: `startedAt`, `occurredAt`, `uploadedAt`, `requestedAt`, `completedAt`, `createdAt` are timestamp columns (with timezone preferred). — Basis: field names imply temporal data.
- **[`contact` field]**: `Client.contact` and `Lead.contact` are free-text contact strings (email/phone). — Basis: kickoff uses the generic term "contact."
- **[Phase 1 endpoint auth]**: `POST /sessions/:id/events` does not enforce BetterAuth in Phase 1 (auth lands in Phase 3); it is functionally open for now. — Basis: auth enforcement is listed under Phase 3.
- **[Health check depth]**: `/health` should attempt a lightweight DB connectivity check in addition to liveness. — Basis: best practice for a probe; not contradicted by the spec.
- **[Backup retention]**: The backup workflow uploads to R2; retention/rotation policy is not specified and may default to "keep all" or a simple lifecycle rule decided later. — Basis: kickoff specifies "daily pg_dump uploaded to R2" without a retention rule.
- **[Validation library]**: Request validation for `POST /sessions/:id/events` will use a runtime validator (e.g., Zod/valibot or Hono's validator) re-using shared enum definitions; exact library is an implementation choice. — Basis: not specified.
- **[Local Postgres]**: Local development uses a developer-provided PostgreSQL (local or a Railway/Neon/dev instance via `DATABASE_URL`). — Basis: `DATABASE_URL` is the only DB config var listed.

## Open Questions
1. **Primary key strategy** — UUID vs. serial/bigserial? Affects FK column types and client-side id generation for future offline support. (Recommend UUID for offline-friendliness; defaulting to UUID unless rejected.)
2. **`pg_dump` source database in CI** — Should the daily backup target the production Railway database via a connection string in GitHub Secrets, and is the R2 bucket for backups the same as the media bucket or a separate one? (Recommend a separate backups bucket/prefix.)
3. **Backup retention/rotation** — How long should dumps be kept (e.g., last 30 days)? No policy is defined yet.
4. **Mobile verification target** — Is verifying `/health` connectivity on Expo **web** sufficient for Phase 1 acceptance, or must iOS/Android simulators also be demonstrated? (Recommend web is sufficient for Phase 1.)
5. **`POST /sessions/:id/events` default-intervention lookup** — Confirm the resolution path (Session → Dog → Protocol → defaultIntervention) when `intervention` is omitted, and the behavior when the dog has no protocol (error vs. require `intervention` in body).

## Original Request
The full raw request is preserved verbatim at:
`C:/Users/KonstantinaKirtsia/source/repos/tailsUp/prompts/001-tailsup-kickoff.md`

It contains the complete product description, the DECIDED architecture, the monorepo structure, the full data model and data rules, the endpoint list, the indexes, the phased build order (Phase 1 = current scope), the conventions, the Phase 3 website specification, and the Phase 3 design system (color tokens, typography, spacing, components, signature progress-curve element, and principles). That document is the authoritative source; this refined specification scopes and structures **Phase 1 — Foundations** as the deliverable being built now, with Phases 2–4 captured for context.
