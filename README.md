# TailsUp

TailsUp is a data-driven dog-training platform. A trainer records structured
behavior data during sessions (a fast 4-tap log), clients track their dog's
progress and homework, a public website captures leads and bookings, and cheap
AI summaries report on progress — with the structured behavior data as the
long-term proprietary dataset moat.

**What is built:** an npm-workspaces monorepo with the full database schema, an
automated daily database backup, and environment scaffolding (Phase 1), plus the
**public website** — Home, About, Services, Results, Contact and Booking, served
from the same Expo codebase as the app — with its two capture endpoints
`POST /leads` and `POST /bookings` (part of Phase 3). Auth, the client dashboard
and the trainer views are **not** built yet
(see [Phase boundary](#phase-boundary)).

## Monorepo layout

```
tailsup/
├── apps/
│   ├── api/        # Hono + TypeScript API, Drizzle ORM over PostgreSQL
│   └── mobile/     # Expo Router app (iOS / Android / web)
├── packages/
│   └── shared/     # @tailsup/shared — enums + DTOs imported by both apps
├── .github/workflows/db-backup.yml   # daily pg_dump -> Cloudflare R2
├── .env.example    # environment variable template
└── package.json    # npm workspaces root
```

`packages/shared` is the single source of truth for the enums and DTOs used by
both the API (validation, schema) and the mobile app (typing the `/health`
response). It is consumed as TypeScript source — no build step.

## Prerequisites

- **Node.js >= 20** (`node -v`). The repo pins `20` in `.nvmrc`.
- **npm** (bundled with Node).
- **A PostgreSQL database** reachable via a `DATABASE_URL`. Either:
  - Spin one up locally with Docker (one-liner):
    ```bash
    docker run --name tailsup-pg -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=tailsup -p 5432:5432 -d postgres:16
    # DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tailsup
    ```
  - …or use a managed instance and copy its connection string (e.g. Railway or
    Neon) into `DATABASE_URL`.

## Setup

From the repo root:

```bash
cp .env.example .env          # then edit .env and set DATABASE_URL
npm install                   # installs ALL workspaces (api, mobile, shared)
```

`npm install` at the root is all you need — it installs every workspace and
links `@tailsup/shared` into both apps.

## Database (migrations)

The Drizzle schema and migration scripts live in `apps/api`. Generate migrations
(only needed if the schema changed — committed migrations already exist), then
apply them to the database in your `DATABASE_URL`:

```bash
npm run db:generate -w apps/api    # regenerate SQL from the schema (idempotent)
npm run db:migrate  -w apps/api    # apply migrations to DATABASE_URL
```

If the `-w apps/api` workspace flag is unavailable in your shell, the equivalent
is:

```bash
cd apps/api && npm run db:generate && npm run db:migrate
```

A successful `db:migrate` creates all 11 tables (singular names), the 6 enums,
the `behavior_event.tags` JSONB column with its GIN index, and the required
indexes.

## Run the API

```bash
npm run dev -w apps/api            # starts the Hono API on PORT (default 3000)
# or:  cd apps/api && npm run dev
```

### Verify `GET /health`

```bash
curl http://localhost:3000/health
```

Expected (database reachable):

```json
{ "status": "ok", "db": "up" }
```

If the API is up but the database is unreachable, `/health` still returns HTTP
200 with a degraded payload so the mobile screen can tell the two states apart:

```json
{ "status": "degraded", "db": "down" }
```

### Example `POST /sessions/:id/events`

The 4-tap behavior-logging write. The body matches `CreateBehaviorEventInput`
from `@tailsup/shared`. Replace `<SESSION_ID>` with a real session UUID (seed a
trainer → client → dog → protocol → session first; the dog's
`Protocol.defaultIntervention` supplies `intervention` when you omit it).

```bash
curl -X POST http://localhost:3000/sessions/<SESSION_ID>/events \
  -H 'Content-Type: application/json' \
  -d '{
    "triggerType": "dog",
    "thresholdMeters": 5,
    "intensity": 7,
    "outcome": "recovered_slowly",
    "intervention": "u-turn",
    "note": "near the park gate",
    "tags": ["reactive", "leash"]
  }'
```

Expected: HTTP 201 with the created `BehaviorEventDTO`. Behavior to expect:

- Invalid enum (e.g. `"triggerType": "cat"`) or out-of-range `intensity`
  (e.g. `11`) → **400**.
- Unknown session id → **404** `{ "error": "session not found" }`.
- `intervention` omitted **and** the dog has a protocol with a default →
  **201**, storing the protocol's `defaultIntervention`.
- `intervention` omitted **and** the dog has no protocol default → **400**
  (`intervention` is never null — it is the dataset moat).

## Run the site / mobile app

`apps/mobile` is one Expo Router codebase serving **both** the public website
(web) and the app (iOS/Android) — there is no separate Next.js project.

| Route            | What it is                                            |
| ---------------- | ----------------------------------------------------- |
| `/`              | Home                                                  |
| `/about`         | About the practice                                    |
| `/services`      | The three session types + the tracking service        |
| `/results`       | Threshold-over-time proof, and how the data is logged |
| `/contact`       | Lead form → `POST /leads`                             |
| `/booking`       | Booking request → `POST /bookings`                    |
| `/debug/health`  | The Phase 1 `GET /health` connectivity screen (AC-9)  |

Set the API base URL via `EXPO_PUBLIC_API_URL` (in `apps/mobile/.env`), then
start the web target:

```bash
# apps/mobile/.env
#   EXPO_PUBLIC_API_URL=http://localhost:3000

npm run web -w apps/mobile         # Expo web build
# or:  cd apps/mobile && npm run web
```

> Script names in `apps/mobile` are `web` (Expo web) and `start` (`expo start`,
> the dev menu for iOS/Android/web). If `-w apps/mobile` does not resolve a
> script in your environment, use the `cd apps/mobile && npm run <script>` form.

With the API running, `/debug/health` shows a "Connected" state with the
`/health` payload. Stop the API and reload to see the clear failure state.

### Before the forms will work

Both public forms write to the database, so the API needs two things set in
`.env` (see `.env.example`):

- **`DEFAULT_TRAINER_ID`** — a real `trainer.id`. Public captures have no
  authenticated actor, and `lead.trainerId` / `booking.trainerId` are NOT NULL,
  so the owning trainer is resolved from config rather than from the request
  body. Insert a trainer row first; a bad id fails the foreign key on submit.
- **`CORS_ORIGINS`** — must include the origin the site is served from. The
  shipped default covers Expo web in dev (`http://localhost:8081`); add your
  deployed site origin before going live. It is never `*`, or any site could
  post leads to this practice.

### Building the site for deployment

```bash
cd apps/mobile && npx expo export -p web    # static site into apps/mobile/dist
```

`app.json` sets `web.output: "static"`, so every route is pre-rendered to HTML
at build time — the marketing copy is in the served HTML rather than injected by
JavaScript, which is what a lead-capture site needs for search and link
previews. If a page ever exports at a uniform ~17 kB with an empty
`<div id="root">`, something in the tree is returning `null` during the Node
pre-render (the root layout's font gate did exactly this — hence the
`Platform.OS !== 'web'` guard in `app/_layout.tsx`).

### Dev networking matrix

The correct API host depends on where the app runs:

| Where the app runs            | `EXPO_PUBLIC_API_URL`            |
| ----------------------------- | -------------------------------- |
| Expo **web** (dev-machine browser) | `http://localhost:3000`     |
| **iOS simulator**             | `http://localhost:3000`          |
| **Android emulator**          | `http://10.0.2.2:3000`           |
| **Physical device** (Expo Go) | `http://<your-LAN-IP>:3000`      |

(Physical device and machine must be on the same Wi-Fi.)

## Backups

A GitHub Actions workflow (`.github/workflows/db-backup.yml`) runs daily at
**03:00 UTC** (and on demand via **workflow_dispatch**). It installs a
`pg_dump` whose major version matches the Postgres server, dumps the database
(`pg_dump -Fc`), and uploads the date-prefixed dump to a **separate** Cloudflare
R2 backups bucket via the AWS CLI against the R2 S3 endpoint.

**Required GitHub Secrets** (repo → Settings → Secrets and variables → Actions):

| Secret                  | Purpose                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`          | Source DB for `pg_dump` (use Railway's **public** string — runners are IPv4-only) |
| `R2_ACCOUNT_ID`         | Cloudflare account id (forms the R2 S3 endpoint)              |
| `R2_ACCESS_KEY_ID`      | R2 API token key id — token must be **Object Read & Write**   |
| `R2_SECRET_ACCESS_KEY`  | R2 API token secret                                           |
| `R2_BACKUP_BUCKET`      | Name of the separate backups bucket (≠ media `R2_BUCKET`)     |

**Before the first run:** confirm the Postgres **server major version** and set
`PG_MAJOR` in the workflow to match it (a `pg_dump` older than the server major
fails). Check with:

```bash
psql "$DATABASE_URL" -c "SELECT version();"
```

To run the backup manually once secrets are set: open the **Actions** tab →
**db-backup** → **Run workflow**.

## Phase boundary

The schema covers all 11 entities. Four endpoints are implemented:
**`GET /health`**, **`POST /sessions/:id/events`** (Phase 1), and
**`POST /leads`** + **`POST /bookings`** (the public site's capture, Phase 3).

The following are intentionally **NOT** built yet:

- **Phase 2 — Trainer view:** 4-tap quick-logging UI, post-session detail
  (note/tags/video upload via R2 presign), dog timeline, `POST /media/presign`.
- **Phase 3 remainder — Client view:** BetterAuth with `trainer`/`client` roles,
  the client dashboard (threshold-over-time graph, homework, reminders), the
  trainer's lead/booking management, and the endpoints those need
  (`PATCH /bookings/:id/status`, `POST /leads/:id/convert`).
- **Phase 4 — AI & scale:** `POST /dogs/:id/summary` (Anthropic
  claude-haiku-4-5), AI spend-cap reminders, multi-tenant SaaS prep.

### Known gaps in the shipped site

- **Booking times are not live availability.** There is no availability endpoint
  until the trainer view exists, so the calendar offers the practice's usual
  weekday slots and the visitor is making a *request*. The page says so; do not
  present it as a confirmed slot.
- **All business facts are placeholders.** Prices, address, opening hours, the
  trainer's name and the credential all still read `[LIKE THIS]`. They live in
  one file — `apps/mobile/src/content/site.ts` — so filling them in once updates
  every page.
- **Photos are marked empty frames**, not stock imagery. The "crew" strip on the
  home page additionally needs owner permission before real photos go up.
- **The progress curves are sample data**, labelled as such on every page they
  appear. Real client curves need the client dashboard.
