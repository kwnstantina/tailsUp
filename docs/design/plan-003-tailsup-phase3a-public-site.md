# Plan 003 — TailsUp Phase 3a: Public Business Website + Public Capture Endpoints

> **Status:** Plan for review at the **design gate**. This is the Claude-executable implementation plan for **Phase 3a — Public business website + public capture endpoints** of TailsUp. It is grounded in the actual committed Phase 1/2 code (verified against the live files), follows the investigation's version-pinned recommendations verbatim, and bakes in the research's SEO-verify-with-fallback approach.
>
> **Build scope: Phase 3a ONLY** — the 6 public website pages + `POST /leads` (with a Resend email stub) + `POST /bookings`. **NOT this cycle:** BetterAuth, the `/login` route and auth guards, the client/trainer dashboards, `PATCH /bookings/:id/status`, `POST /leads/:id/convert`, the `EXPO_PUBLIC_TRAINER_ID` replacement, CORS tightening, and any AI/multi-tenant work. **Those are Phase 3b / Phase 4.**
>
> **Inputs (authoritative — read in full before executing):**
> - Refined spec: `docs/reference/refined-request-phase3.md` (use the **Phase 3a** scope, page list, Design-System requirements DS-1..DS-7, endpoint contracts FR-A1..FR-A3, and the **AC-3a-*** criteria)
> - Investigation: `docs/reference/investigation-phase3a.md` (the HOW + version pins + pitfalls — **FOLLOW its recommendations**)
> - SEO research: `docs/research/expo-router-static-head-sdk54.md` (the `<Head>` pattern; static emission is **UNCERTAIN** → verify via `expo export` + graceful fallback; **not a blocker**)
> - Codebase scan: `docs/reference/codebase-scan-phase3.md` (integration points + anomalies)
> - Design System authority: `prompts/001-tailsup-kickoff.md` ("Design System" + "Website" sections)
> - Existing patterns: `docs/design/project-design.md` · Functional ledger: `docs/design/project-functions.md`

---

## ⛔ DESIGN GATE — decisions needing user sign-off BEFORE execution

These choices change the routing, the data written, the dependencies installed, and the page content. Execution must **not** start until the user approves these defaults (or names changes). Each restates the load-bearing decision and the recommended default this plan bakes in.

| # | Decision | This plan assumes | Impact if changed |
| --- | --- | --- | --- |
| **D-1 — Route grouping + `/` collision** | Public site and authed app coexist in ONE Expo Router tree via **route groups**: new public `app/(site)/*` (Design-System chrome, **no** auth guard) + existing screens move under `app/(app)/*`. Root `app/_layout.tsx` becomes `SafeAreaProvider` + `<Slot/>`. **Home owns `/`** (`(site)/index.tsx`); the **existing health screen moves to `/health`** (`(app)/health.tsx`), resolving the double-`index`-at-`/` collision. The one `Link href="/dogs"` keeps working (route name unchanged under the group). | If flat-routes-with-conditional-chrome is chosen instead, the whole mobile restructure (C1) changes shape and 3b's auth guard becomes a pathname tangle. Investigation strongly recommends groups (LBD-2). |
| **D-2 — `trainerId` for PUBLIC writes** | A `resolveTrainerId()` helper: **prefer `PRACTICE_TRAINER_ID` env var → else the sole/oldest `trainer` row → else throw, mapped to `503`** "practice not configured." Never insert a fabricated/empty `trainerId` (the NOT-NULL FK would 500). New **optional** `PRACTICE_TRAINER_ID` documented in `.env.example`. | If multiple trainers must be addressable from the public site (multi-practice), this needs a per-page trainer selector — out of scope for single-practice 3a. |
| **D-3 — Keyless map provider** | Contact page map is an **OpenStreetMap `export/embed.html` `<iframe>`** (no API key), via a `PracticeMap.web.tsx` / `PracticeMap.native.tsx` platform-extension split (web = iframe; native = card + `Linking` "Open in Maps"). Practice coordinates authored in-code. | If Google Maps Embed is wanted, it needs an API key + billing (rejected for 3a per OQ-6). |
| **D-4 — Copy language (content decision)** | **Greek-first:** Greek nav labels + Greek page headings (Αρχική / Ποιοι είμαστε / Υπηρεσίες / Αποτελέσματα / Επικοινωνία) and **Greek in-code body copy**, no runtime language switcher, no full i18n. *(Recommended default — confirm.)* | If bilingual (Greek+English) body copy is wanted, every page's copy roughly doubles and a toggle is needed — larger C2. Flagged as the main content decision. |
| **D-5 — Results page data** | **Tasteful, clearly-structured placeholder data** in-code (e.g. `{ dogName, summary, before, after, curveData }[]`) so real case studies replace it later with no layout change. May reuse the progress-curve for an outcome arc. No real testimonials fabricated. | If real case studies exist now, swap the array contents (no structural change). |
| **D-6 — SEO static head** | **Best-effort:** use `<Head>` from `expo-router/head` per page + `app/+html.tsx` shell (`<html lang="el">`, site defaults, favicon). **Verify** static emission at integration via `npx expo export --platform web` + grep; if absent, fall back to React-19 bare `<title>`/`<meta>` (web-guarded) and otherwise accept client-side-only head. **Not a build blocker.** | If guaranteed pre-rendered SEO is a hard requirement, it may force the `+html.tsx` page-map fallback (Option B in the research) — minor extra work, decided at integration. |
| **D-7 — Booking ↔ lead linkage** | A public `POST /bookings` inserts the booking with **`leadId: null`** (no auto-created lead). Keep 3a simple. | If a public booking should also create/attach a lead, that's a small addition deferred to 3b (OQ-8). |
| **D-8 — Rate limiting** | Add the lightweight **`hono-rate-limiter`** in-memory limiter scoped to `POST /leads` + `POST /bookings` (generous per-IP window) returning `429 { error }`, **plus** Zod `.max()` input-size caps. Production edge-limiter is deferred (no prod deploy in Phase 3). | If a dependency is unwanted, fall back to Zod caps only + a documented edge-limiter note (weakens the "demonstrable throttle" half of AC-3a-9). |

**Also confirm at the gate (no code impact, but bake into content/recipient):**
- **D-9 — Contact details + email recipient (OQ-7):** practice address/hours/phone/email authored **in-code** on the Contact page; the lead-notification email recipient is the **resolved trainer's `trainer.email`** (looked up via the lead's `trainerId`). Confirm the in-code contact values (or supply real ones).

**Resume signal:** reply **"approved"** to proceed with all D-1..D-9 defaults, or name the ones to change (e.g. "D-4 → bilingual", "D-2 → set PRACTICE_TRAINER_ID, no fallback", "D-8 → Zod caps only").

---

## Objective

Deliver Phase 3a of TailsUp: a **premium, business-first public website for a dog-training practice** — six pages (Home, About, Services, Results, Contact, Booking) rendered with the kickoff's Design System on Expo **web** (the primary verification surface), plus the two **public, unauthenticated** capture endpoints (`POST /leads` with a best-effort Resend email stub, `POST /bookings`) — all type-checked under `strict` across `@tailsup/shared`, `apps/api`, `apps/mobile`, with **no schema migration** (the `lead`/`booking` tables already exist), and **no Phase 3b/4 leakage** (no auth, no dashboards, no management endpoints). The existing Phase 1/2 endpoints and trainer screens keep working unchanged.

**Why now:** Phase 3a is the practice's first externally visible product and the lead funnel. It has **zero dependency on auth** (LBD-1), so shipping it first de-risks the BetterAuth work (Phase 3b) behind a working, demoable site and lets the practice go live with lead capture before dashboards exist.

**Business-first constraint (hard, verifiable by inspection — AC-3a-2 / DS-7):** the homepage is about the **practice**, not "an app" or "a data platform." The data-tracking platform appears as **one premium service** under Services, and the **signature progress-curve appears ONLY in that Services section** (optionally reused in Results). Spend boldness in one place.

---

## Context (read before executing)

@docs/reference/refined-request-phase3.md
@docs/reference/investigation-phase3a.md
@docs/research/expo-router-static-head-sdk54.md
@docs/reference/codebase-scan-phase3.md
@prompts/001-tailsup-kickoff.md
@docs/design/project-design.md
@docs/design/project-functions.md

**Ground-truth facts confirmed against the live code (do not re-derive):**
- `apps/api/src/app.ts` mounts `app.route('/', health|sessions|dogs|events|media)`, applies `app.use('*', cors())` (allow-all — **leave as-is for 3a**; the comment flags 3b tightening), installs `onError` (HTTPException pass-through + 500) + `notFound` (`{ error: 'not found' }`). **Mount the two new sub-apps here.**
- `apps/api/src/routes/sessions.ts` is the **canonical route template**: `export const sessions = new Hono()`, `zValidator('json', zObj)`, `z.enum(BOOKING_TYPES)` over `@tailsup/shared` arrays, `db.select()/insert().returning()`, `{ error }` JSON on domain failures, `c.json(dto, 201)`, ESM **`.js`** import specifiers, DTO mapping with `.toISOString()` on timestamps.
- `apps/api/src/lib/r2.ts` is the **lazy-config template**: a `requiredR2()` reads creds at call time and **throws** (→ 503). `lib/email.ts` mirrors this shape **but inverts the missing-key behavior**: on missing `RESEND_API_KEY` it **logs a stub and returns success** (never throws, never blocks the 201).
- `apps/api/src/config.ts` `required()` throws on missing at import time; `PORT` is the only optional. **Do NOT add `RESEND_API_KEY` or `PRACTICE_TRAINER_ID` to `config.ts`** — both are read lazily.
- `apps/api/src/db/schema.ts` — `lead` and `booking` tables already exist with the exact columns below; `trainer` has `id, name, email` (`email` is the lead-notification recipient). **No migration.** The single committed migration `apps/api/drizzle/0000_amused_brood.sql` already contains these tables.
  - **`lead`**: `id` uuid PK · `trainerId` uuid NOT NULL FK→trainer · `name` text NOT NULL · `contact` text NOT NULL · `source` text NOT NULL · `message` text nullable · `status` leadStatusEnum **default `'new'`** · `clientId` uuid nullable FK→client · `createdAt` timestamptz defaultNow.
  - **`booking`**: `id` uuid PK · `trainerId` uuid NOT NULL FK→trainer · `leadId` uuid nullable FK→lead · `clientId` uuid nullable FK→client · `type` bookingTypeEnum NOT NULL (no default) · `requestedAt` timestamptz NOT NULL (no default) · `status` bookingStatusEnum **default `'requested'`** · `notes` text nullable · `createdAt` timestamptz defaultNow.
- `packages/shared/src/dtos.ts` (plural) imports `from './enums'` (no `.js`). Barrel `index.ts` is `export * from './enums'; export * from './dtos';` — **new DTOs auto-export, no barrel edit needed.** `BOOKING_TYPES`/`BookingType`, `LEAD_STATUSES`/`LeadStatus`, `BOOKING_STATUSES`/`BookingStatus` already exist and are reused **unchanged** (no new enum needed for 3a).
- `apps/mobile/app/` currently: `_layout.tsx` (single `<Stack>` in `SafeAreaProvider`) + `index.tsx` (health screen, uses `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'` static dot-access, discriminated-union `Status`, `StyleSheet.create`, a `Link href="/dogs"`) + `dogs/`, `sessions/`, `events/`. **No theme module, no fonts, no SVG, no web pages exist yet.**
- `apps/mobile/lib/api.ts` is the typed fetch client (`request<T>`, `ApiError`, `JSON_HEADERS`, `API_URL`, `TRAINER_ID` stop-gap). **Extend it** with `createLead`/`createBooking`. The `TRAINER_ID` stop-gap stays untouched in 3a.
- `apps/mobile/app.json` already has `web.bundler: metro`, **`web.output: "static"`**, `experiments.typedRoutes: true`, `newArchEnabled: true`. **No `app.json` change needed for 3a** (route groups are zero-config; parenthesized dirs are auto-recognized).
- No `metro.config.js` exists (SDK 54 auto-config). Do NOT create one pre-emptively; the documented fallback lives in `app/index.tsx:9-33`.
- API test runner is **vitest** (133 tests pass as of Phase 2). Pattern: `vi.hoisted()` mocks → `vi.mock('../db/client.js')` + `vi.mock('dotenv/config')` → seed `process.env.DATABASE_URL` before imports → exercise via `app.request()`. **No mobile test runner exists** (3a adds none, consistent with Phases 1/2).

**Version pins (install via `npx expo install` so SDK-54-compatible versions lock):**
- Mobile: `expo-font@~14.0.12`, `@expo-google-fonts/fraunces` (400/500), `@expo-google-fonts/inter` (400), `react-native-svg@15.12.1`.
- API: `resend@^6.13.0`, `hono-rate-limiter` (latest; plain `npm i -w apps/api`).

---

## Unit breakdown, parallelization & dependency ordering

```
        ┌───────────────────────────────────────────────────────────────┐
        │  UNIT A — packages/shared : the Phase 3a DTO contract            │
        │  LANDS FIRST + is committed before B / C1 start                  │
        └───────────────┬───────────────────────────────┬─────────────────┘
                        │ (B & C1 type-check against A)   │
        ┌───────────────▼───────────────┐   ┌────────────▼──────────────────┐
        │ UNIT B — apps/api              │   │ UNIT C1 — apps/mobile FOUNDATION│
        │ routes/leads + routes/bookings │   │ theme + fonts + (site) layout + │
        │ lib/email (stub) +             │   │ UI primitives + ProgressCurve + │
        │ resolveTrainerId + rate-limit  │   │ PracticeMap + +html + ROUTING   │
        │ + mount + vitest + .env.example│   │ restructure + lib/api helpers   │
        │ (depends on A)                 │   │ (depends on A) → COMMIT          │
        └────────────────────────────────┘   └────────────┬───────────────────┘
                  DISJOINT DIRS                            │ (C2 imports C1's exports)
              (apps/api  vs  apps/mobile)     ┌────────────▼───────────────────┐
                                              │ UNIT C2 — the 6 (site) pages     │
                                              │ Home/About/Services/Results/     │
                                              │ Contact/Booking — consume C1      │
                                              │ primitives (ONE agent, premium    │
                                              │ visual consistency)              │
                                              └──────────────────────────────────┘
```

**Ordering rules:**
1. **Unit A lands and is committed first.** B and C1 both `import` types from `@tailsup/shared`; they will not type-check until A exists.
2. After A is committed, dispatch **Unit B and Unit C1 in PARALLEL** — they touch **disjoint directories** (`apps/api/**` vs `apps/mobile/**`). No file overlap.
3. **C1 → C2 is SEQUENTIAL within `apps/mobile`.** C1 commits the routing restructure + theme + primitives + ProgressCurve + PracticeMap + api helpers; **then** C2 builds the six pages consuming C1's exports. C2 is **ONE agent** so the premium design stays visually consistent across all six pages (do not split pages across agents — they share the theme, the chrome, and the primitive components).

**Disjointness check (confirmed):**
- Unit A writes **only** `packages/shared/src/dtos.ts` (append). No other unit touches `packages/shared`.
- Unit B writes **only** under `apps/api/**` (two new route files, one `lib/email.ts`, one tiny `lib/trainer.ts` helper, `app.ts` mount edit, two new test files, `package.json`, root `.env.example`). No other unit touches `apps/api`.
- Units C1 + C2 write **only** under `apps/mobile/**`. C1 and C2 are sequential (C2 after C1's commit), so no intra-`apps/mobile` race.
- **`.env.example`** (root) is owned by **Unit B** (it documents `PRACTICE_TRAINER_ID` + `RESEND_FROM`). C1's mobile env note (none new for 3a) needs no `.env.example` change.
- **README run-docs** for 3a are owned by **Unit B** (API + env + demo path); C2 contributes the "how to view the site on web" snippet, folded into B's README section at integration (or a brief Unit D-doc step if parallelism makes it awkward).
- **`docs/design/project-functions.md`** is updated by the **planner (this step), not by a build unit** — see the end of this plan.

> **Scope-control note (create-plans):** Units B, C1, and C2 are each larger than the skill's ideal 2–3-task plan. Run **each unit via a fresh subagent context** to stay under ~50% context. The unit boundaries below are the **file-ownership contract**; if a unit risks context exhaustion, split it at execution time along the dotted lines noted per unit — that does not change ownership.

---

## Interface contract — what each unit produces and consumes

### Unit A — `@tailsup/shared` DTOs (the contract B, C1, C2 all depend on)

**File:** `packages/shared/src/dtos.ts` (APPEND below the existing Phase 2 DTOs — do not modify existing ones). **Pure TS only** — no runtime imports; reuse `BookingType` from `./enums` (add to the existing `import type` line) and `LeadStatus`, `BookingStatus`.

```ts
// ── append to packages/shared/src/dtos.ts ──────────────────────────────────
import type { BookingType, LeadStatus, BookingStatus } from './enums'; // add to existing import

// POST /leads request body (PUBLIC). source is set by the page (e.g. 'website-contact').
export interface CreateLeadInput {
  name: string;
  contact: string;       // free-text email or phone
  source: string;
  message?: string;
}

// POST /leads response — mirrors the `lead` row (createdAt as ISO string).
export interface LeadDTO {
  id: string;
  trainerId: string;
  name: string;
  contact: string;
  source: string;
  message: string | null;
  status: LeadStatus;    // always 'new' on create
  clientId: string | null; // always null on create
  createdAt: string;     // ISO
}

// POST /bookings request body (PUBLIC). type ∈ BOOKING_TYPES; requestedAt ISO.
// name/contact captured for the practice to follow up (OQ-8); leadId stays null in 3a (D-7).
export interface CreateBookingInput {
  type: BookingType;
  requestedAt: string;   // ISO datetime
  name: string;
  contact: string;
  notes?: string;
}

// POST /bookings response — mirrors the `booking` row (requestedAt/createdAt as ISO).
export interface BookingDTO {
  id: string;
  trainerId: string;
  leadId: string | null;
  clientId: string | null;
  type: BookingType;
  requestedAt: string;   // ISO
  status: BookingStatus; // always 'requested' on create
  notes: string | null;
  createdAt: string;     // ISO
}
```

> **Note on `CreateBookingInput.name/contact`:** the `booking` table has **no** `name`/`contact` columns. In 3a these capture fields are validated and used for the email/notes context but are **not** persisted as booking columns (booking inserts `leadId: null`). If they should persist, fold them into `notes` (e.g. prepend a contact line) — keep it simple; do not add columns (no migration). **Decided default: prepend captured contact into `notes` text** so it is not lost, e.g. `notes = "[${name} · ${contact}] ${notes ?? ''}".trim()`. (Flagged so B implements one consistent behavior.)

**No new enum is required for 3a.** (`ROLES` is a Phase 3b concern.)

### Unit C1 — the exports C2 imports (the mobile foundation API surface)

C1 must export, and C2 must import, **exactly** these:

- **`apps/mobile/lib/theme.ts`** — `export const colors, fonts, type, space, radii, layout, breakpoints` (DS-1..DS-4 token values, RN-unit-converted; see the theme contract below).
- **`apps/mobile/components/ui/`** (or `components/site/`) primitives, each a Design-System component consuming `theme.ts`:
  - `PrimaryButton` — green bg, off-white text, radius 6, padding 13/28; `Pressable` with `{ hovered, focused, pressed }` styling + visible focus ring; props `{ label, onPress, disabled?, loading? }`.
  - `SecondaryButton` — transparent, 1px border; same interaction contract.
  - `Eyebrow` — copper uppercase label, ls 0.16em-equivalent; props `{ children }`.
  - `Card` — white surface, 0.5px border, radius-lg; props `{ children, style? }`.
  - `Section` — vertical-rhythm wrapper + centered max-width `Container`; props `{ children, alt?, dark?, maxWidth? }` (alt = bgAlt; dark = the deep-green proof-band background).
  - `ProofBand` — the dark deep-green band (used **once per page** max); props `{ children }`.
- **`apps/mobile/components/ProgressCurve.tsx`** — the signature SVG curve; props `{ points: { occurredAt: string; thresholdMeters: number }[] | { x: number; y: number }[]; height?: number }`; per-instance gradient id via `useId()`; honors `prefers-reduced-motion`.
- **`apps/mobile/components/PracticeMap.web.tsx` + `.native.tsx`** — exported as `PracticeMap` (Metro picks per target); no props required (coords in-code) or `{ lat, lon, label }`.
- **`apps/mobile/components/SiteChrome.tsx`** (or folded into `(site)/_layout.tsx`) — header/nav (Greek labels, links to all six routes) + deep-green footer; sticky header via `Platform.select({ web: { position: 'sticky' } as any })`.
- **`apps/mobile/lib/api.ts`** — add `export function createLead(body: CreateLeadInput): Promise<LeadDTO>` and `export function createBooking(body: CreateBookingInput): Promise<BookingDTO>` following the existing `request<T>` + `JSON_HEADERS` pattern (POST to `/leads` and `/bookings`).
- **`apps/mobile/lib/reducedMotion.ts`** (small helper) — `useReducedMotion()` hook over `AccessibilityInfo.isReduceMotionEnabled()` + `addEventListener('reduceMotionChanged', …)`; returns `boolean`. Used by `ProgressCurve` and any animated chrome.

**theme.ts contract (RN-unit-converted from the kickoff — DS-1..DS-4):**

```ts
// apps/mobile/lib/theme.ts — plain TS, mobile-only, NOT in @tailsup/shared.
export const colors = {
  bg: '#FAF7F0', bgAlt: '#F0EADD', surface: '#FFFFFF',
  primary: '#1B3A32', primarySoft: '#3D5249',
  accent: '#B07D48', accentSoft: '#E8C9A0', mint: '#9FC4B5',
  text: '#1B3A32', textMuted: '#6B7D74', border: 'rgba(27,58,50,0.12)',
} as const;

export const fonts = {
  display: 'Fraunces_500Medium', displayRegular: 'Fraunces_400Regular',
  body: 'Inter_400Regular',
} as const;

// letterSpacing in POINTS (em * fontSize); lineHeight in PX (~1.6 * fontSize). NOT em/unitless.
export const type = {
  h1:      { fontFamily: fonts.display,        fontSize: 46,   lineHeight: 52, letterSpacing: -0.92 },
  h2:      { fontFamily: fonts.display,        fontSize: 30,   lineHeight: 36, letterSpacing: -0.6 },
  h3:      { fontFamily: fonts.displayRegular, fontSize: 19,   lineHeight: 26 },
  bodyLg:  { fontFamily: fonts.body,           fontSize: 16,   lineHeight: 26 },
  body:    { fontFamily: fonts.body,           fontSize: 15,   lineHeight: 24 },
  eyebrow: { fontFamily: fonts.body,           fontSize: 12.5, letterSpacing: 2, textTransform: 'uppercase' as const, color: colors.accent },
  caption: { fontFamily: fonts.body,           fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
} as const;

export const space = { xs: 8, sm: 16, md: 24, lg: 32, xl: 54, xxl: 80 } as const;
export const radii = { base: 6, lg: 14 } as const;
export const layout = { maxWidth: 1080, maxProse: 720 } as const;
export const breakpoints = { sm: 640, md: 768, lg: 1024 } as const;
```

Fallbacks (DS-2 quality floor): on web set the family stack so `Georgia`/`system-ui` show acceptably during FOUT (apply `Platform.select` web fontFamily fallbacks or rely on `FontDisplay.SWAP`); never block the whole site on font load on web.

### Unit B — the endpoint contract (consumed by C1's api helpers + C2's forms)

- `POST /leads` (PUBLIC) → `201 LeadDTO`. Body `CreateLeadInput`. Validation: `name`/`contact`/`source` non-empty with `.max()` caps; `message?` capped. Insert `lead` (status DB-default `'new'`, `clientId: null`, `trainerId` from `resolveTrainerId()`). **Then fire-and-forget** `sendLeadNotification(trainerEmail, dto).catch(...)` — never awaited, never fails the 201. `400` on invalid body; `503` if no practice trainer resolvable; `429` if rate-limited.
- `POST /bookings` (PUBLIC) → `201 BookingDTO`. Body `CreateBookingInput`. Validation: `type ∈ BOOKING_TYPES`, `requestedAt` valid ISO (`z.string().datetime()`), `name`/`contact` non-empty + capped, `notes?` capped. Insert `booking` (status DB-default `'requested'`, `leadId: null`, `clientId: null`, `requestedAt: new Date(...)`, captured name/contact prepended into `notes`). `400` on invalid; `503` if no trainer; `429` if rate-limited.
- All error bodies are `{ error: string }`. No secret/internal leakage.

---

## UNIT A — `packages/shared` Phase 3a DTO contract (LANDS FIRST)

**Owner dirs:** `packages/shared/src/` only.

### Tasks

1. **Append the four DTOs + the type import** to `packages/shared/src/dtos.ts` exactly as in the Interface contract above (`CreateLeadInput`, `LeadDTO`, `CreateBookingInput`, `BookingDTO`). Add `BookingType, LeadStatus, BookingStatus` to the existing `import type … from './enums'` line. Do **not** modify any existing DTO. Do **not** edit the barrel (auto-exports).
2. **Verify purity + typecheck.** No runtime imports added. Run the shared typecheck.

### Acceptance (Unit A)
- `npm run typecheck -w packages/shared` passes (zero errors).
- `git grep -nE "drizzle|from 'pg'|aws|resend|better-auth|node:" packages/shared/src` returns nothing (NFR-6 purity).
- The four new symbols are importable: a throwaway `import type { LeadDTO, CreateLeadInput, BookingDTO, CreateBookingInput } from '@tailsup/shared'` type-checks. → maps to **AC-3a-1**.

### Commit
`feat(shared): Phase 3a lead/booking DTOs (LeadDTO, CreateLeadInput, BookingDTO, CreateBookingInput)`

---

## UNIT B — `apps/api` public capture endpoints (PARALLEL with C1)

**Owner dirs:** `apps/api/**` + root `.env.example`. **Depends on:** Unit A committed.

### Files
| Path | Action |
| --- | --- |
| `apps/api/src/lib/email.ts` | **New.** Lazy Resend wrapper; stub-not-throw when keyless; `sendLeadNotification(to, lead)`. |
| `apps/api/src/lib/trainer.ts` | **New.** `resolveTrainerId()` helper: `PRACTICE_TRAINER_ID` → sole/oldest trainer → throw (→ 503). Plus `getTrainerEmail(id)` lookup for the recipient. |
| `apps/api/src/routes/leads.ts` | **New.** `POST /leads` (Zod + insert + fire-and-forget email). |
| `apps/api/src/routes/bookings.ts` | **New.** `POST /bookings` (Zod + insert). |
| `apps/api/src/app.ts` | **Edit.** Import + `app.route('/', leads)` + `app.route('/', bookings)`; register `hono-rate-limiter` on the two POST paths. |
| `apps/api/src/test/leads.test.ts` | **New.** vitest. |
| `apps/api/src/test/bookings.test.ts` | **New.** vitest. |
| `apps/api/package.json` | **Edit.** Add `resend`, `hono-rate-limiter`. |
| `.env.example` (root) | **Edit.** Document `PRACTICE_TRAINER_ID` (optional) + `RESEND_FROM` (optional). |
| `README.md` | **Edit.** Add the Phase 3a API run/demo section (see Verification). |

### Tasks
1. **Install deps.** `npm i -w apps/api resend hono-rate-limiter` (pin `resend@^6.13.0`). Confirm no new advisories vs the existing baseline.
2. **`lib/trainer.ts` — `resolveTrainerId()`.** Read `PRACTICE_TRAINER_ID` at call time; if set, return it. Else `SELECT id FROM trainer ORDER BY <stable column> LIMIT 1` (use `createdAt` asc if present, else `id`); if a row exists, return its id. Else **throw** a clear error the route maps to `503 { error: 'practice not configured' }`. Add `getTrainerEmail(id): Promise<string | null>` (select `trainer.email`). **Do not** add these vars to `config.ts`.
3. **`lib/email.ts` — lazy stub (mirror `lib/r2.ts`, invert missing-key).**
   ```ts
   import { Resend } from 'resend';
   import type { LeadDTO } from '@tailsup/shared';
   let client: Resend | null = null;
   function getClient(): Resend | null {
     const key = process.env.RESEND_API_KEY;
     if (!key || key.trim() === '') return null;   // STUB path — NO throw
     client ??= new Resend(key);
     return client;
   }
   export async function sendLeadNotification(to: string | null, lead: LeadDTO): Promise<void> {
     const c = getClient();
     if (!c || !to) { console.log('[email:stub] new lead', { to, id: lead.id, name: lead.name, contact: lead.contact, source: lead.source }); return; }
     const { error } = await c.emails.send({
       from: process.env.RESEND_FROM ?? 'TailsUp <onboarding@resend.dev>',
       to, subject: `New lead: ${lead.name}`,
       html: `<p>New lead from ${lead.source}</p><p>${lead.name} — ${lead.contact}</p><p>${lead.message ?? ''}</p>`,
     });
     if (error) console.error('[email] resend error (non-fatal)', error); // resolves {data,error}, does not throw on API errors
   }
   ```
   `RESEND_API_KEY` stays **out of `config.ts`** (read lazily here).
4. **`routes/leads.ts`** — follow `sessions.ts` verbatim.
   ```ts
   const createLead = z.object({
     name: z.string().min(1).max(200),
     contact: z.string().min(1).max(200),
     source: z.string().min(1).max(100),
     message: z.string().max(2000).optional(),
   });
   ```
   Flow: validate → `const trainerId = await resolveTrainerId()` (catch → 503) → insert `lead` (status DB-default, `clientId: null`) `.returning()` → map to `LeadDTO` (`createdAt.toISOString()`) → look up `getTrainerEmail(trainerId)` → **`void sendLeadNotification(email, dto).catch((e) => console.error('[email] send failed (non-fatal)', e))`** (never await) → `c.json(dto, 201)`.
5. **`routes/bookings.ts`** — same template.
   ```ts
   const createBooking = z.object({
     type: z.enum(BOOKING_TYPES),
     requestedAt: z.string().datetime(),
     name: z.string().min(1).max(200),
     contact: z.string().min(1).max(200),
     notes: z.string().max(2000).optional(),
   });
   ```
   Flow: validate → `resolveTrainerId()` (→ 503) → insert `booking` (status DB-default `'requested'`, `leadId: null`, `clientId: null`, `requestedAt: new Date(body.requestedAt)`, `notes: \`[${name} · ${contact}] ${notes ?? ''}\`.trim()`) `.returning()` → map to `BookingDTO` (`requestedAt`/`createdAt` `.toISOString()`) → `c.json(dto, 201)`.
6. **Mount + rate-limit in `app.ts`.** Import both sub-apps; `app.route('/', leads)`; `app.route('/', bookings)`. Apply `hono-rate-limiter` scoped to the two POST paths (generous window, e.g. 10/min/IP; key by `x-forwarded-for` → connecting IP) returning `429 { error: 'too many requests' }`. **Leave `cors()` allow-all** (3b tightens it). Keep existing `onError`/`notFound`.
7. **`.env.example`** — under the Email section add `RESEND_FROM` (optional, default `onboarding@resend.dev` for dev); add a new short section documenting `PRACTICE_TRAINER_ID` (optional — "defaults to the single seeded trainer; set to pin the practice trainer for public leads/bookings").
8. **Tests (vitest, mirror `media.test.ts`).**
   - `leads.test.ts`: valid body → `201` + correct `LeadDTO` (`status:'new'`, `clientId:null`); missing field → `400`; **stub-email path** (no `RESEND_API_KEY`) → still `201` and stub log emitted (assert no throw); **resolveTrainerId throws** (no trainer, no env) → `503`. Mock `../db/client.js`, mock `./email.js` (or `resend`) to assert send is called/stubbed and **never blocks**.
   - `bookings.test.ts`: valid body → `201` (`status:'requested'`); bad `type` → `400`; bad/non-ISO `requestedAt` → `400`; no trainer → `503`.
   - Run the full suite: existing 133 still pass.

### Acceptance (Unit B → AC-3a-1, AC-3a-6, AC-3a-7, AC-3a-9, AC-3a-10)
- `npm run typecheck -w apps/api` passes; `npm run test -w apps/api` passes (133 existing + new).
- `git status apps/api/drizzle` shows **no changes** (no migration — AC ties to FR "no migration").
- Live-DB demo: with the API running + a seeded trainer, `POST /leads` → `201 LeadDTO` (`status:'new'`); with `RESEND_API_KEY` unset, still `201` + stub log; `POST /bookings` → `201 BookingDTO` (`status:'requested'`); invalid `type`/`requestedAt` → `400`; rapid repeats → `429`.
- **No 3b/4 leakage:** no auth middleware, no `PATCH /bookings/:id/status`, no `/leads/:id/convert`, `cors()` unchanged.

### Commit
`feat(api): Phase 3a public capture — POST /leads (+Resend stub) + POST /bookings, resolveTrainerId, rate-limit`

---

## UNIT C1 — `apps/mobile` FOUNDATION (PARALLEL with B; commits before C2)

**Owner dirs:** `apps/mobile/**`. **Depends on:** Unit A committed.

### Files
| Path | Action |
| --- | --- |
| `apps/mobile/package.json` | **Edit.** Add `expo-font`, `@expo-google-fonts/fraunces`, `@expo-google-fonts/inter`, `react-native-svg` (via `npx expo install`). |
| `apps/mobile/lib/theme.ts` | **New.** DS tokens (contract above). |
| `apps/mobile/lib/reducedMotion.ts` | **New.** `useReducedMotion()`. |
| `apps/mobile/app/_layout.tsx` | **Rewrite.** Root → `SafeAreaProvider` + `<StatusBar>` + `<Slot/>` (drop the `<Stack>`). |
| `apps/mobile/app/+html.tsx` | **New.** `<html lang="el">` shell, site-wide `<title>`/description defaults, favicon, `ScrollViewStyleReset`. |
| `apps/mobile/app/(site)/_layout.tsx` | **New.** Site chrome (`SiteChrome`) + `useFonts` + `<Head>` defaults; `<Stack screenOptions={{ headerShown:false }}>` or `<Slot/>`; **no auth guard**. |
| `apps/mobile/components/SiteChrome.tsx` | **New.** Header/nav (Greek) + deep-green footer. |
| `apps/mobile/components/ui/*` | **New.** `PrimaryButton`, `SecondaryButton`, `Eyebrow`, `Card`, `Section`, `ProofBand`, `Container`. |
| `apps/mobile/components/ProgressCurve.tsx` | **New.** Hand-rolled `react-native-svg` curve. |
| `apps/mobile/components/PracticeMap.web.tsx` | **New.** OSM `<iframe>`. |
| `apps/mobile/components/PracticeMap.native.tsx` | **New.** Card + `Linking`. |
| `apps/mobile/app/(app)/_layout.tsx` | **New.** The existing dark `<Stack>` header (moved from root); **no auth guard in 3a**. |
| `apps/mobile/app/(app)/health.tsx` | **Move.** From `app/index.tsx` → `/health`. Update its `Link href="/dogs"` (route name unchanged). |
| `apps/mobile/app/(app)/dogs/**`, `sessions/**`, `events/**` | **Move.** From `app/dogs|sessions|events` into `(app)/` verbatim — **behavior unchanged**. |
| `apps/mobile/lib/api.ts` | **Edit.** Add `createLead` + `createBooking`; import the two new DTOs. |

### Tasks (sequence)
1. **Install deps:** `npx expo install expo-font @expo-google-fonts/fraunces @expo-google-fonts/inter react-native-svg`. (Pin via expo-install, not bare npm.) If Metro fails to resolve, apply the documented fallback in `app/index.tsx:9-33` (do **not** add pre-emptively).
2. **Routing restructure (resolve the `/` collision — D-1).**
   - Rewrite root `app/_layout.tsx` to `SafeAreaProvider` + `<StatusBar>` + `<Slot/>` (no Stack).
   - Create `(app)/_layout.tsx` holding the existing dark `<Stack>` (`headerStyle #0f172a`, the four `Stack.Screen` titles) — moved from the old root. Add a `Stack.Screen name="health"` title.
   - **Move** `app/index.tsx` → `app/(app)/health.tsx` (rename default export ok). Move `app/dogs`, `app/sessions`, `app/events` under `app/(app)/`. Verify `Link href="/dogs"` still resolves (route name unchanged by the group).
   - Result URLs: `/` → site Home (C2), `/health` → health screen, `/dogs|/sessions/[id]/log|/events/[id]|/dogs/[id]/timeline` unchanged.
3. **`lib/theme.ts`** — the token contract above (RN-unit-converted letterSpacing/lineHeight).
4. **`lib/reducedMotion.ts`** — `useReducedMotion()` over `AccessibilityInfo`.
5. **`app/+html.tsx`** — research §5a shell: `<html lang="el">`, charset/viewport, fallback `<title>` + description (Greek), `<link rel="icon" href="/favicon.ico">`, `ScrollViewStyleReset`. Ensure a `favicon.ico` exists under `apps/mobile/public/` (or add the `<link>` only).
6. **`(site)/_layout.tsx` + `SiteChrome`** — `useFonts({ Fraunces_400Regular, Fraunces_500Medium, Inter_400Regular })` + `SplashScreen` gate (native) / brief FOUT (web). `<Head>` site defaults (research §5b). Chrome: sticky header (web) with Greek nav links to `/`, `/about`, `/services`, `/results`, `/contact`, `/booking` (use `Link`); deep-green footer with practice name + contact stub. Visible focus on nav links via `Pressable` `focused`.
7. **UI primitives** (`components/ui/*`) — each per DS-4, consuming `theme.ts`, with `Pressable` `{ hovered, focused, pressed }` interaction + visible focus ring; `Container` centers content at `layout.maxWidth`; `Section` provides vertical rhythm (`space.xl`/`xxl`) and `alt`/`dark` backgrounds; `ProofBand` = the once-per-page deep-green band.
8. **`ProgressCurve.tsx`** — `react-native-svg` `<Svg>` with: `<Defs><LinearGradient id={useId()}>` gold→transparent fill; a closed `<Path>` (`fill=url(#id)`) + a stroke-only `<Path>` (thin gold, `strokeWidth 2`, `fill none`) on a `colors.primary` panel (radius-lg). Catmull-Rom→Bézier smoothing. Explicit numeric `width`/`height` (measure container/`useWindowDimensions`). Guard `min===max` (flat line). Static curve acceptable; gate any draw-on animation on `useReducedMotion()`.
9. **`PracticeMap.web.tsx` / `.native.tsx`** — web = OSM `export/embed.html?bbox=…&layer=mapnik&marker=lat,lon` `<iframe loading="lazy">` (rounded, `height:320`); native = `Card` + `Pressable` → `Linking.openURL(osm deep link)`. Coords in-code (D-9). Keep `<iframe>` out of the native file entirely.
10. **`lib/api.ts`** — append:
    ```ts
    export function createLead(body: CreateLeadInput): Promise<LeadDTO> {
      return request<LeadDTO>('/leads', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
    }
    export function createBooking(body: CreateBookingInput): Promise<BookingDTO> {
      return request<BookingDTO>('/bookings', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
    }
    ```
    Import the two DTOs into the existing `import type` block. Leave `TRAINER_ID` untouched.

### Acceptance (Unit C1 → AC-3a-1, AC-3a-3 partial, AC-3a-4, AC-3a-8, AC-3a-10)
- `npm run typecheck -w apps/mobile` passes.
- `expo start --web` boots; `/health` and the existing trainer screens still render and behave as before (Phase 1/2 unchanged — AC-3a-10); `/dogs` link works.
- The `(site)/_layout.tsx` chrome renders with Greek nav + deep-green footer; fonts load (or fall back acceptably).
- `theme.ts` encodes the exact DS tokens; primitives + ProgressCurve + PracticeMap exist and are importable by C2.

### Commit (REQUIRED before C2 starts)
`feat(mobile): Phase 3a foundation — theme, fonts, (site)/(app) route groups, UI primitives, ProgressCurve, PracticeMap, api helpers`

---

## UNIT C2 — the six `(site)` pages (ONE agent, after C1 commit)

**Owner dirs:** `apps/mobile/app/(site)/*.tsx` only (consumes C1's exports). **Depends on:** Unit C1 committed.

### Files (all new)
| Path | Route | Page |
| --- | --- | --- |
| `apps/mobile/app/(site)/index.tsx` | `/` | **Home / Αρχική** — business-first |
| `apps/mobile/app/(site)/about.tsx` | `/about` | **About / Ποιοι είμαστε** |
| `apps/mobile/app/(site)/services.tsx` | `/services` | **Services / Υπηρεσίες** — progress-curve lives HERE |
| `apps/mobile/app/(site)/results.tsx` | `/results` | **Results / Αποτελέσματα** — placeholder data |
| `apps/mobile/app/(site)/contact.tsx` | `/contact` | **Contact / Επικοινωνία** — map + lead form |
| `apps/mobile/app/(site)/booking.tsx` | `/booking` | **Booking** — booking form |

### Tasks
1. **Home (`index.tsx`)** — **business-first** (DS-7 / AC-3a-2): the practice's headline promise (calm, expert, trustworthy dog training) + primary CTAs (`PrimaryButton` → `/booking`, `SecondaryButton` → `/contact`). **Exactly one** bold/proof moment (a single `ProofBand` or hero statement). The data platform is **NOT** the hero — at most a teaser linking into Services. **No `ProgressCurve` on Home.** `<Head>` title/description per research §5d.
2. **About (`about.tsx`)** — practice, method, trainer(s), credentials; "proof not promises" tone; `Eyebrow` + `Section`s + `Card`s. Greek body copy (D-4). `<Head>`.
3. **Services (`services.tsx`)** — service catalogue as peers (assessments/private/group mapping to `BOOKING_TYPES`) + the **data-driven progress-tracking premium service**. **This is the ONLY page with `ProgressCurve`** (sample/placeholder data), framed as proof of method. Optional per-service "Book this" link to `/booking`. `<Head>`.
4. **Results (`results.tsx`)** — render from an in-code placeholder array `{ dogName, summary, before, after, curveData }[]` (D-5), `Card` per case. May reuse `ProgressCurve` for an outcome arc. Clearly placeholder, not fabricated testimonials. `<Head>`.
5. **Contact (`contact.tsx`)** — address, opening hours, phone, email (in-code, D-9) + `<PracticeMap/>` (keyless) + the **lead form** (`name`, `contact`, optional `message`; page sets `source: 'website-contact'`). Submit → `createLead(...)`; discriminated-union `Status` (idle/pending/success/error) like the Phase 1 health screen; on success confirm receipt. Visible focus, `prefers-reduced-motion` respected. `<Head>`.
6. **Booking (`booking.tsx`)** — form: `type` selector (`assessment|private|group` from `BOOKING_TYPES`), requested date/time → ISO `requestedAt`, `name`, `contact`, optional `notes`. Submit → `createBooking(...)`; pending/success/error states; on success confirm the practice will respond. `<Head>`.
7. **Consistency pass** — every page uses `Section`/`Container` rhythm, the type scale, `≤ 1` `ProofBand`/bold moment per page, generous whitespace (DS-3), copper only on small details. Responsive at narrow + wide via `useBreakpoint`/`useWindowDimensions` (column→row).

### Acceptance (Unit C2 → AC-3a-1, AC-3a-2, AC-3a-3, AC-3a-4, AC-3a-5, AC-3a-7, AC-3a-8)
- `npm run typecheck -w apps/mobile` passes.
- All six routes render on `expo start --web` with the Design-System chrome, no auth required (AC-3a-3).
- **Home is business-first**, no progress-curve; the **progress-curve appears only on Services** (and optionally Results) (AC-3a-2).
- Contact shows location + keyless map + a lead form that POSTs to `/leads` and shows pending→success (AC-3a-5); Booking POSTs to `/bookings` (AC-3a-7).
- Visible focus + reduced-motion + responsive hold (AC-3a-8).

### Commit
`feat(mobile): Phase 3a — six (site) pages (Home/About/Services/Results/Contact/Booking) on the Design System`

---

## Verification (overall — run after all units + at integration)

Run from the repo root unless noted.

1. **Typecheck all workspaces (AC-3a-1):**
   `npm run typecheck --workspaces` → zero errors across `@tailsup/shared`, `apps/api`, `apps/mobile`.
2. **API tests (AC-3a-6/7/9):**
   `npm run test --workspaces` (or `npm run test -w apps/api`) → all pass (133 existing + new lead/booking tests).
3. **No migration (FR / scan §5):**
   `git status --porcelain apps/api/drizzle` → **empty**. (No new `.sql` under `apps/api/drizzle`.)
4. **Shared purity (NFR-6):**
   `git grep -nE "drizzle|from 'pg'|aws|resend|better-auth|node:" packages/shared/src` → no matches.
5. **Static web export + SEO grep (AC-3a-3 + D-6):**
   `cd apps/mobile && npx expo export --platform web` → completes; `dist/` contains `index.html`, `about.html`, `services.html`, `results.html`, `contact.html`, `booking.html`.
   `Get-Content apps/mobile/dist/about.html | Select-String "<title>|<meta name"` (PowerShell) → confirm a page `<title>`.
   - **If the per-page `<title>` is present:** static head works on SDK 54 — done.
   - **If absent:** apply the research fallback (Option A: React-19 bare `<title>`/`<meta>` web-guarded; else Option C: site-wide default in `+html.tsx`, client-side per-page head). **Not a blocker** — the export still succeeds and pages render.
6. **Live-DB demo path (AC-3a-5/6/7):** with a seeded `trainer` row (or `PRACTICE_TRAINER_ID` set) and the API running (`npm run dev -w apps/api`):
   ```sh
   # POST /leads → 201, status 'new', stub-email log when RESEND_API_KEY unset
   curl -s -X POST localhost:3000/leads -H 'content-type: application/json' \
     -d '{"name":"Maria P.","contact":"maria@example.com","source":"website-contact","message":"My dog reacts to bikes."}'
   # POST /bookings → 201, status 'requested'
   curl -s -X POST localhost:3000/bookings -H 'content-type: application/json' \
     -d '{"type":"assessment","requestedAt":"2026-07-01T10:00:00.000Z","name":"Maria P.","contact":"maria@example.com","notes":"Mornings preferred."}'
   # invalid type → 400 ; rapid repeats → 429
   ```
   Then on Expo web, submit the Contact lead form and the Booking form and confirm rows insert (`status 'new'` / `'requested'`).
7. **Business-first inspection (AC-3a-2):** read the rendered Home — practice-first, no progress-curve; confirm the curve only on Services.
8. **No 3b/4 leakage (AC-3a-10):** grep the diff for `better-auth`, `AUTH_SECRET` reads, `PATCH /bookings`, `/convert`, `/summary` → none. `cors()` still allow-all. Phase 1/2 screens/endpoints unchanged.

---

## Success criteria (Phase 3a — maps to AC-3a-1..AC-3a-10)

| AC | Criterion | Verified by |
| --- | --- | --- |
| **AC-3a-1** | Typecheck passes across all three workspaces incl. new routes/theme/DTOs | Verify §1 |
| **AC-3a-2** | Business-first Home; progress-curve only in Services (+ optionally Results) | C2; Verify §7 |
| **AC-3a-3** | All six pages exist and render on Expo web, no auth | C1+C2; Verify §5 |
| **AC-3a-4** | Design System tokens/scale/components applied | C1 theme + C2 usage |
| **AC-3a-5** | Contact: location + keyless map + working lead form → `POST /leads` | C2 + B; Verify §6 |
| **AC-3a-6** | `POST /leads` → 201 + Resend stub when keyless, never blocks insert | B; Verify §2/§6 |
| **AC-3a-7** | Booking page + `POST /bookings` → 201 `'requested'`; bad input → 400 | C2 + B; Verify §6 |
| **AC-3a-8** | Quality floor: visible focus, prefers-reduced-motion, responsive | C1+C2; Verify §5 |
| **AC-3a-9** | Public-endpoint hardening: rate limit + input-size caps | B; Verify §6 |
| **AC-3a-10** | No Phase 3b/4 leakage; Phase 1/2 unchanged | B+C1; Verify §3/§8 |

---

## Risk table

| Risk | Likelihood | Impact | Mitigation (baked into the plan) |
| --- | --- | --- | --- |
| **SEO static-head uncertain** on SDK 54 (issue #833 history) | Medium | Low | Verify §5 (`expo export` + grep). Documented fallbacks: React-19 bare tags (web-guarded) → client-side-only head. **Not a blocker** (D-6). |
| **`react-native-svg` web gradient id collisions** (two curves on one page reuse the first `<LinearGradient>`) | Medium | Medium | Per-instance gradient id via `useId()` in `ProgressCurve` (C1 task 8). |
| **RN-Web style limits / responsive** (no media queries; web-only props rejected by RN types) | Medium | Low | `useWindowDimensions`/`useBreakpoint` for breakpoints; web-only props via narrow `Platform.select({ web: {…} as any })` (sticky header, cursor, outline). |
| **Font FOUT on web** | High | Low | Acceptable `Georgia`/`system-ui` fallbacks in `theme.ts` + `FontDisplay.SWAP`; never block the whole web site on font load (DS-2 quality floor). |
| **`/` route collision** (two `index` at `/`) | High if unhandled | High | D-1: Home owns `/`; health → `(app)/health.tsx` (`/health`); move done in C1 task 2; verify `/dogs` link. |
| **Email stub must NOT block the 201** (awaiting Resend couples latency / can 5xx) | Medium | High | Fire-and-forget `void send(...).catch(...)`, never awaited; `RESEND_API_KEY` out of `config.ts`; tests assert 201 regardless (B task 4/8). |
| **`resolveTrainerId()` throw path** (no trainer + no env → could 500 / FK violation) | Medium | Medium | Explicit throw → mapped `503 { error: 'practice not configured' }`; never insert empty `trainerId`; tested (B task 8). |
| **Homepage drifts into app-showcase** (violates business-first DS-7) | Medium | Medium | AC-3a-2 inspection; C2 task 1 forbids the curve on Home and limits to one bold moment; Services owns the data-platform framing. |
| **`<iframe>` leaks into native bundle** (RN rejects unknown element) | Low | Medium | `PracticeMap.web.tsx`/`.native.tsx` platform split (C1 task 9); no `<iframe>` JSX in shared/native code. |
| **Metro monorepo resolution** of new font/svg packages | Low | Medium | `npx expo install` (not bare npm); documented `metro.config.js` fallback in `app/index.tsx:9-33` if needed (do not add pre-emptively). |
| **CORS for web lead/booking POSTs** (allow-all is fine for 3a; tightening is 3b) | Low | Low | Leave `cors()` allow-all in 3a (existing comment anticipates 3b); no change. |
| **Rate-limiter IP behind proxy** (in-memory, single-instance) | Low | Low | Generous window keyed by `x-forwarded-for` → connecting IP; documented that prod adds an edge limiter (D-8). |

---

## Deviation rules (during execution)

1. **Auto-fix bugs** — broken behavior → fix immediately, note in the summary.
2. **Auto-add missing critical** — a security/correctness gap (e.g. an un-caught email rejection that could crash Node) → add immediately, document.
3. **Auto-fix blockers** — can't proceed (e.g. Metro can't resolve a font package) → apply the documented fallback, document.
4. **Ask about architectural** — any change to the route-group structure, the DTO shapes, the endpoint contracts, or adding a dependency beyond the listed set → **stop and ask the user**.
5. **Log enhancements** — nice-to-haves (animations, extra pages, per-service deep-link prefill) → log, do not build now.

All deviations recorded in the build summary with: what was found, which rule applied, what was done.

---

## Out of scope for Phase 3a (do NOT build — Phase 3b / 4)

- BetterAuth, `AUTH_SECRET` reads, `/login`, session/auth guards, CORS tightening, `EXPO_PUBLIC_TRAINER_ID` replacement → **3b**.
- `PATCH /bookings/:id/status`, `POST /leads/:id/convert`, trainer/client read endpoints, `/me/*` → **3b**.
- Client dashboard (threshold graph, homework, reminders), trainer leads/bookings management screens → **3b**.
- `POST /dogs/:id/summary` (Anthropic), spend cap, multi-tenant prep → **4**.
- Real production deploy / domain; a CMS for site copy; full i18n / language switcher.

---

_Phase 1 plan: `docs/design/plan-001-tailsup-phase1-foundations.md` · Phase 2 plan: `docs/design/plan-002-tailsup-phase2-trainer-view.md` · This plan: `docs/design/plan-003-tailsup-phase3a-public-site.md`._
