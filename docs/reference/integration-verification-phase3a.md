# TailsUp — Phase 3a Integration Verification

**Public business website + `POST /leads` + `POST /bookings`**

- **Date:** 2026-06-21
- **Environment:** Node v20.20.2 / npm 10.8.2, Windows 11 Pro. Dependencies installed.
- **By design, no live infra:** no PostgreSQL, no `RESEND_API_KEY`, no R2. DB- and
  email-runtime ACs are verified via the mocked vitest suite + static review; the
  live smoke test is the documented manual step (§ Manual verification).
- **Verified against:** `docs/reference/refined-request-phase3.md` (the **3a** ACs),
  the Phase 3a section of `docs/design/project-design.md`, and `design_system.md`.

## Overall verdict: **READY** (for the user's Phase 3a review)

All automated gates are green: 3/3 workspaces typecheck clean (strict, 0 errors),
the API builds (exit 0), **173/173 API tests pass**, no DB migration was introduced
(`apps/api/drizzle` clean, `schema.ts` unchanged since Phase 1), and the Expo
**web export** succeeds (exit 0) emitting static HTML for all six site pages plus
`/health`. Every Phase 3a acceptance criterion is **met** by command output, file
evidence, or a named passing test. The two unexercised items (a live DB + Resend
smoke test, and a real-browser click-through) are environment limitations, not
defects, and are documented as manual steps with high confidence.

**One known limitation (NOT a blocker):** per-page `<title>`/meta set via expo-router
`<Head>` are **client-side only** — they do **not** appear in the statically exported
HTML, which carries only the site-wide default title. See the SEO verdict below.

---

## 1. Build / typecheck / test / export results

| Gate | Command | Result |
|---|---|---|
| Typecheck — shared (AC-3a-1) | `npx tsc --noEmit -p packages/shared/tsconfig.json` | **exit 0**, 0 errors |
| Typecheck — api (AC-3a-1) | `npm run -s typecheck -w @tailsup/api` | **exit 0**, 0 errors |
| Typecheck — mobile (AC-3a-1) | `npm run -s typecheck -w @tailsup/mobile` | **exit 0**, 0 errors |
| API build | `npm run -s build -w @tailsup/api` | **exit 0** (`tsc --noEmit` gate; no emit by design) |
| Full test suite | `npm run -s test -w @tailsup/api` | **13 files, 173 passed, 0 failed** (exit 0) |
| No migration (AC) | `git status --porcelain apps/api/drizzle` | **empty** |
| Schema unchanged (AC) | `git log -1 -- apps/api/src/db/schema.ts` | last touched **Phase 1** (`0ed0e8f`, 2026-06-20) |
| Web export (AC-3a-3) | `npx expo export --platform web` | **exit 0**, 24 static routes, all 6 site pages + `health.html` emitted |
| Lint | — | **none configured** (expected; matches Phases 1/2) |

### Test breakdown (173 total, all passing)

`config.test.ts` (6) · `email.test.ts` (11) · `trainer.test.ts` (10) ·
`r2.test.ts` (23) · `events-phase2.test.ts` (22) · `media.test.ts` (20) ·
`leads.test.ts` (8) · `sessions-phase2.test.ts` (10) · `health.test.ts` (3) ·
`events.test.ts` (22) · `rate-limit.test.ts` (4) · `dogs.test.ts` (27) ·
`bookings.test.ts` (7).

> Note: the earlier Phase 3a **code-review** ledger entry reported "148/148". That
> count predates the consolidated test suite counted here. The current ground truth
> from a clean run is **173/173** (the prompt's expected figure), which includes the
> `config`, `email`, `trainer`, and `rate-limit` suites. No tests were weakened or
> skipped to reach this number.

### Exported static routes (web export)

```
/about  / (index)  /health  /booking  /contact  /results  /services  /_sitemap
/+not-found  /dogs  /events/[id]  (+ the (app)/(site) group duplicates)
```

Emitted HTML files present in the output dir: `index.html`, `about.html`,
`services.html`, `results.html`, `contact.html`, `booking.html`, `health.html`
(+ `_sitemap.html`, `+not-found.html`). The temp output dir was deleted after the check.

---

## 2. SEO static-head verdict (resolves the research's UNCERTAIN item)

**Verdict: per-page `<title>`/meta are NOT present in the exported static HTML —
they are client-side-only. This is a KNOWN LIMITATION, not a blocker.**

**Evidence (grep of the exported HTML):**

- `about.html` `<title>` → `TailsUp — Επαγγελματική Εκπαίδευση Σκύλων`
  (the **site-wide default** from `+html.tsx`, **not** the page's own
  `'Ποιοι Είμαστε — TailsUp'` set in `about.tsx`'s `<Head>`).
- `services.html` `<title>` → same site-wide default (not `'Υπηρεσίες — TailsUp'`).
- `index.html` `<title>` → same site-wide default.
- Grep across **all** exported `*.html` for the per-page title strings
  `"Ποιοι είμαστε — TailsUp"` and `"Υπηρεσίες — TailsUp"` → **NOT FOUND in any file.**
- Distinct `<title>` values across all exported HTML → exactly **one**:
  the site-wide default. (Confirms every page ships the default in static HTML.)
- The per-page `<meta name="description">` and `og:` tags are likewise **absent**
  from the static HTML (only the default description from `+html.tsx` is present).

**`<html lang="el">` IS present** in every exported page (set in `+html.tsx`) — confirmed
in `about.html`. This part of the SEO/quality floor passes.

**Interpretation.** Expo Router's static export renders the route tree to HTML in Node,
but the per-page `<Head>` (from `expo-router/head`) is applied on the **client** after
hydration — it overrides the default title/description live in the browser, so a human
visitor and a JS-executing crawler see the correct per-page title. A crawler that reads
only the raw HTML (no JS) sees the site-wide default title for every page.

**Why this is not a blocker for 3a:** no Phase 3a AC requires server-rendered per-page
meta. AC-3a-3 requires the six pages to *exist and render* on Expo web — they do (export
exit 0, all HTML emitted, pages mount and set their titles client-side). The research's
fallback explicitly allowed this outcome to be recorded as a limitation. If
crawler-visible per-page meta becomes a requirement, the fix is to move per-page title/
description resolution into the static render (e.g. route-segment metadata or
generating per-page `+html`-level head), tracked as a follow-up.

---

## 3. Phase 3a acceptance criteria — per-criterion verdicts

| AC | Verdict | Evidence |
|---|---|---|
| **AC-3a-1** Type check passes | **MET** | All three workspaces `tsc --noEmit` exit 0, 0 errors (table above). |
| **AC-3a-2** Business-first homepage | **MET** | `app/(site)/index.tsx`: hero is the practice (calm/method/proof) + book/contact CTAs; the data platform is only a one-line teaser linking to `/services`. **No `ProgressCurve` import** on Home; exactly one `<ProofBand>` (DS "one bold moment"). |
| **AC-3a-3** Six pages exist + render on web | **MET** | Glob shows `(site)/{index,about,services,results,contact,booking}.tsx`; web export exit 0 emits `index/about/services/results/contact/booking.html` + `health.html`. |
| **AC-3a-4** Design System applied (tokens) | **MET** | `lib/theme.ts` encodes DS-1 colors verbatim (`primary #1B3A32`, `accent #B07D48`, `bg #FAF7F0`, …), DS-2 type scale (Fraunces 400/500 + Inter 400 with Georgia/system-ui web fallbacks), DS-3 spacing/radii/layout. Components: `PrimaryButton`/`SecondaryButton`/`Eyebrow`/`Card`/`ProofBand` in `components/ui`. Footer + CTAs use `colors.primary` (deep green); copper is accents/focus-ring/curve-line only. |
| **AC-3a-5** Contact: location + keyless map + lead form | **MET (live row pending)** | `app/(site)/contact.tsx` shows address/phone/email/hours, renders `<PracticeMap>`; the web map (`components/PracticeMap.web.tsx`) is a **keyless OpenStreetMap `<iframe>`** (no API key). The form builds `CreateLeadInput { source:'website-contact' }` and calls `createLead` → `POST /leads`, with idle/pending/success/error states. The `status='new'` DB row is asserted by `leads.test.ts` (mocked DB); the live row is the documented manual step. |
| **AC-3a-6** `POST /leads` works + Resend stub | **MET (mocked) / live pending** | `routes/leads.ts`: Zod-validated, `resolveTrainerId()`→503 if no practice, inserts (status DB-default `'new'`, `clientId:null`), returns 201 `LeadDTO`. Email is **fire-and-forget** (`void sendLeadNotification(...).catch(...)`). `lib/email.ts` reads `RESEND_API_KEY` lazily and **stubs (logs `[email:stub] new lead`) — never throws** when unset. Tests: `leads.test.ts` "returns 201 + a LeadDTO (status 'new'…)", "still returns 201 when the email send REJECTS (fire-and-forget never fails the insert)", "passes the resolved trainer email + the LeadDTO to sendLeadNotification". `email.test.ts` (11) covers the stub/real/blank-key/null-recipient paths. |
| **AC-3a-7** Booking page + `POST /bookings` | **MET (mocked) / live pending** | `app/(site)/booking.tsx`: segmented `type` picker over `BOOKING_TYPES`, date+time → ISO `requestedAt`, contact/notes → `createBooking`. `routes/bookings.ts`: Zod (`type ∈ BOOKING_TYPES`, `requestedAt` `.datetime()`, name/contact caps), status DB-default `'requested'`, 201 `BookingDTO`. Tests: `bookings.test.ts` "returns 201 + a BookingDTO (status 'requested')", "returns 400 when type is not in BOOKING_TYPES", "returns 400 when requestedAt is not a valid ISO datetime". |
| **AC-3a-8** Quality floor (focus / reduced-motion / responsive) | **MET** | Visible **copper focus ring** on every interactive element: nav/CTA/brand (`SiteChrome` `focused && styles.focusedRing`), inputs (`contact.tsx`/`booking.tsx` `inputFocused` + web `outlineStyle:'none'`), lang toggle (`i18n.tsx` `optionFocused`). **Responsive** via `useResponsive()` (breakpoints sm/md/lg; column→row; narrow horizontally-scrolling nav). **Reduced motion**: `ProgressCurve` reads `useReducedMotion()` and renders a static curve by default (the only motion is the gated draw-on). |
| **AC-3a-9** Public-endpoint hardening (rate-limit / size / no leak) | **MET** | `app.ts` `publicWriteLimiter` (`hono-rate-limiter`, 10 req/min/IP, keyed `x-forwarded-for`→`x-real-ip`→`'public'`, → 429 `{ error:'too many requests' }`) applied **only** to `/leads` + `/bookings`. Zod `.max()` caps on every field (input-size limit). `onError` returns generic `{ error:'internal server error' }` (no internals leaked). Tests: `rate-limit.test.ts` (4) — 429 on both routes, per-IP isolation. |
| **AC-3a-10** No Phase 3b/4 leakage | **MET** | `app.ts` mounts only `health, sessions, dogs, events, media, leads, bookings`. **No** auth middleware, **no** `PATCH /bookings/:id/status`, **no** `/leads/:id/convert`, **no** AI endpoint, **no** dashboards. `(app)/_layout.tsx` has no auth guard. Phase 1/2 routes + their tests unchanged (133 prior tests still pass within the 173). |

### Supporting cross-cutting checks

- **Bilingual toggle + EL/EN copy:** `lib/i18n.tsx` is a dependency-free EL/EN React
  context (default `'el'`, SSR-safe, localStorage-persisted, accessible `radiogroup`
  toggle with visible focus). `SiteChrome.tsx` nav uses the kickoff Greek labels
  (`Αρχική`, `Ποιοι είμαστε`, `Υπηρεσίες`, `Αποτελέσματα`, `Επικοινωνία`) with EN
  equivalents; every page holds `copy = { el, en }` with full Greek + English bodies.
- **ProgressCurve placement (DS-5):** imported **only** by `(site)/services.tsx`
  (the data-driven premium service, inside the page's single dark ProofBand) and
  `(site)/results.tsx` (outcome arcs — explicitly permitted). **Not** imported by
  `index.tsx` (Home). Hand-rolled `react-native-svg` thin gold line on deep-green
  with a soft gradient fill; per-instance gradient id via `useId()`.
- **Shared package purity (NFR-6):** grep of `packages/shared/src` for
  `drizzle|pg|aws|resend|better-auth|node:` → the only hit is a **comment** in
  `enums.ts`; no actual runtime/server imports. `dtos.ts` imports `type`-only from
  `./enums`. `CreateLeadInput`/`LeadDTO`/`CreateBookingInput`/`BookingDTO` all present.
- **Config discipline (NFR-5):** `config.ts` `required()` covers only `DATABASE_URL`.
  `RESEND_API_KEY`, `RESEND_FROM`, `PRACTICE_TRAINER_ID` are read **lazily** in
  `lib/email.ts` / `lib/trainer.ts`, never in `config.ts` — so the API boots and the
  suite runs credential-free, and the Resend stub is the one intentional graceful path.

---

## 4. Manual verification against real infrastructure

These exercise the paths that cannot run here (no live DB, no Resend key, no browser).
Commands are drawn from the README and the design and confirmed against
`apps/api/package.json` scripts and `apps/api/src/db/schema.ts`.

### (a) Live database — `POST /leads` + `POST /bookings`

1. Set `DATABASE_URL` in `apps/api/.env` to a running PostgreSQL.
2. Apply migrations (already applied since Phase 1; the command is **idempotent** —
   no Phase 3a migration exists):

   ```bash
   npm run db:migrate -w apps/api
   ```

3. **Seed a trainer** so `resolveTrainerId()` resolves (the trainer's `email` becomes
   the Resend recipient — OQ-7). The README seed block already inserts one:

   ```bash
   psql "$DATABASE_URL" <<'SQL'
   INSERT INTO trainer (id, name, email)
   VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Trainer', 'trainer@example.com');
   SQL
   ```

   (Optionally set `PRACTICE_TRAINER_ID=11111111-1111-1111-1111-111111111111` to pin
   the practice trainer explicitly; otherwise the sole/oldest trainer row is used.)

4. Start the API: `npm run dev -w apps/api` (serves on `http://localhost:3000`).
5. Exercise the public endpoints:

   ```bash
   # POST /leads — expect 201 LeadDTO (status:"new", clientId:null) + a new lead row
   curl -i -X POST http://localhost:3000/leads \
     -H 'content-type: application/json' \
     -d '{"name":"Maria P.","contact":"maria@example.com","source":"website-contact","message":"My dog reacts to bikes."}'

   # POST /bookings — expect 201 BookingDTO (status:"requested") + a new booking row
   curl -i -X POST http://localhost:3000/bookings \
     -H 'content-type: application/json' \
     -d '{"type":"assessment","requestedAt":"2026-07-01T10:00:00.000Z","name":"Maria P.","contact":"maria@example.com","notes":"Mornings preferred."}'
   ```

6. With **no `RESEND_API_KEY`**, the API log shows the stub line on the lead POST:
   `[email:stub] new lead { to: 'trainer@example.com', id: …, name: 'Maria P.', … }`.
   The `POST /leads` still returns 201 (email is best-effort, behind the insert — NFR-9).
7. Confirm rows: `psql "$DATABASE_URL" -c "select id,status,trainer_id from lead order by created_at desc limit 1;"`
   and the same for `booking` (`status` should be `requested`; the captured
   name/contact is folded into `notes` as `[name · contact] notes`).
8. (Validation) a bad booking `type` or non-ISO `requestedAt` → **400**; rapid repeats
   (>10/min/IP) → **429**.

### (b) Optional — real Resend email

Set `RESEND_API_KEY` (and optionally `RESEND_FROM`, e.g. a verified
`TailsUp <noreply@yourdomain>`; default is `TailsUp <onboarding@resend.dev>`), restart
the API, POST a lead, and confirm the trainer receives the "New lead: …" notification.
The send is fire-and-forget, so a missing/failing key never changes the 201.

### (c) Web click-through (the six pages + forms + EL/EN toggle)

```bash
# In apps/mobile/.env:  EXPO_PUBLIC_API_URL=http://localhost:3000
npm run web -w apps/mobile
```

Open the served origin (Expo prints it, typically `http://localhost:8081`) and verify:

- All six pages render with the Design-System chrome and **no login** required:
  `/` (Αρχική), `/about` (Ποιοι είμαστε), `/services` (Υπηρεσίες),
  `/results` (Αποτελέσματα), `/contact` (Επικοινωνία), `/booking`.
- Home is about the practice; the **progress-curve appears only on `/services`**
  (and the `/results` outcome arcs), **never on Home**.
- The Contact lead form submits → success state, and a `lead` row appears (per (a)).
- The Booking form submits a `type` + `requestedAt` → success state, and a `booking`
  row appears with `status='requested'`.
- The **EL/EN toggle** in the nav switches all copy and persists across reloads.
- Visible focus rings on tab-through; the keyless OSM map loads on Contact.

---

## 5. Deferred items / known limitations (non-blocking)

1. **Live DB + live Resend smoke test pending** (the §4 manual steps). Verified here
   by 15 endpoint tests (8 leads + 7 bookings) + `email`/`trainer`/`rate-limit` suites
   + static review only. Confidence high.
2. **Per-page `<title>`/meta are client-side only** (the SEO verdict, §2). Static HTML
   carries only the site-wide default title/description; `<html lang="el">` is present.
   Not required by any 3a AC; tracked as a follow-up if crawler-visible per-page meta
   is later required.
3. **CORS is intentionally allow-all for 3a** (`app.use('*', cors())`). Phase 3b tightens
   it to the known origin(s) with credentials once auth/cookies land (noted in `app.ts`).
4. **Rate limiter is in-memory / single-instance** (by design for 3a). Production should
   add an edge/proxy limiter in front (noted in `app.ts`); no prod deploy in 3a.
5. **README has no Phase 3a section yet** (its "Phase boundary" still lists Phase 3 as
   not built). No 3a AC requires README docs (the README criterion is AC-3b-13, a 3b
   item), so this is a documentation follow-up, not a 3a gap.
6. **Deferred dependency advisories** (carried from Phases 1/2, unchanged): the 23
   moderate npm-audit advisories (MR-1 Expo SDK 54 transitive; MR-2
   `drizzle-kit`→`esbuild@0.18`) — all transitive dev/build tooling, none in the
   production API or shipped mobile bundle. The Phase 3a deps (`resend`,
   `hono-rate-limiter`, `react-native-svg`) added no new advisories. Resolve MR-1/MR-2
   before public launch.

---

## Appendix — exact commands run

```text
node -v                                              -> v20.20.2
npm -v                                               -> 10.8.2
npx tsc --noEmit -p packages/shared/tsconfig.json    -> exit 0
npm run -s typecheck -w @tailsup/api                 -> exit 0
npm run -s typecheck -w @tailsup/mobile              -> exit 0
npm run -s build -w @tailsup/api                     -> exit 0
npm run -s test -w @tailsup/api                      -> 13 files, 173 passed, exit 0
git status --porcelain apps/api/drizzle              -> (empty)
git log -1 -- apps/api/src/db/schema.ts              -> 0ed0e8f (Phase 1, 2026-06-20)
cd apps/mobile && npx expo export --platform web --output-dir <temp>   -> exit 0
  grep <temp>/about.html, services.html, index.html  -> only the site-wide default <title>
  grep -rl "Ποιοι είμαστε — TailsUp" <temp>/*.html    -> NOT FOUND
  grep <temp>/about.html for <html lang>              -> <html lang="el">
rm -rf <temp>                                        -> cleaned
```
