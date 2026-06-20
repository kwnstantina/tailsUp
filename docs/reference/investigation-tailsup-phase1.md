# Investigation: TailsUp Phase 1 — Wiring the Decided Stack Correctly

## Executive Summary

The TailsUp stack (npm workspaces monorepo; Expo Router app/web; Hono + TypeScript API on Railway; PostgreSQL via Drizzle ORM; Cloudflare R2; BetterAuth self-hosted; Anthropic claude-haiku-4-5) is fixed. This investigation does NOT re-litigate any of it; it determines **how to wire these specific technologies together** for Phase 1, with concrete 2026 versions and the pitfalls that actually bite.

Headline recommendations:

1. **Monorepo / shared package**: Ship `packages/shared` as a **TypeScript-source-only package with no build step**. Point its `package.json` `main`/`exports` at the `.ts` entry, declare it as a normal workspace dependency, and let each consumer transpile it: Metro transpiles TS source natively for the Expo app, and `tsx`/`tsc` transpiles it for the Hono API. On **Expo SDK 52+ Metro auto-configures monorepos** — you likely do NOT need a hand-written `metro.config.js` watchFolders/nodeModulesPaths block at all on a clean npm-workspaces hoisted layout; add it only if resolution actually fails. Use TypeScript **path aliases backed by a real workspace dependency** rather than TS Project References (simpler, no build orchestration).

2. **Hono + Drizzle + Postgres**: Use the **`node-postgres` (`pg`) driver** with `drizzle-orm/node-postgres`. It is the safest pairing for a Railway-managed Postgres (no prepared-statement-by-default surprises, trivial SSL, ubiquitous), and lock-in-free. Use the **`generate` → review SQL → commit → `migrate`** workflow (never `push` against anything you care about). Run the API on Node via `@hono/node-server`, reading `process.env.PORT`.

3. **Schema specifics**: `jsonb().$type<string[]>()` for `tags` with a GIN index via `index('...').using('gin', table.tags)`; `pgEnum(...)` for each tap/status enum; `uuid().defaultRandom()` primary keys (offline-friendly, satisfies the open question); set `casing: 'snake_case'` on the Drizzle client to map camelCase TS keys to snake_case columns while you give each `pgTable` an **explicit singular name**. The one real trap is the **Session ↔ Booking circular FK** — break the cycle by declaring at least one of those FKs with the standalone `foreignKey(...)` builder (or `AnyPgColumn` typing) rather than inline `.references()`.

4. **Validation**: `@hono/zod-validator` (`zValidator('json', schema)`) with Zod enums built from the **shared enum arrays**, so the API validates against the exact same literals the app imports.

5. **Expo connectivity**: Read the API base URL from `process.env.EXPO_PUBLIC_API_URL` (static dot-access only). The dev networking gotcha is real and must be documented: web = `localhost`, Android emulator = `10.0.2.2`, physical device = the host LAN IP.

6. **Backup**: A scheduled GitHub Action installs a `pg_dump` whose **major version matches the Railway Postgres major version**, dumps via the `DATABASE_URL` secret, and uploads to R2 using the **AWS CLI pointed at the R2 S3 endpoint** (`--endpoint-url https://<account>.r2.cloudflarestorage.com`). Use IPv4 and an R2 token with Object Read & Write.

7. **Forward-looking (do NOT build now)**: R2 presign uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` against the R2 endpoint with `region: 'auto'`; BetterAuth uses `drizzleAdapter(db, { provider: 'pg' })` and its CLI generates the auth tables — keep those table names out of your hand-written schema to avoid collisions, and reserve a `role` field plan for the trainer/client split.

**Research needed before planning: No** (with two low-risk "validate during scaffold" notes — see final section).

---

## Context

- **What**: How to correctly and idiomatically assemble the already-decided TailsUp stack for the Phase 1 deliverable (monorepo scaffold, full 12-entity Drizzle schema + migrations, `GET /health` + `POST /sessions/:id/events`, `.env.example`, one Expo screen hitting `/health`, daily `pg_dump`→R2 GitHub Action, run docs).
- **Why**: This is greenfield (fresh `git init`, empty folder). Every wiring decision is being made for the first time and feeds planning, design, and implementation directly.
- **Driving constraints** (from the refined request): TypeScript strict everywhere; SINGULAR table names; shared enums defined once and imported by both ends; `tags` jsonb + GIN; `intervention` defaults from `Protocol.defaultIntervention`; the `intervention → outcome` linkage is the dataset moat and must persist; secrets never committed; priorities low-maintenance > low-cost > no-lock-in.
- **Refined request**: `docs/reference/refined-request-tailsup.md`
- **Raw kickoff**: `prompts/001-tailsup-kickoff.md`

Confirmed current versions used for this investigation (June 2026): Hono `4.12.x`; `@hono/node-server` v2 (requires Node ≥ 20); `drizzle-orm` `0.45.x` stable (a `1.0.0-rc` line exists but is not recommended for a from-scratch Phase 1 — stay on stable); Expo SDK 54 is the established monorepo-aware release (SDK 56 is in beta); Metro Package Exports on by default since Metro 0.82 / RN 0.79.

---

## Topic 1 — npm-workspaces monorepo with Expo + Hono + shared TS package

This is historically the trickiest wiring, so it gets the most depth.

### Recommended layout

```
tailsup/
├── package.json                 # { "private": true, "workspaces": ["apps/*", "packages/*"] }
├── tsconfig.base.json           # strict:true, shared compilerOptions + path aliases
├── apps/
│   ├── api/                     # Hono + Drizzle (Node)
│   │   ├── package.json         # deps include "@tailsup/shared": "*"
│   │   ├── tsconfig.json        # extends ../../tsconfig.base.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   └── mobile/                  # Expo Router (iOS/Android/web)
│       ├── package.json         # deps include "@tailsup/shared": "*"
│       ├── app.json / app.config.ts
│       ├── metro.config.js      # only if auto-config proves insufficient
│       └── app/                 # Expo Router routes
└── packages/
    └── shared/                  # TS-source-only, NO build step
        ├── package.json
        └── src/index.ts
```

### Make `packages/shared` consumable by BOTH ends with no build step

The clean, low-maintenance answer (matches NFR-2): publish **TypeScript source directly** and let each consumer's bundler/runtime transpile it.

`packages/shared/package.json`:
```jsonc
{
  "name": "@tailsup/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Why this works on each consumer:

- **Expo (Metro)**: Metro treats `.ts`/`.tsx` as source and transpiles it automatically with zero config — TypeScript "is source code used by your application." So Metro happily imports `@tailsup/shared` pointing at `src/index.ts`. (Metro reads `exports` by default since Metro 0.82 / RN 0.79; if no `exports` match is found it warns and falls back, so keep the `exports` map present and correct.)
- **Hono API (Node)**: In dev, run with **`tsx`** (or `ts-node`/`tsx watch`), which transpiles the imported `.ts` source on the fly — no separate build of `shared` needed. For a production build, compile the API with `tsc`/`tsup` and the shared source is pulled into that compilation. Either way, no standalone build artifact for `shared`.

Each app declares the dependency so npm creates the workspace symlink:
```jsonc
// apps/api/package.json and apps/mobile/package.json
"dependencies": { "@tailsup/shared": "*" }
```

### TS Project References vs path aliases — recommendation: **path aliases**

- **Path aliases (recommended)**: in `tsconfig.base.json`:
  ```jsonc
  {
    "compilerOptions": {
      "strict": true,
      "moduleResolution": "bundler",   // matches Metro behavior; respects exports
      "baseUrl": ".",
      "paths": { "@tailsup/shared": ["packages/shared/src/index.ts"] }
    }
  }
  ```
  Combined with the real workspace dependency (which provides runtime resolution), this gives both editor type resolution and bundler/runtime resolution with **no build orchestration**. This is the simplest thing that works (NFR-2).
- **TS Project References**: adds `composite: true`, a build graph, and `tsc -b` orchestration. It buys incremental builds and stricter boundaries but adds maintenance the Phase 1 deliverable does not need. **Skip it** for now; the source-only package + aliases approach can be upgraded later if build times demand it.

> `moduleResolution: "bundler"` (or `node16`/`nodenext`) is what makes TypeScript honor the `exports` map the same way Metro does. Put the `types` condition first if you ever expand the `exports` map, or types can fail to resolve.

### Metro known issues + the config you may (or may not) need

Key 2026 fact: **Expo SDK 52+ auto-configures Metro for monorepos** (Bun/npm/pnpm/Yarn). On a standard hoisted npm-workspaces layout you frequently need **no manual `metro.config.js`** at all. Start without one; add it only if you hit "Unable to resolve module" for the workspace package or for a hoisted dependency.

If you do need it, the canonical monorepo Metro config is:
```js
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1) Watch the whole monorepo so changes in packages/shared trigger reload
config.watchFolders = [monorepoRoot];

// 2) Resolve from app node_modules first, then the hoisted root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
```

Pitfalls to call out explicitly:
- Historic "Unable to resolve `./node_modules/expo-router/entry`" in monorepos — caused by hoisting/resolution-order mismatches; the `nodeModulesPaths` ordering above is the fix when it appears.
- `watchFolders = [monorepoRoot]` makes Metro pre-crawl every workspace on startup (slower cold start). With on-demand filesystem access you can narrow watchFolders to just `packages/*` if startup time matters; for Phase 1, whole-root is fine.
- If you customize `metro.config.js`, do not also leave stale `extraNodeModules`/`disableHierarchicalLookup` from old tutorials — SDK 52+ guidance is to delete those when relying on auto-config.
- SDK 54 added **isolated dependencies / improved autolinking**; on SDK 54 the auto-config is even more robust for hoisted monorepos — another reason to try zero-config first.

---

## Topic 2 — Hono + Drizzle + PostgreSQL structure & migration workflow

### Driver: `node-postgres` (`pg`) — recommended over `postgres.js`

Both are first-class in Drizzle. For a **Railway-managed Postgres + Hono-on-Node-on-Railway** Phase 1:

- **`pg` (recommended)**: `import { drizzle } from 'drizzle-orm/node-postgres'`. No prepared-statements-by-default behavior to reason about, trivial `ssl` handling, the most widely documented pairing, and fully portable (NFR-3). Optional `pg-native` gives ~10% but is unnecessary now.
- **`postgres.js`**: excellent and slightly faster, but **uses prepared statements by default** (must sometimes be disabled, notably behind transaction-pooling proxies). That is a needless variable for Phase 1.

Decision: **`pg`** — lowest-surprise, lowest-maintenance.

Install:
```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg tsx
```

Connection (`apps/api/src/db.ts`):
```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const db = drizzle(process.env.DATABASE_URL!, {
  schema,
  casing: 'snake_case', // camelCase TS keys -> snake_case columns
});
```
(For Railway, SSL is generally handled by the connection string; if a cert error appears in CI/prod, pass `connection: { connectionString, ssl: { rejectUnauthorized: false } }`.)

### Recommended `apps/api` structure

```
apps/api/
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── drizzle/                 # generated SQL migrations + meta/  (COMMIT THIS)
└── src/
    ├── index.ts             # Hono app + @hono/node-server, reads process.env.PORT
    ├── db.ts                # drizzle client
    ├── schema.ts            # all 12 tables + enums + indexes (or schema/ dir)
    ├── migrate.ts           # programmatic migrate() runner for CI/deploy
    └── routes/
        ├── health.ts
        └── events.ts        # POST /sessions/:id/events
```

`drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

### Migration workflow: `generate` → review → commit → `migrate` (NOT `push`)

- **`drizzle-kit push`**: applies schema diff straight to the DB with **no migration files**. Great for throwaway local iteration, but it can silently skip/round-trip changes. **Never run against staging/prod or anything you care about.**
- **`drizzle-kit generate`**: emits versioned SQL migration files under `drizzle/` (+ `meta/`). **Commit these to git** (satisfies auditability and AC-3).
- **`drizzle-kit migrate`** (or programmatic `migrate()` from `drizzle-orm/node-postgres/migrator`): applies committed migrations to a target DB. This is what runs in CI/deploy and what a verifier runs against an empty DB for AC-3.

Recommended npm scripts (api workspace):
```jsonc
"scripts": {
  "db:generate": "drizzle-kit generate",
  "db:migrate":  "tsx src/migrate.ts",   // calls migrate() against DATABASE_URL
  "db:push":     "drizzle-kit push",      // local scratch only
  "dev":         "tsx watch src/index.ts",
  "build":       "tsc",
  "typecheck":   "tsc --noEmit"
}
```

For Phase 1: define the full schema once → `db:generate` to produce the from-scratch migration → commit it → `db:migrate` applies all 12 tables/enums/indexes to an empty DB. This is exactly the AC-3 path.

### How Drizzle expresses the required artifacts

- **Singular snake_case table names**: the table name is the explicit first arg of `pgTable` — give it the singular literal directly (`pgTable('behavior_event', …)`). `casing: 'snake_case'` only affects **column** name mapping, not the table name, so singular naming is fully under your control and never pluralized by Drizzle.
- **pgEnum**: `export const triggerType = pgEnum('trigger_type', ['dog','human','noise','vehicle','other']);`
- **jsonb**: `tags: jsonb('tags').$type<string[]>()` (nullable by default; add `.notNull().default([])` only if desired — spec says optional, so leave nullable).
- **GIN index on jsonb**: in the table's third-arg callback (returns an **array** since drizzle-orm 0.31 / drizzle-kit 0.22): `index('behavior_event_tags_gin').using('gin', table.tags)`.
- **Composite index**: `index('behavior_event_session_occurred_idx').on(table.sessionId, table.occurredAt)`.

---

## Topic 3 — Drizzle schema specifics for the moat fields & circular FK

### Primary keys: UUID (resolves Open Question #1)

Use `id: uuid('id').primaryKey().defaultRandom()` everywhere. Rationale: the spec's NFR-6 (offline-capable later) and the kickoff's offline-queue intent favor client-generatable IDs; UUID lets the future 4-tap offline write mint its own `id` before sync. All FK columns become `uuid('...')` accordingly. (If the team later prefers `bigserial`, it is a one-time change, but UUID is the better default here.)

### `tags`: jsonb string[] + GIN

```ts
export const behaviorEvent = pgTable('behavior_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => session.id),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  triggerType: triggerType('trigger_type').notNull(),
  thresholdMeters: integer('threshold_meters').notNull(),
  intensity: integer('intensity').notNull(), // 1..10 enforced at validation layer (+ optional CHECK)
  outcome: outcome('outcome').notNull(),
  intervention: text('intervention').notNull(), // moat: never null; defaulted from Protocol
  note: text('note'),
  tags: jsonb('tags').$type<string[]>(),
}, (t) => [
  index('behavior_event_session_occurred_idx').on(t.sessionId, t.occurredAt),
  index('behavior_event_tags_gin').using('gin', t.tags),
]);
```
Notes: keep `intervention` `notNull` to guarantee the `intervention → outcome` linkage is never dropped (the dataset moat). Enforcing `intensity` 1–10 is primarily a validation-layer job (Topic 4); optionally add a `check()` constraint for defense-in-depth, but that is not required by the ACs.

### pgEnums for the tap/status fields

```ts
export const triggerType = pgEnum('trigger_type', ['dog','human','noise','vehicle','other']);
export const outcome     = pgEnum('outcome', ['disengaged','recovered_slowly','over_threshold']);
export const mediaType   = pgEnum('media_type', ['video','image']);
export const leadStatus  = pgEnum('lead_status', ['new','contacted','converted','lost']);
export const bookingType  = pgEnum('booking_type', ['assessment','private','group']);
export const bookingStatus = pgEnum('booking_status', ['requested','confirmed','declined','completed','cancelled']);
```
Best practice: define the literal arrays in `packages/shared` and import them into the pgEnum calls AND the Zod validators, so DB enum, runtime validation, and app share one source of truth (directly serves FR-9).

### The cross-reference: Session.bookingId ↔ Booking, Booking.leadId/clientId

This is the one genuine schema trap. `Session.bookingId → Booking` while `Booking` is referenced by `Session`, and `Booking.leadId/clientId → Lead/Client` — and `Lead.clientId → Client` is itself a soft cycle on conversion. Drizzle's inline `.references(() => other.id)` creates a circular TypeScript reference; when two tables reference each other, **types collapse to `any`** (known Drizzle/TS limitation).

Recommended fix: break the cycle by declaring **at least one** of the circular FKs with the standalone `foreignKey(...)` builder in the table's callback, or type the inline reference with `AnyPgColumn`:

```ts
import { foreignKey, type AnyPgColumn } from 'drizzle-orm/pg-core';

// Option A — standalone foreignKey in the callback (clearest for the cycle):
export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  dogId: uuid('dog_id').notNull(),
  bookingId: uuid('booking_id'), // nullable
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  location: text('location'),
}, (t) => [
  foreignKey({ columns: [t.dogId], foreignColumns: [dog.id], name: 'session_dog_fk' }),
  foreignKey({ columns: [t.bookingId], foreignColumns: [booking.id], name: 'session_booking_fk' }),
  index('session_dog_started_idx').on(t.dogId, t.startedAt),
]);

// Option B — inline with AnyPgColumn to dodge the any-collapse, for a self/soft cycle:
// clientId: uuid('client_id').references((): AnyPgColumn => client.id),
```

Practical guidance: define `client`, `lead`, `booking`, `dog`, `session` in an order where most FKs can use simple inline `.references()`, and only the genuinely circular edge(s) (`Session.bookingId`, plus `Lead.clientId`/`Booking.leadId`/`Booking.clientId` as needed) use the standalone `foreignKey(...)` form. **FK ordering also matters for the generated migration SQL** — drizzle-kit handles `CREATE TABLE` ordering and may emit `ALTER TABLE … ADD CONSTRAINT` for the back-edges; review the generated SQL to confirm the back-references are added after both tables exist. This is the single spot in the schema where reviewing the generated migration is non-optional.

---

## Topic 4 — Hono request validation reusing shared enums

Recommendation: **`@hono/zod-validator`** over Hono's built-in validator. The built-in `validator` is fine for trivial cases, but `zValidator` gives declarative schemas, automatic 400s on failure, and full type inference into the handler — and it lets you build the schema directly from the shared enum arrays.

```ts
// packages/shared/src/enums.ts
export const TRIGGER_TYPES = ['dog','human','noise','vehicle','other'] as const;
export const OUTCOMES = ['disengaged','recovered_slowly','over_threshold'] as const;

// apps/api/src/routes/events.ts
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { TRIGGER_TYPES, OUTCOMES } from '@tailsup/shared';

const eventBody = z.object({
  triggerType: z.enum(TRIGGER_TYPES),
  thresholdMeters: z.number().int().nonnegative(),
  intensity: z.number().int().min(1).max(10),
  outcome: z.enum(OUTCOMES),
  intervention: z.string().min(1).optional(), // omitted -> default from Protocol
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

app.post('/sessions/:id/events', zValidator('json', eventBody), async (c) => {
  const sessionId = c.req.param('id');
  const body = c.req.valid('json'); // fully typed
  // if !body.intervention: resolve Session -> Dog -> Protocol.defaultIntervention
  // insert behaviorEvent; return 201 with the created row/id
});
```

This satisfies AC-7 (valid → 2xx + persisted moat linkage; invalid enum / out-of-range intensity → 4xx automatically; omitted intervention → defaulted). Install: `npm i zod @hono/zod-validator`. Use the same `z.enum(...)` arrays the pgEnums use, so there is exactly one source of truth (FR-9). For the default-intervention edge (Open Question #5): resolve `Session → Dog → Protocol.defaultIntervention`; if the dog has no protocol and the body omits `intervention`, return a 400 instructing the client to supply one (keeps `intervention` non-null / moat intact).

---

## Topic 5 — Expo Router minimal scaffold + dev networking

### Env handling

Use `EXPO_PUBLIC_`-prefixed vars, accessed with **static dot notation only** (`process.env.EXPO_PUBLIC_API_URL` — no destructuring, no dynamic keys; Expo inlines these at build):

```
# apps/mobile/.env  (git-ignored)
EXPO_PUBLIC_API_URL=http://localhost:3000
```
```ts
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
```
`app.json`/`app.config.ts` can also carry `extra` config if you later need non-public values, but for a public API base URL `EXPO_PUBLIC_API_URL` is the idiomatic choice. Treat anything `EXPO_PUBLIC_` as fully public.

### The screen (Expo Router)

`apps/mobile/app/index.tsx`: on mount, `fetch(\`${API_URL}/health\`)`, render a clear success state with the JSON payload and a clear failure state — satisfying AC-9.

### The dev networking gotcha (document this prominently)

The single most common "it doesn't work" for newcomers. The correct host depends on where the app runs:

| Where the app runs | API base URL to use |
|---|---|
| Expo **web** (browser on dev machine) | `http://localhost:3000` |
| **Android emulator** | `http://10.0.2.2:3000` (emulator alias for host loopback) |
| **iOS simulator** | `http://localhost:3000` (shares host loopback) |
| **Physical device** (Expo Go) | `http://<your-LAN-IP>:3000` (e.g. `192.168.x.x`); device + machine on same Wi-Fi |

Phase 1 acceptance (AC-9 / Open Question #4) only requires the **web** target to prove the round-trip, so `localhost` is sufficient for the verifier — but the run docs must list all four so the trainer can test on a real device later.

---

## Topic 6 — GitHub Action: daily `pg_dump` → Cloudflare R2

### Recommended approach

A scheduled workflow (`schedule: cron`) on `ubuntu-latest` that: (1) installs a `pg_dump` whose **major version equals the Railway Postgres server major version**, (2) dumps using the `DATABASE_URL` secret, (3) uploads to R2 via the **AWS CLI pointed at R2's S3-compatible endpoint**.

```yaml
name: db-backup
on:
  schedule:
    - cron: '0 3 * * *'   # daily 03:00 UTC
  workflow_dispatch: {}
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install matching pg_dump (e.g. PG 16)
        run: |
          sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
          wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
          sudo apt-get update && sudo apt-get install -y postgresql-client-16
      - name: Dump
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          /usr/lib/postgresql/16/bin/pg_dump "$DATABASE_URL" -Fc -f backup.dump
      - name: Upload to R2 (S3-compatible)
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: auto
        run: |
          aws s3 cp backup.dump \
            s3://${{ secrets.R2_BACKUP_BUCKET }}/$(date +%Y-%m-%d)/backup.dump \
            --endpoint-url https://${{ secrets.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com
```

### Pitfalls to call out explicitly

- **Version match is mandatory**: a `pg_dump` older than the server major version errors out ("server version mismatch"). Pin `postgresql-client-<major>` to the Railway PG major. The default ubuntu image's `pg_dump` may be the wrong major — install the matching one from the PGDG apt repo and call its absolute binary path.
- **R2 token scope**: the R2 API token MUST be **Object Read & Write**; Read-Only fails the upload after retries.
- **IPv4 only**: GitHub runners are IPv4-outbound; an IPv6-only DB host throws "Network is unreachable." Railway's external connection string is reachable over IPv4, so use the public `DATABASE_URL`.
- **Separate backups bucket/prefix** (Open Question #2): keep DB dumps in a different bucket or prefix from media (`R2_BACKUP_BUCKET` vs the media `R2_BUCKET`). Recommend a dedicated backups bucket; date-prefix the key for natural ordering.
- **Secrets**: `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET` all come from **GitHub Secrets** — nothing committed (NFR-5, AC-10).
- **Retention** (Open Question #3): not required for Phase 1 acceptance; an R2 lifecycle rule (e.g., expire after 30 days) can be added later. Date-prefixing now makes that trivial.
- **Format**: `-Fc` (custom/compressed) is restorable via `pg_restore` and smaller than plain SQL; either is acceptable for "plain pg_dump artifact" portability (NFR-3).

There are also marketplace actions (e.g. an "R2 Backup" action) and the `aws-actions/configure-aws-credentials` action; the inline AWS-CLI approach above is the most transparent and lock-in-free.

---

## Topic 7 — Forward-looking notes (do NOT implement in Phase 1)

These exist only so the Phase 1 schema/scaffold doesn't paint us into a corner.

### R2 presigned URLs (Phase 2 — `POST /media/presign`)
- Packages: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.
- Client config: `new S3Client({ region: 'auto', endpoint: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com', credentials: { accessKeyId, secretAccessKey } })`.
- Presign upload: `getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: 3600 })`; app then `PUT`s the file directly to the returned URL (never through the API — matches the architecture).
- Corner not to paint into: `Media` already stores only `blobUrl` + `type` enum + `eventId` + `uploadedAt` — that schema is sufficient; no change needed now. Plan a **CORS policy** on the media bucket for browser/app direct uploads (Phase 2 concern).

### BetterAuth with Drizzle adapter + trainer/client roles (Phase 3)
- Setup: `betterAuth({ database: drizzleAdapter(db, { provider: 'pg' }), ... })`; generate auth tables with `npx @better-auth/cli generate` (it writes the user/session/account/verification tables for Drizzle).
- Corner not to paint into: **do NOT hand-author BetterAuth's tables in your Phase 1 schema** — let its CLI own them later to avoid name/shape collisions. Your domain `Trainer`/`Client` entities are separate from BetterAuth's `user`; in Phase 3 you'll link them (e.g., a `role` field of `trainer`/`client` plus a join from auth user → Trainer/Client). Note the known v1.4.x quirk where a `role` field may be expected in the Drizzle schema; the admin/roles plugin is the intended way to express `trainer`/`client`. Nothing about Phase 1's schema blocks this — just leave auth tables out for now.

---

## Comparison Matrix (the two real either/or decisions)

| Criterion | Postgres driver: `pg` (node-postgres) | Postgres driver: `postgres.js` |
|---|---|---|
| Prepared-statement surprises | None (recommended) | On by default; may need opt-out behind poolers |
| Railway/SSL simplicity | Trivial | Trivial |
| Docs/ubiquity for Drizzle | Highest | High |
| Raw speed | Baseline (+~10% with pg-native) | Slightly faster |
| Lock-in | None | None |
| **Phase 1 fit** | **Best (lowest surprise)** | Good |

| Criterion | Shared pkg: TS-source + path alias (rec.) | TS Project References |
|---|---|---|
| Build step for `shared` | None | Requires `tsc -b` orchestration |
| Metro compatibility | Native (Metro transpiles TS) | Works but needs built output paths |
| Hono/Node compatibility | Via `tsx`/`tsc` (no extra build) | Built output |
| Maintenance | Lowest (NFR-2) | Higher |
| Incremental build speed | N/A (no build) | Better at scale |
| **Phase 1 fit** | **Best** | Overkill |

| Criterion | Migration mode for AC-3 |
|---|---|
| `push` | Dev scratch only — never for the deliverable/CI |
| **`generate` + `migrate`** | **Recommended: versioned, committed, applies cleanly to empty DB** |

---

## Recommendation (consolidated, actionable)

1. **Monorepo**: npm workspaces (`apps/*`, `packages/*`); `packages/shared` is **TS-source-only** (`main`/`exports` → `src/index.ts`, no build); consumers depend on `@tailsup/shared`. Use **path aliases** in `tsconfig.base.json` (`moduleResolution: "bundler"`), not Project References. **Start with zero Metro config** (SDK 54 auto-configures); add the standard `watchFolders` + `nodeModulesPaths` block only if resolution fails.
2. **API**: Hono `4.12.x` on `@hono/node-server` v2 (Node ≥ 20), reading `process.env.PORT`. Drizzle `0.45.x` + **`pg`** driver, `casing: 'snake_case'`. Explicit **singular** `pgTable` names. Migrations via **`generate` → commit → `migrate`**.
3. **Schema**: UUID PKs (`defaultRandom`); `tags: jsonb().$type<string[]>()` + GIN index; `pgEnum` per tap/status (literal arrays sourced from `packages/shared`); `intervention` `notNull`; break the **Session↔Booking circular FK** with the standalone `foreignKey(...)` builder and **review the generated migration SQL** for that edge.
4. **Validation**: `@hono/zod-validator` with `z.enum(SHARED_ARRAY)` so DB/validation/app share one enum source.
5. **Mobile**: one Expo Router screen fetching `${EXPO_PUBLIC_API_URL}/health`; document the localhost / `10.0.2.2` / LAN-IP matrix; web target satisfies AC-9.
6. **Backup**: scheduled GitHub Action; install `pg_dump` matching the Railway PG major; upload via AWS CLI `--endpoint-url` to a **separate backups bucket**; secrets from GitHub Secrets; IPv4; R2 token = Object R/W.
7. **Forward-looking**: keep `Media` as-is (presign needs no schema change); **leave BetterAuth tables out** of Phase 1 (CLI owns them later); plan a `trainer`/`client` role split via BetterAuth's roles plugin.

**Conditions that would change this**: if the team adopts Bun as the API runtime, revisit `Bun.sql`/`postgres.js`; if `shared` grows large enough that bundler transpile time hurts, upgrade to Project References; if Railway's Postgres is reachable only via a transaction pooler, re-check prepared-statement behavior (another point for `pg`).

---

## Technical Research Guidance

**Research needed: No.**

The investigation gathered sufficient, concrete, current detail for confident implementation of every Phase 1 item, including the two historically risky areas:

- **Monorepo / Metro resolving `packages/shared`**: resolved. SDK 54 auto-configures Metro for npm workspaces; Metro transpiles TS source natively; the fallback manual config (`watchFolders` + `nodeModulesPaths`) is documented above. No deeper dive required.
- **drizzle-kit workflow for jsonb + GIN + pgEnum + circular FK**: resolved. `generate`/`migrate` workflow, exact GIN/pgEnum/jsonb/index syntax, and the standalone-`foreignKey` cycle-break are all specified with code above.

Two items are **"validate during scaffold, not research"** — they are well-understood but should be confirmed empirically on first run rather than triggering a separate research task:

1. **Zero-config Metro on this exact npm-workspaces layout** — try with no `metro.config.js`; if `@tailsup/shared` or a hoisted dep fails to resolve, drop in the documented config. (Risk: low; fix is known and included.)
2. **The Session↔Booking circular FK migration SQL** — generate the migration and eyeball that the back-edge constraint is added after both tables exist. (Risk: low; the workaround is specified.)

Neither warrants a dedicated technical-researcher pass before planning.

---

## Implementation Considerations

- **Decisions still open** (with recommendations): PK strategy → **UUID**; CI backup source → **production Railway `DATABASE_URL` via GitHub Secret**, **separate backups bucket**; backup retention → **defer** (date-prefix now, lifecycle rule later); mobile verification target → **web is sufficient for AC**; no-protocol default-intervention → **400 when intervention omitted and dog has no protocol**.
- **Prerequisites**: Node ≥ 20; a reachable PostgreSQL via `DATABASE_URL` (local Docker or a dev Railway/Neon instance) for migrate + `/health`; an R2 bucket + Object-R/W token for the backup workflow; GitHub repo with the listed Secrets.
- **Pitfalls to watch**: (a) leaving stale `extraNodeModules`/`disableHierarchicalLookup` in a hand-written Metro config; (b) running `drizzle-kit push` against a DB that matters; (c) `pg_dump` major-version mismatch in CI; (d) forgetting `region: 'auto'` for R2 in any AWS-SDK/CLI call; (e) dynamic/destructured access of `EXPO_PUBLIC_` vars (only static dot-access is inlined); (f) the circular-FK `any`-collapse if both sides use inline `.references()`.
- **Env vars** required by `.env.example` (AC-8, exact list): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AUTH_SECRET`, `RESEND_API_KEY`. (The mobile app additionally uses `EXPO_PUBLIC_API_URL`, and CI uses `R2_BACKUP_BUCKET` — both separate from the API `.env.example` list.)
- **Suggested first steps**: (1) root `package.json` + workspaces + `tsconfig.base.json`; (2) `packages/shared` with enum arrays + DTOs; (3) `apps/api` Hono + Drizzle schema (all 12 tables) → `db:generate` → review SQL → `db:migrate` against an empty DB; (4) implement `/health` + `POST /sessions/:id/events` with `zValidator`; (5) `apps/mobile` Expo Router scaffold + `/health` screen; (6) backup workflow + `.env.example` + README run docs.

---

## References

| # | Source | URL | What was learned |
|---|--------|-----|-----------------|
| 1 | Expo — Work with monorepos | https://docs.expo.dev/guides/monorepos/ | SDK 52+ auto-configures Metro for npm/pnpm/Yarn/Bun monorepos; canonical `watchFolders`/`nodeModulesPaths` fallback config; delete stale `extraNodeModules`/`disableHierarchicalLookup` |
| 2 | Expo — Customizing Metro / TypeScript | https://docs.expo.dev/guides/customizing-metro/ | Metro treats TS as source and transpiles with no config; reads `exports` field |
| 3 | Metro — Package Exports | https://metrobundler.dev/docs/package-exports/ | Package Exports on by default since Metro 0.82 / RN 0.79; warn-and-fallback when no `exports` match |
| 4 | Expo SDK 54 changelog | https://expo.dev/changelog/sdk-54 | Isolated dependencies + improved autolinking for monorepos |
| 5 | Drizzle — Get started PostgreSQL | https://orm.drizzle.team/docs/get-started-postgresql | `pg` vs `postgres.js` setup; postgres.js prepared-statements-by-default caveat; connection code |
| 6 | Drizzle — Indexes & Constraints | https://orm.drizzle.team/docs/indexes-constraints | Composite index `.on()`; GIN via `.using('gin', ...)`; callback returns array since orm 0.31 / kit 0.22 |
| 7 | Drizzle — PG column types | https://orm.drizzle.team/docs/column-types/pg | `pgEnum`, `jsonb().$type<string[]>()`, `uuid().defaultRandom()`, `timestamp({ withTimezone })` |
| 8 | Drizzle — Schema declaration / casing | https://orm.drizzle.team/docs/sql-schema-declaration | `casing: 'snake_case'` maps camelCase keys to snake_case columns |
| 9 | Drizzle — Migrations / kit overview | https://orm.drizzle.team/docs/kit-overview | `generate`+`migrate` for prod; never `push` against DBs you care about; commit migrations |
| 10 | Drizzle — circular FK discussion | https://github.com/drizzle-team/drizzle-orm/discussions/396 | Circular refs collapse types to `any`; fix by declaring one FK via standalone `foreignKey`/`AnyPgColumn` |
| 11 | Hono — Validation guide | https://hono.dev/docs/guides/validation | `@hono/zod-validator` `zValidator('json', schema)`; `c.req.valid('json')` typed access |
| 12 | Hono — Node.js / Railway | https://docs.railway.com/guides/hono | `@hono/node-server` v2 (Node ≥ 20); read `process.env.PORT`; Hono 4.12.x current |
| 13 | Expo — Environment variables | https://docs.expo.dev/guides/environment-variables/ | `EXPO_PUBLIC_` inlining; static dot-access only; treat as public |
| 14 | DEV — Expo env / Android emulator | https://dev.to/alexcoding42/how-to-set-environment-variables-with-easexpo-and-react-native-3b2n | `10.0.2.2` = host loopback for Android emulator |
| 15 | The New Stack — pg backups via GitHub Actions | https://thenewstack.io/how-to-schedule-postgresql-backups-with-github-actions/ | Install matching `pg_dump` major from PGDG; call absolute binary; cron schedule |
| 16 | Cloudflare R2 — Presigned URLs | https://developers.cloudflare.com/r2/api/s3/presigned-urls/ | R2 presign via AWS SDK against R2 S3 endpoint |
| 17 | Transloadit — Browser uploads to R2 with AWS SDK | https://transloadit.com/devtips/browser-uploads-to-cloudflare-r2-with-aws-sdk/ | `S3Client` endpoint + `region:'auto'`; `PutObjectCommand` + `getSignedUrl` with `expiresIn` |
| 18 | Better Auth — Drizzle adapter | https://better-auth.com/docs/adapters/drizzle | `drizzleAdapter(db, { provider: 'pg' })`; CLI `generate` creates auth tables |
| 19 | Better Auth — role field issue #7006 | https://github.com/better-auth/better-auth/issues/7006 | v1.4.x role-field quirk; roles via admin plugin |
| 20 | drizzle-orm on npm | https://www.npmjs.com/package/drizzle-orm | Stable 0.45.x current; 1.0.0-rc exists but not for from-scratch Phase 1 |

---

## Original Request

Investigate the best implementation approach for building Phase 1 of the TailsUp platform — specifically HOW to wire the already-decided stack (npm workspaces; Expo Router; Hono + TS API on Railway; PostgreSQL via Drizzle; Cloudflare R2 presigned; BetterAuth self-hosted; Anthropic claude-haiku-4-5) together correctly and idiomatically. Tech stack must NOT be re-litigated. Refined spec: `docs/reference/refined-request-tailsup.md`; raw kickoff: `prompts/001-tailsup-kickoff.md`.
