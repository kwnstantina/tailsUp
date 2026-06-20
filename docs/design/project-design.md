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
