---
plan: 001-tailsup-phase1-foundations
phase: 01-foundations
type: execute
domain: typescript-monorepo (Expo Router + Hono + Drizzle/Postgres)
---

# Plan 001 — TailsUp Phase 1: Foundations

> Claude-executable implementation plan for **Phase 1 — Foundations** of the TailsUp platform.
> Scope is **Phase 1 ONLY**: monorepo scaffold, full 12-entity Drizzle schema + migrations, `GET /health` + `POST /sessions/:id/events`, `.env.example`, one Expo Router `/health` screen, a daily `pg_dump`→R2 GitHub Action, and run docs. Do **not** build Phase 2–4 features.
>
> Context (read before executing):
> - `docs/reference/refined-request-tailsup.md` — full scope, 12-entity data model, acceptance criteria AC-1..AC-12.
> - `docs/reference/investigation-tailsup-phase1.md` — version-pinned (June 2026) wiring guidance; **follow its recommendations**.
> - `docs/design/project-functions.md` — functional-requirements ledger (FR-1..FR-11 + data model).

---

## ⚠️ DECISIONS NEEDING USER INPUT (resolve at the design-review gate before execution)

The open questions in the refined spec each came with a recommended default. These defaults are **baked into this plan**. They are listed here so the user can **veto any of them** at the upcoming design-review gate. If none are vetoed, execution proceeds with these choices.

| # | Decision | Chosen default (baked into plan) | Where it bites if changed |
| --- | --- | --- | --- |
| D-1 | **Primary key strategy** | **UUID** (`uuid().defaultRandom()`) on every table. Offline-friendly (NFR-6); client can mint ids before sync. | All FK column types; would require regenerating the schema and migration. |
| D-2 | **`pg_dump` source DB in CI** | The **production Railway `DATABASE_URL`** stored as a GitHub Secret. | Backup workflow env + secret name. |
| D-3 | **Backups bucket** | A **separate R2 backups bucket** (`R2_BACKUP_BUCKET`), distinct from the media bucket (`R2_BUCKET`). | Backup workflow upload target + secret list. |
| D-4 | **Backup retention/rotation** | **Defer** — keep all dumps, date-prefixed keys (`YYYY-MM-DD/backup.dump`). An R2 lifecycle rule (e.g. 30-day expiry) can be added later. | None now; date-prefix makes a lifecycle rule trivial later. |
| D-5 | **Mobile verification target** | **Expo web is sufficient** for Phase 1 acceptance (AC-9). Run docs still list the localhost / `10.0.2.2` / LAN-IP matrix for real devices. | What the verifier must launch; native sims become optional. |
| D-6 | **No-protocol default-intervention behavior** | When `intervention` is omitted **and** the dog has no `protocol` (or the protocol has no `defaultIntervention`), return **HTTP 400** instructing the client to supply `intervention`. Keeps `intervention` non-null (moat intact). | Endpoint error path in Unit B. |
| D-7 | **Validation library** | **`@hono/zod-validator` + Zod**, with `z.enum(...)` built from the shared enum arrays. | Endpoint validation in Unit B; `zod` dependency. |
| D-8 | **Postgres driver** | **`pg` (node-postgres)** via `drizzle-orm/node-postgres`. | DB client + dependencies in Unit B. |
| D-9 | **API runtime / port** | **Node** via `@hono/node-server`, reading `process.env.PORT` (default `3000`). | API entrypoint in Unit B. |

> **Resume signal for this gate:** "approved" to proceed with all defaults, or name the decision(s) to change (e.g. "D-1 → bigserial, D-4 → 30-day retention").

---

## Objective

**Purpose:** Stand up the foundational layer of TailsUp as an npm-workspaces monorepo so that: the full database schema exists and migrates cleanly; the API serves a health probe and the core behavior-logging write; the mobile app proves app↔API connectivity; secrets are templated; and database backups run automatically from day one.

**Output:** A working monorepo at the repo root with `apps/api`, `apps/mobile`, `packages/shared`, committed Drizzle migrations, a backup workflow, and a README that reproduces the `/health` round-trip. All 12 acceptance criteria (AC-1..AC-12) satisfied. **Phase boundary respected (AC-12):** only `GET /health` and `POST /sessions/:id/events` are implemented as endpoints; the schema covers all 12 entities but no other endpoints or UI exist.

---

## Confirmed stack & versions (June 2026 — from the investigation; do not re-litigate)

- Node ≥ 20. npm workspaces.
- Hono `4.12.x` on `@hono/node-server` v2.
- `drizzle-orm` `0.45.x` (stable line; **not** the `1.0.0-rc`). `drizzle-kit` matching. `pg` driver + `@types/pg`. `tsx` for dev/migrate.
- Validation: `zod` + `@hono/zod-validator`.
- Expo SDK 54 (monorepo-aware Metro auto-config). Expo Router. **Start with zero `metro.config.js`**; add the fallback config only if resolution fails.
- TypeScript **strict** everywhere; `moduleResolution: "bundler"`.

---

## Work breakdown & parallelization

Four units. **Unit A must land first** (it creates the workspace root and the `packages/shared` interface contract that B and C import). After A is committed, **B, C, and D can be built in parallel by separate coder agents** — they touch disjoint file sets and do not edit each other's files.

```
        ┌─────────────────────────────────────────────┐
        │  UNIT A — root + workspaces + tsconfig.base  │   (must land first)
        │           + packages/shared (the contract)   │
        └───────────────┬─────────────┬────────────────┘
                        │             │
        ┌───────────────▼──┐   ┌──────▼───────────┐   ┌──────────────────────────┐
        │ UNIT B — apps/api │   │ UNIT C — apps/   │   │ UNIT D — backup workflow  │
        │ Hono+Drizzle      │   │ mobile (Expo)    │   │ + README run docs         │
        │ (depends on A)    │   │ (depends on A)   │   │ (no code dep on B/C;      │
        └───────────────────┘   └──────────────────┘   │  can run in parallel)     │
                                                        └──────────────────────────┘
```

**Dependency rule:** B and C both `import` from `@tailsup/shared` (Unit A). They will not type-check until A exists. D has no source dependency on B/C and may proceed in parallel (its README references files/commands from B and C, which are known from this plan).

**File-ownership map (no two parallel units touch the same file):**

| Unit | Owns / creates (exclusive) |
| --- | --- |
| A | repo root files; `packages/shared/**` |
| B | `apps/api/**` |
| C | `apps/mobile/**` |
| D | `.github/workflows/db-backup.yml`; `README.md`; `.env.example` (root) |

> Note on `.env.example` (AC-8): the refined spec says "at the API (and/or root)". This plan places the canonical `.env.example` at the **repo root** (owned by Unit D so it sits next to the README run docs). Unit B does **not** create its own `.env.example` to avoid a two-owner conflict; the API reads from the root `.env`/process env. If a per-app copy is later wanted, copy the root one — but root is the single source for AC-8.

---

## Interface contract — what `packages/shared` exports (Unit A) and B/C import

This is the **single source of truth** consumed by both ends (FR-9). Unit A MUST export exactly these symbols from `@tailsup/shared` (barrel `packages/shared/src/index.ts`). Units B and C import only from this barrel.

**Enum literal arrays (`as const`)** — reused by Drizzle `pgEnum`, Zod `z.enum`, and the mobile app:

```ts
// packages/shared/src/enums.ts  (re-exported from index.ts)
export const TRIGGER_TYPES = ['dog','human','noise','vehicle','other'] as const;
export const OUTCOMES      = ['disengaged','recovered_slowly','over_threshold'] as const;
export const MEDIA_TYPES   = ['video','image'] as const;
export const LEAD_STATUSES = ['new','contacted','converted','lost'] as const;
export const BOOKING_TYPES  = ['assessment','private','group'] as const;
export const BOOKING_STATUSES = ['requested','confirmed','declined','completed','cancelled'] as const;

export type TriggerType   = (typeof TRIGGER_TYPES)[number];
export type Outcome       = (typeof OUTCOMES)[number];
export type MediaType     = (typeof MEDIA_TYPES)[number];
export type LeadStatus    = (typeof LEAD_STATUSES)[number];
export type BookingType   = (typeof BOOKING_TYPES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
```

**DTOs for the Phase 1 endpoint:**

```ts
// packages/shared/src/dto.ts  (re-exported from index.ts)
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

// Response shape returned by the endpoint (the created event)
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

// GET /health response shape (imported by mobile for typing the fetch result)
export interface HealthDTO {
  status: 'ok' | 'degraded';
  db?: 'up' | 'down';
}
```

**Contract rules:**
- Unit B imports `TRIGGER_TYPES`/`OUTCOMES` (and the other arrays) for `pgEnum(...)` and `z.enum(...)`, and imports `CreateBehaviorEventInput`/`BehaviorEventDTO`/`HealthDTO` for typing handlers.
- Unit C imports `HealthDTO` (to type the `/health` fetch). It does **not** import Drizzle or `pg` — `@tailsup/shared` must contain **no** server-only imports, or Metro will try to bundle them into the app. Keep `packages/shared` pure TypeScript (types + literal arrays only).

---

## Tasks

> Tasks are grouped by unit. Within a unit, execute in order. Across units, respect the A → {B, C, D} ordering. Each `auto` task is ~15–60 min of Claude work.

### UNIT A — Repo root + npm workspaces + tsconfig.base + shared package  *(must land first)*

<task type="auto">
  <name>A1: Repo root scaffold + npm workspaces</name>
  <files>package.json, .gitignore, tsconfig.base.json, .nvmrc</files>
  <action>
  Create root `package.json` with `"private": true` and `"workspaces": ["apps/*", "packages/*"]`. Add root scripts that fan out to workspaces: `"typecheck": "npm run typecheck --workspaces --if-present"`. Set `"engines": { "node": ">=20" }`.
  Create `.nvmrc` with `20`.
  Create `.gitignore` covering: `node_modules/`, `.env`, `.env.*` (but NOT `.env.example`), `dist/`, `.expo/`, `apps/mobile/.expo/`, `*.log`, `.DS_Store`. Add a negation `!.env.example` so the template is committed (NFR-5, AC-8).
  Create `tsconfig.base.json` with `compilerOptions`: `"strict": true`, `"moduleResolution": "bundler"`, `"module": "ESNext"`, `"target": "ES2022"`, `"esModuleInterop": true`, `"skipLibCheck": true`, `"baseUrl": "."`, `"paths": { "@tailsup/shared": ["packages/shared/src/index.ts"] }`, `"noEmit": true`. Do NOT use TS Project References / `composite` (investigation: path aliases + real workspace dep is the low-maintenance choice).
  Run `git init` if no repo exists.
  </action>
  <verify>`node -v` reports >= 20. `cat package.json` shows the workspaces array. `.gitignore` excludes `.env` but a committed `.env.example` would not be ignored (`git check-ignore .env` prints `.env`; `git check-ignore .env.example` prints nothing).</verify>
  <done>Root package.json declares workspaces; tsconfig.base has strict + bundler resolution + the @tailsup/shared path alias; .gitignore protects secrets but allows .env.example.</done>
</task>

<task type="auto">
  <name>A2: packages/shared — the no-build-step contract package</name>
  <files>packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/src/index.ts, packages/shared/src/enums.ts, packages/shared/src/dto.ts</files>
  <action>
  Create `packages/shared/package.json` exactly as the investigation prescribes (TS-source-only, NO build step): `{ "name": "@tailsup/shared", "version": "0.0.0", "private": true, "main": "./src/index.ts", "types": "./src/index.ts", "exports": { ".": "./src/index.ts" } }`. Add a `"typecheck": "tsc --noEmit"` script.
  Create `packages/shared/tsconfig.json` extending `../../tsconfig.base.json` (`"extends": "../../tsconfig.base.json"`, `"include": ["src"]`).
  Create `src/enums.ts` and `src/dto.ts` with EXACTLY the symbols in the "Interface contract" section above. Create `src/index.ts` as a barrel: `export * from './enums'; export * from './dto';`.
  CRITICAL: `packages/shared` must contain ZERO runtime/server imports (no drizzle, no pg, no node built-ins). Types + `as const` arrays only — otherwise Metro will try to bundle server code into the mobile app.
  </action>
  <verify>`npm install` at root (creates the workspace symlink). Then `npm run typecheck -w @tailsup/shared` passes with zero errors. `node -e "require('fs').accessSync('node_modules/@tailsup/shared')"` confirms the hoisted symlink exists.</verify>
  <done>@tailsup/shared resolves as a workspace; exports the 6 enum arrays + their types + the 3 DTOs + HealthDTO; type-checks clean; contains no server-only imports.</done>
</task>

> **CHECKPOINT after Unit A:** Commit Unit A. Confirm a trivial symbol from `@tailsup/shared` is importable. Only then dispatch Units B, C, D in parallel (they each depend on the committed shared package for type resolution).

---

### UNIT B — apps/api: Hono + Drizzle (schema, migrations, endpoints, validation)  *(depends on A)*

<task type="auto">
  <name>B1: apps/api package + tooling + DB client</name>
  <files>apps/api/package.json, apps/api/tsconfig.json, apps/api/drizzle.config.ts, apps/api/src/db.ts</files>
  <action>
  Create `apps/api/package.json` with dependency `"@tailsup/shared": "*"`, runtime deps `hono` (4.12.x), `@hono/node-server` (v2), `@hono/zod-validator`, `zod`, `drizzle-orm` (0.45.x), `pg`; dev deps `drizzle-kit`, `@types/pg`, `tsx`, `typescript`. Scripts: `"dev": "tsx watch src/index.ts"`, `"start": "tsx src/index.ts"`, `"db:generate": "drizzle-kit generate"`, `"db:migrate": "tsx src/migrate.ts"`, `"db:push": "drizzle-kit push"` (scratch only), `"typecheck": "tsc --noEmit"`, `"build": "tsc"`.
  Create `apps/api/tsconfig.json` extending `../../tsconfig.base.json`, `"include": ["src", "drizzle.config.ts"]`. Override `"noEmit": false`, `"outDir": "dist"` for the build script while keeping strict.
  Create `drizzle.config.ts`: `defineConfig({ dialect: 'postgresql', schema: './src/schema.ts', out: './drizzle', casing: 'snake_case', dbCredentials: { url: process.env.DATABASE_URL! } })`.
  Create `src/db.ts`: `drizzle(process.env.DATABASE_URL!, { schema, casing: 'snake_case' })` from `drizzle-orm/node-postgres`. Export `db` and re-export `* as schema`. (If a Railway SSL cert error appears later, the documented fix is `ssl: { rejectUnauthorized: false }` — do not add pre-emptively.)
  </action>
  <verify>`npm install` at root resolves api deps. `npm run typecheck -w apps/api` (will fail only on the not-yet-written schema import — acceptable until B2). `cat drizzle.config.ts` shows dialect postgresql + casing snake_case.</verify>
  <done>api workspace installs; drizzle.config + db client created with pg driver and snake_case casing; scripts wired for generate→migrate (never push for the deliverable).</done>
</task>

<task type="auto">
  <name>B2: Full 12-entity Drizzle schema (singular tables, enums, jsonb+GIN, indexes, circular FK)</name>
  <files>apps/api/src/schema.ts</files>
  <action>
  Define ALL 12 entities (FR-2) with EXPLICIT SINGULAR `pgTable` names: `trainer, client, protocol, dog, session, behavior_event, media, exercise, homework, lead, booking`. Column keys camelCase (mapped to snake_case by casing).
  PKs: `uuid('id').primaryKey().defaultRandom()` on every table (D-1). All FK columns are `uuid(...)`.
  Define 6 `pgEnum`s using the SHARED arrays imported from `@tailsup/shared` (FR-9): `pgEnum('trigger_type', TRIGGER_TYPES)`, `pgEnum('outcome', OUTCOMES)`, `pgEnum('media_type', MEDIA_TYPES)`, `pgEnum('lead_status', LEAD_STATUSES)`, `pgEnum('booking_type', BOOKING_TYPES)`, `pgEnum('booking_status', BOOKING_STATUSES)`. (Cast `as unknown as [string, ...string[]]` only if drizzle's pgEnum signature requires a mutable tuple.)
  Timestamps: `timestamp(..., { withTimezone: true })`; `occurredAt`/`createdAt` `.defaultNow()`; others per spec nullability.
  `behavior_event`: `intervention` is `text().notNull()` (moat — never null, D-6). `tags: jsonb('tags').$type<string[]>()` (nullable). `intensity` integer (1–10 enforced at validation layer in B4; an optional CHECK is allowed but not required by ACs).
  Nullable FKs exactly per spec: `dog.protocolId`, `session.bookingId`, `lead.clientId`, `booking.leadId`, `booking.clientId`.
  **Circular FK (the one real trap):** `session.bookingId → booking` while `booking` is otherwise standalone, plus `lead.clientId`/`booking.leadId`/`booking.clientId`. Declare the genuinely circular edge(s) with the standalone `foreignKey({ columns:[t.bookingId], foreignColumns:[booking.id], name:'session_booking_fk' })` builder in the table callback (or `AnyPgColumn` typing) so types do NOT collapse to `any`. Order table declarations so most FKs use inline `.references()` and only the cycle edge uses the standalone builder.
  Indexes (FR-4) in the third-arg callback, returning an ARRAY: `index('behavior_event_session_occurred_idx').on(t.sessionId, t.occurredAt)`; `index('behavior_event_tags_gin').using('gin', t.tags)`; `index('session_dog_started_idx').on(t.dogId, t.startedAt)`; `index('dog_client_idx').on(t.clientId)`; `index('client_trainer_idx').on(t.trainerId)`.
  Do NOT hand-author any BetterAuth tables (investigation: its CLI owns them in Phase 3).
  </action>
  <verify>`npm run typecheck -w apps/api` passes (confirms no `any`-collapse from the circular FK). No table key resolves to `any` (spot-check `session.bookingId` and `booking.leadId` types in editor/`tsc`).</verify>
  <done>All 12 singular tables, 6 pgEnums (from shared arrays), UUID PKs, all FKs (correct nullability), jsonb tags, and all 5 required indexes are defined; circular FK declared via standalone foreignKey; type-checks clean.</done>
</task>

<task type="auto">
  <name>B3: Generate migration + migrate runner; apply to empty DB</name>
  <files>apps/api/src/migrate.ts, apps/api/drizzle/** (generated SQL + meta — COMMIT)</files>
  <action>
  Create `src/migrate.ts`: programmatic runner using `migrate(db, { migrationsFolder: './drizzle' })` from `drizzle-orm/node-postgres/migrator`, reading `DATABASE_URL`, then `process.exit(0)`.
  Run `npm run db:generate -w apps/api` to emit the from-scratch SQL migration + `meta/` under `apps/api/drizzle/`. COMMIT these (AC-3 auditability).
  **MANDATORY REVIEW (Risk R2):** open the generated SQL and confirm the **Session↔Booking back-edge** constraint is added via `ALTER TABLE ... ADD CONSTRAINT` AFTER both `session` and `booking` tables exist (drizzle-kit may split create + constraint). Also confirm the GIN index uses `USING gin (tags)` and all enums are created with `CREATE TYPE`.
  Apply to an empty DB: `npm run db:migrate -w apps/api` against a `DATABASE_URL` pointing at an empty Postgres.
  </action>
  <verify>
  `npm run db:migrate -w apps/api` exits 0 against an empty database. Then verify via psql:
  - 12 tables, singular: `psql "$DATABASE_URL" -c "\dt"` lists trainer, client, protocol, dog, session, behavior_event, media, exercise, homework, lead, booking (+ drizzle migrations meta table).
  - Enums: `psql "$DATABASE_URL" -c "\dT"` shows trigger_type, outcome, media_type, lead_status, booking_type, booking_status.
  - tags is jsonb + GIN: `psql "$DATABASE_URL" -c "\d behavior_event"` shows `tags jsonb` and an index `... USING gin (tags)`.
  - Indexes present: composite on behavior_event(session_id, occurred_at), composite on session(dog_id, started_at), index on dog(client_id), index on client(trainer_id).
  </verify>
  <done>Migration generated, reviewed (circular-FK back-edge confirmed), committed, and applied cleanly to an empty DB producing all 12 singular tables, 6 enums, jsonb tags, and all 5 indexes (AC-3, AC-4, AC-5).</done>
</task>

<task type="auto">
  <name>B4: GET /health + POST /sessions/:id/events + server entrypoint</name>
  <files>apps/api/src/index.ts, apps/api/src/routes/health.ts, apps/api/src/routes/events.ts</files>
  <action>
  `src/index.ts`: create the Hono app, mount the two route modules, serve via `@hono/node-server` `serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 })`. NO other endpoints (AC-12).
  `routes/health.ts` (FR-5, AC-6): `GET /health` runs a lightweight DB check (`SELECT 1` via the drizzle/pg client). Return 200 `{ status:'ok', db:'up' }` typed as `HealthDTO`; if the DB query throws, return 200 `{ status:'degraded', db:'down' }` (liveness still up) OR 503 — pick 200+degraded so the mobile screen can render a clear payload either way (AC-9). Document the choice in the summary.
  `routes/events.ts` (FR-6, AC-7): `POST /sessions/:id/events` with `zValidator('json', eventBody)` where `eventBody = z.object({ triggerType: z.enum(TRIGGER_TYPES), thresholdMeters: z.number().int().nonnegative(), intensity: z.number().int().min(1).max(10), outcome: z.enum(OUTCOMES), intervention: z.string().min(1).optional(), note: z.string().optional(), tags: z.array(z.string()).optional() })`. zValidator auto-returns 400 on invalid enum / out-of-range intensity.
  Handler logic: read `sessionId = c.req.param('id')`; verify the session exists (404 if not). If `intervention` omitted, resolve `session → dog → protocol.defaultIntervention`; if the dog has no protocol or no defaultIntervention, return **400** "intervention required" (D-6 — keeps intervention non-null, moat intact). Insert the `behavior_event` row preserving the `intervention → outcome` linkage. Return **201** with the created event as `BehaviorEventDTO` (`returning()`).
  Import enums/DTOs ONLY from `@tailsup/shared` (FR-9).
  </action>
  <verify>
  Start API: `DATABASE_URL=... npm run dev -w apps/api`. With a seeded session+dog+protocol (insert minimal rows via psql or a one-off script):
  - `curl -s localhost:3000/health` → 200 with `{"status":"ok","db":"up"}`.
  - Valid event → 201 + JSON body; row exists: `psql -c "select intervention, outcome from behavior_event"` shows the linkage.
  - Invalid enum (`triggerType:"cat"`) → 400. Out-of-range (`intensity:11`) → 400.
  - Omitted `intervention` with a dog that HAS a protocol → 201 and the stored intervention equals `protocol.default_intervention`.
  - Omitted `intervention` with a dog that has NO protocol → 400.
  </verify>
  <done>Health probe returns 200 JSON; event endpoint validates against shared enums (4xx on bad input), defaults intervention from Protocol, returns 201 with the persisted moat linkage, 400 when no protocol and intervention omitted. Only these two endpoints exist (AC-12).</done>
</task>

---

### UNIT C — apps/mobile: Expo Router scaffold + /health screen  *(depends on A)*

<task type="auto">
  <name>C1: Expo Router scaffold (SDK 54), workspace dep, env</name>
  <files>apps/mobile/package.json, apps/mobile/tsconfig.json, apps/mobile/app.json, apps/mobile/app/_layout.tsx, apps/mobile/.env.example (mobile-local), apps/mobile/babel.config.js (if needed)</files>
  <action>
  Scaffold an Expo Router app (SDK 54) targeting iOS/Android/web (NFR-7). Add dependency `"@tailsup/shared": "*"`. `tsconfig.json` extends `../../tsconfig.base.json` and includes Expo's TS base (`expo/tsconfig.base`) — keep `strict: true` (NFR-4); preserve the `@tailsup/shared` path alias so the editor resolves it.
  Add scripts: `"start": "expo start"`, `"web": "expo start --web"`, `"typecheck": "tsc --noEmit"`.
  Create `apps/mobile/.env.example` (mobile-local) with `EXPO_PUBLIC_API_URL=http://localhost:3000` and a comment block listing the dev-networking matrix (web=localhost, Android emulator=10.0.2.2, iOS sim=localhost, physical device=LAN IP). The mobile `.env` is git-ignored (root .gitignore covers it).
  `app/_layout.tsx`: minimal Expo Router Stack.
  **DO NOT write a metro.config.js yet** (investigation: SDK 54 auto-configures Metro for npm workspaces). Only add the fallback `watchFolders`+`nodeModulesPaths` config in C3 IF resolution fails.
  </action>
  <verify>`npm install` at root. `npm run typecheck -w apps/mobile` passes (strict). `apps/mobile/.env.example` lists `EXPO_PUBLIC_API_URL` + the networking matrix comment.</verify>
  <done>Expo Router app scaffolded with strict TS, depends on @tailsup/shared, EXPO_PUBLIC_API_URL templated, no premature metro config.</done>
</task>

<task type="auto">
  <name>C2: /health connectivity screen</name>
  <files>apps/mobile/app/index.tsx</files>
  <action>
  Single screen (FR-8, AC-9). Read base URL via STATIC dot-access only: `const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'` (Expo inlines EXPO_PUBLIC_ only with static access — no destructuring/dynamic keys).
  On mount, `fetch(\`${API_URL}/health\`)`, parse JSON typed as `HealthDTO` imported from `@tailsup/shared`. Render three explicit states: loading, success (clear "Connected" state showing the returned payload, e.g. status + db), and failure (clear "Cannot reach API" state with the error). Include a retry button.
  </action>
  <verify>
  With the API running (Unit B): `npm run web -w apps/mobile` (or `expo start --web`). Open the web build; the screen displays the success state with the `/health` payload. Stop the API and reload → the screen shows the clear failure state. (If Metro throws "Unable to resolve module @tailsup/shared", proceed to C3.)
  </verify>
  <done>Web build renders the /health round-trip: success shows the payload; failure shows a clear error; @tailsup/shared (HealthDTO) imported successfully (AC-9, AC-1).</done>
</task>

<task type="auto">
  <name>C3: (CONDITIONAL) Metro monorepo config — only if C2 resolution failed</name>
  <files>apps/mobile/metro.config.js</files>
  <action>
  ONLY create this if C2 produced "Unable to resolve module @tailsup/shared" or a hoisted-dep resolution error. Use the canonical monorepo config from the investigation: `getDefaultConfig(projectRoot)`, set `config.watchFolders = [monorepoRoot]`, set `config.resolver.nodeModulesPaths = [<app>/node_modules, <root>/node_modules]`. Do NOT add stale `extraNodeModules`/`disableHierarchicalLookup` (SDK 52+ guidance deletes those). Re-run the web build.
  If C2 already worked with zero config, SKIP this task and note "Metro auto-config sufficient" in the summary.
  </action>
  <verify>If created: `npm run web -w apps/mobile` resolves @tailsup/shared and the screen renders. If skipped: note zero-config success.</verify>
  <done>Either Metro auto-config was sufficient (no file), or the fallback config resolves the workspace package and the screen renders.</done>
</task>

---

### UNIT D — GitHub Action backup workflow + .env.example + README run docs  *(parallel; no code dep on B/C)*

<task type="auto">
  <name>D1: Root .env.example (exact AC-8 list)</name>
  <files>.env.example</files>
  <action>
  Create root `.env.example` (FR-7, AC-8) listing EXACTLY these 8 variables with placeholder values and brief inline comments, NO real secrets: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AUTH_SECRET`, `RESEND_API_KEY`.
  Below a separator, document (as comments, NOT counted in the AC-8 list) the two non-API vars used elsewhere: `EXPO_PUBLIC_API_URL` (mobile, lives in apps/mobile/.env) and `R2_BACKUP_BUCKET` (CI-only GitHub Secret for the separate backups bucket, D-3). Make clear these are not part of the API's required 8.
  </action>
  <verify>`.env.example` exists and contains exactly the 8 named vars (placeholders only). `git check-ignore .env.example` prints nothing (committed); `git check-ignore .env` prints `.env` (ignored). No value looks like a real secret.</verify>
  <done>Root .env.example lists exactly the 8 required vars with placeholders; .env is git-ignored; AC-8 satisfied.</done>
</task>

<task type="auto">
  <name>D2: Daily pg_dump → R2 GitHub Action</name>
  <files>.github/workflows/db-backup.yml</files>
  <action>
  Create the workflow (FR-10, AC-10) per the investigation: `on: schedule: - cron: '0 3 * * *'` plus `workflow_dispatch: {}`. Job on `ubuntu-latest`:
  1. Install a `pg_dump` whose MAJOR version matches the Railway Postgres server major (Risk R3) — from the PGDG apt repo; call the absolute binary path. Pin the major in a comment (e.g. `postgresql-client-16`) and add a NOTE that the major MUST be confirmed against the live Railway server (`SELECT version();`) before first run.
  2. Dump: `pg_dump "$DATABASE_URL" -Fc -f backup.dump` with `DATABASE_URL` from `secrets.DATABASE_URL` (D-2).
  3. Upload via AWS CLI to the SEPARATE backups bucket (D-3): `aws s3 cp backup.dump s3://${{ secrets.R2_BACKUP_BUCKET }}/$(date +%Y-%m-%d)/backup.dump --endpoint-url https://${{ secrets.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com` with `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` from `secrets.R2_ACCESS_KEY_ID`/`secrets.R2_SECRET_ACCESS_KEY` and `AWS_DEFAULT_REGION: auto`.
  Reference NO committed secrets — all from GitHub Secrets (NFR-5). Date-prefix the key (D-4, enables a later lifecycle rule). Add inline comments for the three pitfalls: version match mandatory; R2 token must be Object Read & Write; IPv4-only runners (use Railway's public DATABASE_URL).
  </action>
  <verify>`npx --yes @action-validator/cli .github/workflows/db-backup.yml` (or any YAML validator) reports valid. Grep confirms cron `0 3 * * *`, `pg_dump`, `--endpoint-url ...r2.cloudflarestorage.com`, and that every secret is referenced via `${{ secrets.* }}` (no literals). `workflow_dispatch` present so it can be run on demand once secrets are set.</verify>
  <done>Valid scheduled workflow runs pg_dump (version-matched) and uploads to the separate R2 backups bucket using GitHub Secrets only; no committed secrets (AC-10).</done>
</task>

<task type="auto">
  <name>D3: README run/test docs</name>
  <files>README.md</files>
  <action>
  Write the run docs (FR-11, AC-11) with EXACT commands, in this order:
  1. Prerequisites: Node ≥ 20; a reachable Postgres via `DATABASE_URL` (local Docker one-liner OR a dev Railway/Neon instance); copy `.env.example` → `.env` and fill `DATABASE_URL`.
  2. Install: `npm install` (root — installs all workspaces).
  3. Migrate: `npm run db:generate -w apps/api` (if regenerating) then `npm run db:migrate -w apps/api`.
  4. Start API: `npm run dev -w apps/api` (note `PORT` default 3000).
  5. Start mobile (web target sufficient for verification, D-5): `npm run web -w apps/mobile`; set `apps/mobile/.env` `EXPO_PUBLIC_API_URL`.
  6. Verify the /health round-trip: `curl -s localhost:3000/health` AND open the Expo web screen showing the payload.
  7. Include the dev-networking matrix table (web=localhost, Android emulator=10.0.2.2, iOS sim=localhost, physical device=LAN IP).
  8. Backup section: how to set the GitHub Secrets (`DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`), how to confirm the Postgres major for pg_dump, and how to trigger the workflow manually (`workflow_dispatch`).
  9. A "Phase boundary" note: only `GET /health` and `POST /sessions/:id/events` are implemented (AC-12).
  </action>
  <verify>Following the README steps from a clean checkout reproduces AC-6 (`curl /health` → 200) and AC-9 (Expo web shows the payload). Every command in the README is copy-pasteable and references real scripts defined in the package.json files.</verify>
  <done>README documents exact install/migrate/run/verify commands that reproduce the /health round-trip on web; includes the networking matrix, the backup-secrets setup, and the phase-boundary note.</done>
</task>

---

## Per-unit acceptance criteria → AC mapping

| Unit | Satisfies | Notes |
| --- | --- | --- |
| **A** | **AC-1** (workspace resolves; shared symbol imports + type-checks in both apps once B/C land), **AC-2** (strict everywhere — establishes tsconfig.base), partial **FR-9** | The contract package. |
| **B** | **AC-2** (api type-checks), **AC-3** (migrations apply to empty DB), **AC-4** (schema completeness: all entities/FKs/enums/jsonb), **AC-5** (all 5 indexes incl. GIN), **AC-6** (`/health`), **AC-7** (event write: validation, defaulting, moat linkage), **AC-12** (only the 2 endpoints) | The core of Phase 1. |
| **C** | **AC-1** (mobile imports shared), **AC-2** (mobile type-checks), **AC-9** (web /health round-trip) | Connectivity proof. |
| **D** | **AC-8** (.env.example exact 8), **AC-10** (daily backup workflow), **AC-11** (run docs reproduce AC-6 + AC-9) | Ops + docs. |

> **AC-2** is cross-cutting: it is fully met only when A, B, and C each pass `tsc --noEmit` (verified by the overall verification below).

---

## Verification (overall — run before declaring Phase 1 complete)

Run from repo root against an empty Postgres (`DATABASE_URL` set):

```bash
# AC-1, AC-2 — install + strict type-check across all workspaces
npm install
npm run typecheck --workspaces --if-present        # zero errors in shared, api, mobile

# AC-3, AC-4, AC-5 — migrate to empty DB, then inspect
npm run db:generate -w apps/api                      # (already committed; regen is idempotent)
npm run db:migrate  -w apps/api                      # exits 0
psql "$DATABASE_URL" -c "\dt"                        # 12 singular tables
psql "$DATABASE_URL" -c "\dT"                        # 6 enums
psql "$DATABASE_URL" -c "\d behavior_event"          # tags jsonb + GIN index; composite (session_id, occurred_at)
psql "$DATABASE_URL" -c "\d session"                 # composite (dog_id, started_at); booking_id FK nullable
psql "$DATABASE_URL" -c "\d dog"                     # client_id index; protocol_id FK nullable
psql "$DATABASE_URL" -c "\d client"                  # trainer_id index

# AC-6, AC-7 — run API + exercise endpoints (seed a session/dog/protocol first)
npm run dev -w apps/api &                            # PORT 3000
curl -s localhost:3000/health                        # 200 {"status":"ok","db":"up"}
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"dog","thresholdMeters":5,"intensity":7,"outcome":"recovered_slowly","intervention":"u-turn"}'   # 201
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"cat","thresholdMeters":5,"intensity":7,"outcome":"recovered_slowly"}'                           # 400 (bad enum)
curl -s -X POST localhost:3000/sessions/<SID>/events -H 'Content-Type: application/json' \
  -d '{"triggerType":"dog","thresholdMeters":5,"intensity":11,"outcome":"disengaged","intervention":"x"}'            # 400 (intensity range)
# omit intervention with a protocol-bearing dog -> 201 and stored intervention == protocol.default_intervention

# AC-8 — env template
test -f .env.example && git check-ignore .env && ! git check-ignore .env.example   # template committed, .env ignored

# AC-9 — mobile web round-trip
npm run web -w apps/mobile                            # open web build; success state shows /health payload

# AC-10 — backup workflow valid, no committed secrets
npx --yes @action-validator/cli .github/workflows/db-backup.yml   # valid YAML/workflow

# AC-11 — README steps reproduce AC-6 + AC-9 (manual follow-through)
# AC-12 — only two endpoints exist (grep routes; no leads/bookings/media/summary handlers)
```

---

## Success criteria (measurable)

- [ ] AC-1 — single root install; `@tailsup/shared` symbol resolves + type-checks in both `apps/api` and `apps/mobile`.
- [ ] AC-2 — `tsc --noEmit` passes with `strict:true`, zero errors, in shared, api, mobile.
- [ ] AC-3 — `db:migrate` succeeds against an empty DB, creating all 12 singular tables.
- [ ] AC-4 — all entity fields/types, all FKs (correct nullability), all 6 enums, and `behavior_event.tags` jsonb confirmed present.
- [ ] AC-5 — composite `behavior_event(session_id, occurred_at)`, composite `session(dog_id, started_at)`, GIN on `behavior_event.tags`, index on `dog(client_id)`, index on `client(trainer_id)` all present.
- [ ] AC-6 — `GET /health` → 200 + JSON status.
- [ ] AC-7 — valid event → 2xx + persisted `intervention → outcome` linkage; invalid enum / out-of-range intensity → 4xx; omitted intervention defaults from Protocol (and 400 when no protocol, D-6).
- [ ] AC-8 — `.env.example` lists exactly the 8 vars (placeholders); `.env` git-ignored.
- [ ] AC-9 — Expo web screen shows the `/health` success payload (and a clear failure state).
- [ ] AC-10 — valid daily-cron workflow runs `pg_dump`, uploads to the R2 backups bucket via GitHub Secrets; no committed secrets.
- [ ] AC-11 — README commands reproduce AC-6 and AC-9 from a clean checkout.
- [ ] AC-12 — only `GET /health` and `POST /sessions/:id/events` are implemented; schema covers all 12 entities but no other endpoints/UI exist.

---

## Risks & mitigations

| ID | Risk | Likelihood | Mitigation (baked into tasks) |
| --- | --- | --- | --- |
| **R1** | **Metro can't resolve the workspace `@tailsup/shared`** ("Unable to resolve module") or a hoisted dep. | Low (SDK 54 auto-configures) | Start with zero `metro.config.js` (C1/C2). Task **C3** is the documented fallback: `watchFolders=[monorepoRoot]` + `nodeModulesPaths=[app, root]`, with stale `extraNodeModules`/`disableHierarchicalLookup` deliberately omitted. Keep `packages/shared` pure (no server imports) so Metro never tries to bundle drizzle/pg. |
| **R2** | **Circular FK migration SQL** — Session↔Booking (and lead/booking/client) could (a) collapse Drizzle types to `any`, or (b) emit a CREATE with a forward-referencing constraint that fails. | Medium | B2 declares the cycle edge with the standalone `foreignKey()` builder (avoids `any`). B3 makes reviewing the generated SQL **mandatory**: confirm the back-edge is `ALTER TABLE ... ADD CONSTRAINT` after both tables exist before applying. Typecheck (B2 verify) catches the `any`-collapse. |
| **R3** | **`pg_dump` major-version mismatch** with the Railway server → "server version mismatch", backup fails. | Medium | D2 installs `postgresql-client-<major>` from PGDG matched to the server, calls the absolute binary, and carries a NOTE to confirm the major via `SELECT version();` before first run. Pin the major explicitly; do not rely on ubuntu's default `pg_dump`. |
| R4 | **`drizzle-kit push` accidentally used** against a real DB → silent schema drift. | Low | Plan uses `generate`→`migrate` only for the deliverable; `db:push` exists but is labeled scratch-only in B1/scripts and never appears in verification. |
| R5 | **`EXPO_PUBLIC_API_URL` not inlined** (dynamic/destructured access). | Low | C2 mandates static dot-access only. |
| R6 | **R2 upload 403** — token is Read-Only or `region:'auto'` missing. | Low | D2 comments require an Object Read & Write token and set `AWS_DEFAULT_REGION: auto`. |
| R7 | **Two-owner `.env.example` conflict** between parallel Units B and D. | Low | Resolved by ownership: the canonical AC-8 `.env.example` is **root-owned by Unit D**; Unit B creates no API-level `.env.example`. |

---

## Output (SUMMARY specification)

After completing all units, create `docs/design/SUMMARY-001-tailsup-phase1-foundations.md`:

```markdown
# Phase 1 — Foundations Summary

**[One-liner: monorepo + full schema + 2 endpoints + mobile /health proof + daily backup shipped]**

## Accomplishments        (per AC-1..AC-12, with pass/fail)
## Files Created/Modified  (grouped by Unit A/B/C/D)
## Decisions Made          (which D-1..D-9 defaults stood; any vetoed at the gate)
## Deviations              (any auto-fixes per the deviation rules, with rationale)
## Verification Results    (output of the overall verification block)
## Issues Encountered      (e.g. Metro fallback used? circular-FK SQL note; pg major confirmed?)
## Next Phase Readiness    (Phase 2 = trainer 4-tap UI + media presign; schema already supports it)
```

---

## Execution notes

- **Ordering is mandatory:** finish and commit **Unit A** before dispatching B/C/D. B and C will not type-check until `@tailsup/shared` is resolvable.
- **Parallel dispatch:** after A is committed, B, C, and D can be assigned to three independent coder agents — their file sets are disjoint (see the file-ownership map). Each agent reads this plan + the two reference docs + `project-functions.md`.
- **Do not exceed scope:** schema = all 12 entities; endpoints = exactly two. No Phase 2–4 features (AC-12).
