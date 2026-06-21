# TailsUp — Technical Design (Phase 1: Foundations)

> **Status:** Design for review. This is the implementation-ready technical design for **Phase 1 — Foundations** of TailsUp, derived from the refined spec, the Phase 1 plan, the wiring investigation, and the functional ledger.
>
> **Purpose of this document:** Give multiple coder agents enough precision to implement four units (A/B/C/D) **independently and in parallel**, without re-reading each other's code or re-deciding settled questions. Every exported symbol, table column, route shape, and error path is specified here.
>
> **Inputs (authoritative — read in full before implementing):**
> - Refined spec: `docs/reference/refined-request-tailsup.md` (scope, 12-entity data model, AC-1..AC-12)
> - Plan: `docs/design/plan-001-tailsup-phase1-foundations.md` (4 units, file-ownership map, interface contract, verification)
> - Investigation: `docs/reference/investigation-tailsup-phase1.md` (version-pinned HOW-TO — follow its recommendations)
> - Functional ledger: `docs/design/project-functions.md` (FR-1..FR-11 + data model)
>
> **Scope boundary (AC-12):** The schema covers **all 12 entities**, but **only two endpoints** are implemented: `GET /health` and `POST /sessions/:id/events`. No Phase 2–4 endpoints or UI. Schema may anticipate later phases (e.g. `lead.status`, `booking.status`) but no behavior beyond the two endpoints is built.

---

## 1. System Architecture

TailsUp Phase 1 is an **npm-workspaces monorepo** with three workspaces and one CI workflow. Two workspaces are runnable apps (`apps/api`, `apps/mobile`); one is a no-build-step shared contract package (`packages/shared`) imported by both apps.

### 1.1 Component diagram (build + runtime)

```
                                  ┌──────────────────────────────────────────────────────┐
                                  │                  TailsUp monorepo (npm workspaces)     │
                                  │  root package.json  ·  tsconfig.base.json  ·  .nvmrc   │
                                  └──────────────────────────────────────────────────────┘
                                                          │
                ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
                │                                          │                                          │
   ┌────────────▼────────────┐            ┌────────────────▼───────────────┐         ┌────────────────▼──────────────┐
   │  packages/shared         │            │  apps/api  (Hono + Drizzle)     │         │  apps/mobile (Expo Router)     │
   │  @tailsup/shared         │            │  Node ≥ 20 · @hono/node-server  │         │  SDK 54 · iOS/Android/web      │
   │                          │            │                                 │         │                                │
   │  • 6 enum const arrays   │            │  src/index.ts   (Hono app)      │         │  app/_layout.tsx               │
   │  • 6 derived union types │            │  src/db.ts      (drizzle/pg)    │         │  app/index.tsx  (/health UI)   │
   │  • DTOs:                 │            │  src/schema.ts  (12 tables)     │         │                                │
   │    CreateBehaviorEvent.. │            │  src/config.ts  (env validate)  │         │  reads EXPO_PUBLIC_API_URL      │
   │    BehaviorEventDTO      │            │  src/migrate.ts (migrator)      │         │  fetch ${API_URL}/health       │
   │    HealthDTO             │            │  src/routes/health.ts           │         │                                │
   │                          │            │  src/routes/events.ts           │         │                                │
   │  NO server imports       │            │  drizzle/  (committed SQL+meta) │         │                                │
   │  (pure TS — Metro-safe)  │            │                                 │         │                                │
   └────────────┬─────────────┘           └───────────────┬─────────────────┘         └──────────────┬─────────────────┘
                │  type-only / const arrays                │ build: tsx/tsc transpiles                 │ build: Metro transpiles
                │  (import @tailsup/shared)                │ shared TS source inline                   │ shared TS source inline
                └──────────────┬───────────────────────────┴───────────────────────────┬──────────────┘
                               │ imports                                                 │ imports HealthDTO
                               ▼                                                         ▼
                         (build-time resolution via tsconfig path alias                  (runtime: Metro reads
                          + runtime via workspace symlink in node_modules)                workspace symlink)

   ── RUNTIME (HTTP) ──────────────────────────────────────────────────────────────────────────────────────

   apps/mobile  ──HTTP GET /health──▶  apps/api  ──SELECT 1──▶  PostgreSQL
   (browser/sim/device)                (port 3000)              (Railway-managed / local Docker)
                                            │
                                            └──INSERT behavior_event (POST /sessions/:id/events)──▶ PostgreSQL

   ── CI (scheduled, independent of the apps) ─────────────────────────────────────────────────────────────

   GitHub Actions (daily cron 03:00 UTC)
      pg_dump $DATABASE_URL ─Fc─▶ backup.dump ──aws s3 cp --endpoint-url R2──▶  Cloudflare R2 (R2_BACKUP_BUCKET)
```

### 1.2 External services

| Service | Wired in Phase 1? | How | Future phase |
| --- | --- | --- | --- |
| **PostgreSQL** | **Yes** | `apps/api` connects via `pg` driver + Drizzle (`DATABASE_URL`). `/health` pings it (`SELECT 1`); `POST .../events` reads + writes it. | — |
| **Cloudflare R2** | **Yes — backup path only** | The GitHub Action uploads daily `pg_dump` artifacts to a **separate backups bucket** (`R2_BACKUP_BUCKET`) via the AWS CLI against the R2 S3 endpoint. The app does **not** talk to R2 in Phase 1. | P2: media presign upload to `R2_BUCKET`. |
| **Anthropic API** | No (env var templated only) | `ANTHROPIC_API_KEY` listed in `.env.example`; no code reads it. | P4: `POST /dogs/:id/summary` (claude-haiku-4-5). |
| **Resend** | No (env var templated only) | `RESEND_API_KEY` listed in `.env.example`; no code reads it. | P3: lead/booking emails. |
| **BetterAuth** | No (env var templated only) | `AUTH_SECRET` listed in `.env.example`; **no auth tables hand-authored** (its CLI owns them in P3). | P3: trainer/client roles. |

**Build-time vs runtime relationship:**
- **Build time:** `packages/shared` is consumed as **TypeScript source** (no build step). `apps/api` transpiles it via `tsx` (dev) / `tsc` (prod build); `apps/mobile` transpiles it via Metro. The `@tailsup/shared` **path alias** in `tsconfig.base.json` gives editors and `tsc --noEmit` type resolution; the **workspace symlink** (created by `npm install` from the `"@tailsup/shared": "*"` dependency) gives bundlers/runtimes module resolution.
- **Runtime:** `apps/api` runs as a long-lived Node process listening on `process.env.PORT` (default 3000). `apps/mobile` runs in a browser/simulator/device and calls the API over HTTP. They share **no process** — only the wire contract (DTOs) and the network.

---

## 2. Data Model / Database Schema

All 12 entities live in `apps/api/src/schema.ts`. **Table names are SINGULAR** (explicit literal first arg of `pgTable` — Drizzle never pluralizes the explicit name). Column **keys are camelCase in TS**, mapped to **snake_case columns** by the Drizzle client option `casing: 'snake_case'` (applied on both the `drizzle()` client and in `drizzle.config.ts`). **Every PK is `uuid('id').primaryKey().defaultRandom()`**; every FK column is `uuid(...)`. Timestamps are `timestamp(col, { withTimezone: true })`.

### 2.1 The 6 pgEnums (DB names, values sourced from `@tailsup/shared`)

The literal value arrays come from `@tailsup/shared` so the DB enum, Zod validation, and the app share one source of truth (FR-9). If Drizzle's `pgEnum` signature complains about a `readonly` tuple, cast `as unknown as [string, ...string[]]`.

| pgEnum const | DB type name | Values (from shared array) |
| --- | --- | --- |
| `triggerTypeEnum` | `trigger_type` | `dog`, `human`, `noise`, `vehicle`, `other` (`TRIGGER_TYPES`) |
| `outcomeEnum` | `outcome` | `disengaged`, `recovered_slowly`, `over_threshold` (`OUTCOMES`) |
| `mediaTypeEnum` | `media_type` | `video`, `image` (`MEDIA_TYPES`) |
| `leadStatusEnum` | `lead_status` | `new`, `contacted`, `converted`, `lost` (`LEAD_STATUSES`) |
| `bookingTypeEnum` | `booking_type` | `assessment`, `private`, `group` (`BOOKING_TYPES`) |
| `bookingStatusEnum` | `booking_status` | `requested`, `confirmed`, `declined`, `completed`, `cancelled` (`BOOKING_STATUSES`) |

### 2.2 Tables — columns, Postgres types, nullability

All `id` columns are `uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()`. Below, "TS key → column" shows the camelCase→snake_case mapping; "PG type" is the resulting column type; **N** marks nullable columns (all others `NOT NULL`).

**`trainer`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | defaultRandom |
| name → name | text | |
| email → email | text | |

**`client`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| trainerId → trainer_id | uuid | FK → trainer.id |
| name → name | text | |
| contact → contact | text | free-text email/phone |

**`protocol`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| name → name | text | |
| defaultIntervention → default_intervention | text | source of the event default-intervention |

**`dog`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| clientId → client_id | uuid | FK → client.id |
| protocolId → protocol_id | uuid **N** | FK → protocol.id, nullable |
| name → name | text | |
| breed → breed | text | |
| ageMonths → age_months | integer | |
| backgroundNotes → background_notes | text **N** | optional |

**`session`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| dogId → dog_id | uuid | FK → dog.id |
| bookingId → booking_id | uuid **N** | FK → booking.id, nullable — **circular edge** (see 2.3) |
| startedAt → started_at | timestamptz | |
| location → location | text **N** | optional |

**`behavior_event`** (core — the moat)
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| sessionId → session_id | uuid | FK → session.id |
| occurredAt → occurred_at | timestamptz | `.defaultNow()` |
| triggerType → trigger_type | trigger_type (enum) | |
| thresholdMeters → threshold_meters | integer | validated `>= 0` |
| intensity → intensity | integer | validated `1..10` |
| outcome → outcome | outcome (enum) | |
| intervention → intervention | text **NOT NULL** | **moat — never null;** defaulted from Protocol |
| note → note | text **N** | optional |
| tags → tags | jsonb **N** | `$type<string[]>()`; **GIN-indexed** |

**`media`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| eventId → event_id | uuid | FK → behavior_event.id |
| blobUrl → blob_url | text | **R2 URL only — never the file** |
| type → type | media_type (enum) | |
| uploadedAt → uploaded_at | timestamptz | `.defaultNow()` |

**`exercise`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| protocolId → protocol_id | uuid | FK → protocol.id |
| title → title | text | |
| instructions → instructions | text | |

**`homework`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| dogId → dog_id | uuid | FK → dog.id |
| exerciseId → exercise_id | uuid | FK → exercise.id |
| completed → completed | boolean | `.default(false)` |
| completedAt → completed_at | timestamptz **N** | nullable |

**`lead`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| trainerId → trainer_id | uuid | FK → trainer.id |
| name → name | text | |
| contact → contact | text | free-text |
| source → source | text | |
| message → message | text **N** | optional |
| status → status | lead_status (enum) | `.default('new')` |
| clientId → client_id | uuid **N** | FK → client.id, nullable — set on conversion (P3) |
| createdAt → created_at | timestamptz | `.defaultNow()` |

**`booking`**
| TS key → column | PG type | Notes |
| --- | --- | --- |
| id → id | uuid PK | |
| trainerId → trainer_id | uuid | FK → trainer.id |
| leadId → lead_id | uuid **N** | FK → lead.id, nullable |
| clientId → client_id | uuid **N** | FK → client.id, nullable |
| type → type | booking_type (enum) | |
| requestedAt → requested_at | timestamptz | |
| status → status | booking_status (enum) | `.default('requested')` |
| notes → notes | text **N** | optional |
| createdAt → created_at | timestamptz | `.defaultNow()` |

### 2.3 FK relationships and the Session↔Booking circular FK

**FK inventory (must all exist after migration — AC-4):**
`client.trainerId→trainer` · `dog.clientId→client` · `dog.protocolId→protocol (N)` · `session.dogId→dog` · `session.bookingId→booking (N)` · `behavior_event.sessionId→session` · `media.eventId→behavior_event` · `exercise.protocolId→protocol` · `homework.dogId→dog` · `homework.exerciseId→exercise` · `lead.trainerId→trainer` · `lead.clientId→client (N)` · `booking.trainerId→trainer` · `booking.leadId→lead (N)` · `booking.clientId→client (N)`.

**The cycle:** `session.bookingId → booking` while `booking` does not reference `session`, but `booking.leadId → lead`, `booking.clientId → client`, and `lead.clientId → client`. The genuine TypeScript trap is `session ↔ booking`: if both sides used inline `.references()` against each other, Drizzle's types collapse to `any`. (There is also a soft cycle through `lead.clientId`/`booking.leadId`/`booking.clientId` on conversion.)

**Break strategy (the single non-optional schema review point — Risk R2):**
1. **Declaration order:** declare tables so the vast majority of FKs use simple inline `.references(() => other.id)`. Order: `trainer → protocol → client → dog → exercise → lead → booking → session → behavior_event → media → homework`. With this order, `booking.leadId`/`booking.clientId`/`booking.trainerId`/`lead.clientId`/`lead.trainerId` can all be inline because their targets (`trainer`, `lead`, `client`) are declared **before** `booking`.
2. **The one back-edge** — `session.bookingId → booking` (`booking` declared before `session`, so this can also be inline `.references(() => booking.id)`). Because `booking` is declared before `session` and `booking` does **not** reference `session`, **there is no true TS cycle** with this ordering and inline references are safe.
3. **Defensive declaration:** To guarantee no `any`-collapse regardless of editor/version quirks, declare the `session.bookingId` FK with the **standalone `foreignKey()` builder** in the table's third-arg callback rather than inline:
   ```ts
   // in session's callback:
   foreignKey({ columns: [t.bookingId], foreignColumns: [booking.id], name: 'session_booking_fk' })
   ```
   This is the investigation's recommended cycle-break and keeps types precise. If any other inline edge still collapses to `any` under the chosen ordering, apply the same standalone-`foreignKey` (or `AnyPgColumn` typed inline) treatment to it.
4. **Migration SQL review (MANDATORY, Risk R2):** after `db:generate`, open the generated SQL and confirm the `session.bookingId` constraint is emitted as `ALTER TABLE session ADD CONSTRAINT session_booking_fk ...` **after** both `session` and `booking` tables are created (drizzle-kit may split CREATE from the constraint). Also confirm `CREATE TYPE` for all 6 enums and `USING gin (tags)` for the GIN index.

### 2.4 jsonb tags

`tags` on `behavior_event` is `jsonb('tags').$type<string[]>()`, **nullable** (spec says optional — do not add `.notNull().default([])`). It is GIN-indexed for filterable tag queries with no migration to add new tag values (a data rule).

### 2.5 The 5 required indexes (AC-5)

Declared in each table's third-arg callback, which **returns an array** (drizzle-orm ≥ 0.31 / drizzle-kit ≥ 0.22):

| Index name | Table | Definition | Purpose |
| --- | --- | --- | --- |
| `behavior_event_session_occurred_idx` | behavior_event | `index(...).on(t.sessionId, t.occurredAt)` | timeline of a session's events |
| `behavior_event_tags_gin` | behavior_event | `index(...).using('gin', t.tags)` | **GIN** — filter by tag |
| `session_dog_started_idx` | session | `index(...).on(t.dogId, t.startedAt)` | a dog's sessions over time |
| `dog_client_idx` | dog | `index(...).on(t.clientId)` | a client's dogs |
| `client_trainer_idx` | client | `index(...).on(t.trainerId)` | a trainer's clients |

### 2.6 Casing and naming summary

- **Table names:** explicit singular literal — `pgTable('behavior_event', ...)`. `casing` does **not** affect table names.
- **Column names:** TS keys camelCase; `casing: 'snake_case'` auto-derives `threshold_meters` from `thresholdMeters`, etc. Each `column('explicit_snake_name', ...)` may also be given explicitly; either is acceptable, but be consistent — the plan/investigation use explicit snake_case column literals in examples, and `casing` covers any not given explicitly.
- **No BetterAuth tables** are hand-authored (its CLI owns them in P3 — avoids name collisions).

---

## 3. API Contracts / Interfaces

Base URL: `http://localhost:3000` in dev (`process.env.PORT`, default 3000). Content type `application/json`. Only two endpoints exist (AC-12).

### 3.1 `GET /health` (FR-5, AC-6)

Liveness + a lightweight DB connectivity check.

- **Request:** no params, no body.
- **Logic:** run `SELECT 1` via the Drizzle/pg client.
- **Success (DB reachable):** `200`
  ```json
  { "status": "ok", "db": "up" }
  ```
- **DB unreachable:** `200` with degraded body (chosen over 503 so the mobile screen can always render a clear payload — AC-9; documented as a Decision below):
  ```json
  { "status": "degraded", "db": "down" }
  ```
- **Response type:** `HealthDTO` from `@tailsup/shared`.

> **Decision (health on DB failure):** return **200 + `{status:'degraded', db:'down'}`** rather than 503. Rationale: the process is alive (liveness true); returning 200 lets the Expo screen distinguish "API up, DB down" from "API unreachable" and render both clearly (AC-9). If a stricter readiness probe is wanted later, a `?strict=1` variant can return 503 — out of scope now.

### 3.2 `POST /sessions/:id/events` (FR-6, AC-7)

The 4-tap behavior-logging write. `:id` is the session UUID.

**Request body** (validated by `@hono/zod-validator` over shared enums):
```jsonc
{
  "triggerType": "dog",            // required, z.enum(TRIGGER_TYPES)
  "thresholdMeters": 5,            // required, int >= 0
  "intensity": 7,                  // required, int 1..10
  "outcome": "recovered_slowly",   // required, z.enum(OUTCOMES)
  "intervention": "u-turn",        // OPTIONAL — string min 1; if omitted, defaulted from Protocol
  "note": "near the park gate",    // optional, string
  "tags": ["reactive", "leash"]    // optional, string[]
}
```
**Zod schema** (built from shared arrays so validation == DB enum == app types):
```ts
const eventBody = z.object({
  triggerType: z.enum(TRIGGER_TYPES),
  thresholdMeters: z.number().int().nonnegative(),
  intensity: z.number().int().min(1).max(10),
  outcome: z.enum(OUTCOMES),
  intervention: z.string().min(1).optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
```

**Validation & resolution rules (in order):**
1. **Body validation** via `zValidator('json', eventBody)` — invalid enum (e.g. `triggerType:"cat"`) or out-of-range `intensity` (e.g. `11`) → automatic **`400`**.
2. **Session existence:** look up `session` by `:id`. If not found → **`404`**.
3. **Default-intervention resolution** (when `intervention` omitted): resolve **Session → Dog → Protocol → `defaultIntervention`**. (Read the session's `dogId`, then the dog's `protocolId`, then the protocol's `defaultIntervention`.)
   - If the dog has **no protocol** (`protocolId` null) **or** the protocol's `defaultIntervention` is empty, and the body omitted `intervention` → **`400`** with a clear message instructing the client to supply `intervention`. (Decision D-6 — keeps `intervention` NON-NULL so the moat is never dropped.)
4. **Insert** the `behavior_event` row, preserving the `intervention → outcome` linkage (both columns set on the same row). Use `.returning()` to get the created row.

**Success:** `201` with the created event as `BehaviorEventDTO`:
```json
{
  "id": "…uuid…",
  "sessionId": "…uuid…",
  "occurredAt": "2026-06-20T10:00:00.000Z",
  "triggerType": "dog",
  "thresholdMeters": 5,
  "intensity": 7,
  "outcome": "recovered_slowly",
  "intervention": "u-turn",
  "note": null,
  "tags": ["reactive", "leash"]
}
```

**Error shapes (consistent across the API):**
| Status | When | Body |
| --- | --- | --- |
| 400 | zod validation failure | zValidator's default JSON error body (Hono/zod-validator format) |
| 400 | intervention omitted AND no protocol/defaultIntervention | `{ "error": "intervention required: dog has no protocol default" }` |
| 404 | session `:id` not found | `{ "error": "session not found" }` |
| 201 | success | `BehaviorEventDTO` (above) |

> `occurredAt` is set by the DB default (`defaultNow()`) on insert; the body does not accept it in Phase 1. `note`/`tags` default to `null` when omitted.

---

## 4. `packages/shared` Interface Contract (Unit A)

This is the **single source of truth** consumed by B and C (FR-9). The barrel is `packages/shared/src/index.ts` (`export * from './enums'; export * from './dto';`). **B and C import only from `@tailsup/shared`.**

**HARD CONSTRAINT:** `packages/shared` MUST contain **zero** server-only / runtime imports — no `drizzle-orm`, no `pg`, no Node built-ins. Only TypeScript types and `as const` literal arrays. If a server import leaks in, Metro will try to bundle drizzle/pg into the mobile app and break the build.

### 4.1 `packages/shared/src/enums.ts` — exact exports

```ts
export const TRIGGER_TYPES    = ['dog','human','noise','vehicle','other'] as const;
export const OUTCOMES         = ['disengaged','recovered_slowly','over_threshold'] as const;
export const MEDIA_TYPES      = ['video','image'] as const;
export const LEAD_STATUSES    = ['new','contacted','converted','lost'] as const;
export const BOOKING_TYPES    = ['assessment','private','group'] as const;
export const BOOKING_STATUSES = ['requested','confirmed','declined','completed','cancelled'] as const;

export type TriggerType   = (typeof TRIGGER_TYPES)[number];
export type Outcome       = (typeof OUTCOMES)[number];
export type MediaType     = (typeof MEDIA_TYPES)[number];
export type LeadStatus    = (typeof LEAD_STATUSES)[number];
export type BookingType   = (typeof BOOKING_TYPES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
```

### 4.2 `packages/shared/src/dto.ts` — exact exports

```ts
import type { TriggerType, Outcome } from './enums';

// Request body for POST /sessions/:id/events (intervention optional -> defaulted from Protocol)
export interface CreateBehaviorEventInput {
  triggerType: TriggerType;
  thresholdMeters: number;   // int, >= 0
  intensity: number;         // int, 1..10
  outcome: Outcome;
  intervention?: string;     // omitted -> resolved from dog's Protocol.defaultIntervention
  note?: string;
  tags?: string[];
}

// Response shape (the created event)
export interface BehaviorEventDTO {
  id: string;
  sessionId: string;
  occurredAt: string;        // ISO timestamp
  triggerType: TriggerType;
  thresholdMeters: number;
  intensity: number;
  outcome: Outcome;
  intervention: string;      // never null (moat)
  note: string | null;
  tags: string[] | null;
}

// GET /health response shape
export interface HealthDTO {
  status: 'ok' | 'degraded';
  db?: 'up' | 'down';
}
```

### 4.3 Who imports what

| Symbol | Imported by B (api) | Imported by C (mobile) |
| --- | --- | --- |
| `TRIGGER_TYPES`, `OUTCOMES` | ✅ `pgEnum(...)` + `z.enum(...)` | — |
| `MEDIA_TYPES`, `LEAD_STATUSES`, `BOOKING_TYPES`, `BOOKING_STATUSES` | ✅ `pgEnum(...)` | — |
| `CreateBehaviorEventInput`, `BehaviorEventDTO` | ✅ handler typing | — |
| `HealthDTO` | ✅ `/health` return typing | ✅ types the `/health` fetch result |

---

## 5. File Structure / Module Organization

```
tailsup/
├── package.json                     # [A] private, workspaces ["apps/*","packages/*"], typecheck fan-out, engines node>=20
├── tsconfig.base.json               # [A] strict, moduleResolution bundler, @tailsup/shared path alias, noEmit
├── .nvmrc                           # [A] 20
├── .gitignore                       # [A] node_modules,.env,.env.*,dist,.expo,...  + negation !.env.example
├── .env.example                     # [D] EXACT 8 vars (placeholders) + commented EXPO_PUBLIC_API_URL / R2_BACKUP_BUCKET
├── README.md                        # [D] run/test docs
├── .github/workflows/db-backup.yml  # [D] daily pg_dump -> R2
├── packages/
│   └── shared/                      # [A] no-build contract package
│       ├── package.json             #     main/types/exports -> ./src/index.ts ; "@tailsup/shared"
│       ├── tsconfig.json            #     extends ../../tsconfig.base.json ; include ["src"]
│       └── src/
│           ├── index.ts             #     barrel: export * from enums + dto
│           ├── enums.ts             #     6 const arrays + 6 union types
│           └── dto.ts               #     CreateBehaviorEventInput, BehaviorEventDTO, HealthDTO
├── apps/
│   ├── api/                         # [B] Hono + Drizzle
│   │   ├── package.json             #     deps: @tailsup/shared,hono,@hono/node-server,@hono/zod-validator,zod,drizzle-orm,pg
│   │   │                            #     devDeps: drizzle-kit,@types/pg,tsx,typescript ; scripts dev/start/db:*/typecheck/build
│   │   ├── tsconfig.json            #     extends base ; include ["src","drizzle.config.ts"] ; noEmit:false,outDir:dist for build
│   │   ├── drizzle.config.ts        #     dialect postgresql, schema ./src/schema.ts, out ./drizzle, casing snake_case
│   │   ├── drizzle/                 #     generated SQL + meta/  (COMMIT — AC-3 auditability)
│   │   └── src/
│   │       ├── index.ts             #     Hono app + serve() on PORT; mount health + events; NO other routes
│   │       ├── config.ts            #     validated env reader (throws on missing required vars)
│   │       ├── db.ts                #     drizzle(pg) client + schema re-export; casing snake_case
│   │       ├── schema.ts            #     all 12 singular tables, 6 pgEnums, jsonb+GIN, 5 indexes, circular FK
│   │       ├── migrate.ts           #     programmatic migrate() runner -> process.exit(0)
│   │       └── routes/
│   │           ├── health.ts        #     GET /health (SELECT 1)
│   │           └── events.ts        #     POST /sessions/:id/events
│   └── mobile/                      # [C] Expo Router (iOS/Android/web)
│       ├── package.json             #     dep: @tailsup/shared ; scripts start/web/typecheck
│       ├── tsconfig.json            #     extends base (+ expo/tsconfig.base) ; strict ; keep @tailsup/shared alias
│       ├── app.json                 #     Expo app config
│       ├── .env.example             #     EXPO_PUBLIC_API_URL + dev-networking matrix (mobile-local)
│       ├── babel.config.js          #     (if scaffold requires)
│       ├── metro.config.js          #     ONLY if C2 resolution fails (C3 fallback) — else absent
│       └── app/
│           ├── _layout.tsx          #     minimal Expo Router Stack
│           └── index.tsx            #     /health connectivity screen (loading/success/failure + retry)
```

`[A]/[B]/[C]/[D]` = owning unit. **No two units write the same file** (see §10).

---

## 6. Key Logic

### 6.1 `POST /sessions/:id/events` flow

```
POST /sessions/:id/events
  │
  ├─ zValidator('json', eventBody)              # auto-400 on bad enum / intensity out of 1..10 / wrong types
  │
  ├─ sessionId = c.req.param('id')
  ├─ session  = db.select().from(session).where(eq(session.id, sessionId)).limit(1)
  │     └─ none?  ──▶  404 { error: 'session not found' }
  │
  ├─ body = c.req.valid('json')                 # typed CreateBehaviorEventInput shape
  │
  ├─ intervention resolution:
  │     if body.intervention present  ─▶  use it
  │     else:
  │        dog      = db ... where(eq(dog.id, session.dogId))
  │        protocol = dog.protocolId ? db ... where(eq(protocol.id, dog.protocolId)) : null
  │        resolved = protocol?.defaultIntervention
  │        if !resolved  ──▶  400 { error: 'intervention required: dog has no protocol default' }   # D-6 (moat)
  │        else use resolved
  │
  ├─ insert into behavior_event {
  │     sessionId, triggerType, thresholdMeters, intensity, outcome,
  │     intervention: <body or resolved>,        # NOT NULL — moat linkage preserved
  │     note: body.note ?? null,
  │     tags: body.tags ?? null
  │     # occurredAt left to DB defaultNow()
  │  }.returning()
  │
  └─ 201  BehaviorEventDTO(createdRow)           # map row -> DTO (occurredAt -> ISO string)
```
The single SELECT-then-resolve can be done as 1–3 small queries (session, dog, protocol). A single join is also acceptable; correctness and the 400-when-no-default path are what matter.

### 6.2 `/health` DB ping

```
GET /health
  ├─ try:  await db.execute(sql`select 1`)        # or pool.query('SELECT 1')
  │        └─ ok   ─▶  200 { status:'ok',       db:'up'   }   (HealthDTO)
  └─ catch:          ─▶  200 { status:'degraded', db:'down' }  (HealthDTO)
```
Liveness is implicit (the handler ran). The `try/catch` distinguishes DB-down without failing the whole probe.

---

## 7. Error-Handling Strategy

**No fallback values for missing configuration.** Required env vars are read through a **validated config module** (`apps/api/src/config.ts`) that **throws on any missing required variable** — the process fails fast at startup instead of running with a silent default.

```ts
// apps/api/src/config.ts  (Unit B)
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3000),   // PORT is the ONLY optional var, with a documented default
} as const;
```
- `DATABASE_URL` is required and **never defaulted** — `config.ts` throws if absent. `db.ts`, `migrate.ts`, and `drizzle.config.ts` consume `config.databaseUrl` (or `process.env.DATABASE_URL!` in the drizzle-kit config, which runs only via the CLI).
- `PORT` is the single intentionally-optional var, with a documented default of 3000 (an operational convenience, not a secret/config fallback).
- Phase 1 code reads no other secrets; `ANTHROPIC_API_KEY`, `R2_*`, `AUTH_SECRET`, `RESEND_API_KEY` are templated for later phases and not read by Phase 1 code, so they are not in the required set yet (adding them to `required()` would break startup with no consumer).

**Request validation errors → 4xx with a clear body.** `@hono/zod-validator` returns `400` automatically with a structured error body for malformed input. Domain errors return explicit JSON: `404 {error:'session not found'}`, `400 {error:'intervention required: …'}`.

**DB errors at runtime** (e.g. `/health` ping fails) are caught and surfaced as the degraded health body; unexpected handler errors fall through to Hono's default error response (500) — acceptable for Phase 1.

**Secrets hygiene (NFR-5):** secrets live only in `.env` (git-ignored); only `.env.example` (placeholders) is committed; CI uses GitHub Secrets. No secret literal appears in any committed file.

---

## 8. Technology Choices With Justification

The stack is **fixed and non-negotiable** (Expo Router app+site; Hono+TS API on Railway; PostgreSQL via Drizzle; R2; BetterAuth; Anthropic haiku; Resend). Only the **within-stack** picks need justification:

| Pick | Choice | Why (Phase 1) |
| --- | --- | --- |
| **Postgres driver** | `pg` (node-postgres) via `drizzle-orm/node-postgres` | No prepared-statement-by-default surprises (unlike `postgres.js`), trivial SSL, most-documented Drizzle pairing, fully portable (NFR-3). Lowest surprise/maintenance (NFR-2). |
| **Migration mode** | `generate` → review SQL → commit → `migrate` (never `push` for the deliverable) | Versioned, auditable migration files apply cleanly to an empty DB (AC-3); `push` can silently round-trip/skip changes and risks drift. `db:push` exists but is labeled scratch-only. |
| **Shared package** | No-build TS-source package + tsconfig path alias + workspace dep (not TS Project References) | Metro transpiles TS natively; `tsx`/`tsc` transpiles for the API; no build orchestration (NFR-2). Project References add a `tsc -b` build graph the deliverable doesn't need. |
| **Primary keys** | UUID `uuid().defaultRandom()` everywhere | Offline-friendly (NFR-6): a future offline 4-tap write can mint its own `id` before sync. Uniform FK column type. (D-1.) |
| **Validation** | `@hono/zod-validator` + Zod, `z.enum(SHARED_ARRAY)` | Declarative schemas, automatic 400s, type inference into handlers, and **one enum source** shared with `pgEnum` (FR-9). (D-7.) |
| **API runtime** | Node via `@hono/node-server` v2, `process.env.PORT` (default 3000) | Matches the Railway deploy target; Hono is multi-runtime (NFR-3). (D-9.) |
| **Metro config** | Start with **zero** `metro.config.js`; add fallback only if resolution fails | SDK 54 auto-configures monorepos; less config = less maintenance (NFR-2). Fallback (`watchFolders`+`nodeModulesPaths`) documented in C3. |
| **Health on DB failure** | `200 + degraded` (not 503) | Lets the mobile screen render a clear "API up, DB down" state distinct from "API unreachable" (AC-9). |
| **Backup format/bucket** | `pg_dump -Fc` to a **separate** `R2_BACKUP_BUCKET`, date-prefixed keys | `-Fc` is compressed + `pg_restore`-able and still a portable artifact (NFR-3); separate bucket isolates dumps from media; date prefix enables a later lifecycle rule with no code change. (D-2/D-3/D-4.) |

---

## 9. Integration Points & Inter-Unit Contracts

### 9.1 Dependency ordering — **A lands first**

```
        ┌─────────────────────────────────────────────┐
        │  UNIT A — root + workspaces + tsconfig.base  │   (must land + commit first)
        │           + packages/shared (the contract)   │
        └───────────────┬─────────────┬────────────────┘
                        │             │
        ┌───────────────▼──┐   ┌──────▼───────────┐   ┌──────────────────────────┐
        │ UNIT B — apps/api │   │ UNIT C — apps/   │   │ UNIT D — backup workflow  │
        │ Hono+Drizzle      │   │ mobile (Expo)    │   │ + README + .env.example   │
        │ (depends on A)    │   │ (depends on A)   │   │ (no code dep on B/C)      │
        └───────────────────┘   └──────────────────┘   └──────────────────────────┘
```
- **B and C both `import` from `@tailsup/shared`** (Unit A). They will **not type-check until A exists and is committed**. Therefore: **finish and commit Unit A first**, then dispatch B, C, D in parallel.
- **D has no source dependency on B/C** and may run fully in parallel from the start — its README references files/commands from B and C, all of which are specified in this design and the plan.

### 9.2 What A exports that B/C consume (the wire/type contract)

| Consumer | Imports from `@tailsup/shared` | Used for |
| --- | --- | --- |
| **B (api)** | `TRIGGER_TYPES`, `OUTCOMES`, `MEDIA_TYPES`, `LEAD_STATUSES`, `BOOKING_TYPES`, `BOOKING_STATUSES` | `pgEnum(...)` definitions in `schema.ts` |
| **B (api)** | `TRIGGER_TYPES`, `OUTCOMES` | `z.enum(...)` in the events Zod schema |
| **B (api)** | `CreateBehaviorEventInput`, `BehaviorEventDTO`, `HealthDTO` | handler/response typing |
| **C (mobile)** | `HealthDTO` | typing the `/health` fetch result |

**Contract invariants both ends rely on:**
- The 6 enum arrays' **values exactly equal** the DB enum values and the app's accepted strings (one source — FR-9).
- `BehaviorEventDTO.intervention` is **always a non-empty string** (never null — the moat).
- `HealthDTO.status` is `'ok'|'degraded'`; `db` is `'up'|'down'|undefined`.
- `packages/shared` stays **pure** (no server imports) so Metro can bundle it (C depends on this).

### 9.3 Runtime integration points

| From | To | Mechanism | Phase 1 |
| --- | --- | --- | --- |
| mobile screen | api `/health` | HTTP GET, base URL `EXPO_PUBLIC_API_URL` | ✅ |
| api | PostgreSQL | `pg` pool via Drizzle (`DATABASE_URL`) | ✅ |
| GitHub Action | PostgreSQL | `pg_dump $DATABASE_URL` | ✅ |
| GitHub Action | Cloudflare R2 | `aws s3 cp --endpoint-url …r2…` → `R2_BACKUP_BUCKET` | ✅ |
| app | R2 (presign) | — | ❌ P2 |
| api | Anthropic / Resend / BetterAuth | — | ❌ P3/P4 |

---

## 10. Implementation Units (parallel-safe) & File Ownership

After **Unit A is committed**, Units B, C, and D are built by **independent coder agents in parallel** — their file sets are **disjoint** (no two units touch the same file). Each agent reads this design + the plan + the two reference docs.

| Unit | Owns / creates (EXCLUSIVE) | Depends on | Satisfies (AC) |
| --- | --- | --- | --- |
| **A** | repo root: `package.json`, `tsconfig.base.json`, `.nvmrc`, `.gitignore`; `packages/shared/**` (`package.json`, `tsconfig.json`, `src/index.ts`, `src/enums.ts`, `src/dto.ts`) | — (lands first) | AC-1, AC-2 (establishes tsconfig.base), partial FR-9 |
| **B** | `apps/api/**` (`package.json`, `tsconfig.json`, `drizzle.config.ts`, `drizzle/**`, `src/index.ts`, `src/config.ts`, `src/db.ts`, `src/schema.ts`, `src/migrate.ts`, `src/routes/health.ts`, `src/routes/events.ts`) | A (committed) | AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-12 |
| **C** | `apps/mobile/**` (`package.json`, `tsconfig.json`, `app.json`, `.env.example` (mobile-local), `babel.config.js` if needed, `metro.config.js` only if C2 fails, `app/_layout.tsx`, `app/index.tsx`) | A (committed) | AC-1, AC-2, AC-9 |
| **D** | `.github/workflows/db-backup.yml`; `README.md`; **root** `.env.example` | none (code) — runs parallel | AC-8, AC-10, AC-11 |

**Two-owner conflict avoidance (Risk R7):** the canonical AC-8 `.env.example` is at the **repo root, owned by Unit D**. Unit B creates **no** API-level `.env.example` (the API reads from root `.env`/process env). Unit C's `apps/mobile/.env.example` is a distinct mobile-local file (different path) listing `EXPO_PUBLIC_API_URL` only — no conflict.

### Unit-by-unit deliverables (concise)

- **Unit A:** root workspace scaffold (`workspaces: ["apps/*","packages/*"]`, `engines.node>=20`, typecheck fan-out script); `tsconfig.base.json` (`strict`, `moduleResolution:"bundler"`, `module:"ESNext"`, `target:"ES2022"`, `esModuleInterop`, `skipLibCheck`, `baseUrl:"."`, `paths:{"@tailsup/shared":["packages/shared/src/index.ts"]}`, `noEmit`; **no** Project References/`composite`); `.gitignore` with `!.env.example` negation; `.nvmrc`=20; the no-build `@tailsup/shared` package exporting **exactly** the §4 symbols, pure TS.
- **Unit B:** api package + tooling + `config.ts` (throws on missing `DATABASE_URL`) + `db.ts` (`pg` + `casing:'snake_case'`); the full 12-entity `schema.ts` (singular tables, 6 pgEnums from shared arrays, UUID PKs, jsonb+GIN, 5 indexes, circular FK via standalone `foreignKey`); `db:generate` → **review SQL** → commit `drizzle/**` → `migrate.ts` applies to empty DB; `GET /health` + `POST /sessions/:id/events` with zod validation, Protocol default-intervention resolution, 400/404 paths, 201 + `BehaviorEventDTO`; **only these two routes** mounted.
- **Unit C:** Expo Router SDK 54 scaffold (iOS/Android/web), `@tailsup/shared` dep, strict TS, `@tailsup/shared` alias preserved; mobile `.env.example` with `EXPO_PUBLIC_API_URL` + dev-networking matrix; `app/_layout.tsx` Stack; `app/index.tsx` `/health` screen (static `process.env.EXPO_PUBLIC_API_URL` access; loading/success/failure + retry; types result as `HealthDTO`); **no metro.config.js** unless resolution fails (then the documented fallback).
- **Unit D:** root `.env.example` (EXACTLY the 8 vars + commented `EXPO_PUBLIC_API_URL`/`R2_BACKUP_BUCKET`); `db-backup.yml` (daily cron + `workflow_dispatch`; version-matched `pg_dump` from PGDG by absolute path; `-Fc` dump; `aws s3 cp` to `R2_BACKUP_BUCKET` date-prefixed; all secrets via `${{ secrets.* }}`; comments for version-match/Object-R&W/IPv4 pitfalls); `README.md` run/test docs reproducing the `/health` round-trip + networking matrix + backup-secrets setup + phase-boundary note.

---

## 11. Decisions (with rationale)

These mirror and lock the plan's D-1..D-9 defaults; they are settled for execution unless vetoed at the review gate.

| # | Decision | Rationale | Where it bites if changed |
| --- | --- | --- | --- |
| **D-1** | **UUID PKs** (`uuid().defaultRandom()`) on every table | Offline-friendly (NFR-6) — client can mint ids pre-sync; uniform FK type | All FK column types; schema + migration regenerate |
| **D-2** | `pg_dump` source = **production Railway `DATABASE_URL`** (GitHub Secret) | Backs up the real data from day one (FR-10) | Backup workflow env + secret name |
| **D-3** | **Separate** R2 backups bucket `R2_BACKUP_BUCKET` (≠ media `R2_BUCKET`) | Isolates dumps from media; clearer lifecycle | Backup upload target + secret list |
| **D-4** | **Defer** backup retention; date-prefixed keys (`YYYY-MM-DD/backup.dump`) | Keep-all now; an R2 lifecycle rule (e.g. 30-day) is trivial later thanks to date prefix | None now |
| **D-5** | **Expo web** is sufficient for AC-9 verification | Web proves the round-trip; native sims optional. Docs still list localhost/`10.0.2.2`/LAN matrix | What the verifier launches |
| **D-6** | No protocol/default → **HTTP 400** when `intervention` omitted | Keeps `intervention` NON-NULL — the moat is never dropped | Events endpoint error path |
| **D-7** | **`@hono/zod-validator` + Zod** with `z.enum(SHARED_ARRAY)` | Auto-400, type inference, single enum source (FR-9) | Events validation; `zod` dep |
| **D-8** | **`pg` (node-postgres)** driver | No prepared-statement surprises, trivial SSL, most-documented (NFR-2/3) | DB client + deps |
| **D-9** | **Node** via `@hono/node-server`, `process.env.PORT` (default 3000) | Matches Railway target; multi-runtime Hono (NFR-3) | API entrypoint |
| **D-10** | `/health` returns **200 + degraded** on DB failure (not 503) | Mobile can distinguish "DB down" from "API unreachable" (AC-9) | `health.ts` response |
| **D-11** | Required env via **throwing config module**; `PORT` the only optional var | No silent config fallbacks; fail fast (spec convention) | `config.ts`; consumers of `DATABASE_URL` |

**Resume signal for the gate:** "approved" to proceed with all defaults, or name the decision(s) to change (e.g. "D-1 → bigserial", "D-4 → 30-day retention", "D-10 → 503").

---

## 12. Verification (maps to AC-1..AC-12)

Run from repo root against an empty Postgres (`DATABASE_URL` set):

```bash
# AC-1, AC-2 — install + strict type-check across all workspaces
npm install
npm run typecheck --workspaces --if-present          # zero errors in shared, api, mobile

# AC-3, AC-4, AC-5 — migrate to empty DB, then inspect
npm run db:generate -w apps/api                       # (committed; regen idempotent)
npm run db:migrate  -w apps/api                       # exits 0
psql "$DATABASE_URL" -c "\dt"                         # 12 singular tables
psql "$DATABASE_URL" -c "\dT"                         # 6 enums
psql "$DATABASE_URL" -c "\d behavior_event"           # tags jsonb + GIN; composite (session_id, occurred_at)
psql "$DATABASE_URL" -c "\d session"                  # composite (dog_id, started_at); booking_id FK nullable
psql "$DATABASE_URL" -c "\d dog"; psql "$DATABASE_URL" -c "\d client"   # dog(client_id), client(trainer_id) idx

# AC-6, AC-7 — run API + exercise endpoints (seed a session/dog/protocol first)
npm run dev -w apps/api &                             # PORT 3000
curl -s localhost:3000/health                         # 200 {"status":"ok","db":"up"}
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"dog","thresholdMeters":5,"intensity":7,"outcome":"recovered_slowly","intervention":"u-turn"}'  # 201
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"cat","thresholdMeters":5,"intensity":7,"outcome":"recovered_slowly"}'                          # 400 bad enum
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"dog","thresholdMeters":5,"intensity":11,"outcome":"disengaged","intervention":"x"}'           # 400 range
# omit intervention, dog HAS protocol -> 201, stored intervention == protocol.default_intervention
# omit intervention, dog has NO protocol -> 400

# AC-8 — env template
test -f .env.example && git check-ignore .env && ! git check-ignore .env.example

# AC-9 — mobile web round-trip
npm run web -w apps/mobile                            # success state shows /health payload; stop API -> failure state

# AC-10 — backup workflow valid, no committed secrets
npx --yes @action-validator/cli .github/workflows/db-backup.yml

# AC-11 — README steps reproduce AC-6 + AC-9 (manual follow-through)
# AC-12 — only two endpoints (grep routes; no leads/bookings/media/summary handlers)
```

---

## 13. Risks & Mitigations (carried from the plan)

| ID | Risk | Mitigation (in this design) |
| --- | --- | --- |
| **R1** | Metro can't resolve `@tailsup/shared` | Zero metro config first (SDK 54 auto); fallback `watchFolders`+`nodeModulesPaths` in C3; keep `shared` pure (no server imports). |
| **R2** | Circular FK → `any`-collapse or bad migration SQL | Declaration ordering (§2.3) + standalone `foreignKey()` for `session.bookingId`; **mandatory** generated-SQL review (back-edge `ALTER TABLE` after both tables). |
| **R3** | `pg_dump` major-version mismatch | Install `postgresql-client-<major>` from PGDG matched to the Railway server; call absolute binary; confirm via `SELECT version();` before first run. |
| **R4** | `drizzle-kit push` drift | `generate`→`migrate` for the deliverable; `db:push` labeled scratch-only, never in verification. |
| **R5** | `EXPO_PUBLIC_API_URL` not inlined | Static dot-access only in `index.tsx`. |
| **R6** | R2 upload 403 | R2 token must be Object Read & Write; set `AWS_DEFAULT_REGION: auto`. |
| **R7** | Two-owner `.env.example` conflict | Root `.env.example` is Unit D's alone; Unit B creates none; mobile's is a different path. |

---

_Phase 1 plan: `docs/design/plan-001-tailsup-phase1-foundations.md` · Refined spec: `docs/reference/refined-request-tailsup.md` · Investigation: `docs/reference/investigation-tailsup-phase1.md` · Functional ledger: `docs/design/project-functions.md`._

---
---

# Phase 2 — Trainer View

> **Status:** Design for review at the **design gate**. This section **extends** the Phase 1 design above — it does **not** rewrite it. Everything in Phase 1 (the schema, `GET /health`, `POST /sessions/:id/events`, the `@tailsup/shared` enums/DTOs, the single Expo health screen) stays exactly as built. Phase 2 appends three trainer-facing Expo Router screens, the supporting read/media API endpoints, and the new `@tailsup/shared` DTOs they share.
>
> **Build scope: Phase 2 ONLY.** No auth, no public site, no client view, no AI, no leads/bookings, **no schema migration** (the `media`, `behavior_event.note`, `behavior_event.tags` columns already exist — verified in `apps/api/src/db/schema.ts`).
>
> **Inputs (authoritative):** `docs/design/plan-002-tailsup-phase2-trainer-view.md` (units A/B/C, file ownership, gate G-1..G-8, risks) · `docs/reference/refined-request-phase2.md` (scope, endpoints, DTOs, AC-1..AC-13) · `docs/reference/investigation-phase2.md` (the HOW + pitfalls) · `docs/reference/codebase-scan-phase2.md` (integration points).
>
> **Purpose:** Give three coder agents (Units A / B / C) enough precision to implement **independently and in parallel** on disjoint file sets, without re-reading each other's code or re-deciding settled questions. Every exported DTO, route shape, status code, query strategy, and screen contract is specified below.

---

## P2.1 Phase 2 Architecture (delta over Phase 1)

Phase 2 adds **one new runtime integration edge** the Phase 1 diagram did not have: **the device uploads media bytes directly to Cloudflare R2**, never through the API (NFR-2). The API only *issues a presigned URL* and *records the resulting object reference* — it never receives the file.

```
   ── PHASE 2 RUNTIME (HTTP) ───────────────────────────────────────────────────────────────────

   apps/mobile (trainer)                       apps/api (Hono, :3000)                  PostgreSQL
   ─────────────────────                       ──────────────────────                  ──────────
   dog list  ───────GET /trainers/:tid/dogs──▶ dogs.ts   ──select+join──▶              dog⋈client
   timeline  ───────GET /dogs/:id/timeline──▶  dogs.ts   ──2 selects + group──▶        session,event
   4-tap log ───────POST /sessions/:id/events▶ sessions.ts (Phase 1, unchanged)──▶     behavior_event
   start ses ───────POST /dogs/:id/sessions──▶ dogs.ts   ──insert──▶                   session
   detail    ───────GET /events/:id─────────▶  events.ts ──select+media──▶             behavior_event,media
   edit n/t  ───────PATCH /events/:id───────▶  events.ts ──update note/tags──▶         behavior_event
                                                   │
   ┌── video upload (the new direct-to-R2 edge — NFR-2) ──────────────────────────────────────────┐
   │ 1. POST /media/presign {eventId,contentType} ─▶ media.ts ─getSignedUrl(PUT)─▶ returns uploadUrl│
   │      (media.ts lazily reads R2_* via getR2Config(); 503 if unconfigured — NFR-4)              │
   │ 2. PUT <uploadUrl> (raw video bytes) ───────────────────────────────────▶ Cloudflare R2       │
   │      (device → R2 directly; bytes NEVER transit the API)                   (R2_BUCKET)         │
   │ 3. POST /events/:id/media {key,contentType} ─▶ events.ts ─insert──▶ media row (blobUrl=key ref)│
   └───────────────────────────────────────────────────────────────────────────────────────────────┘
```

**External services delta vs Phase 1 §1.2:** Cloudflare R2 moves from "backup path only" to **also the media-presign path** in `apps/api` (the `R2_BUCKET` media bucket, distinct from `R2_BACKUP_BUCKET`). Anthropic / Resend / BetterAuth remain untouched (P3/P4).

**What does NOT change:** the monorepo layout, the build-time vs runtime relationship of `@tailsup/shared` (still pure-TS, Metro-transpiled), the `pg`+Drizzle client (`casing:'snake_case'`), the throwing `config.ts` for `DATABASE_URL`/`PORT`, the `cors()`/`onError`/`notFound` middleware, and the two Phase 1 endpoints.

---

## P2.2 New Shared DTOs (Unit A — `@tailsup/shared`, LANDS FIRST)

**File:** `packages/shared/src/dtos.ts` — **append** the block below beneath the existing Phase 1 DTOs. **Do not modify** the existing `CreateBehaviorEventInput`, `BehaviorEventDTO`, `HealthDTO` (byte-for-byte unchanged). The barrel `packages/shared/src/index.ts` is `export * from './enums'; export * from './dtos';` — **no barrel edit needed** (new exports are picked up automatically).

**HARD CONSTRAINT (NFR-5 / AC-2):** pure TypeScript only. **Zero** runtime/server imports — no `drizzle-orm`, no `pg`, no AWS SDK, no `node:` built-ins. The only import is the existing type-only line, to which `MediaType` is added. If any server import leaks in, Metro will try to bundle it into the mobile app and break the build.

The existing import line:
```ts
import type { TriggerType, Outcome } from './enums';
```
becomes:
```ts
import type { TriggerType, Outcome, MediaType } from './enums';
```

Then append:

```ts
// ── Phase 2 DTOs (Trainer View) — appended below the Phase 1 DTOs ───────────────

// A media row — stores the R2 object REFERENCE only, never the file (FR-A2).
export interface MediaDTO {
  id: string;
  eventId: string;
  blobUrl: string;          // R2 object reference (G-7: key-only/private — see P2.4)
  type: MediaType;          // 'video' | 'image' — Phase 2 ships 'video'
  uploadedAt: string;       // ISO timestamp
}

// A behavior event plus its media — returned by GET /events/:id (FR-A8).
export interface BehaviorEventWithMediaDTO extends BehaviorEventDTO {
  media: MediaDTO[];
}

// A list-endpoint row: the Phase 1 event shape plus a media COUNT (FR-A5, OQ-3).
// Distinct named type so the base BehaviorEventDTO (Phase 1) is NOT mutated.
export interface BehaviorEventListItemDTO extends BehaviorEventDTO {
  mediaCount: number;
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

// One session under a dog (FR-A4), with its event count (no events embedded).
export interface SessionSummaryDTO {
  id: string;
  startedAt: string;        // ISO timestamp
  location: string | null;
  eventCount: number;
}

// A dog with its sessions, no events (FR-A4).
export interface DogDetailDTO extends DogSummaryDTO {
  sessions: SessionSummaryDTO[];
}

// One session with its events, for the timeline (FR-A6).
export interface TimelineSessionDTO {
  id: string;
  startedAt: string;        // ISO timestamp
  location: string | null;
  events: BehaviorEventDTO[]; // reverse-chronological within the session
}

// The dog timeline (FR-A6): sessions reverse-chronological by startedAt,
// events reverse-chronological within each session.
export interface DogTimelineDTO {
  dog: DogSummaryDTO;
  sessions: TimelineSessionDTO[];
}

// POST /media/presign request (FR-A1).
export interface PresignRequest {
  eventId: string;
  contentType: string;      // must be in the allowed set (G-6: video/mp4 | video/quicktime)
}

// POST /media/presign response (FR-A1). The client MUST echo `headers` on the PUT.
export interface PresignResponse {
  uploadUrl: string;        // the presigned R2 PUT URL
  method: 'PUT';
  headers: Record<string, string>; // e.g. { 'Content-Type': 'video/mp4' } — echo on PUT
  key: string;              // events/<eventId>/<uuid>.<ext>
  expiresInSeconds: number; // 600 (G-5) — client may re-request on expiry
}

// POST /events/:id/media request (FR-A2). Records the row AFTER the device
// confirms the direct upload succeeded. eventId comes from the path.
export interface CreateMediaInput {
  key: string;              // the exact key returned by presign
  contentType: string;      // must be in the allowed set (G-6); derives type='video'
}

// PATCH /events/:id request (FR-A7). Partial — only note/tags are mutable;
// the four tap fields + intervention are IMMUTABLE (not in this shape — AC-4).
export interface UpdateBehaviorEventInput {
  note?: string | null;
  tags?: string[] | null;
}
```

**Exported DTO count check (AC-2):** the 11 names listed in FR-A11 — `MediaDTO`, `BehaviorEventWithMediaDTO`, `DogSummaryDTO`, `SessionSummaryDTO`, `DogDetailDTO`, `TimelineSessionDTO`, `DogTimelineDTO`, `PresignRequest`, `PresignResponse`, `CreateMediaInput`, `UpdateBehaviorEventInput` — plus the recommended `BehaviorEventListItemDTO` (12 total). All re-export through the barrel.

**Who imports what (the wire/type contract):**

| Symbol | Imported by B (api) | Imported by C (mobile) |
| --- | --- | --- |
| `DogSummaryDTO`, `DogDetailDTO`, `SessionSummaryDTO` | ✅ handler return typing | ✅ list/detail/start-session screens |
| `DogTimelineDTO`, `TimelineSessionDTO` | ✅ timeline handler | ✅ timeline screen |
| `BehaviorEventWithMediaDTO`, `BehaviorEventListItemDTO` | ✅ event/session-events handlers | ✅ detail + timeline rows |
| `MediaDTO` | ✅ `POST /events/:id/media` return | ✅ media list in detail |
| `PresignRequest`, `PresignResponse` | ✅ presign handler | ✅ upload flow |
| `CreateMediaInput`, `UpdateBehaviorEventInput` | ✅ zod body typing | ✅ request bodies |
| `MediaType` (existing enum) | ✅ `MediaDTO.type` | ✅ `MediaDTO.type` |
| `BehaviorEventDTO` (Phase 1) | ✅ reused, extended | ✅ reused |

**Verify (Unit A):** `npm run typecheck -w packages/shared` → 0 errors; `grep -REn "drizzle|from 'pg|aws|node:|require\(" packages/shared/src` → no matches (purity); `import { PresignResponse } from '@tailsup/shared'` resolves. **Commit Unit A before dispatching B and C.**

---

## P2.3 API Endpoint Contracts (Unit B — `apps/api`)

Base URL `http://localhost:3000` (dev); all JSON; ISO timestamps; error bodies `{ error: '...' }` (the Phase 1 convention). Status codes: `200` reads · `201` creates · `400` validation · `404` unknown id · `503` R2 unconfigured (presign only) · `500` unexpected. Every route module mirrors Phase 1: `export const <name> = new Hono()`, `zValidator('json'|'param', …)` first, `db.select()/insert()/update()` via `../db/client.js`, ESM `.js` import specifiers, `{ error }` JSON on domain failures. New sub-apps are mounted in `app.ts` after the existing two.

### P2.3.0 Wire-contract summary table

| Method + path | File | Request | Success | Errors | FR / AC |
| --- | --- | --- | --- | --- | --- |
| `GET /trainers/:trainerId/dogs` | `dogs.ts` | — | `200 DogSummaryDTO[]` (unknown trainer → `[]`) | — | FR-A3 / AC-3 |
| `GET /dogs/:id` | `dogs.ts` | — | `200 DogDetailDTO` | `404` | FR-A4 / AC-3 |
| `GET /dogs/:id/timeline` | `dogs.ts` | — | `200 DogTimelineDTO` (reverse-chron) | `404` | FR-A6 / AC-3 |
| `POST /dogs/:id/sessions` | `dogs.ts` | `{ startedAt?, location? }` | `201 SessionSummaryDTO` | `400`, `404` | G-2/OQ-7 / AC-3 |
| `GET /sessions/:id/events` | `sessions.ts` (extend) | — | `200 BehaviorEventListItemDTO[]` (chronological) | `404` | FR-A5 / AC-3 |
| `GET /events/:id` | `events.ts` | — | `200 BehaviorEventWithMediaDTO` | `404` | FR-A8 / AC-3 |
| `PATCH /events/:id` | `events.ts` | `UpdateBehaviorEventInput` | `200 BehaviorEventDTO` | `400`, `404` | FR-A7 / AC-4 |
| `POST /events/:id/media` | `events.ts` | `CreateMediaInput` | `201 MediaDTO` | `400`, `404` | FR-A2 / AC-7 |
| `POST /media/presign` | `media.ts` | `PresignRequest` | `200 PresignResponse` | `400`, `404`, `503` | FR-A1 / AC-5 |

### P2.3.1 `GET /trainers/:trainerId/dogs` (FR-A3)

- **Request:** path param `trainerId` (UUID).
- **Logic:** `db.select(<DogSummaryDTO cols>).from(dog).innerJoin(client, eq(dog.clientId, client.id)).where(eq(client.trainerId, trainerId))`. Maps each row → `DogSummaryDTO` (`protocolId` may be null).
- **Success:** `200 DogSummaryDTO[]`. **Unknown/empty trainer → `200 []`** (G-1/OQ-1 — an unauthenticated read returns the empty set, not 404; the eventual auth swap replaces the path id with the session trainer).
- No validation beyond the param being a string; an invalid-UUID string simply yields `[]` (the join matches nothing).

### P2.3.2 `GET /dogs/:id` (FR-A4)

- **Logic:** (1) fetch the dog by id → **404 `{ error: 'dog not found' }`** if absent. (2) fetch its sessions with a grouped event count: `db.select({ id, startedAt, location, eventCount: count(behaviorEvent.id) }).from(session).leftJoin(behaviorEvent, eq(behaviorEvent.sessionId, session.id)).where(eq(session.dogId, id)).groupBy(session.id).orderBy(desc(session.startedAt))` (uses `session_dog_started_idx`). `count()` from `drizzle-orm`.
- **Success:** `200 DogDetailDTO` = `DogSummaryDTO` + `sessions: SessionSummaryDTO[]` (`eventCount` is the grouped count, `0` for an empty session).

### P2.3.3 `GET /dogs/:id/timeline` (FR-A6) — the nested-ordering read

- **Logic (a small fixed number of queries — NFR-7, no N+1):**
  1. Fetch the dog → **404** if absent (reused as `DogTimelineDTO.dog`, mapped to `DogSummaryDTO`).
  2. `sessionRows = db.select().from(session).where(eq(session.dogId, id)).orderBy(desc(session.startedAt))` (sessions newest-first; uses `session_dog_started_idx`).
  3. If there are sessions: `eventRows = db.select().from(behaviorEvent).where(inArray(behaviorEvent.sessionId, sessionIds)).orderBy(desc(behaviorEvent.occurredAt))` — **one** query for all events across the dog's sessions (`inArray` from `drizzle-orm`; uses `behavior_event_session_occurred_idx`).
  4. Group `eventRows` by `sessionId` in TS, preserving the desc order, and attach to each session → `TimelineSessionDTO[]`. Sessions stay desc, events stay desc within each.
- **Success:** `200 DogTimelineDTO`. **This nested reverse-chronological grouping is precisely why `select()` is used, not the relational query builder** (see P2.7 / G-5-decision below). Map `occurredAt`/`startedAt` rows → ISO strings.

### P2.3.4 `POST /dogs/:id/sessions` (G-2 / OQ-7) — the one borderline write

- **Request body** (`@hono/zod-validator`):
  ```ts
  const startSessionBody = z.object({
    startedAt: z.string().datetime().optional(), // ISO; defaults to now
    location: z.string().optional(),
  });
  ```
- **Logic:** (1) verify the dog exists → **404 `{ error: 'dog not found' }`**. (2) `db.insert(session).values({ dogId: id, startedAt: body.startedAt ? new Date(body.startedAt) : new Date(), location: body.location ?? null }).returning()`.
- **Success:** `201 SessionSummaryDTO` with `eventCount: 0` (a freshly started session has no events). This unblocks the 4-tap screen — you cannot log events without a session. Note: `bookingId` is left null (a trainer-initiated session is not tied to a booking in Phase 2).

### P2.3.5 `GET /sessions/:id/events` (FR-A5) — extends `sessions.ts`

- **Added to the existing `sessions` Hono instance** (disjoint from the Phase 1 `POST /sessions/:id/events` handler in the same file).
- **Logic:** (1) verify the session exists → **404 `{ error: 'session not found' }`**. (2) `events = db.select().from(behaviorEvent).where(eq(behaviorEvent.sessionId, id)).orderBy(asc(behaviorEvent.occurredAt))` — **chronological ascending** (matches the in-session reading order and the composite index's natural order; the timeline is the reverse-chron view, a single session reads top-to-bottom). (3) media counts batched: `db.select({ eventId, c: count() }).from(media).where(inArray(media.eventId, eventIds)).groupBy(media.eventId)` → map to `mediaCount` per event (0 when absent).
- **Success:** `200 BehaviorEventListItemDTO[]` (Phase 1 `BehaviorEventDTO` shape + `mediaCount`).

### P2.3.6 `GET /events/:id` (FR-A8)

- **Logic:** (1) fetch the event → **404 `{ error: 'event not found' }`**. (2) `mediaRows = db.select().from(media).where(eq(media.eventId, id))` → `MediaDTO[]`.
- **Success:** `200 BehaviorEventWithMediaDTO` = `BehaviorEventDTO` + `media: MediaDTO[]`.

### P2.3.7 `PATCH /events/:id` (FR-A7 / AC-4) — note/tags only, the moat protected

- **Request body** (`@hono/zod-validator`) — **only** these two keys exist in the schema, so tap fields + `intervention` are structurally **un-settable** (AC-4):
  ```ts
  const patchEventBody = z.object({
    note: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
  });
  ```
- **Logic:** (1) verify the event exists → **404**. (2) build a partial `set` object containing **only the keys present in the body** (so omitting `note` leaves the column untouched; sending `note: null` clears it). If the body is empty, return the current row unchanged. (3) `db.update(behaviorEvent).set(partial).where(eq(behaviorEvent.id, id)).returning()`.
- **Success:** `200 BehaviorEventDTO` (Phase 1 shape). Tap fields/`intervention` are returned unchanged — the endpoint cannot mutate them.

### P2.3.8 `POST /events/:id/media` (FR-A2 / AC-7) — records the row, no R2 call

- **Request body** (`@hono/zod-validator`), `contentType` validated against the allow-set (G-6):
  ```ts
  const createMediaBody = z.object({
    key: z.string().min(1),
    contentType: z.enum(['video/mp4', 'video/quicktime']),
  });
  ```
- **Logic:** (1) verify the event exists → **404 `{ error: 'event not found' }`**. (2) derive `blobUrl` from the key + R2 account/bucket via `getR2Config()` (key-only/private reference — G-7; see P2.4): `https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>`. (3) `db.insert(media).values({ eventId: id, blobUrl, type: 'video' }).returning()` (`uploadedAt` is `defaultNow()`). **No AWS/R2 network call here** — the device already uploaded; this only records the row.
- **Success:** `201 MediaDTO`. The new media then appears in `GET /events/:id`'s `media[]`.

### P2.3.9 `POST /media/presign` (FR-A1 / AC-5) — see R2 module (P2.4)

- **Request body** (`@hono/zod-validator`):
  ```ts
  const presignBody = z.object({
    eventId: z.string().min(1),
    contentType: z.enum(['video/mp4', 'video/quicktime']), // G-6 allow-set
  });
  ```
- **Logic, in order:**
  1. Validate body → **400** on bad/disallowed `contentType` (e.g. `image/png`).
  2. Verify `eventId` is a known `behavior_event` → **404 `{ error: 'event not found' }`**.
  3. `getR2Config()` (lazy) — if any R2 var is missing it **throws**; the handler catches and returns **`503 { error: 'media storage not configured' }`** (NFR-4 — fail fast, never a fabricated URL).
  4. Build the key `events/${eventId}/${crypto.randomUUID()}.${ext}` where `ext = contentType === 'video/quicktime' ? 'mov' : 'mp4'`.
  5. `uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), { expiresIn: 600 })`.
- **Success:** `200 PresignResponse` = `{ uploadUrl, method: 'PUT', headers: { 'Content-Type': contentType }, key, expiresInSeconds: 600 }`. **No `media` row is created** (G-3 — the row is recorded only by `POST /events/:id/media` after the device confirms the PUT succeeded).

### P2.3.10 Error shapes (consistent across all new routes)

| Status | When | Body |
| --- | --- | --- |
| 400 | zod validation failure (bad/missing field, disallowed `contentType`) | zValidator's default JSON error body (Hono/zod-validator format) |
| 404 | unknown `dog` / `session` / `event` id | `{ error: 'dog not found' }` / `{ error: 'session not found' }` / `{ error: 'event not found' }` |
| 503 | `POST /media/presign` when R2 env vars are unset | `{ error: 'media storage not configured' }` |
| 500 | unexpected throw | Hono `onError` → `{ error: 'internal server error' }` (unchanged from Phase 1) |

### P2.3.11 Mounting in `app.ts`

Append after the existing mounts (Phase 1 lines untouched):
```ts
import { dogs } from './routes/dogs.js';
import { events } from './routes/events.js';
import { media } from './routes/media.js';
// …existing health + sessions mounts stay…
app.route('/', dogs);
app.route('/', events);
app.route('/', media);
```
The existing `cors()`, `onError`, `notFound` are reused as-is (no change). `GET /sessions/:id/events` is added inside the already-mounted `sessions` instance, so no extra mount is needed for it.

---

## P2.4 R2 Presign Module Design (`apps/api/src/r2.ts`)

A **new** module, owned by Unit B, that encapsulates the R2 S3 client and the lazy config. Imported only by `media.ts` (presign) and `events.ts` (to derive `blobUrl`). **The AWS SDK lives ONLY in `apps/api`** (NFR-5) — never `@tailsup/shared`, never mobile.

### P2.4.1 Dependencies (Unit B — `apps/api/package.json`)

Add **both** AWS SDK packages **pinned to the same exact version** (the long-standing v3 footgun: mismatched `client-s3` / `s3-request-presigner` majors break `getSignedUrl` at runtime — investigation ref #5). Current baseline: the `~3.937.x` line; any matched **≥3.729** pair works **with the checksum flags below**. Install via `npm i @aws-sdk/client-s3@<v> @aws-sdk/s3-request-presigner@<v> -w apps/api` with identical `<v>`.

### P2.4.2 S3Client config — the CRC32 flags are MANDATORY (R-1)

```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// LAZY config — read R2 vars at call time, NOT at module top-level / config.ts.
// Reuses the SAME throw-on-missing discipline as config.ts (NFR-4) without
// putting R2 vars in config.ts (which would break boot + the whole vitest suite
// for read-endpoint tests that need no R2 creds — investigation Area 3, R-4).
function requiredR2(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function getR2Config(): R2Config {
  return {
    accountId: requiredR2('R2_ACCOUNT_ID'),
    accessKeyId: requiredR2('R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredR2('R2_SECRET_ACCESS_KEY'),
    bucket: requiredR2('R2_BUCKET'),
  };
}

export function r2Client(cfg: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    // ── MANDATORY for R2 (R-1) ────────────────────────────────────────────────
    // AWS SDK >= v3.729 auto-adds an x-amz-checksum-crc32 the SDK signs into the
    // request; R2 REJECTS it (NotImplemented / SignatureDoesNotMatch). These two
    // flags suppress the auto-checksum so the presigned PUT is R2-compatible.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  // forcePathStyle is NOT needed for the https://<account>.r2.cloudflarestorage.com endpoint.
}

const EXT_BY_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export function buildKey(eventId: string, contentType: string): string {
  const ext = EXT_BY_TYPE[contentType] ?? 'mp4';
  return `events/${eventId}/${crypto.randomUUID()}.${ext}`;
}

// The stored blobUrl (G-7: private / key-only canonical reference).
export function blobUrlForKey(cfg: R2Config, key: string): string {
  return `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`;
}

export async function presignPut(
  cfg: R2Config,
  key: string,
  contentType: string,
): Promise<string> {
  return getSignedUrl(
    r2Client(cfg),
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }),
    { expiresIn: 600 }, // G-5 (10 min)
  );
}
```

### P2.4.3 Lazy config — why R2 vars are NOT in `config.ts` (R-4)

Phase 1's `config.ts` calls `required('DATABASE_URL')` at **module top-level**, so every module that transitively imports it (which is the whole app, and therefore every vitest file via `app.request()`) throws at import if the var is missing. If R2 vars were added there, **every read-endpoint test would need real R2 creds** to even import the app — and the API could not boot for a developer who only wants the reads. So:
- R2 vars are read **only** inside `getR2Config()`, invoked **at presign-handler call time** (and at `POST /events/:id/media` time to derive `blobUrl`).
- It still **throws clearly** on a missing var (NFR-4 — no silent fallback, no fake URL). The presign handler wraps the throw → `503`.
- Tests assert the `503`-on-missing-config path **without** real creds (the payoff of lazy config), plus a `config.test.ts`-style throw test (`vi.resetModules` + delete env var + expect the exact var name in the throw).

### P2.4.4 What `blobUrl` stores (G-7 / OQ-9) — deferred playback

**Decision: private / key-only.** `blobUrl` stores the canonical S3-style reference `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>` (derived from the key — it is **not** a publicly fetchable URL against a private R2 bucket). **Playback in the trainer UI is not a Phase 2 requirement**, so no public base URL and no presigned-GET is built. The detail screen shows a **media indicator / filename**, not a `<Video>` player.

**If G-7 flips** (the detail screen must *play* the uploaded video): add a `R2_PUBLIC_BASE_URL` env var and store `${R2_PUBLIC_BASE_URL}/<key>` **or** add a `GET /media/:id/url` presigned-GET endpoint, and add a `<Video>` player in Unit C. **This is the one decision that changes the data written — confirm explicitly at the gate (R-9).**

---

## P2.5 Media Persistence Flow (the two-step sequence — G-3)

Presign issues the URL **only**; a follow-up call records the row **after** the device confirms the direct upload. Presign creates **no** `media` row (rejecting the "presign inserts a pending row" alternative, which adds orphan-row state/cleanup with no upload-status column — OQ-2).

```
 Device (apps/mobile, events/[id].tsx)              API (apps/api)                 Cloudflare R2
 ─────────────────────────────────────              ──────────────                 ─────────────
 1. pick video (expo-image-picker)
    → { uri, mimeType, fileSize }
    validate mimeType ∈ {mp4,mov}; warn >200MB
 2. POST /media/presign {eventId, contentType} ───▶ media.ts: 404? 400? 503?
                                                     getSignedUrl(PUT, expiresIn 600)
    ◀──────────────────── 200 { uploadUrl, headers:{Content-Type}, key, expiresInSeconds }
 3. PUT uploadUrl  (Content-Type = SAME contentType) ─────────────────────────────▶ R2 stores object
    native: new File(uri).createUploadTask(...) BINARY_CONTENT + onProgress
    web:    fetch(uploadUrl, {method:'PUT', body:file, headers:{Content-Type}})
    ◀──────────────────────────────────────────────────────────────── 200/204 (bytes never touch the API)
 4. POST /events/:id/media {key, contentType} ────▶ events.ts: 404? insert media row
                                                     blobUrl = blobUrlForKey(cfg, key), type='video'
    ◀──────────────────── 201 MediaDTO
 5. refetch GET /events/:id ───────────────────────▶ media[] now includes the new video (FR-M4)
```

**Critical invariant (R-6):** the `Content-Type` sent on the step-3 PUT **must equal** the `contentType` baked into the presign at step 2, or R2 returns `403 SignatureDoesNotMatch`. Thread the **one** value end-to-end: picker `mimeType` → presign request body → presign response `headers['Content-Type']` → the PUT header.

---

## P2.6 Reads via Drizzle `select()` + joins — no `relations()`, NO migration

**Confirmed against `apps/api/src/db/schema.ts`:** the columns Phase 2 reads/writes already exist — `behaviorEvent.note` (text nullable, line 218), `behaviorEvent.tags` (jsonb `$type<string[]>()`, GIN-indexed, line 219), and the full `media` table (`id`/`eventId`/`blobUrl`/`type`/`uploadedAt`, lines 230-238). The composite indexes the reads ride already exist: `session_dog_started_idx (dogId, startedAt)` and `behavior_event_session_occurred_idx (sessionId, occurredAt)`. **No new column, no new index, no migration** (AC-12). Verify: `git status --porcelain apps/api/drizzle` stays empty.

All reads use **plain `select()` + explicit joins + `inArray` batching**, mirroring the Phase 1 `db.select().from(session).where(eq(...))` idiom in `sessions.ts` — **not** the `db.query.*` relational builder. Rationale (G-5-decision below): the relational builder needs `relations()` declarations (a `schema.ts` change) **and** cannot cleanly express **nested `orderBy` on relations**, which the reverse-chronological grouped timeline requires.

**Timeline query sketch** (the read that forces `select()`):
```ts
// GET /dogs/:id/timeline
const [dogRow] = await db.select().from(dog).where(eq(dog.id, id)).limit(1);
if (!dogRow) return c.json({ error: 'dog not found' }, 404);

const sessionRows = await db
  .select()
  .from(session)
  .where(eq(session.dogId, id))
  .orderBy(desc(session.startedAt));              // sessions newest-first

const sessionIds = sessionRows.map((s) => s.id);
const eventRows = sessionIds.length
  ? await db
      .select()
      .from(behaviorEvent)
      .where(inArray(behaviorEvent.sessionId, sessionIds))
      .orderBy(desc(behaviorEvent.occurredAt))    // events newest-first (ONE query — no N+1)
  : [];

// group eventRows by sessionId in TS, preserving desc order, build TimelineSessionDTO[]
```
Two queries total regardless of session/event count (NFR-7). `desc`/`asc`/`inArray`/`count`/`eq` all import from `drizzle-orm`.

---

## P2.7 Mobile Screen Specs (Unit C — `apps/mobile`, Expo Router)

All screens imitate `app/index.tsx` exactly: `useState`/`useEffect`/`useCallback`, a discriminated-union `Status` state (`loading | success | error`), `StyleSheet.create`, `SafeAreaView` + `ScrollView`, **no data-fetching library** (no TanStack Query). `react`/`react-native`/`react-native-safe-area-context` are already deps.

### P2.7.1 Route tree (Expo Router, file-based — auto-registered)

```
apps/mobile/app/
├── _layout.tsx            # EXTEND: add <Stack.Screen> titles for the new routes (file routes auto-register)
├── index.tsx              # Phase 1 /health screen — UNCHANGED (optionally add a <Link> to /dogs)
├── dogs/
│   ├── index.tsx          # NEW — dog list / entry point (FR-M6)
│   └── [id]/
│       └── timeline.tsx   # NEW — dog timeline, reverse-chron grouped (FR-M5)
├── sessions/
│   └── [id]/
│       └── log.tsx        # NEW — 4-tap quick-log (FR-M1/M2)
└── events/
    └── [id].tsx           # NEW — post-session detail + video upload (FR-M3/M4)
```
Dynamic params via `useLocalSearchParams<{ id: string }>()`; navigation via `useRouter().push()` and `<Link>`. Must work on **Expo web** (the Phase 1 verification target) and not be web-only (FR-M8). `_layout.tsx` edits are titles only — file-based routes register without explicit `<Stack.Screen>` (the existing root `Stack` + `SafeAreaProvider` stay).

### P2.7.2 Typed fetch client (`apps/mobile/lib/api.ts`, FR-M7 / AC-11)

A tiny typed `fetch` wrapper over `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'` — **static dot-access only** (Metro inlines `EXPO_PUBLIC_*` only via static dot-access; mirror `app/index.tsx:54`; R-5/Phase-1 R5). Every function returns a `@tailsup/shared` DTO (no `any` on responses):
```ts
import type {
  DogSummaryDTO, DogDetailDTO, DogTimelineDTO, BehaviorEventListItemDTO,
  BehaviorEventWithMediaDTO, BehaviorEventDTO, MediaDTO,
  PresignRequest, PresignResponse, CreateMediaInput, UpdateBehaviorEventInput,
  CreateBehaviorEventInput, SessionSummaryDTO,
} from '@tailsup/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// getDogs(trainerId) -> DogSummaryDTO[]
// getDog(id) -> DogDetailDTO
// getDogTimeline(id) -> DogTimelineDTO
// getSessionEvents(id) -> BehaviorEventListItemDTO[]
// getEvent(id) -> BehaviorEventWithMediaDTO
// patchEvent(id, body: UpdateBehaviorEventInput) -> BehaviorEventDTO
// postEvent(sessionId, body: CreateBehaviorEventInput) -> BehaviorEventDTO   (reuses the Phase 1 endpoint)
// startSession(dogId, body: { startedAt?: string; location?: string }) -> SessionSummaryDTO
// presign(body: PresignRequest) -> PresignResponse
// createMedia(eventId, body: CreateMediaInput) -> MediaDTO
```
Each wrapper does `fetch`, checks `res.ok` (throwing/returning a typed error the screen's `Status` union surfaces), and `res.json() as <DTO>`. Read `EXPO_PUBLIC_TRAINER_ID` the same static way in the dog-list screen.

### P2.7.3 Dog list (`app/dogs/index.tsx`, FR-M6)

Reads `process.env.EXPO_PUBLIC_TRAINER_ID` (static dot-access); calls `getDogs(trainerId)`; renders the trainer's dogs. Each dog offers two actions: **open timeline** (`router.push('/dogs/' + id + '/timeline')`) and **start a session** (`startSession(id)` → then `router.push('/sessions/' + newSessionId + '/log')`). Loading/empty/error states mirror Phase 1.

### P2.7.4 4-tap quick-log (`app/sessions/[id]/log.tsx`, FR-M1/M2/NFR-1) — keep it FAST

- **Four tap targets, all pre-defaulted** so an unchanged field needs no tap: `triggerType` (5 chips from `TRIGGER_TYPES`), `outcome` (3 chips from `OUTCOMES`), `intensity` (1–10 segmented/slider), `thresholdMeters` (stepper / preset chips). State is local component state.
- **One submit** → `postEvent(sessionId, { triggerType, thresholdMeters, intensity, outcome })` **omitting `intervention`** (the server defaults it from the dog's protocol — Phase 1 behavior). ≤ 4 deliberate taps + submit in the common case; **no scrolling/dialogs/round-trips between selecting fields and submit** (NFR-1).
- **On `201`:** immediate **optimistic reset** to defaults for the next capture + a lightweight confirmation (toast/inline). **On failure:** show the error and **retry without losing the in-progress selections** (R-5/FR-M2). Surface `404` (unknown session) and the `400` no-protocol-default case with actionable messages; if the `400` is the no-default case (OQ-8), offer a **one-time** intervention entry — do not bake a 5th tap into the common path.

### P2.7.5 Timeline (`app/dogs/[id]/timeline.tsx`, FR-M5 / AC-10)

`getDogTimeline(id)` → render sessions **newest-first** (header: `startedAt` formatted + `location`), events **newest-first** under each session header. Each event row shows the tap fields (`triggerType`, `intensity`, `outcome`, `thresholdMeters`), `intervention`, and **indicators** for note / tags (chips) / media (the count, since playback is deferred — G-7). Tapping a row → `router.push('/events/' + eventId)`.

### P2.7.6 Detail + upload (`app/events/[id].tsx`, FR-M3/M4 / AC-9)

- **Load** `getEvent(id)` → render the four tap fields **read-only**, plus the editable `note` (multiline) and `tags` (add free-text chip / remove chip), and the existing `media[]` as indicators (filename/type — no player, G-7).
- **Persist edits** via `patchEvent(id, { note, tags })` → `200 BehaviorEventDTO`; reflect the saved state.
- **Video flow** (the riskiest path, R-2): pick → presign → direct PUT → record → refetch (see P2.7.7).

### P2.7.7 Upload flow — `Platform.OS` native/web branch + progress (R-2)

- **Dependencies (Unit C):** `npx expo install expo-image-picker` (lets Expo pick the SDK-54-compatible version, currently the `~17.x` line) and confirm/install `expo-file-system`. **Do not** hand-pin from npm latest.
- **Pick:** `launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 })` — **SDK 54 `mediaTypes` is a STRING ARRAY** (`['videos']`), not `MediaTypeOptions.Videos`. Returns `{ uri, mimeType, fileSize }`.
- **Validate** the picked `mimeType` against the allow-set (`video/mp4` / `video/quicktime`) **before** presigning; **soft-warn above 200 MB** (G-6).
- **Presign:** `presign({ eventId, contentType: mimeType })` → `{ uploadUrl, headers, key, expiresInSeconds }`.
- **Upload — branch on `Platform.OS` (NEVER the legacy `FileSystem.uploadAsync`, which throws at runtime in SDK 54 — R-2):**
  - **native:** new `expo-file-system` File API — `new File(asset.uri).createUploadTask(uploadUrl, { httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT, headers: { 'Content-Type': contentType }, onProgress })` then `await task.uploadAsync()`. Streams the `file://` body correctly (avoids the 0-byte bug) and gives progress for FR-M4.
  - **web:** `fetch(uploadUrl, { method: 'PUT', body: asset.file ?? blob, headers: { 'Content-Type': contentType } })`.
  - **Escape hatch (validate on first run):** if the new File-API symbol surface misbehaves, fall back to `import * as FileSystem from 'expo-file-system/legacy'` with `uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, httpMethod: 'PUT'`. Low risk; both paths known.
- **Content-Type must match** the presign value end-to-end (R-6) — same string into the presign body and the PUT header.
- **After a 2xx PUT:** `createMedia(eventId, { key, contentType })` → then refetch `getEvent(id)` so the new media shows (FR-M4). Show upload **progress** (native) / spinner (web) + success/failure states.

### P2.7.8 `.env.example` (Unit C — `apps/mobile/.env.example`, extend)

Add `EXPO_PUBLIC_TRAINER_ID=<seeded-trainer-uuid>` alongside the existing `EXPO_PUBLIC_API_URL`. (`EXPO_PUBLIC_API_URL` and the dev-networking matrix are already documented from Phase 1.)

---

## P2.8 Error-Handling Strategy (Phase 2 delta)

- **No config fallbacks (NFR-4):** R2 vars are read via the lazy `getR2Config()` which **throws** on a missing var (never a silent default / fabricated URL); the presign handler maps the throw → `503`. R2 vars are deliberately **not** in `config.ts` (would break boot + the read-endpoint vitest suite — R-4).
- **Validation 400s:** every new body/param goes through `@hono/zod-validator`; bad enums / disallowed `contentType` / wrong types → automatic `400` with the standard error body (Phase 1 convention). Unknown ids → `404 { error: '...' }`.
- **Clear UI failure states (FR-M2):** each screen uses the discriminated-union `Status` pattern. The 4-tap screen **retries without losing in-progress selections**; the detail/upload screen surfaces pick-validation (bad type / >200 MB), presign (`404`/`503`), PUT (R2 `403` on Content-Type mismatch / CORS on web), and persist (`POST /events/:id/media`) failures distinctly with actionable copy.
- **Web upload CORS (G-8 / R-3):** the R2 **bucket CORS policy** (allow `PUT` + `Content-Type` from the Expo web origin `http://localhost:8081`) is a **bucket setting, not API code** — documented in the README as an AC-9-on-web prerequisite. Native uploads do not enforce CORS; if CORS is not set, verify the picker/upload on a native simulator.

---

## P2.9 Technology Choices (within the fixed stack)

| Pick | Choice | Why (Phase 2) |
| --- | --- | --- |
| **R2 presign SDK** | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, **same version**, **`requestChecksumCalculation`/`responseChecksumValidation: 'WHEN_REQUIRED'`** | Cloudflare-documented PUT-presign; matches the `PresignResponse` (PUT) shape; SDK isolated to `apps/api` (NFR-5). The CRC32 flags are **mandatory** — without them SDK ≥3.729 bakes `x-amz-checksum-crc32` which R2 rejects (R-1). Same-version pair avoids the `getSignedUrl` mismatch footgun. |
| **Video picker** | `expo-image-picker` (`mediaTypes: ['videos']`), via `npx expo install` | Natural camera-roll/record path for training clips; returns a usable `mimeType`. `expo-document-picker` is the wrong tool for media (G-4). |
| **Read query strategy** | plain Drizzle `select()` + joins + `inArray`, **no `relations()`** | The relational builder needs `relations()` (a `schema.ts` change) and can't cleanly express the timeline's **nested reverse-chron `orderBy`**; `select()` hits every index with zero schema churn (G-5-decision). |
| **R2 config** | **lazy** `getR2Config()` in `r2.ts`, **not** `config.ts` | Keeps the API bootable and the read-endpoint vitest suite runnable **without** R2 creds, while still throwing on missing vars (NFR-4). Eager validation in `config.ts` breaks boot + tests (R-4). |
| **Trainer context** | `EXPO_PUBLIC_TRAINER_ID` (static dot-access) + path-scoped `/trainers/:trainerId/dogs` + minimal `POST /dogs/:id/sessions` | Production-shaped: the path id becomes the authenticated trainer id in Phase 3 (drop the env var, read `c.get('trainer').id`); unblocks the 4-tap screen (no session ⇒ no events). (G-1/G-2.) |
| **Mobile data layer** | tiny typed `fetch` wrapper + `useState/useEffect` (no TanStack Query) | Zero new deps; matches Phase 1; trivially typed against shared DTOs (AC-11). Caching/invalidation is overkill for three screens. |
| **Upload native/web** | new `expo-file-system` File API (native) / `fetch` PUT (web), branched on `Platform.OS` | Native File API streams `file://` correctly (avoids the 0-byte bug) + gives progress; legacy `uploadAsync` throws at runtime in SDK 54 (R-2). |

---

## P2.10 Integration Points & Parallel-Unit Contract

### P2.10.1 Dependency ordering — Unit A lands first

```
        ┌───────────────────────────────────────────────────────────┐
        │  UNIT A — packages/shared : the Phase 2 DTO contract         │
        │  LANDS FIRST + committed before B/C start                    │
        └───────────────┬───────────────────────────┬─────────────────┘
                        │ (B & C type-check against A) │
        ┌───────────────▼──────────────┐   ┌──────────▼────────────────┐
        │ UNIT B — apps/api             │   │ UNIT C — apps/mobile        │
        │ r2.ts + media + events + dogs │   │ 3 screens + dog list +      │
        │ + GET /sessions/:id/events    │   │ lib/api.ts + nav/layout +   │
        │ + mount in app.ts + tests     │   │ deps + .env.example         │
        │ (depends on A)                │   │ (depends on A)              │
        └───────────────────────────────┘   └─────────────────────────────┘
                  DISJOINT FILE SETS — run B and C in parallel
```

**B and C both `import` from `@tailsup/shared`; they will not type-check until A exists and is committed.** After A commits, dispatch B and C in parallel (independent coder agents / fresh contexts).

### P2.10.2 File ownership (disjoint — no two units touch the same file)

| Unit | Owns / creates (EXCLUSIVE) | Depends on | Satisfies (AC) |
| --- | --- | --- | --- |
| **A** | `packages/shared/src/dtos.ts` (append-only; one import-line edit). **No barrel edit.** | — (lands first) | AC-2; partial AC-1 |
| **B** | `apps/api/package.json` (+AWS SDK); `apps/api/src/r2.ts` (new); `apps/api/src/routes/dogs.ts` (new); `apps/api/src/routes/events.ts` (new); `apps/api/src/routes/media.ts` (new); `apps/api/src/routes/sessions.ts` (extend — add `GET /sessions/:id/events`); `apps/api/src/app.ts` (extend — mount dogs/events/media); `apps/api/src/test/**` (new tests); `README.md` (Phase 2 section — AC-13) | A (committed) | AC-3, AC-4, AC-5, AC-7, AC-12, AC-13; partial AC-1, AC-6 |
| **C** | `apps/mobile/package.json` (+expo-image-picker/-file-system); `apps/mobile/lib/api.ts` (new); `apps/mobile/app/_layout.tsx` (extend — titles); `apps/mobile/app/dogs/index.tsx`, `apps/mobile/app/dogs/[id]/timeline.tsx`, `apps/mobile/app/sessions/[id]/log.tsx`, `apps/mobile/app/events/[id].tsx` (new); `apps/mobile/.env.example` (extend — `EXPO_PUBLIC_TRAINER_ID`); optionally a `<Link>` in `apps/mobile/app/index.tsx` (do NOT remove the health screen) | A (committed) | AC-8, AC-9, AC-10, AC-11; partial AC-1, AC-6 |

**Conflict-avoidance notes:** the README/run-docs (AC-13) is owned solely by **Unit B** (it documents the API + env setup); Unit C contributes its mobile env var to that section via B (or README lands in a brief follow-up step after B+C). `docs/design/project-functions.md` is updated by the planner, not a build unit. **`apps/api/src/db/schema.ts` is touched by NO unit** (no migration — AC-12).

### P2.10.3 Contract invariants both ends rely on

- The new DTO field names/shapes are the single wire contract; B returns them, C consumes them (no `any`).
- `PresignResponse.headers['Content-Type']` **equals** the `contentType` the client sends on the PUT (R-6).
- `MediaDTO.type` is always `'video'` in Phase 2 (the schema enum also allows `'image'`, not shipped).
- `packages/shared` stays pure (no server/AWS imports) so Metro can bundle it (C depends on this).
- The Phase 1 `BehaviorEventDTO` shape is unchanged; `BehaviorEventListItemDTO`/`BehaviorEventWithMediaDTO` **extend** it (additive only).

---

## P2.11 Architectural Decisions — G-1..G-8 (with rationale)

These mirror and lock the plan's design-gate decisions. They are settled for execution **unless vetoed at the review gate**. Each changes the data written, the dependencies installed, or the endpoint surface — so each needs explicit sign-off.

| # | Decision | Rationale | Where it bites if changed |
| --- | --- | --- | --- |
| **G-1** | **Trainer context = `EXPO_PUBLIC_TRAINER_ID`** (static dot-access) + path-scoped reads (`GET /trainers/:trainerId/dogs`). Unknown trainer → `[]`. | Production-shaped pre-auth: swaps cleanly to BetterAuth in Phase 3 (drop the env var, read `c.get('trainer').id`). Minimal surface. | Dog-list screen's "my dogs" resolution (FR-M6); the alternative is a `GET /trainers` list-all + in-app picker (extra endpoint + screen). |
| **G-2** | **Add `POST /dogs/:id/sessions`** (`{ startedAt?, location? }`, defaults `startedAt=now`) → `201 SessionSummaryDTO`. | The one borderline write beyond pure reads — unblocks the 4-tap screen (no session ⇒ no events). | If excluded: sessions must be pre-seeded, the app only logs into seeded sessions, Unit B drops a route, Unit C drops the "start session" action. |
| **G-3** | **Two-step media persistence:** presign issues the URL only (no row); `POST /events/:id/media` records the row after the device confirms the PUT. | No orphan `media` rows for uploads that never completed; the API needs no R2 webhooks; the device is the only party that knows the PUT succeeded. | Alternative (presign inserts a `pending` row) adds state/cleanup with no upload-status column — reshapes both media routes. |
| **G-4** | **`expo-image-picker`** (`launchImageLibraryAsync({ mediaTypes: ['videos'] })`), installed via `npx expo install`. | Natural camera-roll/record path; returns a usable `mimeType`. | Switching to `expo-document-picker` changes the mobile dependency + the pick code path. |
| **G-5** | **Presign expiry `expiresIn: 600` (10 min)**; response returns `expiresInSeconds` for client re-request. | Long enough for a large video on a phone network; short enough to limit URL-leak window. | Shorter risks large-video timeouts; longer widens the leak window. (Also: the **`select()`-not-`relations()`** read strategy is locked here — see P2.6/P2.9.) |
| **G-6** | **Allowed content types = `video/mp4` + `video/quicktime` only** (others → 400). **No hard server size cap**; client soft-warns above **200 MB**. | Covers iOS `.mov` + standard `.mp4`; size policy deferred (R2 accepts the PUT) while protecting mobile UX. | Changing the allow-set changes the presign validation + the picker mime check + the ext map (`mp4`/`mov`). |
| **G-7** | **Private / key-only `blobUrl`:** store `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>`. **No** public base URL / presigned-GET; **no** in-UI playback in Phase 2. | Playback is not a Phase 2 requirement; keeps the data written minimal and the bucket private. | **If the detail screen must PLAY the video back, this flips:** add `R2_PUBLIC_BASE_URL` (store `${R2_PUBLIC_BASE_URL}/<key>`) **or** a `GET /media/:id/url` presigned-GET, plus a `<Video>` player. **The one OQ that changes the data written — confirm explicitly (R-9).** |
| **G-8** | **R2 bucket CORS** (allow `PUT` + `Content-Type` from `http://localhost:8081`) is a **bucket setting, documented in the README**, not API code. | Browser PUT to R2 is cross-origin; the rule is required only for **web** upload, not native. | If web upload must be demonstrated, the CORS rule is a hard AC-9-on-web prerequisite; if not, verify the picker/upload on a native simulator. |

**Resume signal for the gate:** reply **"approved"** to proceed with all G-1..G-8 defaults, or name the ones to change (e.g. "G-7 → add R2_PUBLIC_BASE_URL, screen must play video", "G-1 → list-all picker", "G-8 → web upload must be demonstrated").

---

## P2.12 Phase 2 Verification (maps to AC-1..AC-13)

```bash
# AC-1, AC-2 — type-check ALL workspaces under strict; shared stays pure
npm install
npm run typecheck --workspaces --if-present        # 0 errors in shared, api, mobile
grep -REn "drizzle|from 'pg|aws|node:|require\(" packages/shared/src   # -> no matches (AC-2 purity)

# AC-12 — no migration, phase boundary respected
git status --porcelain apps/api/drizzle             # -> empty (no new migration)
grep -REn "leads|bookings|/summary|betterAuth" apps/api/src/routes      # -> no Phase 3/4 routes

# api unit tests (vitest) — no R2 creds needed thanks to lazy config (R-4)
npm run test -w apps/api                            # incl. new dogs/events/media + r2-config (503) tests

# (live-DB) seed trainer->client->dog(+protocol+defaultIntervention)->session; capture ids
# AC-3 reads
curl -s localhost:3000/trainers/$TRAINER_ID/dogs            # 200 DogSummaryDTO[]
curl -s localhost:3000/dogs/$DOG_ID                         # 200 DogDetailDTO (sessions[].eventCount)
curl -s localhost:3000/dogs/$DOG_ID/timeline                # 200 DogTimelineDTO (reverse-chron)
curl -s localhost:3000/sessions/$SESSION_ID/events          # 200 [] chronological (+mediaCount)
curl -s localhost:3000/dogs/00000000-0000-0000-0000-000000000000   # 404
# AC-4 PATCH note/tags only (tap fields unchanged)
curl -s -X PATCH localhost:3000/events/$EVENT_ID -d '{"note":"near the gate","tags":["reactive"]}'  # 200
# AC-5 presign (R2 set -> 200; image/png -> 400; R2 UNSET -> 503)
curl -s -X POST localhost:3000/media/presign -d "{\"eventId\":\"$EVENT_ID\",\"contentType\":\"video/mp4\"}"  # 200
curl -s -X POST localhost:3000/media/presign -d "{\"eventId\":\"$EVENT_ID\",\"contentType\":\"image/png\"}"  # 400
# AC-6 + AC-7 direct upload (host == R2, not the API) + persist
curl -s -X PUT "$UPLOAD_URL" -H 'Content-Type: video/mp4' --data-binary @clip.mp4            # 200 from R2
curl -s -X POST localhost:3000/events/$EVENT_ID/media -d "{\"key\":\"$KEY\",\"contentType\":\"video/mp4\"}"  # 201
curl -s localhost:3000/events/$EVENT_ID                     # media[] now includes the video

# AC-8/9/10/11 — Expo web render
npm run web -w apps/mobile     # dog list -> start session -> 4-tap log (resets); timeline; detail edit+upload
#   (G-8) web upload needs the R2 bucket CORS rule (PUT from http://localhost:8081); else verify on a simulator
```

**Success criteria (measurable):** typecheck 0 errors (AC-1); 12 DTOs exported + shared pure (AC-2); 9 endpoints return the documented shapes/status (AC-3..AC-7); no `apps/api/drizzle` change + `/health` + `POST /sessions/:id/events` unchanged + no Phase 3/4 routes (AC-12); Expo web exercises all three screens incl. upload (AC-8..AC-11); README documents seed + run + env + presign/upload + R2 CORS (AC-13).

---

## P2.13 Phase 2 Risks & Mitigations (carried from the plan)

| ID | Risk | Mitigation (in this design) |
| --- | --- | --- |
| **R-1** | AWS SDK ≥3.729 auto-CRC32 → R2 rejects the PUT (`NotImplemented`/`SignatureDoesNotMatch`) | **Mandatory** `requestChecksumCalculation`/`responseChecksumValidation: 'WHEN_REQUIRED'` on the `S3Client` (P2.4.2); both AWS pkgs pinned to the **same** version. |
| **R-2** | Expo native 0-byte upload / legacy `uploadAsync` throws at runtime in SDK 54 | `Platform.OS` branch: native = new File-API `createUploadTask` (`BINARY_CONTENT`, PUT, `onProgress`); web = `fetch` PUT. `/legacy` escape hatch documented (P2.7.7). |
| **R-3** | R2 bucket CORS for web uploads (cross-origin PUT) | Document the R2 bucket CORS rule (PUT + `Content-Type` from `http://localhost:8081`) in the README (G-8); native unaffected — verify on a simulator if CORS not set. |
| **R-4** | Eager R2 vars in `config.ts` break boot + the whole vitest suite for read tests | R2 vars read **only** via lazy `getR2Config()` in `r2.ts`; never in `config.ts`; presign maps the throw → 503; tests assert 503-on-missing without creds (P2.4.3). |
| **R-5** | 4-tap screen too slow (extra taps/dialogs/round-trips) | All four fields pre-defaulted; single submit omitting `intervention`; optimistic reset on 201; retry-without-retap on failure; no blocking dialogs/scroll (P2.7.4). |
| **R-6** | Content-Type mismatch between presign and PUT → 403 | Thread one value end-to-end (picker mimeType → presign body → presign `headers` → PUT header); presign signs `ContentType` and echoes it (P2.5). |
| **R-7** | `relations()` / migration creep | Plain `select()` + `inArray` everywhere; no `relations()`, no migration; `git status apps/api/drizzle` empty (P2.6/AC-12). |
| **R-8** | Shared-package impurity (AWS/server import leaks into `@tailsup/shared`) | Unit A is types-only; AWS SDK lives only in `apps/api`; grep-purity gate (P2.2/AC-2). |
| **R-9** | G-7 flips (video playback wanted) → `blobUrl` must be publicly fetchable | Gated at G-7: if approved-to-flip, add `R2_PUBLIC_BASE_URL` (store `${R2_PUBLIC_BASE_URL}/<key>`) **or** `GET /media/:id/url` presigned-GET + a `<Video>` player. Default stores key-only (P2.4.4). |

---

_Phase 2 plan: `docs/design/plan-002-tailsup-phase2-trainer-view.md` · Refined spec: `docs/reference/refined-request-phase2.md` · Investigation: `docs/reference/investigation-phase2.md` · Codebase scan: `docs/reference/codebase-scan-phase2.md` · Phase 1 design: this document (above)._

---
---

# Phase 3a — Public Site

> **Status:** Design for review at the **design gate**. This section **extends** the Phase 1 + Phase 2 design above — it does **not** rewrite them. Everything earlier (the 12-table schema, `GET /health`, `POST /sessions/:id/events`, the trainer read/media endpoints, the four trainer screens, the `@tailsup/shared` enums/DTOs) stays exactly as built and keeps working unchanged (AC-3a-10).
>
> **Build scope: Phase 3a ONLY** — the six public website pages (Home, About, Services, Results, Contact, Booking) rendered with the Design System on Expo **web** (the primary verification surface), plus the two **public, unauthenticated** capture endpoints `POST /leads` (with a best-effort Resend email stub) and `POST /bookings`. **NO schema migration** (the `lead`/`booking` tables already exist). **EXCLUDED — Phase 3b/4:** BetterAuth, `/login`, auth guards, client/trainer dashboards, `PATCH /bookings/:id/status`, `POST /leads/:id/convert`, the `EXPO_PUBLIC_TRAINER_ID` replacement, CORS tightening, the Anthropic summary endpoint, multi-tenant prep.
>
> **Inputs (authoritative):** `docs/design/plan-003-tailsup-phase3a-public-site.md` (Units A / B / C1 / C2, file-ownership map, gate D-1..D-9, risks) · `docs/reference/refined-request-phase3.md` (3a scope, FR-W1..W10, FR-A1..A3, DS-1..DS-7, AC-3a-1..AC-3a-10) · `docs/reference/investigation-phase3a.md` (the HOW + version pins + pitfalls) · `docs/research/expo-router-static-head-sdk54.md` (the `<Head>` SEO pattern + verify-and-fallback) · `prompts/001-tailsup-kickoff.md` (the authoritative Design System + "The Website") · **`design_system.md`** (the operationalized DS reference at the repo root — the source coders apply).
>
> **Purpose:** Give the four coder agents (Units A / B / C1 / C2) enough precision to implement on **disjoint file sets** without re-reading each other's code or re-deciding settled questions. Every new DTO, route shape, status code, exported symbol, page outline, and decision is specified below.
>
> **Business-first constraint (hard — AC-3a-2 / DS-7):** the homepage is about the **practice**, not "an app" or "a data platform." The data-tracking platform is **one premium service** under Services, and the **signature progress-curve appears ONLY in that Services section** (optionally reused on Results). Spend boldness in one place.

---

## P3a.0 Ground truth (verified against the live code — do not re-derive)

- **`apps/api/src/app.ts`** builds the Hono app, applies `app.use('*', cors())` (allow-all — **leave as-is for 3a**; the comment already flags 3b tightening), mounts route sub-apps via `app.route('/', …)` (`health`, `sessions`, `dogs`, `events`, `media`), and installs `onError` (HTTPException pass-through + `500 { error: 'internal server error' }`) and `notFound` (`404 { error: 'not found' }`). **Mount the two new sub-apps here.**
- **`apps/api/src/routes/sessions.ts`** is the canonical route template: `export const sessions = new Hono()`, `zValidator('json', zObj)`, `z.enum(SHARED_ARRAY)`, `db.select()/insert().returning()`, ESM **`.js`** import specifiers, `{ error }` JSON on domain failures, `c.json(dto, 201)`, `.toISOString()` on timestamps.
- **`apps/api/src/lib/r2.ts`** is the lazy-config template: `requiredR2()` reads creds at **call time** and **throws** (mapped → 503). `lib/email.ts` mirrors this shape **but inverts the missing-key behavior**: on missing `RESEND_API_KEY` it **logs a stub and returns success** (never throws, never blocks the 201).
- **`apps/api/src/config.ts`** `required()` throws at import time; `PORT` is the only optional. **Do NOT add `RESEND_API_KEY` or `PRACTICE_TRAINER_ID` to `config.ts`** — both are read lazily.
- **`apps/api/src/db/schema.ts`** — `lead` and `booking` tables already exist with the exact columns documented in §2.2 (Phase 1). **No migration.** `trainer` has `id, name, email` (`email` is the lead-notification recipient).
- **`packages/shared/src/dtos.ts`** (plural) opens with `import type { TriggerType, Outcome, MediaType } from './enums';`. Barrel `index.ts` is `export * from './enums'; export * from './dtos';` — **new DTOs auto-export, no barrel edit needed.** `BOOKING_TYPES`/`BookingType`, `LEAD_STATUSES`/`LeadStatus`, `BOOKING_STATUSES`/`BookingStatus` already exist and are reused **unchanged**.
- **`apps/mobile/lib/api.ts`** is the typed fetch client (`request<T>`, `ApiError`, `JSON_HEADERS`, `API_URL`, `TRAINER_ID` stop-gap). **Extend it** with `createLead`/`createBooking`. `TRAINER_ID` stays untouched in 3a.
- **`apps/mobile/app/`** currently: `_layout.tsx` (single `<Stack>` in `SafeAreaProvider`) + `index.tsx` (health screen, has a `Link href="/dogs"` and the documented Metro fallback in lines 9–33) + `dogs/index.tsx`, `dogs/[id]/timeline.tsx`, `sessions/[id]/log.tsx`, `events/[id].tsx`. **No theme module, no fonts, no SVG, no web pages exist yet.**
- **`apps/mobile/app.json`** already has `web.bundler: metro`, **`web.output: "static"`**, `experiments.typedRoutes: true`, `newArchEnabled: true`. **No `app.json` change needed for 3a.**
- **Version pins** (install via `npx expo install` for mobile so SDK-54-compatible versions lock): `expo-font@~14.0.12`, `@expo-google-fonts/fraunces` (400/500), `@expo-google-fonts/inter` (400), `react-native-svg@15.12.1`. API: `resend@^6.13.0`, `hono-rate-limiter` (plain `npm i -w apps/api`).
- API test runner is **vitest** (133 tests pass as of Phase 2); pattern: `vi.hoisted()` → `vi.mock('../db/client.js')` + `vi.mock('dotenv/config')` → seed env → exercise via `app.request()`. **No mobile test runner exists** (3a adds none).

---

## P3a.1 Route architecture

Phase 3a resolves the central question (LBD-2 / D-1): the public site and the existing authed-ish app coexist in ONE Expo Router tree via **route groups**. Parenthesized directories add **no URL segment** (`app/(site)/about.tsx` → `/about`).

### P3a.1.1 The tree (after the restructure)

```
apps/mobile/app/
  _layout.tsx              // REWRITE: SafeAreaProvider + <StatusBar/> + <Slot/>  (drop the <Stack>)
  +html.tsx                // NEW: web-only HTML shell — <html lang="el">, charset/viewport, fallback <title>/<meta>, favicon, ScrollViewStyleReset
  (site)/                  // PUBLIC group — Design-System chrome, NO auth guard
    _layout.tsx            // NEW: SiteChrome (sticky nav + footer) + useFonts() + <Head> site defaults; <Stack screenOptions={{headerShown:false}}> (or <Slot/>)
    index.tsx              // /          Αρχική (Home)            — business-first; NO progress-curve
    about.tsx              // /about     Ποιοι είμαστε (About)
    services.tsx           // /services  Υπηρεσίες (Services)     — the ONLY page with ProgressCurve
    results.tsx            // /results   Αποτελέσματα (Results)   — placeholder case studies (+ optional curve)
    contact.tsx            // /contact   Επικοινωνία (Contact)    — address/hours/phone/email + map + lead form
    booking.tsx            // /booking   Booking                  — appointment-request form
  (app)/                   // EXISTING screens MOVED here — keeps its dark <Stack> header; NO auth guard in 3a
    _layout.tsx            // NEW: the existing dark <Stack> (headerStyle #0f172a, the screen titles) MOVED from old root
    health.tsx             // MOVED from app/index.tsx -> /health  (resolves the double-index-at-/ collision)
    dogs/index.tsx         // MOVED verbatim — /dogs
    dogs/[id]/timeline.tsx // MOVED verbatim — /dogs/[id]/timeline
    sessions/[id]/log.tsx  // MOVED verbatim — /sessions/[id]/log
    events/[id].tsx        // MOVED verbatim — /events/[id]
```

### P3a.1.2 The `/` collision and the health move (D-1)

Today `app/index.tsx` (the health screen) owns `/`. In 3a the marketing **Home owns `/`** (`(site)/index.tsx`). Two routes cannot both resolve to `/`, so the health screen **moves to `(app)/health.tsx` → `/health`** (matching the kickoff's "`/health` stays reachable"). The one `Link href="/dogs"` inside the health screen keeps working — the route **name** is unchanged by the group wrapper (`/dogs` resolves to `(app)/dogs/index.tsx`). No other in-app link changes.

**Resulting web URLs:** `/`→Home, `/about`, `/services`, `/results`, `/contact`, `/booking`; `/health`, `/dogs`, `/dogs/[id]/timeline`, `/sessions/[id]/log`, `/events/[id]` (the last four unchanged in behavior).

### P3a.1.3 Root `_layout.tsx` → `<Slot>`

The root layout drops its `<Stack>` and becomes the minimal shell, delegating all chrome to the two groups:

```tsx
// apps/mobile/app/_layout.tsx  (rewrite)
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Slot />
    </SafeAreaProvider>
  );
}
```

The `(app)/_layout.tsx` holds the dark `<Stack>` moved from the old root (`headerStyle #0f172a`, `headerTintColor #fff`, the existing `Stack.Screen` titles **plus** a `name="health"` title). The `(site)/_layout.tsx` renders the Design-System chrome (P3a.3.7).

### P3a.1.4 Static web URLs + the `<Head>` SEO pattern (D-6)

`web.output: "static"` is already on, so `npx expo export --platform web` emits one static HTML file per route — real SEO for a marketing site. Route groups flatten in the export: `(site)/about.tsx` → `dist/about.html` → `/about`. Expected `dist/`: `index.html`, `about.html`, `services.html`, `results.html`, `contact.html`, `booking.html`, plus `_expo/static/*` and `favicon.ico`.

**Per-page head** uses `import Head from 'expo-router/head'`:
- `app/+html.tsx` is the web-only Node shell: `<html lang="el">`, `<meta charset>`/viewport, a **fallback** site `<title>` + `<meta name="description">` (Greek), `<link rel="icon" href="/favicon.ico">`, and `<ScrollViewStyleReset/>` from `expo-router/html`. `<html lang>`/favicon **must** live here (not in `<Head>`).
- `(site)/_layout.tsx` renders a `<Head>` with the **site-wide default** title/description + OG defaults; each page renders its own `<Head>` to override `<title>`/`<meta name="description">` (deepest-wins merge). Per-page titles per the research §5d table (e.g. Home `TailsUp — Επαγγελματική Εκπαίδευση Σκύλων`, About `Ποιοι Είμαστε — TailsUp`, …).

**Verify-and-fallback (best-effort, NOT a build blocker):** after wiring `<Head>`, run `npx expo export --platform web` and grep the exported HTML for the per-page `<title>` (`Get-Content apps/mobile/dist/about.html | Select-String "<title>|<meta name"`).
1. **Tags present** → static head works on SDK 54; done.
2. **Tags absent** → **Option A (primary fallback):** replace `<Head>` with bare **React 19** `<title>`/`<meta>` tags, **web-guarded** (`Platform.OS === 'web'` or a `.web.tsx` split, since bare `<title>` errors on native), and re-export/grep. React 19.1 natively hoists `<title>`/`<meta>`/`<link>` into `<head>` during static render.
3. **Still absent** → **Option C (lowest effort):** keep the site-wide default in `+html.tsx` (always statically emitted) and accept client-side-only per-page head. The pages still render; only the initial crawl sees a generic title — a minor SEO cost, acceptable for the 3a demo.

(Option B — a `__EXPO_ROUTER_PATHNAME` page-map in `+html.tsx` — is documented in the research but **skipped** by default: the env var is an undocumented internal and may not populate.)

---

## P3a.2 Theme module — `apps/mobile/lib/theme.ts`

Plain TS, **mobile-only** (NOT in `@tailsup/shared` — it has no place in the wire contract and would never be imported by the API). It encodes DS-1..DS-4 with RN-unit conversions (letterSpacing in **points** = `em × fontSize`; lineHeight in **px** ≈ `1.6 × fontSize`). The exhaustive token table + conversion math lives in `design_system.md`; the exported shape is:

```ts
// apps/mobile/lib/theme.ts
export const colors = {
  bg: '#FAF7F0', bgAlt: '#F0EADD', surface: '#FFFFFF',
  primary: '#1B3A32', primarySoft: '#3D5249',
  accent: '#B07D48', accentSoft: '#E8C9A0', mint: '#9FC4B5',
  text: '#1B3A32', textMuted: '#6B7D74', border: 'rgba(27,58,50,0.12)',
} as const;

export const fonts = {
  display: 'Fraunces_500Medium', displayRegular: 'Fraunces_400Regular',
  body: 'Inter_400Regular',
} as const;

export const type = {
  h1:      { fontFamily: fonts.display,        fontSize: 46,   lineHeight: 52, letterSpacing: -0.92 },
  h2:      { fontFamily: fonts.display,        fontSize: 30,   lineHeight: 36, letterSpacing: -0.6 },
  h3:      { fontFamily: fonts.displayRegular, fontSize: 19,   lineHeight: 26 },
  bodyLg:  { fontFamily: fonts.body,           fontSize: 16,   lineHeight: 26 },
  body:    { fontFamily: fonts.body,           fontSize: 15,   lineHeight: 24 },
  eyebrow: { fontFamily: fonts.body,           fontSize: 12.5, letterSpacing: 2, textTransform: 'uppercase' as const, color: colors.accent },
  caption: { fontFamily: fonts.body,           fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
} as const;

export const space  = { xs: 8, sm: 16, md: 24, lg: 32, xl: 54, xxl: 80 } as const;
export const radii  = { base: 6, lg: 14 } as const;
export const layout = { maxWidth: 1080, maxProse: 720 } as const;
export const breakpoints = { sm: 640, md: 768, lg: 1024 } as const;
```

**Helpers (C1 exports):**
- **`useBreakpoint(): 'sm' | 'md' | 'lg'`** — over `useWindowDimensions().width` against `breakpoints` (RN has no CSS `@media`). Pages switch column→row and adjust `space`/`fontSize` by this. (May live in `theme.ts` or a sibling `lib/responsive.ts`.)
- **`useReducedMotion(): boolean`** (`apps/mobile/lib/reducedMotion.ts`) — wraps `AccessibilityInfo.isReduceMotionEnabled()` + `addEventListener('reduceMotionChanged', …)`; on web RNW maps this to the `(prefers-reduced-motion: reduce)` media query, so one RN API covers both targets. Consumed by `ProgressCurve` and any animated chrome.

**Web-only style escape hatch:** a few web properties (sticky/`fixed` header, `cursor`, `outline`, CSS `transition`) are not in RN's type surface — apply them narrowly via `Platform.select({ web: { …webOnly } as any })`, localized to the component (never global). The 0.5px card border uses `borderWidth` (portable), **not** a shadow.

**Fallbacks (quality floor):** set web family fallbacks (`Georgia` for display, `system-ui` for body) via `Platform.select` and rely on `FontDisplay.SWAP` so the site never blocks on font load on web (brief FOUT acceptable); native splash-gates briefly.

---

## P3a.3 UI primitive components (C1 exports for C2)

All under `apps/mobile/components/` consuming `theme.ts`. Each interactive primitive styles `Pressable`'s `({ hovered, focused, pressed })` callback — `focused` is the portable **visible-focus** mechanism (quality floor); `hovered` is mouse-only on web (inert on native, safe). Exact visual specs are in `design_system.md` §4; the API/props are below.

### P3a.3.1 `PrimaryButton` / `SecondaryButton` — `components/ui/`
```ts
interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;        // shows ActivityIndicator, blocks onPress
}
```
- `PrimaryButton`: `colors.primary` bg → `primarySoft` on hover/press; off-white (`colors.bg`) text; `radii.base` (6); padding **13/28**; copper focus ring; `Platform.select` `cursor:'pointer'` (web).
- `SecondaryButton`: transparent, **1px** border (`colors.primary`), `colors.primary` text; same radius/padding/focus contract.

### P3a.3.2 `Eyebrow` — `components/ui/`
```ts
interface EyebrowProps { children: React.ReactNode }
```
`type.eyebrow` (copper, uppercase, `letterSpacing 2`); `marginBottom space.xs`. Copper used here as a small detail (compliant with "copper only on small details").

### P3a.3.3 `Card` — `components/ui/`
```ts
interface CardProps { children: React.ReactNode; style?: StyleProp<ViewStyle> }
```
`colors.surface` bg; **0.5px** `colors.border` (via `borderWidth`); `radii.lg` (14); padding `space.md`. No shadow by default.

### P3a.3.4 `Section` + `Container` — `components/ui/`
```ts
interface SectionProps { children: React.ReactNode; alt?: boolean; dark?: boolean; maxWidth?: number }
interface ContainerProps { children: React.ReactNode; maxWidth?: number }
```
- `Section`: full-bleed vertical rhythm wrapper; vertical padding `space.xl`→`space.xxl` by breakpoint; `alt` → `bgAlt` bg; `dark` → `colors.primary` bg (the ProofBand surface). Wraps a `Container`.
- `Container`: centered column — `width '100%'`, `maxWidth layout.maxWidth` (or the passed `maxProse`), `alignSelf 'center'`, horizontal padding `space.md`.

### P3a.3.5 `ProofBand` — `components/ui/`
```ts
interface ProofBandProps { children: React.ReactNode }
```
The dark deep-green band — **at most one per page** (DS-4 / DS-6 "spend boldness in one place"). Implemented as `<Section dark>` semantics; off-white text; holds a proof statement / key stat / strong CTA, never decoration.

### P3a.3.6 `ProgressCurve` — `components/ProgressCurve.tsx`
```ts
interface ProgressCurveProps {
  points: { occurredAt: string; thresholdMeters: number }[] | { x: number; y: number }[];
  height?: number;          // default e.g. 220
}
```
Hand-rolled `react-native-svg` (no charting dep). Deep-green (`colors.primary`) panel, `radii.lg`. `<Defs><LinearGradient id={useId()} x1=0 y1=0 x2=0 y2=1>` gold→transparent (Stop 0 ~0.28 opacity → Stop 1 = 0). A **closed** `<Path fill="url(#id)">` (gradient fill) + a **stroke-only** `<Path fill="none" stroke={gold} strokeWidth={2} strokeLinecap="round">` (thin gold line; gold = `colors.accent`/`accentSoft`). Catmull-Rom→Bézier smoothing. **Per-instance gradient id via `useId()`** (R: two curves on one page would otherwise share the first `<LinearGradient>`). Explicit numeric `width`/`height` (measure container / `useWindowDimensions`; % sizing collapses on web). Guard `min === max` (flat line). Static curve is acceptable; any draw-on animation gated on `useReducedMotion()`. **Services-only** (optionally Results).

### P3a.3.7 `SiteChrome` — `components/SiteChrome.tsx` (or folded into `(site)/_layout.tsx`)
Header/nav + footer, no props. Sticky header on web via `Platform.select({ web: { position: 'sticky', top: 0 } as any })`. Greek nav links (`Link`) to all six routes: Αρχική `/`, Ποιοι είμαστε `/about`, Υπηρεσίες `/services`, Αποτελέσματα `/results`, Επικοινωνία `/contact`, and a primary "Κλείσε αξιολόγηση"-style CTA to `/booking`. Deep-green (`colors.primary`) footer with the practice name + contact stub. Visible focus on nav links via `Pressable` `focused`.

### P3a.3.8 `PracticeMap` — `.web.tsx` / `.native.tsx` (D-3)
Exported as `PracticeMap` (Metro picks the file per target). No props required (coords in-code per D-9) or `{ lat, lon, label }`.
- `PracticeMap.web.tsx`: a plain JSX `<iframe loading="lazy">` pointing at OpenStreetMap `https://www.openstreetmap.org/export/embed.html?bbox=…&layer=mapnik&marker=${lat},${lon}` — **no API key**. `style={{ border:0, width:'100%', height:320, borderRadius:14 }}`.
- `PracticeMap.native.tsx`: a `Card` + `Pressable` → `Linking.openURL('https://www.openstreetmap.org/?mlat=…&mlon=…#map=16/…')` ("Open in Maps"). **No `<iframe>` JSX in the native file** (RN rejects the unknown element).

### P3a.3.9 `lib/api.ts` additions (C1)
Append, following the existing `request<T>` + `JSON_HEADERS` pattern (import the two new DTOs into the existing `import type` block; leave `TRAINER_ID` untouched):
```ts
export function createLead(body: CreateLeadInput): Promise<LeadDTO> {
  return request<LeadDTO>('/leads', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
}
export function createBooking(body: CreateBookingInput): Promise<BookingDTO> {
  return request<BookingDTO>('/bookings', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
}
```

---

## P3a.4 The six pages — IA + content outline (Unit C2)

Greek-first content (D-4 default — Greek nav labels + Greek headings + Greek in-code body copy; no runtime switcher, no full i18n). **Bilingual Greek+English is an option** (D-4 veto) — it roughly doubles every page's copy and needs a toggle; flagged as the main content decision. Every page: `Section`/`Container` rhythm, the type scale, **≤ 1 `ProofBand`/bold moment**, generous whitespace, copper only on small details, responsive column→row via `useBreakpoint`, and a per-page `<Head>`.

### P3a.4.1 Home — `(site)/index.tsx` → `/` (Αρχική)
**Business-first (DS-7 / AC-3a-2): about the PRACTICE, not the app.** **No `ProgressCurve` on Home.**
- **Hero:** `Eyebrow` + H1 headline promise (calm, expert, trustworthy dog training) + a short sub-line. Primary CTA **`PrimaryButton` "Κλείσε αξιολόγηση"** → `/booking`; `SecondaryButton` "Επικοινωνία" → `/contact`.
- **Value/method strip:** 3 `Card`s — the practice's calm/precise/proof-driven approach (no hype).
- **Exactly one bold moment:** a single `ProofBand` (a proof statement or key outcome) — the page's only dark band.
- **Services teaser:** a short row linking into `/services`; the data-tracking platform appears here at most as a one-line teaser ("μετρήσιμη πρόοδος") that links into Services — **never the hero**.
- Primitives: `Eyebrow`, `Section`, `Card`, `PrimaryButton`, `SecondaryButton`, `ProofBand` (×1).

### P3a.4.2 About — `(site)/about.tsx` → `/about` (Ποιοι είμαστε)
- **Intro:** `Eyebrow` + H2; the practice, its philosophy. "Proof not promises" tone.
- **Method:** prose at `maxProse` (720) — the training method, why structured/longitudinal.
- **Trainer(s) / credentials:** `Card`(s) — name, approach, credentials.
- Greek body copy (D-4). Optional single `ProofBand`. Primitives: `Eyebrow`, `Section`, `Card`.

### P3a.4.3 Services — `(site)/services.tsx` → `/services` (Υπηρεσίες)
**The ONLY page with `ProgressCurve`.**
- **Service catalogue as peers:** `Card` per service mapping to `BOOKING_TYPES` — Αξιολόγηση (`assessment`), Ιδιαίτερα (`private`), Ομαδικά (`group`). Each may carry a "Κλείσε ραντεβού" link to `/booking` (per-service `type` prefill is a nice-to-have, not required).
- **The data-driven premium service:** a distinct section framing structured behavior tracking as **one premium service** (not the hero), with **`ProgressCurve`** (sample/placeholder data) as proof of method — thin gold line on deep green. This is the page's bold moment.
- Primitives: `Eyebrow`, `Section`, `Card`, `ProgressCurve`, `PrimaryButton`/`SecondaryButton`.

### P3a.4.4 Results — `(site)/results.tsx` → `/results` (Αποτελέσματα)
- Renders from an **in-code placeholder array** (D-5), clearly structured so real case studies replace it with no layout change:
  ```ts
  const CASES: { dogName: string; summary: string; before: string; after: string; curveData: { occurredAt: string; thresholdMeters: number }[] }[] = [ /* tasteful placeholders */ ];
  ```
- A `Card` per case (dog, summary, before→after). **May reuse `ProgressCurve`** for an outcome arc per case. Clearly placeholder — **no fabricated testimonials**.
- Primitives: `Eyebrow`, `Section`, `Card`, optional `ProgressCurve`.

### P3a.4.5 Contact — `(site)/contact.tsx` → `/contact` (Επικοινωνία)
- **Practice details (in-code, D-9):** address, opening hours, phone, email — in `Card`(s).
- **Map:** `<PracticeMap/>` (keyless OSM iframe on web; card+Linking on native).
- **Lead form** → `POST /leads`: fields `name`, `contact` (email/phone), optional `message`; the page sets `source: 'website-contact'`. Submit → `createLead(...)`; a discriminated-union `Status` (`idle`/`pending`/`success`/`error`) mirroring the Phase 1 health screen; on success confirm receipt; on error surface the `ApiError` message. Visible focus on inputs; `prefers-reduced-motion` respected.
- Primitives: `Eyebrow`, `Section`, `Card`, `PracticeMap`, `PrimaryButton`.

### P3a.4.6 Booking — `(site)/booking.tsx` → `/booking`
- **Appointment-request form** → `POST /bookings`: `type` selector (`assessment`/`private`/`group` from `BOOKING_TYPES`), a requested date/time → ISO `requestedAt`, `name`, `contact`, optional `notes`. Submit → `createBooking(...)`; same `Status` union; on success confirm the practice will respond.
- Primitives: `Eyebrow`, `Section`, `Card`, `PrimaryButton`.

---

## P3a.5 API contracts (Unit B)

Both endpoints are **PUBLIC / unauthenticated**, follow the `sessions.ts` template, mount in `app.ts` via `app.route('/', leads)` / `app.route('/', bookings)`, and return `{ error: string }` on failure (no internal leakage). `cors()` stays allow-all (3b tightens it).

### P3a.5.1 `POST /leads` (PUBLIC) → `201 LeadDTO`
**Body** `CreateLeadInput`. **Zod** (length caps satisfy FR-A3 input-size limits):
```ts
const createLead = z.object({
  name:    z.string().min(1).max(200),
  contact: z.string().min(1).max(200),
  source:  z.string().min(1).max(100),
  message: z.string().max(2000).optional(),
});
```
**Flow:** validate → `const trainerId = await resolveTrainerId()` (catch → 503) → `db.insert(lead).values({ name, contact, source, message: body.message ?? null, trainerId /* status DB-default 'new', clientId DB-default null */ }).returning()` → map to `LeadDTO` (`createdAt.toISOString()`) → `const to = await getTrainerEmail(trainerId)` → **fire-and-forget** `void sendLeadNotification(to, dto).catch((e) => console.error('[email] send failed (non-fatal)', e))` (NEVER awaited) → `c.json(dto, 201)`.

| Status | When | Body |
| --- | --- | --- |
| 201 | valid | `LeadDTO` (`status:'new'`, `clientId:null`) |
| 400 | zod validation failure | zValidator default JSON error body |
| 503 | `resolveTrainerId()` throws (no practice trainer) | `{ error: 'practice not configured' }` |
| 429 | rate-limited | `{ error: 'too many requests' }` |

### P3a.5.2 `POST /bookings` (PUBLIC) → `201 BookingDTO`
**Body** `CreateBookingInput`. **Zod:**
```ts
const createBooking = z.object({
  type:        z.enum(BOOKING_TYPES),
  requestedAt: z.string().datetime(),   // ISO; → new Date(...) on insert
  name:        z.string().min(1).max(200),
  contact:     z.string().min(1).max(200),
  notes:       z.string().max(2000).optional(),
});
```
**Name/contact folding (D-7 + interface-contract note):** the `booking` table has **no** `name`/`contact` columns. They are validated for follow-up context and **prepended into `notes`** so they are not lost: `notes = \`[${name} · ${contact}] ${body.notes ?? ''}\`.trim()`. `leadId` stays **null** (no auto-created lead in 3a).
**Flow:** validate → `resolveTrainerId()` (→ 503) → `db.insert(booking).values({ type, requestedAt: new Date(body.requestedAt), trainerId, leadId: null, clientId: null, notes /* status DB-default 'requested' */ }).returning()` → map to `BookingDTO` (`requestedAt`/`createdAt` `.toISOString()`) → `c.json(dto, 201)`.

| Status | When | Body |
| --- | --- | --- |
| 201 | valid | `BookingDTO` (`status:'requested'`, `leadId:null`) |
| 400 | bad `type` or non-ISO `requestedAt` (or other zod failure) | zValidator default JSON error body |
| 503 | no practice trainer | `{ error: 'practice not configured' }` |
| 429 | rate-limited | `{ error: 'too many requests' }` |

### P3a.5.3 `resolveTrainerId()` + `getTrainerEmail()` — `apps/api/src/lib/trainer.ts` (D-2)
```ts
// resolveTrainerId(): read PRACTICE_TRAINER_ID at CALL TIME (NOT in config.ts).
//   - set & non-empty  -> return it.
//   - else SELECT id FROM trainer ORDER BY createdAt ASC LIMIT 1 (else by id) -> if a row, return its id.
//   - else THROW (clear message) -> route maps to 503 { error: 'practice not configured' }.
// NEVER insert a fabricated/empty trainerId (the NOT-NULL FK would 500).
// getTrainerEmail(id): SELECT trainer.email -> string | null (the lead-notification recipient).
```
`PRACTICE_TRAINER_ID` is read lazily here, **not** added to `config.ts` (mirrors the R2 lazy discipline). Documented in `.env.example` as optional ("defaults to the single seeded trainer; set to pin the practice trainer for public leads/bookings").

### P3a.5.4 Rate limiting (D-8)
`hono-rate-limiter` in-memory limiter scoped to the two POST paths (generous per-IP window, e.g. ~10/min), keyed by `c.req.header('x-forwarded-for')` → connecting IP, returning `429 { error: 'too many requests' }`. **Plus** the Zod `.max()` caps (independently required). Optional note: production should add an edge limiter (in-memory resets on restart / isn't shared across instances — fine for a single scale-to-zero Railway instance and local acceptance). If the dependency is unwanted (D-8 veto) → Zod caps only + a documented edge-limiter note.

---

## P3a.6 `lib/email.ts` design (Unit B)

Mirrors `lib/r2.ts`'s lazy-config shape **but inverts the missing-key behavior**: R2 throws (→503); email **logs a stub and returns success** when keyless (kickoff "stub if no key"; NFR-9 insert-is-source-of-truth). The Resend SDK lives **only** in `apps/api` (NFR-6).

```ts
// apps/api/src/lib/email.ts
import { Resend } from 'resend';
import type { LeadDTO } from '@tailsup/shared';

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;          // lazy read — NOT in config.ts
  if (!key || key.trim() === '') return null;      // STUB path — NO throw
  client ??= new Resend(key);
  return client;
}

export async function sendLeadNotification(to: string | null, lead: LeadDTO): Promise<void> {
  const c = getClient();
  if (!c || !to) {
    console.log('[email:stub] new lead', { to, id: lead.id, name: lead.name, contact: lead.contact, source: lead.source });
    return;                                         // stub: no key OR no recipient -> log + no-op
  }
  const { error } = await c.emails.send({          // resolves { data, error }; does NOT throw on API errors
    from: process.env.RESEND_FROM ?? 'TailsUp <onboarding@resend.dev>',
    to,
    subject: `New lead: ${lead.name}`,
    html: `<p>New lead from ${lead.source}</p><p>${lead.name} — ${lead.contact}</p><p>${lead.message ?? ''}</p>`,
  });
  if (error) console.error('[email] resend error (non-fatal)', error);
}
```
**Critical invariants:** (1) `RESEND_API_KEY` stays **out of `config.ts`** (read lazily). (2) The route **never awaits** `sendLeadNotification` before the 201 — awaiting couples request latency to Resend and risks a 5xx. (3) The un-awaited promise always gets a `.catch()` (an unhandled rejection on a network/DNS failure could crash Node). (4) `RESEND_FROM` documented in `.env.example` (optional; needs a Resend-verified domain in production; `onboarding@resend.dev` for dev).

---

## P3a.7 New `@tailsup/shared` DTOs (Unit A — LANDS FIRST)

**File:** `packages/shared/src/dtos.ts` (APPEND below the Phase 2 DTOs; do not modify existing ones). **Pure TS** — reuse the existing enum unions. Add `BookingType, LeadStatus, BookingStatus` to the existing `import type { TriggerType, Outcome, MediaType } from './enums';` line. **No new enum** is needed for 3a (`ROLES` is a 3b concern). The barrel auto-exports (no `index.ts` edit).

```ts
// add to the existing import: BookingType, LeadStatus, BookingStatus from './enums'

// POST /leads request body (PUBLIC). `source` is set by the page (e.g. 'website-contact').
export interface CreateLeadInput {
  name: string;
  contact: string;        // free-text email or phone
  source: string;
  message?: string;
}

// POST /leads response — mirrors the `lead` row (createdAt as ISO string).
export interface LeadDTO {
  id: string;
  trainerId: string;
  name: string;
  contact: string;
  source: string;
  message: string | null;
  status: LeadStatus;     // always 'new' on create
  clientId: string | null;// always null on create
  createdAt: string;      // ISO
}

// POST /bookings request body (PUBLIC). type ∈ BOOKING_TYPES; requestedAt ISO.
// name/contact captured for follow-up; folded into `notes` on insert (no columns exist); leadId stays null in 3a (D-7).
export interface CreateBookingInput {
  type: BookingType;
  requestedAt: string;    // ISO datetime
  name: string;
  contact: string;
  notes?: string;
}

// POST /bookings response — mirrors the `booking` row (requestedAt/createdAt as ISO).
export interface BookingDTO {
  id: string;
  trainerId: string;
  leadId: string | null;
  clientId: string | null;
  type: BookingType;
  requestedAt: string;    // ISO
  status: BookingStatus;  // always 'requested' on create
  notes: string | null;
  createdAt: string;      // ISO
}
```

**Purity gate (NFR-6):** `git grep -nE "drizzle|from 'pg'|aws|resend|better-auth|node:" packages/shared/src` returns nothing.

---

## P3a.8 Error-handling strategy

Consistent with the Phase 1/2 discipline: **no config fallbacks** except the deliberate email stub.
- **Validation → 400.** `@hono/zod-validator` returns 400 with its structured body on any malformed input (`.min()`/`.max()` caps, bad `type` enum, non-ISO `requestedAt`).
- **`resolveTrainerId()` throw → 503** `{ error: 'practice not configured' }` — never insert a fabricated/empty `trainerId` (the NOT-NULL FK would 500). The route catches the throw and maps it.
- **Email stub (the ONE intentional graceful degradation):** missing `RESEND_API_KEY` (or missing recipient) → logged no-op, returns success; failure (incl. an un-awaited rejection) is caught and logged **non-fatally** — it **must not** block or fail the 201 (NFR-9).
- **Rate limit → 429** `{ error: 'too many requests' }`.
- **Unhandled handler errors** fall through to the existing `onError` → `500 { error: 'internal server error' }`. `notFound` → `404 { error: 'not found' }`. No secret/internal leakage in any body.
- **`config.ts` unchanged:** `RESEND_API_KEY` and `PRACTICE_TRAINER_ID` are read lazily, never in the throw-on-missing required set (adding them would break boot + the vitest suite with no consumer).

---

## P3a.9 Technology choices (within the fixed stack)

The stack is fixed (one Expo Router codebase; Hono+Drizzle; Resend stub; pure shared). Within-stack 3a picks:

| Pick | Choice | Why |
| --- | --- | --- |
| **Routing** | `(site)`/`(app)` route groups; root `<Slot>` | Idiomatic Expo Router, zero config, clean 3b auth boundary on `(app)/_layout.tsx` only (LBD-2). |
| **SEO** | keep `web.output:"static"` + `expo-router/head` `<Head>` (verify+fallback) | Already enabled; real per-route SEO for a marketing site; React-19/client-side fallbacks if static emit fails (D-6, not a blocker). |
| **Design System** | `lib/theme.ts` tokens + `StyleSheet` + `Pressable` states + `useWindowDimensions` | No new styling dep (NFR-6); matches the existing `app/index.tsx` idiom; tokens are the single source of truth. |
| **Fonts** | `expo-font` + `@expo-google-fonts/{fraunces,inter}` via `npx expo install` | Supported path, web+native, FOUT-tolerable with `Georgia`/`system-ui` fallbacks. |
| **Progress-curve** | hand-rolled `react-native-svg@15.12.1` | Full DS control over the gold-line-on-green look; minimal deps (OQ-16/NFR-6); web+native. |
| **Map** | OSM `export/embed.html` iframe (`.web.tsx`) + native card+`Linking` (`.native.tsx`) | No API key (D-3/OQ-6); keeps `<iframe>` out of the native bundle. |
| **Endpoints** | `sessions.ts` pattern + `resolveTrainerId()` + lazy fire-and-forget email | NFR-9 (insert is source of truth); honest 503 on unconfigured practice. |
| **Rate-limit** | `hono-rate-limiter` on the two routes + Zod `.max()` caps | Demonstrable throttle (AC-3a-9), simple (NFR-2), lives in `apps/api`. |

---

## P3a.10 Integration points & the parallel-unit contract

### P3a.10.1 Ordering & disjointness
```
        ┌──────────────────────────────────────────────────────────────┐
        │  UNIT A — packages/shared : the Phase 3a DTO contract          │
        │  LANDS FIRST + is COMMITTED before B / C1 start                 │
        └───────────────┬───────────────────────────────┬────────────────┘
                        │ (B & C1 type-check against A)   │
        ┌───────────────▼───────────────┐   ┌────────────▼──────────────────┐
        │ UNIT B — apps/api              │   │ UNIT C1 — apps/mobile FOUNDATION│
        │ routes/leads + routes/bookings │   │ theme + fonts + (site)/(app)    │
        │ lib/email (stub) + lib/trainer │   │ groups + UI primitives +        │
        │ + rate-limit + mount + vitest  │   │ ProgressCurve + PracticeMap +   │
        │ + .env.example  (depends on A) │   │ +html + ROUTING restructure +   │
        │                                │   │ lib/api helpers  (depends on A) │
        └────────────────────────────────┘   └────────────┬───────────────────┘
                  DISJOINT DIRS                            │ (C2 imports C1's exports)
            (apps/api  vs  apps/mobile)      ┌─────────────▼──────────────────┐
                                             │ UNIT C2 — the 6 (site) pages     │
                                             │ Home/About/Services/Results/     │
                                             │ Contact/Booking (ONE agent)      │
                                             └──────────────────────────────────┘
```
1. **Unit A lands and is committed first** (B and C1 both import the new DTOs — they won't type-check until A exists).
2. After A commits, **B and C1 run in PARALLEL** on **disjoint directories** (`apps/api/**` vs `apps/mobile/**`).
3. **C1 → C2 is SEQUENTIAL within `apps/mobile`.** C1 commits the routing restructure + theme + primitives + ProgressCurve + PracticeMap + api helpers; **then** C2 builds the six pages consuming C1's exports. **C2 is ONE agent** so the premium design stays visually consistent across all six pages (do not split pages across agents — they share the theme, chrome, and primitives).

### P3a.10.2 File-ownership map (no two units write the same file)
| Unit | Owns / creates (EXCLUSIVE) | Depends on | Satisfies (AC) |
| --- | --- | --- | --- |
| **A** | `packages/shared/src/dtos.ts` (append 4 DTOs + extend the `import type` line) | — (lands first) | AC-3a-1 |
| **B** | `apps/api/**`: `routes/leads.ts`, `routes/bookings.ts`, `lib/email.ts`, `lib/trainer.ts` (new); `app.ts` (mount + rate-limit edit); `test/leads.test.ts`, `test/bookings.test.ts` (new); `package.json` (add `resend`, `hono-rate-limiter`); **root** `.env.example` (add `PRACTICE_TRAINER_ID` + `RESEND_FROM`); `README.md` (3a API/demo section) | A (committed) | AC-3a-1, AC-3a-6, AC-3a-7, AC-3a-9, AC-3a-10 |
| **C1** | `apps/mobile/**`: `lib/theme.ts`, `lib/reducedMotion.ts`, `app/+html.tsx`, `app/(site)/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/health.tsx` + moved `dogs`/`sessions`/`events`, `components/SiteChrome.tsx`, `components/ui/*`, `components/ProgressCurve.tsx`, `components/PracticeMap.web.tsx`+`.native.tsx`; **rewrite** `app/_layout.tsx`; **edit** `lib/api.ts`, `package.json` (add fonts + svg) | A (committed) → COMMIT | AC-3a-1, AC-3a-3 (partial), AC-3a-4, AC-3a-8, AC-3a-10 |
| **C2** | `apps/mobile/app/(site)/*.tsx` only (the 6 pages — consumes C1's exports) | C1 (committed) | AC-3a-1, AC-3a-2, AC-3a-3, AC-3a-4, AC-3a-5, AC-3a-7, AC-3a-8 |

**Two-owner avoidance:** root `.env.example` is owned by **Unit B** alone (it documents `PRACTICE_TRAINER_ID` + `RESEND_FROM`; no mobile env change is needed for 3a). README 3a docs are owned by B; C2's "how to view the site on web" snippet folds in at integration. `docs/design/project-functions.md` is updated by the planner, not a build unit.

### P3a.10.3 Runtime integration points (new in 3a)
| From | To | Mechanism |
| --- | --- | --- |
| Contact page lead form | api `POST /leads` | `createLead()` → `request<LeadDTO>` over `API_URL` |
| Booking page form | api `POST /bookings` | `createBooking()` → `request<BookingDTO>` over `API_URL` |
| api `POST /leads` | Resend | `sendLeadNotification()` fire-and-forget (stub when keyless) |
| api (both routes) | PostgreSQL | `resolveTrainerId()` + `db.insert(lead|booking).returning()` |
| Contact web page | OpenStreetMap | keyless `<iframe>` embed (no API call from the API) |

---

## P3a.11 Architectural Decisions (D-1..D-9)

These mirror and lock the plan's gate defaults; settled for execution unless vetoed at the review gate.

| # | Decision | This design assumes | Rationale | Where it bites if changed |
| --- | --- | --- | --- | --- |
| **D-1** | Route grouping + `/` collision + health move | Public `(site)/*` + authed `(app)/*` route groups; root `_layout`→`<Slot>`; **Home owns `/`**, **health → `/health`** (`(app)/health.tsx`); the `Link href="/dogs"` keeps working | Idiomatic Expo Router; clean 3b auth boundary; resolves the double-`index`-at-`/` error (LBD-2) | The whole C1 mobile restructure; flat-routes-with-conditional-chrome would make the 3b guard a pathname tangle |
| **D-2** | `trainerId` for PUBLIC writes | `resolveTrainerId()`: `PRACTICE_TRAINER_ID` (lazy) → sole/oldest `trainer` row → throw→503. Never fabricate a `trainerId`. New optional `PRACTICE_TRAINER_ID` in `.env.example` | Honest, debuggable single-practice resolution; the FK rejects empty anyway | Multi-practice would need a per-page trainer selector (out of 3a scope) |
| **D-3** | Keyless map provider | OSM `export/embed.html` `<iframe>` via `PracticeMap.web.tsx`/`.native.tsx` split; coords in-code | No API key / no billing (OQ-6) | Google Maps Embed would need a key + billing |
| **D-4** | Copy language | **Greek-first** (Greek nav + headings + in-code Greek body); no switcher, no full i18n. *(Bilingual Greek+English is the veto option.)* | Matches the kickoff's Greek page names; no CMS in scope | Bilingual roughly doubles every page's copy + needs a toggle (larger C2) |
| **D-5** | Results page data | Tasteful in-code **placeholder array** `{ dogName, summary, before, after, curveData }[]`; may reuse `ProgressCurve`; **no fabricated testimonials** | Real case studies later swap the array contents with no layout change | If real cases exist now, swap the array (no structural change) |
| **D-6** | SEO static head | **Best-effort:** `<Head>` per page + `+html.tsx` shell; verify via `expo export` + grep; fall back to React-19 bare tags (web-guarded) → client-side-only head. **Not a build blocker** | SDK-54 static emission is UNCERTAIN (issue #833 history); pages render regardless | Guaranteed pre-rendered SEO might force the `+html.tsx` page-map (research Option B), decided at integration |
| **D-7** | Booking ↔ lead linkage | `POST /bookings` inserts `leadId: null` (no auto-created lead); name/contact folded into `notes` | Keeps 3a simple | Auto-creating/attaching a lead is a small 3b addition (OQ-8) |
| **D-8** | Rate limiting | `hono-rate-limiter` on the two POST paths (generous per-IP) + Zod `.max()` caps; production edge-limiter deferred | Demonstrable throttle (AC-3a-9), simple (NFR-2), no prod deploy in 3a | Dropping the dep → Zod caps only + a documented edge-limiter note (weakens the "demonstrable throttle" half of AC-3a-9) |
| **D-9** | Contact details + email recipient | Practice address/hours/phone/email authored **in-code** on Contact; the lead-notification recipient is the **resolved trainer's `trainer.email`** (via `getTrainerEmail`) | Single-practice, no CMS; the seed trainer is the practice (OQ-7) | If details should come from the `trainer` row / an env var, the Contact page + recipient lookup change |

**Resume signal for the gate:** "approved" to proceed with all D-1..D-9 defaults, or name the ones to change (e.g. "D-4 → bilingual", "D-2 → set PRACTICE_TRAINER_ID, no fallback", "D-5 → real cases", "D-8 → Zod caps only").

---

## P3a.12 Verification (maps to AC-3a-1..AC-3a-10)

Run from repo root unless noted.
1. **Typecheck all workspaces (AC-3a-1):** `npm run typecheck --workspaces` → zero errors across `@tailsup/shared`, `apps/api`, `apps/mobile`.
2. **API tests (AC-3a-6/7/9):** `npm run test -w apps/api` → 133 existing + new lead/booking tests pass. New tests: `leads.test.ts` (201 + correct `LeadDTO`; missing field → 400; keyless stub path still 201 + stub log, no throw; no-trainer → 503; mock `../db/client.js` + `./email.js`/`resend`), `bookings.test.ts` (201 `'requested'`; bad `type` → 400; non-ISO `requestedAt` → 400; no-trainer → 503).
3. **No migration (FR):** `git status --porcelain apps/api/drizzle` → empty.
4. **Shared purity (NFR-6):** `git grep -nE "drizzle|from 'pg'|aws|resend|better-auth|node:" packages/shared/src` → no matches.
5. **Static web export + SEO grep (AC-3a-3 + D-6):** `cd apps/mobile && npx expo export --platform web` completes; `dist/` contains `index.html`, `about.html`, `services.html`, `results.html`, `contact.html`, `booking.html`; grep one for `<title>`; apply the D-6 fallback if absent. Not a blocker.
6. **Live-DB demo (AC-3a-5/6/7):** with a seeded `trainer` (or `PRACTICE_TRAINER_ID` set) and the API running, `POST /leads` → 201 `'new'` (+ stub log when keyless), `POST /bookings` → 201 `'requested'`, invalid `type`/`requestedAt` → 400, rapid repeats → 429; then submit the Contact + Booking forms on Expo web and confirm rows insert.
7. **Business-first inspection (AC-3a-2):** Home is practice-first, **no** progress-curve; the curve appears **only** on Services.
8. **No 3b/4 leakage (AC-3a-10):** grep the diff for `better-auth`, `AUTH_SECRET` reads, `PATCH /bookings`, `/convert`, `/summary` → none; `cors()` unchanged; Phase 1/2 screens/endpoints unchanged.

---

## P3a.13 Phase 3a Risks & Mitigations (carried from the plan)

| ID | Risk | Mitigation (in this design) |
| --- | --- | --- |
| **R-1** | SEO static-head uncertain on SDK 54 (issue #833 history) | P3a.1.4 verify (`expo export` + grep); React-19 bare-tag (web-guarded) → client-side-only fallbacks. **Not a blocker** (D-6). |
| **R-2** | `react-native-svg` web gradient-id collisions (two curves reuse the first `<LinearGradient>`) | Per-instance gradient id via `useId()` in `ProgressCurve` (P3a.3.6). |
| **R-3** | RN-Web style limits (no `@media`; web-only props rejected by RN types) | `useWindowDimensions`/`useBreakpoint` for breakpoints; web-only props via narrow `Platform.select({ web: {…} as any })` (sticky header, cursor, outline). |
| **R-4** | Font FOUT on web | Acceptable `Georgia`/`system-ui` fallbacks + `FontDisplay.SWAP`; never block the whole web site on font load (quality floor). |
| **R-5** | `/` route collision (two `index` at `/`) | D-1: Home owns `/`; health → `(app)/health.tsx` (`/health`); move in C1; verify `/dogs` link. |
| **R-6** | Email stub must NOT block the 201 (awaiting Resend couples latency / can 5xx) | Fire-and-forget `void send(...).catch(...)`, never awaited; `RESEND_API_KEY` out of `config.ts`; tests assert 201 regardless (P3a.6). |
| **R-7** | `resolveTrainerId()` throw path (no trainer + no env → could 500 / FK violation) | Explicit throw → `503 { error: 'practice not configured' }`; never insert empty `trainerId`; tested (P3a.5.3). |
| **R-8** | Homepage drifts into app-showcase (violates business-first DS-7) | AC-3a-2 inspection; C2 forbids the curve on Home + limits to one bold moment; Services owns the data-platform framing (P3a.4.1/.3). |
| **R-9** | `<iframe>` leaks into the native bundle (RN rejects unknown element) | `PracticeMap.web.tsx`/`.native.tsx` platform split; no `<iframe>` JSX in shared/native code (P3a.3.8). |
| **R-10** | Metro monorepo resolution of new font/svg packages | `npx expo install` (not bare npm); documented `metro.config.js` fallback in `app/index.tsx:9-33` if needed (do not add pre-emptively). |
| **R-11** | Rate-limiter IP behind proxy (in-memory, single-instance) | Generous window keyed by `x-forwarded-for` → connecting IP; documented that prod adds an edge limiter (D-8). |

---

_Phase 3a plan: `docs/design/plan-003-tailsup-phase3a-public-site.md` · Refined spec: `docs/reference/refined-request-phase3.md` (3a parts) · Investigation: `docs/reference/investigation-phase3a.md` · SEO research: `docs/research/expo-router-static-head-sdk54.md` · Design System reference: `design_system.md` (repo root) · Kickoff: `prompts/001-tailsup-kickoff.md` · Phases 1+2 design: this document (above)._
