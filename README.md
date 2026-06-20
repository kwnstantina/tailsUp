# TailsUp

TailsUp is a data-driven dog-training platform. A trainer records structured
behavior data during sessions (a fast 4-tap log), clients track their dog's
progress and homework, a public website captures leads and bookings, and cheap
AI summaries report on progress — with the structured behavior data as the
long-term proprietary dataset moat. **This repository has shipped Phase 1
(Foundations) and Phase 2 (Trainer view):** an npm-workspaces monorepo with the
full database schema, the Phase 1 endpoints (`GET /health`,
`POST /sessions/:id/events`), the Phase 2 trainer-view read/media API, three
trainer-facing Expo Router screens (4-tap quick-log, post-session detail with
direct-to-R2 video upload, dog timeline), environment scaffolding, and an
automated daily database backup. Phases 3–4 are not built yet (see
[Phase boundary](#phase-boundary)). Phase 2 run/test instructions are in the
[Phase 2 — Trainer view](#phase-2--trainer-view) section.

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

## Run the mobile app

The Expo Router app proves app↔API connectivity by calling `GET /health`.
Set the API base URL via `EXPO_PUBLIC_API_URL` (in `apps/mobile/.env`), then
start the web target (sufficient for Phase 1 verification):

```bash
# apps/mobile/.env
#   EXPO_PUBLIC_API_URL=http://localhost:3000

npm run web -w apps/mobile         # Expo web build
# or:  cd apps/mobile && npm run web
```

> Script names in `apps/mobile` are `web` (Expo web) and `start` (`expo start`,
> the dev menu for iOS/Android/web). If `-w apps/mobile` does not resolve a
> script in your environment, use the `cd apps/mobile && npm run <script>` form.

With the API running, the screen shows a "Connected" state with the `/health`
payload. Stop the API and reload to see the clear failure state.

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

## Phase 2 — Trainer view

Phase 2 adds the trainer-facing experience **on top of** Phase 1 (nothing in
Phase 1 changed). It is **three Expo Router screens** plus the **read/media API**
they depend on. **No schema migration** — the `media` table and the
`behavior_event.note` / `behavior_event.tags` columns already existed (AC-12).

### What Phase 2 adds

**API endpoints** (all unauthenticated — auth is Phase 3):

| Method & path | Purpose |
| --- | --- |
| `GET /trainers/:trainerId/dogs` | List a trainer's dogs (`DogSummaryDTO[]`; unknown trainer → `200 []`). |
| `GET /dogs/:id` | A dog + its sessions with `eventCount` (`DogDetailDTO`; `404` if unknown). |
| `GET /dogs/:id/timeline` | The dog's sessions+events, reverse-chronological, grouped (`DogTimelineDTO`; `404`). |
| `GET /sessions/:id/events` | A session's events, chronological, with `mediaCount` (`BehaviorEventListItemDTO[]`; `404`). |
| `GET /events/:id` | A single event + its `media[]` (`BehaviorEventWithMediaDTO`; `404`). |
| `PATCH /events/:id` | Update **only** `note` / `tags` — tap fields & `intervention` are immutable (`404`). |
| `POST /events/:id/media` | Record a `media` row after a confirmed upload (`201 MediaDTO`; `404`; `503` if R2 unset). |
| `POST /media/presign` | Issue a presigned R2 **PUT** URL (`200 PresignResponse`; `400` bad type; `404`; `503`). |
| `GET /media/:id/url` | Issue a short-lived presigned R2 **GET** URL for playback (`200 MediaPlaybackUrlDTO`; `404`; `503`). |
| `POST /dogs/:id/sessions` | Start a session so the 4-tap screen has a container (`201 SessionSummaryDTO`; `404`). |

**Mobile screens** (Expo Router, work on **web**): `app/dogs/index.tsx` (dog
list), `app/dogs/[id]/timeline.tsx` (timeline), `app/sessions/[id]/log.tsx`
(4-tap quick-log), `app/events/[id].tsx` (detail + video upload). The typed API
client is `apps/mobile/lib/api.ts`; the direct-to-R2 upload flow is
`apps/mobile/lib/upload.ts`.

### Seed the org graph (required before the screens have data)

Phase 2 reads/logs against a **seeded** trainer → client → dog → protocol →
session graph — there is no UI to create the org graph (out of scope). With
`DATABASE_URL` set and migrations applied (see [Database](#database-migrations)),
run these manual inserts (psql), capturing the trainer and session ids:

```bash
psql "$DATABASE_URL" <<'SQL'
-- a trainer
INSERT INTO trainer (id, name, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Trainer', 'trainer@example.com');

-- a protocol with a default intervention (so the 4-tap screen can omit it)
INSERT INTO protocol (id, name, default_intervention)
VALUES ('22222222-2222-2222-2222-222222222222', 'Reactivity v1', 'u-turn');

-- a client owned by the trainer
INSERT INTO client (id, trainer_id, name, email)
VALUES ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111', 'Demo Client', 'client@example.com');

-- a dog owned by the client, on the protocol
INSERT INTO dog (id, client_id, protocol_id, name, breed, age_months)
VALUES ('44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222', 'Rex', 'GSD', 30);

-- a session to log into
INSERT INTO session (id, dog_id, started_at, location)
VALUES ('55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444', now(), 'park');
SQL
```

> Column names are **snake_case** (the schema's `casing: 'snake_case'`). Adjust
> the column list to match `apps/api/src/db/schema.ts` if you change the schema.
> The exact non-null columns per table are defined there; the inserts above cover
> the columns the Phase 2 screens read. You can also start a session via the API
> instead of seeding one: `POST /dogs/:id/sessions` (see below).

### Run the API + mobile app (Phase 2)

```bash
# 1. API (same as Phase 1)
npm run dev -w apps/api

# 2. Mobile — set the trainer context, then start web
#    apps/mobile/.env:
#      EXPO_PUBLIC_API_URL=http://localhost:3000
#      EXPO_PUBLIC_TRAINER_ID=11111111-1111-1111-1111-111111111111
npm run web -w apps/mobile
```

`EXPO_PUBLIC_TRAINER_ID` is the seeded trainer id the dog-list screen scopes to
(pre-auth trainer context; replaced by the authenticated trainer id in Phase 3).
It is read via **static dot-access** so Metro inlines it — see
`apps/mobile/.env.example`.

### R2 environment (for presign / upload / playback)

`POST /media/presign`, `POST /events/:id/media`, and `GET /media/:id/url` read
the R2 credentials via a **lazy, throw-on-missing** accessor
(`apps/api/src/lib/r2.ts`). If any var is unset these endpoints return
**`503 { "error": "media storage not configured" }`** — never a fabricated URL.
The read endpoints and the 4-tap log need **no** R2 config. Set in `.env`:

```bash
R2_ACCOUNT_ID=...            # forms https://<id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...         # R2 API token, scoped Object Read & Write
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=tailsup-media      # the media bucket (≠ the backups bucket)
```

> **R2 bucket CORS is a hard prerequisite for web upload (AC-9 on web).** The
> browser `PUT` to R2 from Expo **web** is cross-origin and is blocked unless the
> **R2 bucket's CORS policy** allows `PUT` (and the `Content-Type` header) from
> the Expo web origin (`http://localhost:8081` in dev). This is a **Cloudflare
> bucket setting, not API code.** Configure it in the Cloudflare dashboard
> (R2 → your media bucket → Settings → CORS Policy), for example:
>
> ```json
> [
>   {
>     "AllowedOrigins": ["http://localhost:8081"],
>     "AllowedMethods": ["PUT", "GET"],
>     "AllowedHeaders": ["content-type"],
>     "MaxAgeSeconds": 3600
>   }
> ]
> ```
>
> Native (iOS/Android) uploads do **not** enforce CORS; if you cannot set CORS,
> verify the upload on a native simulator instead.

### Exercise the video flow (presign → direct PUT → persist → playback)

Replace `<EVENT_ID>` with a real `behavior_event` id (log one via the 4-tap
screen or `POST /sessions/:id/events`):

```bash
# 1. Presign — get a PUT URL + object key (no media row is created here)
curl -s -X POST http://localhost:3000/media/presign \
  -H 'Content-Type: application/json' \
  -d '{ "eventId": "<EVENT_ID>", "contentType": "video/mp4" }'
# -> { "uploadUrl": "...", "method": "PUT", "headers": { "Content-Type": "video/mp4" },
#      "key": "events/<EVENT_ID>/<uuid>.mp4", "expiresInSeconds": 600 }

# 2. Upload the bytes DIRECTLY to R2 (never through the API). Echo the SAME
#    Content-Type the presign signed, or R2 returns 403 SignatureDoesNotMatch.
curl -s -X PUT "<uploadUrl>" \
  -H 'Content-Type: video/mp4' \
  --data-binary @./clip.mp4

# 3. Record the media row (after the upload confirms)
curl -s -X POST http://localhost:3000/events/<EVENT_ID>/media \
  -H 'Content-Type: application/json' \
  -d '{ "key": "events/<EVENT_ID>/<uuid>.mp4", "contentType": "video/mp4" }'
# -> 201 MediaDTO

# 4. The new media now appears here, and you can fetch a playback URL
curl -s http://localhost:3000/events/<EVENT_ID>          # media[] now includes it
curl -s http://localhost:3000/media/<MEDIA_ID>/url       # -> { "url": "...", "expiresInSeconds": 600 }
```

### Verifying AC-3..AC-10

| AC | How to verify |
| --- | --- |
| **AC-3** reads | `curl` the five read endpoints above against the seeded ids; unknown ids → `404` (trainers list → `200 []`). |
| **AC-4** patch note/tags only | `curl -X PATCH /events/<id> -d '{"note":"x","tags":["a"]}'` → `200`; sending tap fields/`intervention` has no effect on those columns. |
| **AC-5** presign | step 1 above → `200 PresignResponse`; disallowed `contentType` → `400`; unknown event → `404`; R2 unset → `503`. |
| **AC-6/7** upload + persist | steps 2–3 above; bytes go to the R2 host (the API has no file-receiving route); media then shows in `GET /events/:id`. |
| **AC-8** 4-tap log | On Expo web, open `/sessions/<id>/log`, tap the four fields, submit → `201` (intervention omitted, server-defaulted), screen resets. |
| **AC-9** detail + upload | On Expo web, open `/events/<id>`, edit note/tags (persists via PATCH), pick a video, watch progress → media appears (requires R2 + bucket CORS). |
| **AC-10** timeline | On Expo web, open `/dogs/<id>/timeline` → sessions newest-first, events newest-first, tap a row → detail screen. |

## Phase boundary

Phases **1 — Foundations** and **2 — Trainer view** are built. The schema covers
all 11 entities; the implemented endpoints are `GET /health`,
`POST /sessions/:id/events` (Phase 1) plus the Phase 2 trainer-view endpoints
listed above (AC-12). The following are intentionally **NOT** built yet:

- **Phase 3 — Public site + Client view:** website pages (Home, About,
  Services, Results, Contact + lead form, Booking), BetterAuth with
  `trainer`/`client` roles, client dashboard, and the lead/booking endpoints
  (`POST /leads`, `POST /bookings`, `PATCH /bookings/:id/status`,
  `POST /leads/:id/convert`).
- **Phase 4 — AI & scale:** `POST /dogs/:id/summary` (Anthropic
  claude-haiku-4-5), AI spend-cap reminders, multi-tenant SaaS prep.
