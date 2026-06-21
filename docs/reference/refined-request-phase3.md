# Refined Request: TailsUp — Phase 3: Public Site + Client View

## Category
Development

## Objective
Build **Phase 3 — Public site + Client view** of TailsUp: the public-facing **business website** for the dog-training practice (a real practice site, **not** an app showcase), the **lead/booking capture API** behind it, and then the **authentication layer plus role-scoped dashboards** that turn the existing trainer-only mobile app into a real two-audience product (trainer + client). All of this ships from **one Expo Router codebase** (the public web pages, the authed app, and the native app are the same project) and one Hono API. Phase 3 introduces the practice's **Design System** (the kickoff's color tokens, typography scale, spacing, components, and the signature progress-curve), self-hosted **BetterAuth** with `trainer`/`client` roles, **Resend** lead-notification email (stubbed when no key), and the lead/booking endpoints (`POST /leads`, `POST /bookings`, `PATCH /bookings/:id/status`, `POST /leads/:id/convert`). The decided architecture is fixed and must not be re-opened. The Anthropic AI summary endpoint and multi-tenant SaaS prep are **Phase 4** and out of scope.

Phase 3 is split into **two sequenced sub-phases with a review checkpoint between them** (see Scope): **Phase 3a — Public business website** (public, no auth) and **Phase 3b — App auth + dashboards** (BetterAuth + role-scoped dashboards). The recommended sequencing is **3a first, then 3b** (see the load-bearing decisions below).

---

## Load-bearing decisions to confirm at the design gate

These three decisions shape almost everything downstream and the orchestrator should confirm them before design begins:

- **LBD-1 — Sub-phase sequencing (3a then 3b).** Phase 3a (public website + `POST /leads` + `POST /bookings`) has **zero dependency on auth** and delivers the practice's externally visible product plus the data-capture funnel. Phase 3b (BetterAuth, dashboards, lead/booking management) depends on auth scaffolding and the existing trainer screens. **Recommended:** ship **3a first, STOP for review, then 3b.** They *can* ship together, but the 3a-first split de-risks the auth work (the biggest unknown) behind a working, demoable site and lets the practice go live with lead capture before dashboards exist. See OQ-12.
- **LBD-2 — How public web routes coexist with the authed app in ONE Expo Router tree.** This is the central architectural question of Phase 3. The kickoff fixes "App + Site = ONE Expo Router codebase." **Recommended:** an Expo Router **route-group** layout — a public group (e.g. `app/(site)/…` for `/`, `/about`, `/services`, `/results`, `/contact`, `/booking`) rendered with the Design System and **no auth guard**, and an authed group (e.g. `app/(app)/…`) hosting the existing trainer screens plus the new client dashboard, **guarded by a BetterAuth session check** that redirects unauthenticated users to a `/login` route. The existing Phase 2 screens (`dogs`, `dogs/[id]/timeline`, `sessions/[id]/log`, `events/[id]`) move under the authed group. The Phase 1 `/health` screen stays reachable. Web is the primary verification surface for the site; native still builds. See OQ-2 and OQ-3.
- **LBD-3 — BetterAuth session strategy across Expo web vs native.** BetterAuth is self-hosted on the Hono API. The session-token transport differs between the **web** target (cookies, same-site/CORS-sensitive) and the **native** target (no cookie jar; bearer token in secure storage). **Recommended:** use BetterAuth's Expo integration / bearer-token plugin so native stores the session token in secure storage and sends it as a header, while web uses cookies; the API trusts both. The current allow-all `cors()` in `apps/api/src/app.ts` must be **tightened to the known web origin(s) with credentials enabled** once cookies are in play. See OQ-1 and OQ-9.

---

## Phase 1 + 2 ground truth (what already exists — do not rebuild)

This refinement is grounded in the actual committed code, not just the design docs.

- **API app composition:** `apps/api/src/app.ts` builds the Hono app, applies `cors()` (currently **allow-all**), mounts route sub-apps via `app.route('/', …)` (`health`, `sessions`, `dogs`, `events`, `media`), and installs a JSON `onError` (HTTPException passthrough + 500) and `notFound` (404 `{ error: 'not found' }`). Entry/serve is `apps/api/src/index.ts` (Node, `@hono/node-server`, `process.env.PORT` default 3000). The CORS comment already flags: *"Phase 3 should restrict this to the known site/app origins once auth/cookies are introduced."*
- **Config:** `apps/api/src/config.ts` reads env through a `required()` helper that **throws** on any missing required var (currently only `DATABASE_URL`; `PORT` is the lone optional). R2 vars are read **lazily** in `apps/api/src/lib/r2.ts` (throw-on-missing at call time, mapped to 503), deliberately kept out of `config.ts` so the API boots and tests run without R2 creds. Phase 3 must apply the **same throw-on-missing discipline** to `AUTH_SECRET` (auth cannot run without it) and to `RESEND_API_KEY` **only as a graceful stub** (the kickoff says email is *stubbed when absent* — so Resend must NOT be in the throw-on-missing required set; it degrades to a logged no-op when unset).
- **Schema (`apps/api/src/db/schema.ts`):** 11 application tables + 6 pgEnums. The **`lead` and `booking` tables already exist** (created in Phase 1) with exactly these columns:
  - **`lead`**: `id` (uuid PK), `trainerId` (uuid, NOT NULL, FK → trainer), `name` (text), `contact` (text, free-text email/phone), `source` (text, NOT NULL), `message` (text, nullable), `status` (`lead_status` enum, default `'new'`), `clientId` (uuid, nullable, FK → client — set on conversion), `createdAt` (timestamptz, defaultNow).
  - **`booking`**: `id` (uuid PK), `trainerId` (uuid, NOT NULL, FK → trainer), `leadId` (uuid, nullable, FK → lead), `clientId` (uuid, nullable, FK → client), `type` (`booking_type` enum, NOT NULL — no default), `requestedAt` (timestamptz, NOT NULL — no default), `status` (`booking_status` enum, default `'requested'`), `notes` (text, nullable), `createdAt` (timestamptz, defaultNow).
  - Relevant enums (already in `@tailsup/shared`): `LEAD_STATUSES = ['new','contacted','converted','lost']`, `BOOKING_TYPES = ['assessment','private','group']`, `BOOKING_STATUSES = ['requested','confirmed','declined','completed','cancelled']`.
  - Other tables Phase 3b reads: `homework` (`id`, `dogId` FK, `exerciseId` FK, `completed` bool default false, `completedAt` nullable), `exercise` (`id`, `protocolId` FK, `title`, `instructions`), `client` (`id`, `trainerId` FK, `name`, `contact`), `dog`, `session`, `behaviorEvent` (carries `thresholdMeters`, `occurredAt`, `intensity`, `outcome` — the data behind the client's threshold-over-time graph and the site's progress-curve).
  - **No BetterAuth tables exist yet** — its CLI/migration owns them (Phase 1 design deliberately hand-authored none to avoid collisions).
- **Shared package (`packages/shared/src`):** `enums.ts` (6 const arrays + union types) and `dtos.ts` (Phase 1 + Phase 2 DTOs), barrel `index.ts`. **Pure TS only — zero server/runtime imports (Metro-safe).** New Phase 3 DTOs go here. File is `dtos.ts` (plural).
- **Mobile (`apps/mobile`):** Expo Router SDK ~54. `app/_layout.tsx` is a single `<Stack>` in `<SafeAreaProvider>` registering the Phase 1 `/health` (`index`) screen + the Phase 2 trainer screens (`dogs/index`, `dogs/[id]/timeline`, `sessions/[id]/log`, `events/[id]`). `lib/api.ts` is a typed fetch client over `EXPO_PUBLIC_API_URL` (static dot-access) returning `@tailsup/shared` DTOs and throwing a typed `ApiError`; `lib/upload.ts` handles the direct-to-R2 upload. **Trainer context is the Phase 2 stop-gap `EXPO_PUBLIC_TRAINER_ID`** (read statically in `lib/api.ts` as `TRAINER_ID`) — Phase 3b **replaces this with the authenticated trainer's id from the session.** Deps already include `expo-image-picker`, `expo-file-system`, `expo-video`. **No auth, no charting library, no Design System / theme module, no web-specific pages exist yet.**
- **Conventions:** singular table names; camelCase TS → snake_case columns (`casing: 'snake_case'`); Zod + `@hono/zod-validator`, reusing `@tailsup/shared` arrays; ESM `.js` import specifiers in `apps/api`; static `EXPO_PUBLIC_*` dot-access in mobile; JSON error bodies `{ error: '…' }`; UUID PKs; TS strict everywhere; throw-on-missing config (no fallbacks). Root `npm run typecheck --workspaces` and `npm run test --workspaces` fan out. `apps/api` test runner is **vitest** (133 tests passing as of Phase 2).
- **Env template (`.env.example`):** already lists `AUTH_SECRET` ("Phase 3 only — not read in Phase 1") and `RESEND_API_KEY` ("Phase 3 only — stubbed when absent"), plus `DATABASE_URL`, the R2 vars, `EXPO_PUBLIC_API_URL`. Phase 3 will start *reading* `AUTH_SECRET` and `RESEND_API_KEY` and may add new documented vars (e.g. an auth base URL / allowed web origin, an `EXPO_PUBLIC_*` for the contact details if not hard-coded — see OQ-7/OQ-9).

---

## Scope

### In scope — Phase 3a (Public business website + lead/booking capture API)

**Website (public Expo Router web routes, no auth) — the practice's real business site:**
1. **Home / Αρχική** — the practice's homepage: who the practice is, the headline promise (calm, expert, trustworthy dog training), primary CTAs (request a booking / contact). The data-tracking platform is **NOT** the homepage message — it is one service surfaced later. One bold "proof" moment per the Design System.
2. **About / Ποιοι είμαστε** — the practice, its method, the trainer(s), credentials/approach. "Proof not promises" tone.
3. **Services / Υπηρεσίες** — the service catalogue. **The data-driven progress-tracking platform appears here as ONE premium service** (not the hero), and **this is the only section that features the signature progress-curve visual** (threshold-over-time, thin gold line on deep-green with soft gradient fill — proof of method, not decoration). Other services (assessments, private/group sessions per `BOOKING_TYPES`) sit alongside it as peers.
4. **Results / Αποτελέσματα** — case studies / outcomes, rendered with **tasteful placeholder data** (clearly placeholder, structured so real case studies can replace it later). May reuse the progress-curve to show an outcome arc.
5. **Contact / Επικοινωνία (πού θα μας βρείτε)** — practice location: **address, an embedded map, opening hours, phone/email**, plus the **lead form** that submits `POST /leads`. The map embed must work **without an API key** (see OQ-6).
6. **Booking** — an appointment-request form that submits `POST /bookings` with `status: 'requested'` (server default), capturing booking `type` (`assessment|private|group`), requested date/time (`requestedAt`), and contact info / notes.
7. **Design System applied to every page** — the kickoff's tokens, type scale, spacing, components, principles (see the Design System requirements section). A shared theme/style module is created (currently none exists) and consumed by all site pages.

**API (the capture endpoints behind 3a) — both PUBLIC, unauthenticated:**
8. **`POST /leads`** (PUBLIC) — inserts a `lead` (status `'new'`), then sends a **Resend** email notification to the trainer. When `RESEND_API_KEY` is unset, the email path is a **logged no-op stub** (insert still succeeds). Returns the created `LeadDTO`.
9. **`POST /bookings`** (PUBLIC) — inserts a `booking` with `status: 'requested'`. Returns the created `BookingDTO`.

### In scope — Phase 3b (App auth + role dashboards + lead/booking management)

**Auth (BetterAuth, self-hosted on the Hono API):**
10. **BetterAuth integration** with roles **`trainer`** and **`client`**: its tables created via its own migration (committed under `apps/api/drizzle/`), mounted into the Hono app, signing with `AUTH_SECRET` (now required). Email/password is the baseline credential method (see OQ-4). Sessions work on **both Expo web (cookies) and native (bearer token in secure storage)** per LBD-3.
11. **Auth UI in the Expo app** — a `/login` route and session handling: an authenticated `trainer` lands on the trainer screens; an authenticated `client` lands on the client dashboard; unauthenticated users hitting authed routes are redirected to `/login`. The public site routes remain reachable without auth.
12. **Replace the `EXPO_PUBLIC_TRAINER_ID` stop-gap** — trainer-scoped reads/writes (`GET /trainers/:trainerId/dogs`, etc.) now resolve the trainer from the authenticated session rather than the build-time env var. Client-scoped reads resolve the client from the session. The path-param endpoints may stay (now authorized against the session) or move to `/me/*` (see OQ-10).

**Client dashboard (Expo app, role `client`):**
13. **Threshold-over-time graph** — a chart of the client's dog's `behaviorEvent.thresholdMeters` over `occurredAt` (the longitudinal progress view; the data counterpart of the site's progress-curve). Requires a client-scoped read endpoint (see FR-A-CLIENT-1).
14. **Homework list** — the dog's `homework` rows (joined to `exercise` for title/instructions) with completion state, and the ability to mark an item complete (sets `completed=true`, `completedAt=now`).
15. **Reminders** — surfaced reminders for the client (e.g. pending homework, upcoming/confirmed bookings). The reminders **mechanism** is an open question with a recommended in-app derived default (see OQ-11) — no push-notification infra is required for Phase 3.

**Trainer management (Expo app, role `trainer`):**
16. **Leads & bookings management view** — the trainer lists incoming `lead`s and `booking`s, **approves/updates bookings** (`PATCH /bookings/:id/status` → `confirmed|declined|completed|cancelled`), and **converts a lead to a client** (`POST /leads/:id/convert`).

**API (TRAINER-auth endpoints behind 3b):**
17. **`PATCH /bookings/:id/status`** (TRAINER auth) — transitions a booking's status to `confirmed|declined|completed|cancelled`. Returns the updated `BookingDTO`.
18. **`POST /leads/:id/convert`** (TRAINER auth) — creates a `client` from the `lead` (trainer = the authenticated trainer / the lead's trainer), sets `lead.status='converted'` and `lead.clientId` to the new client's id. Returns the created `ClientDTO` (and/or the updated `LeadDTO`).
19. **Trainer/client read endpoints for the management view and dashboards** — list a trainer's leads, list a trainer's bookings, plus the client-scoped reads the dashboard needs (FR-A-CLIENT-1/2/3). Exact shapes below.

### Out of scope (deferred — NOT built in Phase 3)
- **AI summary** — `POST /dogs/:id/summary` (claude-haiku-4-5), the JSON-serialization-to-Haiku flow, and the spend-cap reminder. **Phase 4.**
- **Multi-tenant SaaS** preparation/refactor. **Phase 4.**
- **Self-service client account creation / password reset flows beyond the baseline** unless trivially provided by BetterAuth (clients are expected to originate from trainer-side conversion; see OQ-4/OQ-5).
- **Online payments / scheduling-calendar integration** (bookings are *requests* a trainer manually approves; no calendar sync, no payment).
- **A CMS / admin UI to edit website copy** — site content is authored in-code for Phase 3 (Results uses placeholder data).
- **Push notifications / SMS / email reminders to clients** — reminders are in-app/derived for Phase 3 (OQ-11). (Trainer lead-notification email via Resend IS in scope.)
- **Production deploy to Railway / a real domain.** Acceptance is local-run + tests, consistent with Phases 1–2. (Email and map can be exercised with a real key/embed if available, else stubbed/documented.)
- **Image (non-video) media, offline write queue, editing the four tap fields** — unchanged from Phase 2 scope.

---

## Requirements

### Functional requirements — Website (Phase 3a)

**FR-W1 — Route structure under one Expo Router tree.** The six public pages are Expo Router routes in a **public route group** that renders the Design System chrome (header/nav with Greek labels, footer in deep green) and applies **no auth guard** (LBD-2). Recommended paths: `/` (Home), `/about`, `/services`, `/results`, `/contact`, `/booking`. They build and render on **Expo web** (the primary verification surface) and remain part of the same project that builds native.

**FR-W2 — Home / Αρχική is business-first.** The homepage communicates the **dog-training practice** (who we are, the promise, primary CTAs to book/contact). It does **NOT** lead with "an app" or "a data platform." At most one bold/proof moment (Design System: "spend boldness in one place"). The data platform is referenced only as a path into Services.

**FR-W3 — About / Ποιοι είμαστε.** Presents the practice, method, and trainer(s) with the calm/precise/specialist tone; "proof not promises." Content authored in-code.

**FR-W4 — Services / Υπηρεσίες with tracking-as-a-service.** Lists the practice's services as peers. **One** of them is the **data-driven progress-tracking premium service**, and **this section is the only place** the **signature progress-curve** visual appears (FR-W8). Other services map naturally to the booking types (`assessment`, `private`, `group`). Each service can route the visitor to **Booking** with the relevant `type` preselected (nice-to-have; not required).

**FR-W5 — Results / Αποτελέσματα.** Renders case studies from **clearly-structured placeholder data** (e.g. an in-code array of `{ dogName, summary, before/after, curveData }`) so real outcomes can replace it without layout changes. Tasteful, not fabricated-looking testimonials. May reuse the progress-curve to depict an outcome arc.

**FR-W6 — Contact / Επικοινωνία.** Shows the practice **address, opening hours, phone, email**, and an **embedded map centered on the address that requires no API key** (OQ-6). Includes the **lead form**: fields for `name`, `contact` (email/phone), an optional `message`, and a `source` value the page sets (e.g. `'website-contact'`). On submit it calls `POST /leads`; shows pending/success/error states; on success confirms the lead was received. Honors `prefers-reduced-motion` and visible focus.

**FR-W7 — Booking page.** A form capturing booking `type` (`assessment|private|group` from `BOOKING_TYPES`), a requested date/time (mapped to `requestedAt`, ISO), contact info, and optional `notes`. On submit it calls `POST /bookings` (server defaults `status='requested'`); shows pending/success/error states; on success confirms the request was received and that the practice will respond. (A booking from the public site has no authenticated user; how `trainerId` is set is OQ-8.)

**FR-W8 — Signature progress-curve component.** A reusable progress-curve visual: a **thin gold line** on a **deep-green background** with a **soft gradient fill**, plotting threshold-over-time. It is "proof of method," appears **only** in the Services data-service section (and optionally Results), respects `prefers-reduced-motion` (no/again-reduced animation), and renders on web. (This is a presentational chart fed by sample/placeholder data on the public site; the *client dashboard's* live threshold chart is FR-C1 and may share the component.)

**FR-W9 — Design System theme module.** A single shared theme/style module (none exists today) encodes the tokens, type scale, spacing, radii, and component primitives (buttons, eyebrow label, card, dark proof-band) so every page is consistent. See the Design System requirements section for the exact values.

**FR-W10 — Bilingual labels.** Page names/nav use the Greek labels from the kickoff (Αρχική, Ποιοι είμαστε, Υπηρεσίες, Αποτελέσματα, Επικοινωνία) alongside the build's route names. Full i18n is **not** required; the Greek nav labels and page headings are. (Confirm copy language scope — OQ-13.)

### Functional requirements — API for 3a (PUBLIC capture)

**FR-A1 — `POST /leads` (PUBLIC).** Body `CreateLeadInput` `{ name, contact, source, message? }` (+ `trainerId` resolution per OQ-8). Validates with Zod (`name`/`contact`/`source` non-empty). Inserts a `lead` with `status='new'`, `clientId=null`. **Then** triggers a Resend email notification to the trainer ("new lead received" with the lead details). If `RESEND_API_KEY` is unset, the email is a **logged no-op stub** and the insert still returns success (the kickoff: "stub if no key"). Email failure must **not** fail the request (insert is the source of truth; email is best-effort, logged). Returns `201` `LeadDTO`.

**FR-A2 — `POST /bookings` (PUBLIC).** Body `CreateBookingInput` `{ type, requestedAt, notes? }` (+ contact capture and `trainerId` resolution per OQ-8; a public booking may also create/attach a lead — see OQ-8). Validates `type ∈ BOOKING_TYPES` and `requestedAt` is a valid ISO datetime. Inserts a `booking` with `status='requested'` (server default), `leadId`/`clientId` nullable. Returns `201` `BookingDTO`.

**FR-A3 — Public-endpoint hardening.** `POST /leads` and `POST /bookings` are unauthenticated and internet-facing, so they must be **rate-limit-aware** (a basic per-IP throttle / abuse guard) and validate/limit input sizes. CORS must permit the site's web origin (see FR-A11 below). No secret or internal detail leaks in responses/errors.

### Functional requirements — Auth (Phase 3b)

**FR-AUTH1 — BetterAuth self-hosted with roles.** Integrate BetterAuth on the Hono API with a role attribute supporting `trainer` and `client`. Its schema is generated and applied as a **committed Drizzle migration** under `apps/api/drizzle/` (no hand-authored auth tables; avoid collisions with the 11 app tables). Mount its handler routes in `apps/api/src/app.ts`. `AUTH_SECRET` becomes **required** (throw-on-missing) wherever auth is initialized.

**FR-AUTH2 — Session transport on web + native (LBD-3).** Web uses cookies; native uses a bearer token persisted in Expo secure storage and sent as an Authorization header. Use BetterAuth's Expo support to cover both. The API authenticates a request from whichever transport is present.

**FR-AUTH3 — Login screen + guards (LBD-2).** A `/login` route (Design-System styled) authenticates a user. After login, role determines the landing area (trainer screens vs client dashboard). An auth guard on the authed route group redirects unauthenticated users to `/login`; public site routes are never guarded.

**FR-AUTH4 — Trainer/client context from session (replaces stop-gap).** The Phase 2 `EXPO_PUBLIC_TRAINER_ID` mechanism is **removed from the runtime auth path**: trainer-scoped data resolves from the authenticated trainer; client-scoped data resolves from the authenticated client. (`EXPO_PUBLIC_TRAINER_ID` may remain only as a dev/seed convenience, not as the production trainer-context source.)

**FR-AUTH5 — Authorization on protected endpoints.** Trainer-only endpoints (`PATCH /bookings/:id/status`, `POST /leads/:id/convert`, trainer list/read endpoints) require a `trainer` session and operate scoped to that trainer's data. Client-scoped endpoints require a `client` session and only expose that client's own dog(s)/homework/events. A request with the wrong/absent role → `401`/`403`.

**FR-AUTH6 — CORS tightening.** The current allow-all `cors()` is replaced with an origin allow-list (the site/app web origin[s]) **with credentials enabled** so cookie-based auth works cross-origin (the app.ts comment already anticipates this). Native (no CORS) is unaffected.

### Functional requirements — Client dashboard (Phase 3b)

**FR-C1 — Threshold-over-time graph.** The client dashboard renders a line chart of `thresholdMeters` vs `occurredAt` for the client's dog (longitudinal progress). Data comes from a client-scoped read (FR-A-CLIENT-1). Honors `prefers-reduced-motion`; renders on web. May reuse the FR-W8 progress-curve component styled to the Design System.

**FR-C2 — Homework list.** Lists the dog's `homework` joined to `exercise` (`title`, `instructions`) with completion status, ordered sensibly (incomplete first, or by created order). The client can mark an item complete; this persists `completed=true`, `completedAt=now` via a client-auth mutation (FR-A-CLIENT-2). Completed items show their `completedAt`.

**FR-C3 — Reminders.** Surfaces reminders for the client — at minimum **pending homework** and **upcoming/confirmed bookings** — derived in-app or from a lightweight read (no push infra; OQ-11). Reminders are read-only prompts that deep-link to the relevant dashboard section.

**FR-C4 — Client navigation.** A client landing/dashboard route (under the authed group) presenting the graph, homework, and reminders. A client only ever sees their own data (FR-AUTH5).

### Functional requirements — Trainer management (Phase 3b)

**FR-T1 — Leads list & convert.** A trainer screen lists the trainer's `lead`s (newest first, with `status`). The trainer can **convert** a `new`/`contacted` lead via `POST /leads/:id/convert`, after which the lead shows `converted` and links to the created client. Surfaces success/error.

**FR-T2 — Bookings list & status management.** A trainer screen lists the trainer's `booking`s (with `type`, `requestedAt`, `status`). The trainer can transition a booking via `PATCH /bookings/:id/status` to `confirmed|declined|completed|cancelled`. Surfaces success/error and reflects the new status. (Confirming a booking does not auto-create a session in Phase 3 unless trivially desired — out of scope; keep to status only.)

**FR-T3 — Management entry point.** The trainer area gains navigation to the leads/bookings management screens alongside the existing dogs/timeline/log screens, all under the authed group.

### Functional requirements — API for 3b (TRAINER/CLIENT auth)

**FR-A4 — `PATCH /bookings/:id/status` (TRAINER auth).** Body `UpdateBookingStatusInput` `{ status }` where `status ∈ {confirmed, declined, completed, cancelled}` (a Zod enum derived from `BOOKING_STATUSES` minus `requested`, or the full set validated against allowed transitions — see OQ-14). Verifies the booking belongs to the authenticated trainer (`404` if not found / not theirs). Updates `status`. Returns `200` `BookingDTO`.

**FR-A5 — `POST /leads/:id/convert` (TRAINER auth).** Verifies the lead belongs to the authenticated trainer (`404` otherwise). Creates a `client` (`trainerId` = the lead's trainer, `name` = lead `name`, `contact` = lead `contact`). Sets `lead.status='converted'` and `lead.clientId` = the new client id. Idempotency/already-converted handling per OQ-15 (recommended: `409`/no-op if already `converted`). Returns `201` with the created `ClientDTO` (and the updated lead, or `{ client, lead }`). Done in a transaction.

**FR-A6 — `GET /trainers/:trainerId/leads` (TRAINER auth).** Returns the trainer's leads as `LeadDTO[]`, newest first. Scoped to the authenticated trainer (the `:trainerId` must match the session, or use `/me/leads` per OQ-10).

**FR-A7 — `GET /trainers/:trainerId/bookings` (TRAINER auth).** Returns the trainer's bookings as `BookingDTO[]`, newest first.

**FR-A-CLIENT-1 — Client progress read (CLIENT auth).** Returns the authenticated client's dog progress series for the graph: at minimum `{ dog: DogSummaryDTO, points: { occurredAt: string; thresholdMeters: number; intensity: number; outcome: Outcome }[] }` ordered chronologically. Recommended route `GET /me/dog/progress` or `GET /clients/:clientId/progress` (OQ-10). Only the client's own dog(s).

**FR-A-CLIENT-2 — Homework read + complete (CLIENT auth).** `GET` the client's dog homework (joined to exercise) → `HomeworkDTO[]`; and a mutation to mark complete (e.g. `PATCH /homework/:id` `{ completed: true }`) that verifies the homework belongs to the client's dog (`404`/`403` otherwise), sets `completedAt=now`, returns the updated `HomeworkDTO`.

**FR-A-CLIENT-3 — Reminders read (CLIENT auth) [if not purely client-derived].** If reminders are server-derived (OQ-11), a `GET /me/reminders` returning `ReminderDTO[]`. If client-derived from FR-A-CLIENT-1/2 + bookings, no new endpoint is needed.

**FR-A8 — Validation & errors.** All new bodies/params validated with `@hono/zod-validator` + Zod, reusing `@tailsup/shared` arrays (`BOOKING_TYPES`, `BOOKING_STATUSES`, `LEAD_STATUSES`). Invalid input → `400`; unknown id → `404`; auth failures → `401`/`403`; all with the standard `{ error: '…' }` body.

**FR-A9 — Routing/registration.** New routes are Hono sub-apps in `apps/api/src/routes/*` mounted via `app.route('/', …)` in `app.ts` (e.g. `routes/leads.ts`, `routes/bookings.ts`, `routes/clients.ts` or `routes/me.ts`, plus the BetterAuth handler mount). Reuse the existing `cors()` (now restricted), `onError`, `notFound`. Auth middleware guards the protected sub-apps.

**FR-A10 — Email service module.** A small `apps/api/src/lib/email.ts` (or `resend.ts`) wraps Resend with the **lazy throw-or-stub** discipline: if `RESEND_API_KEY` is set, send via Resend; if unset, log a structured stub and return success. The Resend SDK lives only in `apps/api` (never in `@tailsup/shared`/mobile). Mirrors the lazy-config pattern of `lib/r2.ts`.

**FR-A11 — Shared DTOs.** Add to `packages/shared/src/dtos.ts` (pure TS, no runtime imports), re-exported via the barrel:
- `LeadDTO`, `CreateLeadInput`
- `BookingDTO`, `CreateBookingInput`, `UpdateBookingStatusInput`
- `ClientDTO`
- `ConvertLeadResponse` (e.g. `{ client: ClientDTO; lead: LeadDTO }`)
- `HomeworkDTO` (incl. joined exercise `title`/`instructions`, `completed`, `completedAt`)
- `ClientProgressDTO` (dog + threshold/occurredAt points for the graph)
- `ReminderDTO` (if server-derived reminders are chosen)
- `AuthUserDTO` / `SessionUserDTO` as needed to type the app's session (id, role, name)
Existing enums (`LEAD_STATUSES`/`LeadStatus`, `BOOKING_TYPES`/`BookingType`, `BOOKING_STATUSES`/`BookingStatus`, `OUTCOMES`/`Outcome`) are reused unchanged. **No new enums needed** for Phase 3 unless OQ-4 introduces a role enum (recommended `ROLES = ['trainer','client']` const array added to `enums.ts`).

### Proposed API contracts (request/response shapes)

> All JSON, timestamps ISO strings. Status codes: `200` reads/updates, `201` creates, `400` validation, `401`/`403` auth, `404` unknown id, `409` conflict (already-converted), `429` rate-limited (public), `5xx` internal. `trainerId` resolution for public writes is OQ-8.

```jsonc
// POST /leads  (PUBLIC)   body CreateLeadInput   -> 201 LeadDTO
// request:
{ "name": "Maria P.", "contact": "maria@example.com", "source": "website-contact", "message": "My dog reacts to bikes." }
// response (LeadDTO):
{
  "id": "uuid", "trainerId": "uuid", "name": "Maria P.", "contact": "maria@example.com",
  "source": "website-contact", "message": "My dog reacts to bikes.",
  "status": "new", "clientId": null, "createdAt": "ISO"
}

// POST /bookings  (PUBLIC)   body CreateBookingInput   -> 201 BookingDTO
// request:
{ "type": "assessment", "requestedAt": "2026-07-01T10:00:00.000Z",
  "name": "Maria P.", "contact": "maria@example.com", "notes": "Mornings preferred." }
// response (BookingDTO):
{
  "id": "uuid", "trainerId": "uuid", "leadId": "uuid|null", "clientId": "uuid|null",
  "type": "assessment", "requestedAt": "ISO", "status": "requested",
  "notes": "Mornings preferred.", "createdAt": "ISO"
}

// PATCH /bookings/:id/status  (TRAINER auth)   body UpdateBookingStatusInput   -> 200 BookingDTO
{ "status": "confirmed" }   // one of confirmed|declined|completed|cancelled

// POST /leads/:id/convert  (TRAINER auth)   -> 201 ConvertLeadResponse
{
  "client": { "id": "uuid", "trainerId": "uuid", "name": "Maria P.", "contact": "maria@example.com" },
  "lead":   { /* LeadDTO with status:"converted", clientId:<new client id> */ }
}

// GET /trainers/:trainerId/leads     (TRAINER auth) -> 200 LeadDTO[]   (newest first)
// GET /trainers/:trainerId/bookings  (TRAINER auth) -> 200 BookingDTO[](newest first)

// GET /me/dog/progress (or /clients/:clientId/progress)  (CLIENT auth) -> 200 ClientProgressDTO
{
  "dog": { /* DogSummaryDTO */ },
  "points": [ { "occurredAt": "ISO", "thresholdMeters": 5, "intensity": 7, "outcome": "recovered_slowly" } ]
}

// GET /me/homework (CLIENT auth) -> 200 HomeworkDTO[]
{ "id": "uuid", "dogId": "uuid", "exerciseId": "uuid",
  "title": "Engage-disengage", "instructions": "…",
  "completed": false, "completedAt": null }
// PATCH /homework/:id (CLIENT auth) body { "completed": true } -> 200 HomeworkDTO (completedAt set)
```

### Design System — captured as requirements (from the kickoff)

> A shared theme module (currently none) must encode these. Premium, refined, calm, precise — a **trustworthy specialist brand, not a "cute" pet brand**. Avoid the cliché cream + terracotta look; **deep green is the differentiator**.

**DS-1 — Color tokens (exact values).**
```
--color-bg:           #FAF7F0
--color-bg-alt:       #F0EADD
--color-surface:      #FFFFFF
--color-primary:      #1B3A32   (deep green — weight/trust: CTA, footer, dark proof band)
--color-primary-soft: #3D5249
--color-accent:       #B07D48   (copper — SMALL details ONLY; never large copper surfaces)
--color-accent-soft:  #E8C9A0
--color-mint:         #9FC4B5
--color-text:         #1B3A32
--color-text-muted:   #6B7D74
--color-border:       rgba(27,58,50,0.12)
```
Deep green carries weight/trust (CTAs, footer, the dark "proof" band). Copper is for small details only — never large copper surfaces.

**DS-2 — Typography.** Display = **Fraunces** (fallback Georgia), headings only, weight 400–500, letter-spacing -0.02em. Body = **Inter** (fallback system-ui), weight 400, line-height 1.6. Scale: H1 44–48 / H2 27–32 / H3 18–20 / body-lg 16 / body 14–15 / eyebrow 12.5 uppercase ls 0.16em / caption 11.5. (Font loading on Expo web via `expo-font` or web font links — confirm in design; fallbacks must be acceptable if a font fails to load — quality floor.)

**DS-3 — Spacing & layout.** Spacing scale: xs 8 / sm 16 / md 24 / lg 32 / xl 54 / 2xl 80. Radii: radius 6 / radius-lg 14. Max widths: max-width 1080 / max-prose 720.

**DS-4 — Components.**
- **Primary button:** green bg (`--color-primary`), off-white text, radius 6, padding 13/28.
- **Secondary button:** transparent, 1px border.
- **Eyebrow label:** copper, uppercase, letter-spacing 0.16em.
- **Card:** white surface, 0.5px border (`--color-border`), radius-lg.
- **Dark proof-band:** used **ONCE per page** maximum.

**DS-5 — Signature progress-curve.** Threshold-over-time visual: **thin gold line** on a **deep-green** background with a **soft gradient fill**. It is **proof of method, not decoration**, and appears in the **data-driven service section only** (Services), optionally reused for an outcome arc in Results and the client dashboard. (See FR-W8 / FR-C1.)

**DS-6 — Principles (enforceable).** Spend boldness in one place (one bold moment per page). Whitespace = premium (generous spacing per DS-3). **Proof not promises** (show data/outcomes, avoid hype copy). **Quality floor:** responsive, **visible focus** states, respect **`prefers-reduced-motion`**. Motion is subtle.

**DS-7 — Business-first principle.** The homepage is about the **practice**, not the app. The data platform is **ONE premium service**, surfaced in Services — never the homepage's main message. This is a hard content constraint, verifiable by inspection (AC-3a-2).

### Non-functional requirements

**NFR-1 — Premium quality floor on every page.** All site pages and dashboards are **responsive** (web breakpoints), have **visible focus** states on interactive elements, and **respect `prefers-reduced-motion`** (no essential information conveyed only by motion; animations reduced/disabled when the user prefers). Per the kickoff's quality floor. Subtle motion only.

**NFR-2 — Public endpoints are rate-limit-aware and abuse-resistant.** `POST /leads` and `POST /bookings` apply a basic per-IP throttle and input-size limits; they never leak internal detail; a flood does not take down the API or spam the trainer's inbox uncontrollably (email is best-effort and behind the insert).

**NFR-3 — Auth security.** `AUTH_SECRET` is required (throw-on-missing) and never logged/committed. Sessions are httpOnly/secure cookies on web and secure-storage bearer tokens on native (LBD-3). CORS is restricted to known origins with credentials (FR-AUTH6). Role checks are enforced **server-side** on every protected endpoint (never trusted from the client). Passwords (if email/password) are handled by BetterAuth (hashed; never stored/logged in plaintext).

**NFR-4 — TypeScript strict everywhere.** All new code type-checks under `strict: true` with zero errors across `@tailsup/shared`, `apps/api`, `apps/mobile`. New DTOs are the single source of truth for the new request/response shapes. No `any` on API responses in the mobile client.

**NFR-5 — No config fallbacks (except documented optionals + the email stub).** `AUTH_SECRET` and any required auth/CORS-origin vars are read through throw-on-missing config (no silent defaults). `RESEND_API_KEY` is the **one intentional graceful degradation**: unset → logged stub, by explicit kickoff requirement ("stub if no key"). No fabricated URLs/keys.

**NFR-6 — `@tailsup/shared` stays pure (Metro-safe).** Phase 3 adds only types/const arrays to `@tailsup/shared` — **no** BetterAuth, Resend SDK, charting lib, `drizzle`, `pg`, AWS SDK, or Node built-ins. Auth client code, the Resend SDK, and the charting library live in `apps/mobile` / `apps/api` only.

**NFR-7 — Consistency with Phase 1/2 conventions.** Singular tables; camelCase→snake_case; Zod reusing shared arrays; ESM `.js` specifiers in api; static `EXPO_PUBLIC_*` dot-access in mobile; JSON `{ error }` bodies; UUID PKs; throw-on-missing config; vitest for api tests. Newest-first reads reuse existing indexes where applicable; new query paths avoid N+1.

**NFR-8 — One codebase, no second framework.** No Next.js / separate web app. The public site, the authed app, and native all build from `apps/mobile` (Expo Router). The site must build and render on Expo web; native builds must not break (the authed screens still work on native).

**NFR-9 — Email is best-effort, insert is source of truth.** A failed/stubbed Resend send never fails `POST /leads`; the lead row is always persisted and returned.

---

## Constraints

### Architecture — DECIDED and NON-NEGOTIABLE (do not re-open)
- **App + Site = ONE Expo Router codebase** (iOS/Android/web). Public pages and authed app are route groups in `apps/mobile`. **No separate Next.js site.**
- **API = Hono + TypeScript** on Railway (scale-to-zero), composed in the existing `apps/api/src/app.ts`.
- **Database = PostgreSQL via Drizzle ORM.** The `lead` and `booking` tables **already exist** (Phase 1) — Phase 3 implements their endpoints, **no new app-table migration** for leads/bookings. BetterAuth's own tables are the **only** new schema, added via a committed migration generated by BetterAuth (not hand-authored).
- **Auth = BetterAuth (self-hosted)**, roles `trainer` | `client`. Sessions work on web (cookies) and native (bearer/secure-storage).
- **Email = Resend**, **stubbed when no `RESEND_API_KEY`** (logged no-op; insert still succeeds).
- **AI = Anthropic, deferred to Phase 4.** Do not build `POST /dogs/:id/summary` or the spend cap.
- **Media = R2 presigned, direct device→R2** (unchanged from Phase 2).

### Process / convention constraints
- **Phase 3 only**, split **3a → review → 3b** (LBD-1). Do not implement Phase 4 (AI/summary, multi-tenant).
- **Singular table names**; reuse the existing `lead`/`booking` columns verbatim (do not rename/add unless a genuine gap is found and documented as a committed migration).
- TypeScript strict; shared enums/DTOs in `packages/shared`, imported by both ends; `@tailsup/shared` stays pure.
- Secrets only in `.env`; start reading `AUTH_SECRET` (required) and `RESEND_API_KEY` (optional/stub). Document any new var (e.g. allowed web origin, auth base URL) in `.env.example`.
- Tighten CORS from allow-all to an origin allow-list with credentials once auth/cookies land.
- Provide exact run/test commands and verification steps for 3a and for 3b before declaring each done.

---

## Acceptance Criteria (Phase 3 — concrete, verifier-checkable)

### Phase 3a acceptance criteria

**AC-3a-1 — Type check passes.** `npm run typecheck --workspaces` passes with zero errors across `@tailsup/shared`, `apps/api`, `apps/mobile`, including the new public-site routes, the theme module, and the new lead/booking DTOs.

**AC-3a-2 — Business-first homepage (inspection).** The Home page's primary message is the **dog-training practice** (who we are + book/contact CTA). It does **not** present "an app" or "a data platform" as the hero. The data-tracking platform appears as **one service** under Services, and the **progress-curve visual appears only in that Services section** (and optionally Results) — verifiable by reading the rendered pages.

**AC-3a-3 — All six pages exist and render on Expo web.** `/` (Αρχική), `/about` (Ποιοι είμαστε), `/services` (Υπηρεσίες), `/results` (Αποτελέσματα), `/contact` (Επικοινωνία), `/booking` each render with the Design System chrome on `expo start --web`, with no auth required.

**AC-3a-4 — Design System applied (token check).** Pages use the exact tokens (deep green `#1B3A32` for CTAs/footer/proof-band; copper `#B07D48` only on small details; bg `#FAF7F0`), the type scale (Fraunces headings / Inter body with documented fallbacks), spacing scale, radii, and the component primitives (primary/secondary button, eyebrow, card, single dark proof-band per page). Verifiable in the theme module + page usage.

**AC-3a-5 — Contact page shows location + keyless map + working lead form.** The Contact page shows address, hours, phone, email, and an **embedded map that loads without an API key**. Submitting the lead form calls `POST /leads`, shows pending→success, and on success a `lead` row exists (`status='new'`).

**AC-3a-6 — `POST /leads` works + Resend stub.** With the API running and seed trainer present: `POST /leads` with a valid body returns `201` `LeadDTO` (`status:'new'`, `clientId:null`) and inserts the row. With `RESEND_API_KEY` **unset**, the request still returns `201` and a structured stub log is emitted (no throw). With a key set (if available), an email is dispatched (or documented as exercised). Email failure does not fail the insert.

**AC-3a-7 — Booking page + `POST /bookings`.** The Booking page submits `type`+`requestedAt`(+contact/notes); `POST /bookings` returns `201` `BookingDTO` with `status:'requested'` and inserts the row. Invalid `type` or `requestedAt` → `400`.

**AC-3a-8 — Quality floor.** Interactive elements have visible focus; animations respect `prefers-reduced-motion`; pages are responsive at narrow and wide widths. Verifiable on Expo web.

**AC-3a-9 — Public-endpoint hardening present.** `POST /leads`/`POST /bookings` enforce a basic rate limit / input-size guard (demonstrable: rapid repeated calls are throttled or capped) and never leak internals.

**AC-3a-10 — No Phase 3b/Phase 4 leakage in 3a.** 3a ships **no** auth middleware, no dashboards, no `PATCH /bookings/:id/status`, no `/leads/:id/convert`, no AI endpoint. The Phase 1/2 endpoints and trainer screens keep working unchanged.

### Phase 3b acceptance criteria

**AC-3b-1 — Type check passes.** `npm run typecheck --workspaces` passes with zero errors including auth code, dashboards, management screens, and the new auth/management DTOs.

**AC-3b-2 — BetterAuth tables via committed migration.** BetterAuth's tables are created by a **committed Drizzle migration** under `apps/api/drizzle/` and apply cleanly to a DB that already has the 11 app tables, with no name collisions. No auth tables are hand-authored. `AUTH_SECRET` is required (the API throws on startup/auth-init if unset).

**AC-3b-3 — Login + role routing (web + native build).** On Expo web, `/login` authenticates a user; a `trainer` lands on the trainer screens, a `client` on the client dashboard. An unauthenticated request to an authed route redirects to `/login`. Public site routes remain reachable without auth. The native build still compiles and the authed screens render with a session (bearer/secure-storage) per LBD-3.

**AC-3b-4 — Session works on web (cookies) and native (bearer).** A logged-in web session persists across reloads via cookie; a native session persists via secure storage and is sent as a bearer header. The API authenticates both. CORS is restricted to the known origin(s) with credentials enabled (no longer allow-all).

**AC-3b-5 — Stop-gap replaced.** Trainer-scoped reads/writes resolve the trainer from the session (not `EXPO_PUBLIC_TRAINER_ID`). Demonstrable: with the env var unset, an authenticated trainer still sees their dogs/leads/bookings.

**AC-3b-6 — Role-scoped authorization enforced server-side.** A `client` session cannot call trainer endpoints (`PATCH /bookings/:id/status`, `POST /leads/:id/convert`, trainer lists) → `401`/`403`. A `trainer` cannot read another trainer's leads/bookings (→ `404`/`403`). A `client` only sees their own dog's progress/homework. Verified by request, not just UI.

**AC-3b-7 — `PATCH /bookings/:id/status`.** An authenticated trainer transitions one of their bookings to `confirmed|declined|completed|cancelled`; returns `200` `BookingDTO` with the new status and persists it. Invalid status → `400`; not-theirs/unknown → `404`.

**AC-3b-8 — `POST /leads/:id/convert`.** An authenticated trainer converts one of their `new` leads: returns `201`, a `client` row is created (`trainerId`=lead's trainer, name/contact from the lead), the lead now has `status='converted'` and `clientId`=the new client id (one transaction). Already-converted → handled per OQ-15 (recommended `409`/no-op). Not-theirs/unknown → `404`.

**AC-3b-9 — Trainer management screens.** On Expo web (trainer session), the trainer sees a leads list and a bookings list, can convert a lead (reflected as `converted` + linked client) and change a booking's status (reflected in the list).

**AC-3b-10 — Client dashboard renders graph + homework + reminders.** On Expo web (client session): a threshold-over-time chart of the client's dog renders from real `behaviorEvent` data; the homework list renders (with exercise title/instructions) and a "mark complete" sets `completed=true`/`completedAt`; reminders surface pending homework and confirmed/upcoming bookings. The client sees only their own data.

**AC-3b-11 — Shared DTOs present and pure.** `@tailsup/shared` exports `LeadDTO`, `CreateLeadInput`, `BookingDTO`, `CreateBookingInput`, `UpdateBookingStatusInput`, `ClientDTO`, `ConvertLeadResponse`, `HomeworkDTO`, `ClientProgressDTO`, (and `ReminderDTO`/`AuthUserDTO` if used). A grep finds no `drizzle`/`pg`/`aws`/`resend`/`better-auth`/`node:` import in `@tailsup/shared`.

**AC-3b-12 — Tests + phase boundary.** New api tests (vitest) cover the lead/booking/convert/status/client-read endpoints (incl. auth/role rejection and validation paths); `npm run test --workspaces` passes. **No** Phase 4 feature is implemented (no `POST /dogs/:id/summary`, no spend cap, no multi-tenant). Existing Phase 1/2 endpoints/tests keep passing.

**AC-3b-13 — Run/test docs updated.** The README documents: seeding a trainer + client + dog + protocol + homework/exercise graph; creating trainer and client auth accounts (with roles); the exact commands to run the API and the app; how to log in as each role on web; the CORS/origin and `AUTH_SECRET` setup; the Resend stub vs real-key behavior; and how to verify AC-3b-3..AC-3b-10.

---

## Assumptions
- **[3a then 3b]** — Phase 3 ships as 3a first (public site + capture), STOP for review, then 3b (auth + dashboards). Basis: LBD-1; de-risks the auth unknown behind a demoable site. (Confirm vs. ship-together — OQ-12.)
- **[Route-group coexistence]** — Public site and authed app live in one Expo Router tree via route groups, with an auth guard only on the authed group. Basis: LBD-2 and the fixed "one Expo codebase" architecture.
- **[lead/booking tables reused as-is]** — `POST /leads`/`POST /bookings`/`PATCH /bookings/:id/status`/`POST /leads/:id/convert` use the existing Phase 1 columns; no migration for these tables. Basis: confirmed in `apps/api/src/db/schema.ts`.
- **[BetterAuth owns its schema]** — Auth tables come from BetterAuth's generated, committed migration; none are hand-authored. Basis: Phase 1 design deliberately authored no auth tables to avoid collisions.
- **[Resend lazy stub]** — `RESEND_API_KEY` is read lazily (like R2 in `lib/r2.ts`); unset → logged no-op, insert still succeeds; never in the throw-on-missing required set. Basis: kickoff "stub if no key" + NFR-9.
- **[Charting on web]** — A lightweight RN/web-compatible chart (or a hand-rolled SVG curve) renders the threshold series and the progress-curve; it lives in `apps/mobile` only and works on Expo web. Basis: no chart lib exists today; NFR-6 keeps it out of shared.
- **[Web is the primary verification surface]** — As in Phases 1/2, Expo **web** is sufficient to verify the site and dashboards; native must still build and the authed screens render with a session. Basis: D-5 precedent.
- **[Seed graph + accounts]** — A seed script / documented inserts provide at least one trainer, one client (linked to a dog with sessions, events, homework, exercises) and the matching auth accounts for both roles, so the dashboards and management views have data. Basis: there is no UI to create the org graph; dashboards need real rows.
- **[Greek nav + headings, in-code copy]** — Page nav labels and headings use the kickoff's Greek names; full i18n is not required; site copy is authored in-code. Basis: kickoff page list is bilingual; no CMS in scope. (Confirm — OQ-13.)
- **[Bookings stay requests]** — Confirming a booking only changes status; it does not auto-create a `session` or sync a calendar. Basis: scheduling/calendar/payments are out of scope.

---

## Open Questions (with recommended defaults)

1. **OQ-1 — BetterAuth session strategy (web cookies vs native bearer).** **Recommended:** use BetterAuth's Expo integration so native uses a bearer token in Expo secure storage and web uses httpOnly cookies; the API trusts both. (LBD-3.) Confirm before wiring auth so the mobile client and CORS are built once.
2. **OQ-2 — Route-group layout for site vs app coexistence.** **Recommended:** `app/(site)/*` (public, Design-System chrome, no guard) + `app/(app)/*` (authed; existing trainer screens move here; new client dashboard added) + a top-level `/login`. The Phase 1 `/health` screen stays reachable (under `(app)` or as a dev route). (LBD-2.) Confirm the exact grouping at the design gate.
3. **OQ-3 — Default landing route per target/role.** When the app opens with no session: web → public Home (`/`); native → `/login` (native has no public-site purpose) or also Home? **Recommended:** web defaults to Home; native defaults to `/login`. Post-login: `trainer`→trainer dogs list; `client`→client dashboard. Confirm.
4. **OQ-4 — Credential method + a role enum.** Email/password only, or also magic-link/social? **Recommended:** email/password baseline (simplest, lowest maintenance); add a `ROLES = ['trainer','client'] as const` array to `@tailsup/shared/enums.ts` so role strings are shared. Confirm whether magic-link is wanted for clients.
5. **OQ-5 — How client accounts come into being.** Self-signup, or trainer-provisioned on conversion? **Recommended:** clients are **trainer-provisioned** — `POST /leads/:id/convert` creates the `client` row; a client auth account is then issued (invite/initial-password flow) tied to that client. Public self-signup is out of scope. Confirm the exact account-issuance step (it touches FR-A5).
6. **OQ-6 — Keyless embedded map.** **Recommended:** an OpenStreetMap `<iframe>` embed (no API key) for the Contact map, or a static map image; avoid Google Maps Embed (needs a key) for Phase 3. Confirm the map provider.
7. **OQ-7 — Where do the practice contact details + the trainer recipient come from?** Address/hours/phone/email and the lead-notification recipient. **Recommended:** author the public contact details in-code (site content), and use the **seed trainer's email** as the Resend recipient (looked up via the lead's `trainerId`). Confirm whether contact details should instead come from the `trainer` row / an env var.
8. **OQ-8 — `trainerId` for PUBLIC `POST /leads` and `POST /bookings` (single-practice).** With no authenticated user and one practice, which trainer owns a public lead/booking? **Recommended:** resolve to the **single/primary seeded trainer** (the practice). For bookings, optionally also create/attach a `lead` from the booking's contact so leads and bookings stay linked. Confirm the trainer-resolution rule and whether a public booking auto-creates a lead.
9. **OQ-9 — CORS allowed origin(s) + new env var.** Restricting CORS needs the web origin(s). **Recommended:** add a documented `WEB_ORIGIN` (or `ALLOWED_ORIGINS`) env var (comma-separated), default the dev value to the Expo web origin; enable `credentials`. Confirm the var name and dev origin.
10. **OQ-10 — Path-param vs `/me/*` for authed reads.** Keep `GET /trainers/:trainerId/*` (authorized against the session) or switch to `/me/*` (id from session)? **Recommended:** add `/me/*` for client reads (`/me/dog/progress`, `/me/homework`, `/me/reminders`) and **authorize the existing `:trainerId` trainer routes against the session** (reject if `:trainerId` ≠ session trainer) to minimize churn to Phase 2 routes. Confirm.
11. **OQ-11 — Reminders mechanism.** Server-derived endpoint, or client-derived from existing data? **Recommended:** **client-derived** for Phase 3 (compute from homework + confirmed/upcoming bookings already fetched) — no new endpoint, no push infra. Add `GET /me/reminders` only if a server-side rule set is wanted. Confirm.
12. **OQ-12 — Ship 3a and 3b together or 3a first?** **Recommended:** **3a first, STOP for review, then 3b** (LBD-1). Confirm; if "together," collapse the two review gates into one.
13. **OQ-13 — Copy language scope.** Greek nav/headings only, or full Greek (or Greek+English) body copy on every page? **Recommended:** Greek nav labels + page headings (as the kickoff names them) with in-code body copy in Greek; no runtime language switcher. Confirm the desired language(s).
14. **OQ-14 — Booking status transitions.** Free transition to any of `confirmed|declined|completed|cancelled`, or enforce a state machine (e.g. can't `complete` a `declined`)? **Recommended:** validate the target ∈ the four allowed values; **do not** enforce a strict state machine in Phase 3 (keep it simple). Confirm.
15. **OQ-15 — Convert idempotency.** Converting an already-`converted` lead. **Recommended:** **`409`** (or a no-op returning the existing client) rather than creating a duplicate client. Confirm.
16. **OQ-16 — Charting library vs hand-rolled SVG.** A dependency (e.g. `victory-native`/`react-native-svg`-based) or a hand-rolled SVG path for the threshold line and the progress-curve? **Recommended:** a small `react-native-svg`-based hand-rolled curve (full control over the gold-line-on-green Design-System look, web-compatible, minimal deps). Confirm the approach.

---

## Original Request
> Refine **Phase 3 — Public site + Client view** of TailsUp into a structured, development-oriented specification.
>
> Context to read first (all under `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/`):
> - `prompts/001-tailsup-kickoff.md` — AUTHORITATIVE. Phase 3 is defined under "Build order" AND the detailed **"The Website"** section AND the **"Design System"** section (color tokens, typography scale, spacing, components, the signature progress-curve, principles). Read all three carefully.
> - `docs/reference/refined-request-phase2.md` + `docs/design/project-design.md` — what Phases 1+2 built (api on Hono+Drizzle with health/events/media/reads/start-session; `@tailsup/shared` enums+DTOs; Expo Router mobile with health + 4-tap/timeline/detail screens; trainer context via EXPO_PUBLIC_TRAINER_ID; no auth yet; CORS enabled).
> - The data model already has `lead` and `booking` tables (created in Phase 1) — Phase 3 implements their endpoints; verify their columns in `apps/api/src/db/schema.ts`.
>
> **Architecture is DECIDED/fixed** (do not re-open): ONE Expo Router codebase serves app + public website (NO separate Next.js); BetterAuth self-hosted with roles `trainer`|`client`; Resend for email (stub when no key); Anthropic deferred to Phase 4.
>
> Scope **Phase 3** as the deliverable. It has TWO clear workstreams — **propose and structure a sub-phase split** so the user gets a review checkpoint:
> - **Phase 3a — Public business website** (public, no auth): the pages from the kickoff's "The Website" section — **Home/Αρχική**, **About/Ποιοι είμαστε**, **Services/Υπηρεσίες** (with the **data-driven progress-tracking as ONE premium service**, featuring the signature progress-curve visual), **Results/Αποτελέσματα** (case studies w/ tasteful placeholder data), **Contact/Επικοινωνία** (πού θα μας βρείτε: address, embedded map, hours, phone/email + the **lead form** → `POST /leads`), **Booking** (appointment request → `POST /bookings`, status "requested"). Apply the **Design System** to every page. CRITICAL framing from the kickoff: this is a real **business website for a dog-training practice**, NOT an app showcase — the homepage is about the practice; the data platform is ONE premium service, not the homepage's message. Plus the API: `POST /leads` (PUBLIC, then a Resend email notification to the trainer — stub if no key) and `POST /bookings` (PUBLIC, defaults status "requested").
> - **Phase 3b — App auth + dashboards**: **BetterAuth** with roles trainer/client; **client dashboard** (threshold-over-time graph, homework list, reminders); **trainer view** to list/approve leads & bookings and convert leads. Plus the TRAINER-auth API: `PATCH /bookings/:id/status` (confirmed|declined|completed|cancelled), `POST /leads/:id/convert` (creates a Client from the Lead, sets lead.status=converted + lead.clientId). Note how Phase 2's `EXPO_PUBLIC_TRAINER_ID` stop-gap is replaced by real auth.
>
> Produce: clear in/out scope with the 3a/3b split; functional requirements (web pages + app screens + API); the new API endpoints with request/response shapes; new shared DTOs/enums needed; the **Design System** captured as requirements (tokens, type scale, components, the progress-curve, the business-first principle); non-functional requirements (premium/responsive/accessible/prefers-reduced-motion per the kickoff's quality floor; public endpoints rate-limit-aware; auth security; TS strict; no config fallbacks); constraints (fixed architecture; one Expo codebase; singular tables; lead/booking tables already exist); assumptions; **open questions with recommended defaults** (e.g. BetterAuth session strategy on Expo native vs web; how the public web routes coexist with the authed app routes in one Expo Router tree; map embed approach without API keys; Results page placeholder data; reminders mechanism; whether 3a and 3b ship together or 3a first); and concrete **verifier-checkable acceptance criteria** for Phase 3 (split by 3a/3b).
>
> Out of scope: the Anthropic `/dogs/:id/summary` AI summary and spend cap (Phase 4); multi-tenant SaaS.
>
> Write the refined spec to `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/docs/reference/refined-request-phase3.md` and state the exact path when done. Surface the most load-bearing decisions (especially the 3a/3b sequencing and the BetterAuth-in-one-Expo-codebase routing) prominently so the orchestrator can confirm them at the design gate.

### Authoritative source documents
- Kickoff: `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/prompts/001-tailsup-kickoff.md`
- Phase 2 refined spec: `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/docs/reference/refined-request-phase2.md`
- Phase 1 technical design: `C:/Users/KonstantinaKirtsia/source/repos/tailsUp/docs/design/project-design.md`
- Implemented code referenced above: `apps/api/src/db/schema.ts`, `apps/api/src/app.ts`, `apps/api/src/config.ts`, `apps/api/src/lib/r2.ts`, `apps/api/src/routes/{dogs,events,media,sessions,health}.ts`, `packages/shared/src/{enums,dtos,index}.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/lib/{api,upload}.ts`, `.env.example`.
