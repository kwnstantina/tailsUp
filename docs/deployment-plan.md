# TailsUp — Deployment Plan

**Written:** 2026-09-27 · **Status:** not yet deployed; development ongoing

Target topology (decided 2026-09-27):

```
tailsup.gr           ->  Cloudflare Pages   (Expo Router static web export)
api.tailsup.gr       ->  Railway            (Hono API, tsx runtime)
                         Railway Postgres
                         Cloudflare R2      (media bucket + SEPARATE backups bucket)
                         Resend             (lead notification email)
iOS / Android        ->  EAS Build -> App Store / Play Store
```

Site and API share the registrable domain `tailsup.gr` **on purpose** — it keeps the
BetterAuth session cookie same-site, so no `SameSite=None` weakening is needed. See
**W4**; moving the API off this apex later is a breaking change for web login.

---

## Verified baseline (2026-09-27)

Run on Windows 11, Node v24.20.0 (repo pins Node 20 in `.nvmrc`; ran clean anyway):

| Check | Result |
| --- | --- |
| `npm run typecheck` (api + mobile + shared) | PASS — zero errors |
| `npm test -w apps/api` | PASS — 226/226 in 16 files |
| API boot (`tsx src/index.ts`) | PASS |
| `GET /health` | `{"status":"degraded","db":"down"}` — no local Postgres |
| `GET /api/auth/ok` | 200 — BetterAuth mounted |
| `GET /me` unauthenticated | 401 — guards work |
| `npm run build:web -w apps/mobile` | PASS — 30 routes, marketing pages carry real pre-rendered HTML |

**The code is in good shape. What is missing is deployment infrastructure** — before the
changes below there was no Dockerfile, no Railway/nixpacks config, no `_redirects`, and
the only GitHub workflow was `db-backup.yml`.

---

## Already done (2026-09-27)

Deploy plumbing and documentation only — no app behavior touched, so these should not
collide with in-flight feature work.

- [x] **`.env.example` rewritten.** It documented `DEFAULT_TRAINER_ID` and `CORS_ORIGINS`
      as required; **no code reads either**. The code reads `ALLOWED_ORIGINS`
      (`apps/api/src/config.ts`) and `PRACTICE_TRAINER_ID` (`apps/api/src/lib/trainer.ts`).
      Deploying from the old template would have set the wrong variables and left CORS
      silently falling back to the localhost dev origins — every browser request from the
      live site failing, with no startup error.
- [x] **`apps/mobile/.env.example`** — dropped the retired `EXPO_PUBLIC_TRAINER_ID`
      (Phase 3b replaced it with the session-resolved trainer id), added the production
      API URL and a note that `EXPO_PUBLIC_*` is inlined at build time.
- [x] **`apps/api/src/test/health.test.ts`** — stale comment naming the wrong required vars.
- [x] **Dynamic-route 404 fix** — `apps/mobile/public/_redirects`,
      `apps/mobile/scripts/post-export.mjs`, and a `build:web` npm script.
      See the next section for why.

### Why the dynamic-route fix was needed

`web.output: "static"` pre-renders one HTML file per route, but a dynamic route can only
be emitted as its literal bracket filename — `events/[id].html`,
`dogs/[id]/timeline.html`, `sessions/[id]/log.html`. A real request for
`/events/8f3c-...` matches no file on disk, so a static host returns a hard 404 and the
client router never runs.

All six `(app)` routes export as **one byte-identical client shell** (md5
`1524c9c6bf4bb4d4146e5badd54b8225`, 27,560 bytes), so every dynamic path can be rewritten
to a single shell. `post-export.mjs` copies that shell to a bracket-free
`/app-shell.html` — square brackets in a Cloudflare `_redirects` destination are not
documented as supported, and a bracket-free path removes the question entirely.

The script also deletes the literal `(app)/` and `(site)/` directories Expo emits. Expo
writes every route **twice** — once at its real URL (`/about`) and once under its route
group (`/(site)/about`). The group form was never meant to be a URL; left in place it is
a crawlable duplicate of every marketing page.

Rewrites use status `200` (serve, don't redirect) so the address bar keeps the real URL
for the client router to read. Every rule is a specific path, never a catch-all splat, so
none can shadow a pre-rendered marketing page.

**Use `npm run build:web -w apps/mobile` as the Cloudflare Pages build command** — plain
`expo export -p web` skips the post-export step and reintroduces the 404s.

---

## Track 1 — Web

### W1. Accounts & infrastructure — *do early, long lead times*
- [ ] Register `tailsup.gr`, move DNS to Cloudflare
- [ ] Railway project: Postgres + API service, `api.tailsup.gr` custom domain
- [ ] Cloudflare Pages project, `tailsup.gr` custom domain
- [ ] Cloudflare R2: media bucket **and a separate backups bucket** (never the same one)
- [ ] Resend account, verify the sending domain (unverified = mail only reaches the
      account owner)

### W2. API deploy config — *near the end of development*
- [ ] Start command: `npm run start -w apps/api` — no build step, `tsx` is already a
      production dependency
- [ ] **Release/pre-deploy command: `npm run db:migrate -w apps/api`.** Nothing currently
      applies migrations on deploy; without this the first deploy meets an empty schema
- [ ] Health check path `/health`. It deliberately returns **200 with
      `{"status":"degraded"}`** when the DB is down rather than failing — do not "fix"
      this into a 503, or a brief DB blip becomes a restart loop
- [ ] Do **not** set `PORT` — Railway injects it
- [ ] Set the variables listed in the reference table below

### W3. Postgres SSL — *small code change*
`apps/api/src/db/client.ts` builds a bare `Pool` and carries a standing comment to add
`ssl: { rejectUnauthorized: false }` if a cert error shows up.

- [ ] Make it explicit and env-driven instead of discovering it mid-deploy. Railway
      **private** networking (`*.railway.internal`) needs no TLS; a public Railway string
      or Neon does

### W4. Auth cookie — *verify; probably no change* ⚠️ UNVERIFIED
With `tailsup.gr` + `api.tailsup.gr` on one registrable domain, the site's fetches are
cross-**origin** but same-**site**, so the default `SameSite=Lax` session cookie should be
sent; and BetterAuth should mark the cookie `Secure` because `BETTER_AUTH_URL` is https.

- [ ] **Confirm both against the installed `better-auth` version before relying on them.**
      This was not verified on 2026-09-27 — the check timed out
- [ ] Log in on the deployed site as the first real smoke test

There is no cookie configuration in `apps/api/src/lib/auth.ts` today. If the API ever
moves to a different registrable domain (e.g. `*.up.railway.app`), web login breaks until
`advanced.defaultCookieAttributes = { sameSite: 'none', secure: true }` is set.

### W5. R2 bucket CORS — *dashboard only, nothing in the repo*
The browser PUTs directly to R2 from the site origin, so the **media** bucket needs:

```
AllowedOrigins: https://tailsup.gr   (+ http://localhost:8081 for dev)
AllowedMethods: PUT, GET
AllowedHeaders: content-type
```

- [ ] Configure it. This is invisible in the codebase and easy to forget — uploads simply
      fail in the browser with a CORS error

### W6. Backups
- [ ] Confirm the Postgres **server major** and match `PG_MAJOR: '16'`
      (`.github/workflows/db-backup.yml:58`). A `pg_dump` older than the server major
      fails outright
- [ ] Add the 5 GitHub Secrets (`DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
      `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`)
- [ ] Use the **public** DB connection string here — Actions runners are external and
      IPv4-only
- [ ] The R2 token must be scoped **Object Read & Write**; a read-only token fails upload
- [ ] Trigger the workflow manually once and confirm an object lands in the bucket

### W7. Production trainer login — *needs a small script* ⚠️
`npm run db:seed -w apps/api` is a **local demo seed**. It creates two BetterAuth logins
with hardcoded, committed passwords (`apps/api/src/seed.ts`):

```
trainer@tailsup.local / Trainer123!
client@tailsup.local  / Client123!
```

It reads no environment variables for those accounts — the `SEED_TRAINER_EMAIL` /
`SEED_TRAINER_NAME` vars the old `.env.example` documented are dead.

> **Never run `db:seed` against production.** It would create working logins whose
> credentials are public in this repo.

- [ ] Write a one-off provisioning path instead: `auth.api.signUpEmail` with a generated
      password, then patch `user.role = 'trainer'` and `user.trainerId` to the real
      trainer row
- [ ] Set `PRACTICE_TRAINER_ID` to that trainer's id, or the public `POST /leads` and
      `POST /bookings` endpoints return `503 { "error": "practice not configured" }`

### W8. CI — *do now, cheap, protects ongoing development*
- [ ] No workflow runs `typecheck` or the 226 tests on push; only `db-backup.yml` exists.
      ~20 lines

### W9. Rate limiting — *accept or upgrade*
`apps/api/src/app.ts` uses an in-memory limiter (10 req/min/IP) on `POST /leads` and
`POST /bookings`. State resets on restart and is not shared across instances.

- [ ] Fine for a single Railway instance. If you scale past one, add an edge limiter
      (Cloudflare WAF rate limiting) in front — already noted as deferred in `app.ts`

---

## Track 2 — Mobile

Nothing here is configured yet. `apps/mobile/app.json` has no `ios.bundleIdentifier`, no
`android.package`, `version: "0.0.0"`, no icon or splash, no `extra.eas`; there is no
`eas.json`, no `assets/` directory, and `expo-updates` is not installed.

Ordered by what blocks what:

### M1. Identifiers — *blocks every EAS build*
- [ ] `ios.bundleIdentifier` (e.g. `gr.tailsup.app`) and `android.package` — these are
      **permanent** once published; choose carefully
- [ ] Real `version` (e.g. `1.0.0`) — `0.0.0` is not a valid store version

### M2. Permission strings — *blocks App Store review*
- [ ] `expo-image-picker` is used at `apps/mobile/app/(app)/events/[id].tsx:118`
      (`requestMediaLibraryPermissionsAsync`) with no usage description.
      Add `ios.infoPlist.NSPhotoLibraryUsageDescription` explaining *why* the app needs
      the photo library (Apple rejects generic strings)

### M3. Assets — *blocks store submission*
- [ ] No `assets/` directory exists. Needs app icon (1024×1024), Android adaptive icon
      (foreground + background), splash image, web favicon

### M4. `eas.json` + EAS project
- [ ] `eas init` to create and link a project id (lands in `extra.eas.projectId`)
- [ ] `development` / `preview` / `production` profiles
- [ ] `production` must set `EXPO_PUBLIC_API_URL=https://api.tailsup.gr`

### M5. `expo-updates` — *decide before first release*
- [ ] Not installed. Optional, but OTA update channels are baked into the binary at build
      time, so retrofitting means new store builds. Decide now

### M6. Store accounts & metadata
- [ ] Apple Developer Program ($99/yr) — note the enrolment can take days
- [ ] Google Play Developer ($25 one-off)
- [ ] Listing copy, screenshots per device class, **privacy policy URL** (required by
      both stores; the app collects account data and uploads media)

### M7. Build-time API URL ⚠️
`EXPO_PUBLIC_API_URL` is **inlined at build time**, not read at runtime — a store build
points permanently at whatever it was built with. Shipping a build with `localhost:3000`
baked in produces an app that can never connect and can only be fixed by a new release.

- [ ] Verify the production profile's value before every submission

---

## Environment variable reference

Required (API throws at startup if missing):

| Variable | Where | Production value |
| --- | --- | --- |
| `DATABASE_URL` | Railway API | Railway **private** string |
| `AUTH_SECRET` | Railway API | `openssl rand -base64 32` |

Optional with a default, **but the default silently misbehaves in production**:

| Variable | Default | Production value |
| --- | --- | --- |
| `BETTER_AUTH_URL` | `http://localhost:<PORT>` | `https://api.tailsup.gr` |
| `ALLOWED_ORIGINS` | localhost dev origins | `https://tailsup.gr` |
| `RESEND_FROM` | `onboarding@resend.dev` (owner-only delivery) | `TailsUp <leads@tailsup.gr>` |
| `PRACTICE_TRAINER_ID` | sole/oldest trainer row | the real trainer id |

Lazily read — API boots without them, feature degrades cleanly:

| Variable | Missing behavior |
| --- | --- |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | media presign returns 503 |
| `RESEND_API_KEY` | lead email becomes a logged no-op; never blocks the 201 |

GitHub Secrets (backup workflow only): `DATABASE_URL` (**public** string),
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`.

Mobile: `EXPO_PUBLIC_API_URL` — build-time inlined, public, never secret.

---

## Sequencing

**Now — safe alongside development**
W8 (CI), W1 (accounts/DNS — long lead times), M1–M3 (identifiers, permissions, assets:
pure config, no conflict with feature work)

**Once features settle**
W2, W3, W7, M4–M5

**At launch**
W5, W6, M6–M7, then the live-DB per-role walkthrough still open in
`Issues - Pending Items.md`

---

## Two open risks carried from the ledger

1. **Nothing has ever run against a real Postgres.** Migrations, seed, and the per-role
   walkthrough are verified only by the mocked test suite and static review. This is
   already an open *Important* item for Phase 1 (AC-3/6/7) and Phase 3b-2
   (AC-3b-6..10). Do the live walkthrough before pointing a domain at anything.

2. **`npm audit` triage is stale.** Now **40 vulnerabilities (1 critical, 15 high, 24
   moderate)**; `Issues - Pending Items.md` records "23 moderate, none high/critical".
   The new high/critical entries — `tar`, `metro`, `@expo/cli`, `postcss`, `shell-quote`,
   `nanoid`, `js-yaml`, `image-size`, `@xmldom/xmldom`, `browserslist`, `brace-expansion`
   — are all Expo SDK 54 build toolchain rather than API runtime dependencies, which is
   consistent with the existing assessment, but the counts and the fix path (the SDK
   upgrade) need re-triage before launch.

---

## Resume point (paused 2026-09-27)

Work paused here deliberately — feature development is still in progress, and everything
left in Track 1 / Track 2 is better done once the code settles.

**Where we stopped:** collecting environment variable values. Question 1 of 10 was asked
and not yet answered:

> Confirm the final domain (`tailsup.gr` site + `api.tailsup.gr` API), and whether
> `www.tailsup.gr` should also work — it changes `ALLOWED_ORIGINS`, and a missing origin
> there fails CORS silently rather than loudly.

**The remaining 9 values to collect** (see the reference table above for the full set):

| # | Value | Notes |
| --- | --- | --- |
| 1 | Domain / `BETTER_AUTH_URL` / `ALLOWED_ORIGINS` | incl. the `www` decision |
| 2 | `R2_BUCKET` | media bucket name |
| 3 | `R2_BACKUP_BUCKET` | must differ from the media bucket |
| 4 | `RESEND_FROM` | needs a Resend-verified domain |
| 5 | `R2_ACCOUNT_ID` | identifier, not a credential |
| 6 | `EXPO_PUBLIC_API_URL` | public by design — inlined into the bundle |
| 7 | `PRACTICE_TRAINER_ID` | does not exist yet; comes after W7 |
| 8 | `PG_MAJOR` | must match the actual Postgres server major |
| 9 | `ios.bundleIdentifier` + `android.package` | permanent once published |

**Secrets — never paste these into a chat transcript.** Set them directly in the Railway
and GitHub dashboards: `AUTH_SECRET` (`openssl rand -base64 32`), `DATABASE_URL`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`. The repo has a guard that
blocks reading `.env` for this reason.

**Uncommitted when paused.** The five files under "Already done" are working-tree changes
only — nothing was committed, and nothing was deployed.

**Good first step on return:** re-run the baseline (`npm run typecheck`,
`npm test -w apps/api`, `npm run build:web -w apps/mobile`) to confirm the intervening
development did not disturb it, then pick up at W8 (CI) and M1–M3, which are safe to do
in parallel with anything else.
