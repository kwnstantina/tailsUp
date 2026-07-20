# Plan 004 — TailsUp Phase 3b-2: Role Dashboards + Lead/Booking Management

> **Status:** Plan for review at the **design gate**. This is the Claude-executable implementation plan for **Phase 3b-2 — Client dashboard + Trainer lead/booking management** of TailsUp. It is grounded in the actual committed Phase 1/2/3a/3b-1 code (verified against the live files on branch `phase/3b1-auth-foundation`), and consumes the auth foundation that 3b-1 shipped (BetterAuth on Hono, session middleware, role guards, the `(site)`/`(app)` route groups, `/login`).
>
> **Prerequisite:** 3b-1's one pending manual check — a live-DB sign-in smoke test — should pass first (see `docs/reference/integration-verification-phase3b1.md` §4). 3b-2 builds directly on the auth links (`session.user.trainerId` / `session.user.clientId`), so a verified sign-in de-risks everything here.
>
> **Build scope: Phase 3b-2 ONLY** — the role dashboards + the TRAINER/CLIENT-auth endpoints they need. **Already shipped (3b-1), do NOT rebuild:** BetterAuth, `/login`, session middleware, `requireTrainer`/`requireClient`/`requireTrainerOwnsParam`, credentialed CORS, the `/client` placeholder, the retirement of `EXPO_PUBLIC_TRAINER_ID`. **NOT this cycle (Phase 4):** `POST /dogs/:id/summary` (Anthropic), the AI spend cap, multi-tenant SaaS prep.
>
> **Inputs (authoritative — read in full before executing):**
> - Refined spec: `docs/reference/refined-request-phase3.md` (use the **Phase 3b** scope: FR-AUTH*, FR-C1..C4, FR-T1..T3, FR-A4/A5/A6/A7, FR-A-CLIENT-1/2/3, the proposed API contracts, and the **AC-3b-*** criteria)
> - Functional ledger: `docs/design/project-functions.md`
> - 3b-1 verification (what already exists): `docs/reference/integration-verification-phase3b1.md`
> - Design System authority: `prompts/001-tailsup-kickoff.md` ("Design System" section) + the live `apps/mobile/lib/theme.ts`
> - Prior plan for conventions + the DS token contract: `docs/design/plan-003-tailsup-phase3a-public-site.md`

---

## ⛔ DESIGN GATE — decisions needing user sign-off BEFORE execution

These choices shape the API surface, the data written, and the screens. Each restates the load-bearing decision and the recommended default this plan bakes in. **Reply "approved"** to proceed with all defaults, or name the ones to change.

| # | Decision | This plan assumes | Impact if changed |
| --- | --- | --- | --- |
| **DG-1 — Client-login provisioning is a SEPARATE action from lead conversion** | `POST /leads/:id/convert` creates the **domain `client` row** + flips the lead to `converted` (no auth account). A distinct **`POST /clients/:id/login`** (trainer auth) then issues the BetterAuth login with a **trainer-supplied initial password**, linked to that client via the `clientId` field. Matches the memory decision ("a trainer 'create client login' action — trainer sets the client's initial password"). | If convert should also mint the login in one step, fold `CreateClientLoginInput` into the convert body and drop `POST /clients/:id/login`. |
| **DG-2 — `/me/*` for client reads; keep `/trainers/:trainerId/*` for trainer reads** | Client endpoints live under **`/me/*`** (id from session — no path param to spoof), guarded by `requireClient`. Trainer list reads stay at **`GET /trainers/:trainerId/leads|bookings`**, already covered by the 3b-1 `requireTrainerOwnsParam` guard on `/trainers/:trainerId/*`. The three trainer *mutations* (convert / status / create-login) live under `/leads`, `/bookings`, `/clients` prefixes that collide with the PUBLIC `POST /leads` + `POST /bookings`, so they carry **route-scoped `requireTrainer`** (not a prefix `app.use`) to avoid guarding the public POSTs. | If everything should be `/me/*` symmetric, the Phase-2/3a route churn grows and the public-POST collision must be re-solved. |
| **DG-3 — Reminders are CLIENT-DERIVED (no endpoint, no table)** | The client dashboard computes reminders **in-app** from the data it already fetches: pending homework (`completed=false`) + upcoming/confirmed bookings (`GET /me/bookings`, status `confirmed`/`requested` with `requestedAt` in the future). No `ReminderDTO`, no `GET /me/reminders`, no push infra (OQ-11 recommended default). | If server-derived reminders are wanted, add `ReminderDTO` + `GET /me/reminders`; larger Unit B. |
| **DG-4 — Booking status: validate target ∈ 4 values, NO state machine** | `PATCH /bookings/:id/status` accepts `status ∈ {confirmed, declined, completed, cancelled}` (a Zod enum; `requested` is rejected as a target). No transition rules (e.g. can't-complete-a-declined) in 3b-2 (OQ-14). | If a state machine is wanted, add allowed-transition validation → more tests + a transition table. |
| **DG-5 — Convert idempotency: already-converted → `409`** | Converting a lead whose `status` is already `converted` returns **`409 { error }`** (no duplicate client) (OQ-15). Not-theirs / unknown → `404`. | If a no-op returning the existing client is preferred, return `200` with the existing `client`/`lead` instead of `409`. |
| **DG-6 — Client dashboard handles N dogs** | `GET /me/progress` returns **`ClientProgressDTO[]`** — one entry (dog + points) per dog the client owns (usually one). The dashboard renders each dog's `ProgressCurve`; with one dog it's a single panel, with several it stacks them. Avoids assuming exactly one dog per client. | If "one dog per client" is guaranteed, collapse to a single `ClientProgressDTO` and `GET /me/progress` returns one object. |
| **DG-7 — Trainer management lives under a new `(app)/manage/*` sub-route** | Two new authed screens: `(app)/manage/leads.tsx` + `(app)/manage/bookings.tsx`, reachable from the trainer's **My Dogs** screen header (and registered in `(app)/_layout.tsx`). The client never sees them (role-gated in-app; enforced server-side regardless). | If the trainer wants a single combined "Inbox" screen, merge the two into one `(app)/manage/index.tsx` with tabs. |

**Also confirm at the gate (no structural impact):**
- **DG-8 — Progress metric framing.** The graph plots `behaviorEvent.thresholdMeters` over `occurredAt`. In the seed the series **falls** over time (20m→6m) and the seed comment calls *rising* thresholds "progress" — so the axis semantics must be labelled ("closer coping distance = progress" or invert). Recommended: plot raw `thresholdMeters` chronologically and label the panel so a falling line reads correctly as improvement (the dog copes at ever-shorter distances). Confirm the framing/label copy.

**Resume signal:** reply **"approved"** to proceed with DG-1..DG-8 defaults, or name the ones to change.

---

## Objective

Deliver Phase 3b-2 of TailsUp: turn the authenticated shell from 3b-1 into a working **two-audience product** — a **client dashboard** (threshold-over-time graph reusing the 3a `ProgressCurve`, a homework list with mark-complete, and in-app derived reminders) and a **trainer management** area (list incoming leads + bookings, convert a lead to a client, provision that client's login, and transition a booking's status) — backed by the **role-scoped auth'd endpoints** they require, all type-checked under `strict` across `@tailsup/shared`, `apps/api`, `apps/mobile`, with **no schema migration** (every table already exists; auth tables landed in 3b-1's `0001_betterauth_tables`), and **no Phase 4 leakage** (no AI summary, no spend cap, no multi-tenant). Phases 1/2/3a and the 3b-1 auth foundation keep working unchanged.

**Why now:** 3b-1 proved sign-in and role routing work but every authed landing area is a placeholder. 3b-2 is what makes the login *worth* doing — it delivers the actual client value (see your dog's progress + do homework) and the trainer's daily workflow (triage the lead/booking funnel that 3a's public forms fill). It is the last phase before AI (Phase 4).

**Hard constraints (verifiable):**
- **Role enforcement is server-side (NFR-3 / AC-3b-6).** Every new client endpoint requires a `client` session; every trainer mutation requires a `trainer` session and verifies the target row belongs to that trainer. The mobile role-gating is UX only — never the security boundary.
- **The moat is read-only here.** The graph and homework reads never mutate `behaviorEvent` (the `intervention → outcome` linkage is never touched). The only client write is `homework.completed`/`completedAt`.
- **No migration.** `git status apps/api/drizzle` stays empty — 3b-2 reads/writes existing columns only.

---

## Context (read before executing)

@docs/reference/refined-request-phase3.md
@docs/reference/integration-verification-phase3b1.md
@docs/design/project-functions.md
@prompts/001-tailsup-kickoff.md
@docs/design/plan-003-tailsup-phase3a-public-site.md

**Ground-truth facts confirmed against the live code (do not re-derive):**

- **Auth foundation (3b-1) — reuse, do not rebuild.**
  - `apps/api/src/middleware/auth.ts` exports `AuthedUser`, `AppEnv` (`Variables: { user: AuthedUser | null }`), `getUser(c)`, `sessionMiddleware`, `requireAuth`, `requireTrainer`, `requireClient`, `requireTrainerOwnsParam`. Guards read `c.get('user')` (populated globally by `sessionMiddleware`) and return `401`/`403` `{ error }`. **`AuthedUser` carries `id, email, name, role, trainerId, clientId`** — `trainerId`/`clientId` are the domain links (nullable). Type the new sub-apps `new Hono<AppEnv>()` so `c.get('user')` is typed.
  - `apps/api/src/app.ts` already: credentialed `cors({ origin: config.allowedOrigins, credentials: true })`, global `sessionMiddleware`, the `/api/auth/*` handler, and prefix guards `app.use('/trainers/:trainerId/*', requireTrainerOwnsParam)`, `app.use('/dogs|/sessions|/events|/media/*', requireTrainer)`. **`GET /trainers/:trainerId/leads|bookings` are therefore already trainer-guarded** by the existing `/trainers/:trainerId/*` rule — just add the route handlers. **Mount the two new sub-apps (`management`, `me`) here** + add exactly one new prefix guard: `app.use('/me/*', requireClient)`.
  - `apps/api/src/lib/auth.ts` — the BetterAuth instance. `user.additionalFields` = `role` (default `'client'`), `trainerId`, `clientId`, all `input:false` (set server-side only). Login creation = `auth.api.signUpEmail({ body: { email, password, name } })` **then** a Drizzle `update(userTable).set({ role, clientId })` patch — **this is the exact pattern `seed.ts` uses** (`ensureAuthUser`); the trainer create-login endpoint mirrors it.
  - `apps/api/src/db/auth-schema.ts` exports `user` (import as `userTable`) for the role/link patch.
- **Route template = `apps/api/src/routes/dogs.ts`.** `export const dogs = new Hono()`; `zValidator('json', zObj)`; `db.select()/insert().returning()`; `count`/`desc`/`eq`/`inArray` from `drizzle-orm`; `{ error }` JSON on failures; `c.json(dto, 200|201)`; ESM **`.js`** import specifiers; `.toISOString()` on timestamps; **`z.iso.datetime()`** (zod v4 — NOT `z.string().datetime()`). Row→DTO mappers at the top of the file.
- **Schema (`apps/api/src/db/schema.ts`) — all tables exist, NO migration:**
  - `client`: `id, trainerId (NOT NULL FK→trainer), name, contact`. `client_trainer_idx` on `trainerId`.
  - `dog`: `id, clientId (NOT NULL FK→client), protocolId (nullable FK→protocol), name, breed, ageMonths, backgroundNotes`. `dog_client_idx` on `clientId`.
  - `homework`: `id, dogId (NOT NULL FK→dog), exerciseId (NOT NULL FK→exercise), completed (bool default false), completedAt (nullable tstz)`.
  - `exercise`: `id, protocolId (NOT NULL FK→protocol), title, instructions`.
  - `behaviorEvent`: `id, sessionId (FK→session), occurredAt, triggerType, thresholdMeters (int), intensity (int), outcome, intervention (NOT NULL), note, tags`. `behavior_event_session_occurred_idx` on `(sessionId, occurredAt)`.
  - `session`: `id, dogId (FK→dog), bookingId (nullable), startedAt, location`. `session_dog_started_idx` on `(dogId, startedAt)`.
  - `lead`: `id, trainerId (NOT NULL), name, contact, source, message, status (default 'new'), clientId (nullable FK→client), createdAt`.
  - `booking`: `id, trainerId (NOT NULL), leadId (nullable), clientId (nullable), type, requestedAt, status (default 'requested'), notes, createdAt`.
  - **No client→dog→session→event index exists for a single client's cross-dog progress read** — use plain `select()` + joins + `inArray` batching (mirror `dogs.ts` timeline: sessions/events fetched with `inArray`, grouped in TS). No new index in 3b-2 (NFR-7).
- **Shared (`packages/shared/src/`):** `enums.ts` has `ROLES`/`Role`, `BOOKING_STATUSES`/`BookingStatus`, `LEAD_STATUSES`/`LeadStatus`, `OUTCOMES`/`Outcome`, `BOOKING_TYPES`/`BookingType`. `dtos.ts` (plural) already has `LeadDTO`, `BookingDTO`, `DogSummaryDTO`, `SessionUserDTO`/`AuthUserDTO`. Barrel `index.ts` = `export * from './enums'; export * from './dtos';` — **new DTOs auto-export, no barrel edit.** **Pure TS only** (NFR-6). Append new DTOs; do not modify existing ones.
- **Mobile (`apps/mobile`):**
  - `lib/theme.ts` exports `colors, fonts, fontFallback, radii, space, type` (+ `layout`, `breakpoints`); `lib/i18n.ts` exports `useLang()` (EL/EN, EL default); `lib/reducedMotion.ts` exports `useReducedMotion()`.
  - `components/ProgressCurve.tsx` — **the reusable graph.** Props `{ data: number[] | {x,y}[] | {occurredAt,thresholdMeters}[]; width?; height?; style? }`; measures its own width via `onLayout`; per-instance gradient id; flat-series guard; static curve on a deep-green panel. **Feed it the `ClientProgressDTO.points` array directly** (it accepts `{occurredAt, thresholdMeters}[]`).
  - `lib/auth-client.ts` exports `authClient`, `signIn`, `signOut`, `useSession`. `useSession().data.user` is typed with `role`/`trainerId`/`clientId` (via `inferAdditionalFields`). Trainer screens read `session.user.trainerId`; client screens read `session.user.clientId`.
  - `lib/api.ts` — typed fetch client: `request<T>` sends `credentials:'include'` (web cookie) + `authHeader()` (native SecureStore cookie); `ApiError` carries `status`; `JSON_HEADERS`; existing helpers `getDogs`, `getDog`, `getDogTimeline`, `createLead`, `createBooking`, etc. **Extend it** with the new calls.
  - `app/(app)/_layout.tsx` — the authed group: `useSession()` guard (spinner while `isPending`, `<Redirect href="/login">` when no user), a `<Stack>` with a dark header + Sign-out button, registering `health`, `client`, `dogs/index`, `dogs/[id]/timeline`, `sessions/[id]/log`, `events/[id]`. **Register the two new `manage/*` screens here.**
  - `app/(app)/client.tsx` — the **placeholder to REPLACE** with the real dashboard (currently reads `session.user.name`, shows "coming soon"; already imports `theme` + `i18n`).
  - `app/(app)/dogs/index.tsx` — the trainer's **My Dogs** screen; reads `session.user.trainerId`. Add a nav entry to `manage/leads` + `manage/bookings` from here (or the layout header).
- **Tests:** vitest; **186 pass** as of 3b-1. Pattern (`src/test/*.test.ts`): `vi.hoisted()` mocks → `vi.mock('../db/client.js')` → seed `process.env` → exercise via `app.request()`. 3b-1 added `src/test/authMock.ts` + `setup.ts` to inject a mocked trainer/client session — **reuse `authMock.ts`** to test the new guarded routes with each role.
- **Node/vitest caveat:** run tooling via the **absolute** Node-20 path (`~/AppData/Roaming/nvm/v20.20.2/node.exe`) — the nvm symlink flaps and hangs vitest ([[node-version-requirement]]).

---

## Unit breakdown, parallelization & dependency ordering

```
        ┌───────────────────────────────────────────────────────────────┐
        │  UNIT A — packages/shared : the Phase 3b-2 DTO contract          │
        │  LANDS FIRST + is committed before B / C start                   │
        └───────────────┬───────────────────────────────┬─────────────────┘
                        │ (B & C type-check against A)    │
        ┌───────────────▼───────────────┐   ┌────────────▼──────────────────┐
        │ UNIT B — apps/api              │   │ UNIT C — apps/mobile            │
        │ routes/management.ts (trainer) │   │ C1: lib/api.ts helpers +        │
        │ routes/me.ts (client)          │   │     small primitives            │
        │ + app.ts mount + /me/* guard   │   │ C2: client dashboard (replace   │
        │ + seed note + vitest           │   │     placeholder) + manage/leads │
        │ (depends on A)                 │   │     + manage/bookings + nav     │
        └────────────────────────────────┘   │ (depends on A; integ. w/ B)     │
                  DISJOINT DIRS               └────────────────────────────────┘
              (apps/api  vs  apps/mobile)
```

**Ordering rules:**
1. **Unit A lands and is committed first.** B and C both `import type` the new DTOs from `@tailsup/shared`; neither type-checks until A exists.
2. After A is committed, dispatch **Unit B and Unit C in PARALLEL** — disjoint directories (`apps/api/**` vs `apps/mobile/**`), no file overlap. C is built against the **endpoint contract** (below), not against B's running server; final integration verifies them together against a live DB.
3. **C1 → C2 is SEQUENTIAL within `apps/mobile`** (C2's screens import C1's `lib/api.ts` helpers). C1 (api helpers + shared primitives) commits first; C2 (the three screens + nav) consumes them.
4. **B is internally splittable** along the dotted line (`management.ts` trainer routes vs `me.ts` client routes) if context runs tight — the two files are disjoint. Same commit or two.

**Disjointness check (confirmed):**
- Unit A writes **only** `packages/shared/src/dtos.ts` (append) + `enums.ts` (only if DG-4 wants a derived transition array — otherwise untouched).
- Unit B writes **only** under `apps/api/**` (`routes/management.ts`, `routes/me.ts`, `app.ts` mount edit, `src/test/*.test.ts`, optional `seed.ts` tweak, `README.md` 3b-2 section).
- Unit C writes **only** under `apps/mobile/**` (`lib/api.ts` edit, new `components/*`, `app/(app)/client.tsx` rewrite, `app/(app)/manage/*.tsx` new, `app/(app)/_layout.tsx` edit, `app/(app)/dogs/index.tsx` nav edit).

> **Scope-control note:** Units B and C are each larger than a 2–3-task plan. Run **each unit via a fresh subagent context** to stay under ~50% context. The unit boundaries are the **file-ownership contract**.

---

## Interface contract — what each unit produces and consumes

### Unit A — `@tailsup/shared` DTOs (the contract B + C depend on)

**File:** `packages/shared/src/dtos.ts` (APPEND below the Phase 3b auth DTOs). **Pure TS only.** Reuse `BookingStatus`, `Outcome` from `./enums` (already imported on the existing `import type` line — extend it if needed). Do **not** modify existing DTOs.

```ts
// ── append to packages/shared/src/dtos.ts (Phase 3b-2) ──────────────────────────
// (BookingStatus, Outcome already imported at the top of the file)

// ---- Trainer management ----

// PATCH /bookings/:id/status body (TRAINER). `requested` is NOT a valid target (DG-4).
export interface UpdateBookingStatusInput {
  status: Exclude<BookingStatus, 'requested'>; // 'confirmed' | 'declined' | 'completed' | 'cancelled'
}

// A domain client row (created by convert). NOT the auth user.
export interface ClientDTO {
  id: string;
  trainerId: string;
  name: string;
  contact: string;
}

// POST /leads/:id/convert response — the new client + the updated lead (DG-5).
export interface ConvertLeadResponse {
  client: ClientDTO;
  lead: LeadDTO; // status:'converted', clientId set
}

// POST /clients/:id/login body (TRAINER) — trainer sets the client's initial password (DG-1).
export interface CreateClientLoginInput {
  email: string;
  password: string; // >= 8 (BetterAuth minPasswordLength)
}

// POST /clients/:id/login response — the provisioned login, linked to the client.
export interface ClientLoginDTO {
  userId: string;   // BetterAuth user id
  clientId: string; // the linked domain client id
  email: string;
}

// ---- Client dashboard ----

// One homework row joined to its exercise (GET /me/homework).
export interface HomeworkDTO {
  id: string;
  dogId: string;
  exerciseId: string;
  title: string;         // exercise.title
  instructions: string;  // exercise.instructions
  completed: boolean;
  completedAt: string | null; // ISO
}

// PATCH /me/homework/:id body — mark complete (the only client write in 3b-2).
export interface UpdateHomeworkInput {
  completed: boolean;
}

// One point on the threshold-over-time series.
export interface ProgressPointDTO {
  occurredAt: string;      // ISO
  thresholdMeters: number;
  intensity: number;
  outcome: Outcome;
}

// GET /me/progress returns one of these per client dog (DG-6).
export interface ClientProgressDTO {
  dog: DogSummaryDTO;
  points: ProgressPointDTO[]; // chronological (oldest→newest) for the curve
}
```

> **No new enum required.** `Exclude<BookingStatus,'requested'>` is a pure type; the server validates with an explicit `z.enum(['confirmed','declined','completed','cancelled'])`. (Optionally add a `BOOKING_STATUS_TRANSITIONS` const to `enums.ts` derived from `BOOKING_STATUSES` — only if you prefer a single source over the inline enum. Not required.)

### Unit B — the endpoint contract (consumed by C's api helpers)

All bodies validated with `@hono/zod-validator`; all error bodies `{ error: string }`; auth per the guard column.

| Method + path | Auth | Body → Response | Errors |
| --- | --- | --- | --- |
| `GET /trainers/:trainerId/leads` | trainer (own) | → `200 LeadDTO[]` newest-first | `403` (via existing `requireTrainerOwnsParam`) |
| `GET /trainers/:trainerId/bookings` | trainer (own) | → `200 BookingDTO[]` newest-first | `403` |
| `PATCH /bookings/:id/status` | trainer (route-scoped) | `UpdateBookingStatusInput` → `200 BookingDTO` | `400` bad/`requested` status · `404` unknown/not-theirs · `401`/`403` |
| `POST /leads/:id/convert` | trainer (route-scoped) | (no body) → `201 ConvertLeadResponse` | `404` unknown/not-theirs · `409` already converted · `401`/`403` |
| `POST /clients/:id/login` | trainer (route-scoped) | `CreateClientLoginInput` → `201 ClientLoginDTO` | `400` invalid · `404` client not theirs · `409` login/email exists · `401`/`403` |
| `GET /me/progress` | client | → `200 ClientProgressDTO[]` (one per dog) | `401`/`403` |
| `GET /me/homework` | client | → `200 HomeworkDTO[]` (incomplete first) | `401`/`403` |
| `PATCH /me/homework/:id` | client | `UpdateHomeworkInput` → `200 HomeworkDTO` | `400` · `404` not the client's homework · `401`/`403` |
| `GET /me/bookings` | client | → `200 BookingDTO[]` (the client's bookings, newest-first) | `401`/`403` |

**Guard wiring in `app.ts`:** add `app.use('/me/*', requireClient)` (no collision — nothing public under `/me`). Mount `app.route('/', management)` + `app.route('/', me)`. The trainer *mutations* in `management.ts` carry **route-scoped `requireTrainer`** (e.g. `management.patch('/bookings/:id/status', requireTrainer, zValidator(...), handler)`) because a prefix guard on `/bookings/*` or `/leads/*` would also gate the PUBLIC `POST /leads` + `POST /bookings` — which must stay open. The two trainer GET lists need no route-scoped guard (the `/trainers/:trainerId/*` prefix guard already covers them).

### Unit C — the mobile surface (screens consume C1's api helpers)

C1 adds to `apps/mobile/lib/api.ts` (following the existing `request<T>` + `JSON_HEADERS` pattern):

```ts
// Trainer management (session.user.trainerId passed in by the screen)
export function getTrainerLeads(trainerId: string): Promise<LeadDTO[]>;
export function getTrainerBookings(trainerId: string): Promise<BookingDTO[]>;
export function updateBookingStatus(id: string, body: UpdateBookingStatusInput): Promise<BookingDTO>;
export function convertLead(id: string): Promise<ConvertLeadResponse>;
export function createClientLogin(clientId: string, body: CreateClientLoginInput): Promise<ClientLoginDTO>;
// Client dashboard
export function getMyProgress(): Promise<ClientProgressDTO[]>;
export function getMyHomework(): Promise<HomeworkDTO[]>;
export function completeHomework(id: string): Promise<HomeworkDTO>; // PATCH { completed:true }
export function getMyBookings(): Promise<BookingDTO[]>;
```

C2 screens: `app/(app)/client.tsx` (rewrite the placeholder), `app/(app)/manage/leads.tsx` + `app/(app)/manage/bookings.tsx` (new), plus `(app)/_layout.tsx` registration + a nav entry. All follow the existing `(app)` screen conventions: discriminated-union `Status` loading state (idle/pending/success/error) like the Phase 1/2 screens, `theme.ts` tokens, `useLang()` EL/EN copy objects (match `client.tsx`'s existing pattern), visible focus + `useReducedMotion()`.

---

## UNIT A — `@tailsup/shared` Phase 3b-2 DTO contract (LANDS FIRST)

**Owner dirs:** `packages/shared/src/` only.

### Tasks
1. **Append the DTOs** from the Interface contract to `packages/shared/src/dtos.ts` (`UpdateBookingStatusInput`, `ClientDTO`, `ConvertLeadResponse`, `CreateClientLoginInput`, `ClientLoginDTO`, `HomeworkDTO`, `UpdateHomeworkInput`, `ProgressPointDTO`, `ClientProgressDTO`). Ensure `BookingStatus` + `Outcome` are on the existing `import type … from './enums'` line. Do **not** modify existing DTOs; do **not** edit the barrel (auto-export).
2. **Verify purity + typecheck.** No runtime imports.

### Acceptance (Unit A → AC-3b-11)
- `npm run typecheck -w packages/shared` passes (zero errors).
- `git grep -nE "drizzle|from 'pg'|aws|resend|better-auth|node:" packages/shared/src` → no matches.
- The nine new symbols import cleanly from `@tailsup/shared`.

### Commit
`feat(shared): Phase 3b-2 DTOs (client progress/homework, lead-convert, booking-status, client-login)`

---

## UNIT B — `apps/api` role-scoped endpoints (PARALLEL with C)

**Owner dirs:** `apps/api/**`. **Depends on:** Unit A committed.

### Files
| Path | Action |
| --- | --- |
| `apps/api/src/routes/management.ts` | **New.** Trainer sub-app: `GET /trainers/:trainerId/leads`, `GET /trainers/:trainerId/bookings`, `PATCH /bookings/:id/status` (route-scoped `requireTrainer`), `POST /leads/:id/convert` (route-scoped), `POST /clients/:id/login` (route-scoped). |
| `apps/api/src/routes/me.ts` | **New.** Client sub-app: `GET /me/progress`, `GET /me/homework`, `PATCH /me/homework/:id`, `GET /me/bookings`. |
| `apps/api/src/app.ts` | **Edit.** Import + `app.use('/me/*', requireClient)` + `app.route('/', management)` + `app.route('/', me)`. |
| `apps/api/src/test/management.test.ts` | **New.** vitest (uses `authMock.ts`). |
| `apps/api/src/test/me.test.ts` | **New.** vitest. |
| `README.md` | **Edit.** Add the Phase 3b-2 run/verify section. |

### Tasks
1. **`routes/management.ts`** — `export const management = new Hono<AppEnv>()`. Import guards from `../middleware/auth.js`, `auth` from `../lib/auth.js`, `user as userTable` from `../db/auth-schema.js`, and `lead`/`booking`/`client` from `../db/schema.js`. Row→DTO mappers (`toLeadDTO`, `toBookingDTO`, `toClientDTO`) at the top (mirror `dogs.ts`).
   - **`GET /trainers/:trainerId/leads`** → `select().from(lead).where(eq(lead.trainerId, trainerId)).orderBy(desc(lead.createdAt))` → `LeadDTO[]`. (Guarded by the existing `/trainers/:trainerId/*` prefix rule — the param already equals the session trainer.)
   - **`GET /trainers/:trainerId/bookings`** → same for `booking` by `createdAt` desc → `BookingDTO[]`.
   - **`PATCH /bookings/:id/status`**, route-scoped `requireTrainer`, `zValidator('json', z.object({ status: z.enum(['confirmed','declined','completed','cancelled']) }))`. Load the booking; `404` if missing **or** `booking.trainerId !== user.trainerId` (never reveal others' rows). Update `status`, return `200 BookingDTO`.
   - **`POST /leads/:id/convert`**, route-scoped `requireTrainer`. Load the lead; `404` if missing/not the trainer's; **`409`** if `lead.status === 'converted'` (DG-5). In a **`db.transaction`**: insert `client` (`trainerId: lead.trainerId`, `name: lead.name`, `contact: lead.contact`), then update the lead `status:'converted'`, `clientId: <new>`. Return `201 { client, lead }`.
   - **`POST /clients/:id/login`**, route-scoped `requireTrainer`, `zValidator('json', z.object({ email: z.string().email(), password: z.string().min(8) }))`. Load the client (`:id`); `404` if missing/not the trainer's. Look up the client's `name`. Mirror `seed.ts` `ensureAuthUser`: `try { await auth.api.signUpEmail({ body: { email, password, name } }) } catch { → 409 'login already exists' }`; select the created `user` row by email; `update(userTable).set({ role:'client', clientId: id })`. Return `201 { userId, clientId, email }`. (If a user with that email already exists → `409`.)
2. **`routes/me.ts`** — `export const me = new Hono<AppEnv>()`. Every handler reads `const user = getUser(c)` — the `/me/*` prefix guard guarantees `user` is a client, but read `user.clientId` and `400`/`403` defensively if somehow null.
   - **`GET /me/dogs`** *(internal helper query, may or may not be a public route — the progress read needs the client's dogs)*: `select dog where dog.clientId = user.clientId`. Reused by progress.
   - **`GET /me/progress`** → for each of the client's dogs, gather its sessions (`session.dogId`), then **one `inArray`** query for all `behaviorEvent` across those sessions ordered `occurredAt` asc, group in TS by dog → `ClientProgressDTO[]` (`points` = `{occurredAt, thresholdMeters, intensity, outcome}`). Mirror the `dogs.ts` timeline batching (no N+1). Empty dogs → `[]`.
   - **`GET /me/homework`** → join `homework` → `exercise` where `homework.dogId ∈ (client's dogs)`; order incomplete-first then by title → `HomeworkDTO[]`.
   - **`PATCH /me/homework/:id`**, `zValidator('json', z.object({ completed: z.boolean() }))`. Load the homework + its dog; `404` if the dog's `clientId !== user.clientId`. Set `completed`, `completedAt: completed ? new Date() : null`; return `200 HomeworkDTO` (re-join exercise for title/instructions).
   - **`GET /me/bookings`** → `select booking where booking.clientId = user.clientId order by createdAt desc` → `BookingDTO[]` (feeds the derived reminders on the client, DG-3).
3. **Wire `app.ts`.** Add `import { management } from './routes/management.js'`, `import { me } from './routes/me.js'`, `import { requireClient } from './middleware/auth.js'` (extend the existing import). Add `app.use('/me/*', requireClient)` (after the existing guards). Add `app.route('/', management)` + `app.route('/', me)` (after the existing routes; order relative to public leads/bookings does not matter — the management mutations are route-scoped-guarded and public POSTs live in their own sub-apps).
4. **Tests (vitest, mirror the 3b-1 `auth-guard.test.ts` + `authMock.ts`).**
   - `management.test.ts`: convert → `201` (client created, lead `converted`); convert-already-converted → `409`; convert-not-theirs → `404`; patch-status valid → `200`; patch-status `requested`/garbage → `400`; patch-not-theirs → `404`; create-login → `201` (role/clientId patched); create-login dup email → `409`; create-login client-not-theirs → `404`; **client role hitting any trainer mutation → `403`**; unauthenticated → `401`.
   - `me.test.ts`: progress → `200` (only the session client's dogs); homework → `200`; patch-homework own → `200` (completedAt set); patch-homework not-own → `404`; bookings → `200`; **trainer role hitting `/me/*` → `403`**; unauthenticated → `401`.
   - Run the full suite: the existing **186 still pass** → target ~186 + new.

### Acceptance (Unit B → AC-3b-1, AC-3b-6, AC-3b-7, AC-3b-8, AC-3b-12)
- `npm run typecheck -w apps/api` passes; `npm run test -w apps/api` passes (186 + new).
- `git status --porcelain apps/api/drizzle` → **empty** (no migration).
- Role rejection verified by request (not UI): `client`→trainer mutation `403`; `trainer`→`/me/*` `403`; cross-trainer read/mutation `403`/`404`.
- **No Phase 4 leakage:** no `POST /dogs/:id/summary`, no Anthropic import, no spend cap.

### Commit
`feat(api): Phase 3b-2 role endpoints — trainer leads/bookings mgmt + convert + client-login; client /me progress/homework/bookings`

---

## UNIT C — `apps/mobile` dashboards + management screens (PARALLEL with B)

**Owner dirs:** `apps/mobile/**`. **Depends on:** Unit A committed. **Integrates with:** Unit B's endpoint contract.

### C1 — api helpers + primitives (commit before C2)
| Path | Action |
| --- | --- |
| `apps/mobile/lib/api.ts` | **Edit.** Add the nine helpers from the Interface contract; import the new DTOs into the existing `import type` block. Client `/me/*` calls take no id (session-scoped); trainer calls take `trainerId`/`id` args. |
| `apps/mobile/components/StatusBadge.tsx` | **New (small).** A pill showing a `LeadStatus`/`BookingStatus` with DS colors (deep-green/copper/muted). Reused by both management screens. |
| `apps/mobile/components/HomeworkRow.tsx` | **New (small).** A `Card`-styled row: title, instructions, a complete toggle/button, completed timestamp. |

**C1 acceptance:** `npm run typecheck -w apps/mobile` passes; helpers return the correct DTOs (no `any`).

**C1 commit:** `feat(mobile): Phase 3b-2 api helpers + StatusBadge/HomeworkRow primitives`

### C2 — the three screens + nav (after C1 commit)
| Path | Route | Screen |
| --- | --- | --- |
| `apps/mobile/app/(app)/client.tsx` | `/client` | **Client dashboard** — replace the placeholder |
| `apps/mobile/app/(app)/manage/leads.tsx` | `/manage/leads` | **Trainer — Leads** |
| `apps/mobile/app/(app)/manage/bookings.tsx` | `/manage/bookings` | **Trainer — Bookings** |
| `apps/mobile/app/(app)/_layout.tsx` | — | **Edit** — register `manage/leads` + `manage/bookings` `Stack.Screen`s |
| `apps/mobile/app/(app)/dogs/index.tsx` | `/dogs` | **Edit** — add header/links to `/manage/leads` + `/manage/bookings` |

**Tasks**
1. **Client dashboard (`client.tsx`)** — keep the `useLang()` EL/EN copy pattern. On mount fetch `getMyProgress()`, `getMyHomework()`, `getMyBookings()` (parallel; a discriminated-union `Status`). Render:
   - **Progress** — one `ProgressCurve` per `ClientProgressDTO` (feed `dto.points` directly), captioned with the dog name + a before/after threshold label per DG-8. Empty points → a friendly "no sessions logged yet" card (never a broken curve).
   - **Homework** — `HomeworkRow` per item, incomplete first; "mark complete" calls `completeHomework(id)` with optimistic-or-pending UI, updates the row on success, surfaces `ApiError` on failure.
   - **Reminders** (DG-3, derived) — a small card computed in-app: count of pending homework + the next confirmed/upcoming booking (from `getMyBookings()` filtered to future `requestedAt` / status `confirmed`). Read-only prompts; no new fetch.
   - Quality floor: visible focus, `useReducedMotion()`, responsive (`useWindowDimensions`/`layout.maxProse`).
2. **Trainer Leads (`manage/leads.tsx`)** — read `session.user.trainerId`; `getTrainerLeads(trainerId)`. List newest-first with `StatusBadge`. For a `new`/`contacted` lead: a **Convert** action → `convertLead(id)` → on success show `converted` + the linked client, then reveal a **Create login** mini-form (email + password) → `createClientLogin(clientId, {email,password})` → confirm the login was issued (DG-1). Surface `409`/`404` messages from `ApiError`.
3. **Trainer Bookings (`manage/bookings.tsx`)** — `getTrainerBookings(trainerId)`; list with `type`, `requestedAt`, `StatusBadge`; four action buttons (`confirmed|declined|completed|cancelled`) → `updateBookingStatus(id,{status})`; reflect the new status in the list; surface errors.
4. **Nav + layout** — register the two `manage/*` screens in `(app)/_layout.tsx` (`<Stack.Screen name="manage/leads" .../>`, `name="manage/bookings"`). From `dogs/index.tsx` add header links (or buttons) to both (trainer-only; the client never routes here — role-gated in-app, enforced server-side). Optionally hide the `manage/*` + `dogs/*` entries for a `client` session and the `client` entry for a `trainer` (UX only).

**C2 acceptance (→ AC-3b-9, AC-3b-10, AC-3b-3):**
- `npm run typecheck -w apps/mobile` passes.
- `expo start --web` (with the API + seed running): logging in as **client** renders the graph (from real seeded `behaviorEvent`), the homework list, and reminders; "mark complete" persists (`completed=true`/`completedAt`). Logging in as **trainer** shows the leads + bookings lists; convert flips a lead to `converted` + links a client; create-login issues a client login; a status button transitions a booking. The client only ever sees their own data; the trainer never sees `/client`, the client never reaches `/manage/*`.

**C2 commit:** `feat(mobile): Phase 3b-2 — client dashboard (graph/homework/reminders) + trainer leads/bookings management`

---

## Verification (overall — run after all units + at integration, needs a live Postgres)

Run from the repo root; use the **absolute Node-20 path** for tooling.

1. **Typecheck all workspaces (AC-3b-1):** `npm run typecheck --workspaces` → zero errors across `@tailsup/shared`, `apps/api`, `apps/mobile`.
2. **API tests (AC-3b-12):** `npm run test -w apps/api` → 186 existing + the new management/me tests pass.
3. **No migration:** `git status --porcelain apps/api/drizzle` → **empty**.
4. **Shared purity (AC-3b-11):** `git grep -nE "drizzle|from 'pg'|aws|resend|better-auth|node:" packages/shared/src` → no matches.
5. **Live-DB role walkthrough (AC-3b-6/7/8/9/10)** — Docker Postgres + `db:migrate` + `db:seed` + `npm run dev -w apps/api`, then:
   - **Client** (`client@tailsup.local`): sign in → `curl -b cookie /me/progress` returns the seeded dog + 5 points; `/me/homework` returns 2 rows (one complete); `PATCH /me/homework/:id {completed:true}` sets `completedAt`; `/me/bookings` returns the client's bookings. A **trainer** cookie against `/me/*` → `403`.
   - **Trainer** (`trainer@tailsup.local`): `GET /trainers/:trainerId/leads` + `/bookings` (create a lead/booking first via the public 3a endpoints); `POST /leads/:id/convert` → `201` (client row + `converted`); re-convert → `409`; `POST /clients/:id/login {email,password}` → `201`; `PATCH /bookings/:id/status {status:'confirmed'}` → `200`; invalid status → `400`. A **client** cookie against any trainer mutation → `403`; another trainer's row → `404`.
   - **Web UI:** log in as each role on `expo start --web` and confirm AC-3b-9 (management) + AC-3b-10 (dashboard) by inspection.
6. **No Phase 4 leakage (AC-3b-12):** grep the diff for `anthropic`, `claude`, `summary`, spend-cap, multi-tenant → none. Phases 1/2/3a + 3b-1 screens/endpoints unchanged.
7. **Run `/verify`** on the client dashboard flow and the trainer convert→login flow (drive them end-to-end on web), per the repo's verify convention.

---

## Success criteria (Phase 3b-2 — maps to the AC-3b-* the foundation didn't already close)

| AC | Criterion | Verified by |
| --- | --- | --- |
| **AC-3b-1** | Typecheck passes across all three workspaces incl. dashboards, management, new DTOs | Verify §1 |
| **AC-3b-6** | Role-scoped authorization enforced server-side (client↔trainer rejection, cross-trainer 404/403, client sees only own data) | B tests + Verify §5 |
| **AC-3b-7** | `PATCH /bookings/:id/status` — trainer transitions own booking; invalid → 400; not-theirs → 404 | B; Verify §5 |
| **AC-3b-8** | `POST /leads/:id/convert` — client row created + lead `converted`+`clientId` in one txn; already-converted → 409; not-theirs → 404 | B; Verify §5 |
| **AC-3b-9** | Trainer management screens — leads list + convert (+login), bookings list + status change | C2; Verify §5 |
| **AC-3b-10** | Client dashboard — threshold graph from real `behaviorEvent`, homework list + mark-complete, derived reminders; own data only | C2; Verify §5 |
| **AC-3b-11** | New DTOs present + `@tailsup/shared` stays pure | A; Verify §4 |
| **AC-3b-12** | New vitest coverage; full suite passes; no Phase 4 feature; Phase 1/2/3a/3b-1 intact | B; Verify §2/§6 |
| **AC-3b-13** | README documents seed logins, per-role login on web, and how to verify AC-3b-6..10 | B (README) |

*(AC-3b-2 auth-tables-via-migration, AC-3b-3 login+role-routing, AC-3b-4 web/native session, AC-3b-5 stop-gap replaced were closed by 3b-1; 3b-2 must not regress them.)*

---

## Risk table

| Risk | Likelihood | Impact | Mitigation (baked in) |
| --- | --- | --- | --- |
| **Prefix-guard collision** — guarding `/leads/*` or `/bookings/*` with `requireTrainer` would gate the PUBLIC `POST /leads`/`POST /bookings` (3a) → public forms 401 | Medium | High | DG-2: the three trainer *mutations* use **route-scoped** `requireTrainer`, not a prefix `app.use`; the public POSTs stay in their own un-guarded sub-apps. Test asserts public POST still `201`. |
| **`client` login provisioning duplicates the seed logic imperfectly** (signUpEmail side effects / duplicate-email) | Medium | Medium | Mirror `seed.ts` `ensureAuthUser` exactly; wrap `signUpEmail` in try/catch → `409`; patch role/clientId via Drizzle after. Test the dup path. |
| **Convert not atomic** — client inserted but lead not flipped (or vice-versa) | Low | High | `db.transaction` around insert-client + update-lead; test asserts both or neither. |
| **Progress read N+1** across a client's dogs/sessions/events | Medium | Low | Mirror `dogs.ts` timeline: batch events with a single `inArray` over all session ids, group in TS. No new index (NFR-7). |
| **Graph semantics inverted** — falling `thresholdMeters` misread as regression | Medium | Low | DG-8: label the panel; the `ProgressCurve` renders raw chronological points; caption states "closer coping distance = progress." |
| **Client with 0 dogs / 0 events** → broken curve or crash | Medium | Medium | `ClientProgressDTO[]` empty / `points:[]` → friendly empty card; `ProgressCurve` already guards `points.length===0`. |
| **Role UX leak** — a client briefly sees `/manage/*` links or vice-versa | Low | Low | Role-gate nav in-app; **server guards are the real boundary** (403/404) — tested by request, so a UX slip can't expose data. |
| **tsc slowdown from BetterAuth inferred types** | Low | Medium | Reuse the 3b-1 discipline: consume `AuthedUser`/`getUser(c)` + `AppEnv`, never `auth.$Infer.Session` in route generics. |
| **vitest hangs on flapping nvm symlink** | Medium | Low | Absolute Node-20 path for all tooling ([[node-version-requirement]]). |

---

## Deviation rules (during execution)

1. **Auto-fix bugs** — broken behavior → fix immediately, note in the summary.
2. **Auto-add missing critical** — a security/correctness gap (e.g. a missing ownership check that would leak another trainer's/client's data) → add immediately, document.
3. **Auto-fix blockers** — can't proceed → apply the smallest documented fix, document.
4. **Ask about architectural** — any change to the route grouping, the guard strategy (DG-2), the DTO shapes, the endpoint contracts, the login-provisioning model (DG-1), or adding a dependency → **stop and ask the user**.
5. **Log enhancements** — nice-to-haves (per-service booking deep-links, homework filtering, a combined trainer inbox, animated draw-on for the curve) → log, do not build now.

All deviations recorded in the build summary: what was found, which rule applied, what was done.

---

## Out of scope for Phase 3b-2 (do NOT build — Phase 4 / later)

- `POST /dogs/:id/summary` (Anthropic `claude-haiku-4-5`), the AI JSON-to-Haiku flow, the spend-cap reminder → **Phase 4**.
- Multi-tenant SaaS prep/refactor → **Phase 4**.
- Push notifications / SMS / email reminders to clients (reminders stay in-app derived — DG-3).
- Booking-status state machine (DG-4), a scheduling calendar, payments, auto-creating a `session` on booking confirm.
- Client self-signup / password-reset flows beyond BetterAuth's baseline (clients are trainer-provisioned — DG-1).
- Any new index or schema migration (reads use existing indexes; the only write is `homework.completed`/`completedAt`).
- Production deploy / real domain (acceptance is local-run + tests, per Phases 1–3a precedent).

---

_Phase 1 plan: `docs/design/plan-001-tailsup-phase1-foundations.md` · Phase 2 plan: `docs/design/plan-002-tailsup-phase2-trainer-view.md` · Phase 3a plan: `docs/design/plan-003-tailsup-phase3a-public-site.md` · 3b-1 foundation: `docs/reference/integration-verification-phase3b1.md` · This plan: `docs/design/plan-004-tailsup-phase3b2-dashboards.md`._
