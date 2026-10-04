# TailsUp — Deployment Plan

**Written:** 2026-09-27 · **Updated:** 2026-10-04
**Status:** web test deploy LIVE on workers.dev; API/DB not deployed; development ongoing

Target topology (decided 2026-09-27):

```
tailsupacademy.gr           ->  Cloudflare Workers (static assets; Expo Router web export)
api.tailsupacademy.gr       ->  Railway            (Hono API, tsx runtime)
                         Railway Postgres
                         Cloudflare R2      (media bucket + SEPARATE backups bucket)
                         Resend             (lead notification email)
iOS / Android        ->  EAS Build -> App Store / Play Store
```

Site and API share the registrable domain `tailsupacademy.gr` **on purpose** — it keeps the
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

**Use `npm run build:web -w apps/mobile` as the Cloudflare build command** — plain
`expo export -p web` skips the post-export step and reintroduces the 404s.

---

## Live test deploy — WEB IS UP (2026-10-04)

**URL:** https://tailsup.konstantinakirtsia.workers.dev
Cloudflare Worker `tailsup` (static assets), auto-deploying from `main`.

Dashboard build settings that actually work:

| Field | Value |
| --- | --- |
| Build command | `npm run build:web -w apps/mobile` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

`deploy:web` exists in the root package.json as a single-command alternative, but
is NOT currently what the dashboard uses — the two-field setup above is live and
green. Leave it alone unless the build config breaks again.

**Do not use "Retry deployment" after changing build settings.** A retry replays
the build configuration captured with the ORIGINAL deployment, so corrected
fields do not take effect and the previous failure reproduces exactly. Use
"Create deployment", or push a commit.

### Verified live, 2026-10-04

| Path | Status | Bytes | |
| --- | --- | --- | --- |
| `/` | 200 | 62,924 | pre-rendered; 3,908 Greek chars in body, non-empty `#root` |
| `/about` | 200 | 50,635 | |
| `/services` | 200 | 58,265 | |
| `/results` | 200 | 47,894 | |
| `/contact` | 200 | 46,350 | |
| `/booking` | 200 | 44,555 | |
| `/login` | 200 | 29,060 | |
| `/events/test-123` | 200 | 27,560 | app shell, URL preserved (no redirect) |
| `/dogs/abc-123/timeline` | 200 | 27,560 | |
| `/sessions/xyz-9/log` | 200 | 27,560 | |
| `/nonsense-path` | 404 | 26,870 | 404.html via `not_found_handling` |
| `/(site)/about` | 404 | — | route-group dirs correctly pruned |
| `/(app)/client` | 404 | — | |

Byte counts match the local build exactly.

### Bug this deploy caught — `_redirects` destinations must omit `.html`

The first deploy returned `307 Location: /app-shell` for every dynamic route.
Cloudflare's default `html_handling: "auto-trailing-slash"` strips `.html` and
redirects, so a destination of `/app-shell.html` was rewritten AND THEN
redirected — changing the address bar, which defeats a 200 rewrite entirely
(Expo Router reads the URL to choose the route, so it would have rendered
not-found). Fixed in `fca353f` by targeting `/app-shell`.

**Not reproducible locally** — `npx serve` implements neither `_redirects` nor
`html_handling`. Only a real deploy could surface it. Worth remembering before
trusting any future local check of hosting behaviour.

### Resolved 2026-10-04 — stray "Hello world" Worker script

For a period the apex returned `200 "Hello world"` (plain text, 11 bytes) for every
unmatched path, bypassing 404.html entirely — so every unknown URL advertised itself to
search engines as a valid page.

Cause: a Worker SCRIPT had been deployed from the dashboard ("Edit code" / Quick Edit).
A Worker is `[static assets] + [optional script]`; this repo builds assets only
(`wrangler.jsonc` has no `main`), but once a script exists Cloudflare routes unmatched
requests to it instead of to `not_found_handling`. Correcting the build settings does
NOT clear it — settings only affect the next build, and the old version keeps serving.

Fix: Deployments -> **Create deployment** from `main`. Re-verified after:
`/nonsense` -> 404 / 26,870 bytes, `/(site)/about` -> 404, all 10 real routes unchanged.

**Do not use the dashboard "Edit code" button on this Worker** — it deploys a
dashboard-authored version that overwrites what the Git pipeline builds.

### Custom domain — LIVE 2026-10-04

`https://tailsupacademy.gr` serves the site: DNS on Cloudflare, valid TLS
(`ssl_verify_result: 0`), `http://` -> `https://`, all pages and dynamic routes verified.

- [ ] **`www.tailsupacademy.gr` returns 404** with no `Location` header, so no redirect
      rule is firing. The `*.tailsupacademy.gr` wildcard in the Worker's Domains tab does
      NOT cover it — that entry is for preview deployments. Either add `www` as its own
      Custom Domain (then it must also go in `ALLOWED_ORIGINS`), or add a zone-level
      Redirect Rule to the apex (preferred: one canonical hostname, no duplicate content).
- [ ] A redundant **Route** entry for `tailsupacademy.gr` sits alongside the Custom Domain
      in the Worker's Domains tab. The Custom Domain is what serves; the Route is noise
      and worth removing once `www` is settled.

### Known limitation of this deploy

`EXPO_PUBLIC_API_URL` points at `https://api-staging.tailsupacademy.gr`, which
does not exist yet. The marketing pages are fully functional; **the lead and
booking forms and login are not**. Do not share this URL as a preview with
anyone who will try to submit a form.

---

## Track 1 — Web

### W1. Domain + accounts — *do first, long lead times, safe during development*

Domain is **tailsupacademy.gr**, registered at **Papaki** (2026-09-27).

Papaki stays the REGISTRAR; Cloudflare becomes the DNS HOST. This is required because
Cloudflare serves the apex domain, and apex records need CNAME flattening that most
registrars do not offer.

- [ ] Free Cloudflare account -> **Add a site** -> `tailsupacademy.gr`
- [ ] **Export the existing Papaki DNS records BEFORE switching.** If any email runs on
      this domain through Papaki, moving nameservers without recreating the `MX` records
      kills it. Cloudflare auto-scans and imports records, but verify the list rather
      than trusting it — this is the one irreversible-feeling mistake in the whole setup
- [ ] Set Cloudflare's two nameservers in the Papaki control panel. Propagation is
      usually under an hour, occasionally up to 24
- [ ] Cloudflare Worker (static assets) -> custom domain `tailsupacademy.gr` + `www`
      (Cloudflare creates these DNS records itself). Config lives in `wrangler.jsonc`
      at the repo root; dashboard needs build command `npm run build:web -w apps/mobile`,
      deploy command `npx wrangler deploy`, root directory `/`
- [ ] Railway project: Postgres + API service -> custom domain `api.tailsupacademy.gr`
      (`CNAME` + `TXT` to Railway's targets, **proxy ON** — Railway will not associate
      the domain with the proxy off)
- [ ] **Cloudflare SSL/TLS mode -> `Full`.** NOT `Flexible` (Cloudflare sends plain HTTP,
      Railway redirects to HTTPS, infinite redirect loop) and NOT `Full (Strict)` (fails
      during Railway certificate renewal windows). This one costs hours to diagnose
- [ ] Cloudflare R2: media bucket **and a separate backups bucket** (never the same one)
- [ ] Resend account, verify `tailsupacademy.gr` and add its SPF/DKIM records in
      Cloudflare. Do this early — verification is not instant, and `RESEND_FROM` is
      useless until it passes (unverified = mail only reaches the account owner)


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
With `tailsupacademy.gr` + `api.tailsupacademy.gr` on one registrable domain, the site's fetches are
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
AllowedOrigins: https://tailsupacademy.gr   (+ http://localhost:8081 for dev)
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

### W8. CI — DONE 2026-10-04 ✅
- [x] `.github/workflows/ci.yml` — typecheck (3 workspaces) + 226 api tests +
      `build:web` on every push to main and every PR. Green on first run (7f2ab79).
      Uses `node-version-file: .nvmrc` and `npm ci` so a drifted lockfile fails loudly.
- [ ] **`db-backup.yml` is failing on every scheduled run** — no database, no secrets.
      Harmless but it emails on each failure. Either set the W6 secrets or comment out
      the `schedule:` trigger (leaving `workflow_dispatch`) until the DB exists.

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
- [ ] `production` must set `EXPO_PUBLIC_API_URL=https://api.tailsupacademy.gr`

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
| `BETTER_AUTH_URL` | `http://localhost:<PORT>` | `https://api.tailsupacademy.gr` |
| `ALLOWED_ORIGINS` | localhost dev origins | `https://tailsupacademy.gr` |
| `RESEND_FROM` | `onboarding@resend.dev` (owner-only delivery) | `TailsUp <leads@tailsupacademy.gr>` |
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

**Where we stopped:** collecting environment variable values. Question 1 is ANSWERED
(2026-09-27): the domain is **tailsupacademy.gr**, registered at **Papaki**. Site on the
apex, API on `api.tailsupacademy.gr` — one registrable domain, so the same-site cookie
reasoning in W4 holds unchanged. Still open: whether `www` should resolve too (it changes
`ALLOWED_ORIGINS`, and a missing origin there fails CORS silently rather than loudly).

Next up is W1 — the Papaki -> Cloudflare nameserver move, which gates everything else.

**The remaining 9 values to collect** (see the reference table above for the full set):

| # | Value | Notes |
| --- | --- | --- |
| 1 | ~~Domain~~ -> tailsupacademy.gr (Papaki). `www` decision still open |
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
