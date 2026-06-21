---
language: typescript
framework: hono (api) / expo-router (mobile)
package_manager: npm (workspaces)
build_command: "npm run build --workspaces --if-present  # fans out; api: tsc --noEmit, mobile: tsc --noEmit"
test_command: "npm run test --workspaces --if-present  # api: vitest run (133 tests); mobile: no test runner yet"
lint_command: null
entry_points:
  - apps/api/src/index.ts
  - apps/api/src/app.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/index.tsx
  - packages/shared/src/index.ts
last_scanned_commit: fb0b257cb2ba555a6e6a061fc4e564a3b68757e3
scanned_for_request: refined-request-phase3.md (Phase 3a scope only)
scanned_at: "2026-06-21T00:00:00Z"
---

# Codebase Scan — TailsUp (Phase 3a integration view)

## 1. Project Overview

TailsUp is a TypeScript npm-workspaces monorepo (Node ≥ 20) with three packages: `apps/api` (Hono 4 + Drizzle ORM + node-postgres, ESM, `tsx` dev-runner), `apps/mobile` (Expo Router SDK 54, React Native 0.81 / React 19, targets iOS / Android / web via Metro), and `packages/shared` (pure-TS enums + DTOs, Metro-safe, no runtime imports). The API is composed in `apps/api/src/app.ts`; the mobile root layout is `apps/mobile/app/_layout.tsx`. All workspace typechecks fan out from the root `npm run typecheck --workspaces`. As of Phase 2, 133 vitest tests pass; no mobile test runner exists yet.

---

## 2. Module Map

### `apps/api/src/`

| Path | Purpose | Key symbols |
|---|---|---|
| `index.ts` | Node HTTP entrypoint — serves the Hono app on `config.port` (default 3000) | `serve`, `app`, `config` |
| `app.ts` | App composition — mounts all route sub-apps, `cors()`, `onError`, `notFound` | `app`, `health`, `sessions`, `dogs`, `events`, `media` |
| `config.ts` | Validated env loader — `required()` throws on missing vars; `PORT` is the only optional | `config`, `required` |
| `db/schema.ts` | Full 12-table Drizzle schema + 6 pgEnums; enums sourced from `@tailsup/shared` | `lead`, `booking`, `trainer`, `client`, `behaviorEvent`, all pgEnums |
| `db/client.ts` | Drizzle/pg client with `casing: 'snake_case'`; imports `config.databaseUrl` | `db`, `pool`, `schema` |
| `lib/r2.ts` | Lazy-config R2/S3 module — `getR2Config()` reads creds at call time (not at boot), maps throws → 503 | `getR2Config`, `presignPutUrl`, `presignGetUrl`, `buildKey` |
| `routes/health.ts` | `GET /health` — DB liveness check | `health` |
| `routes/sessions.ts` | `POST /sessions/:id/events` (4-tap log) + `GET /sessions/:id/events` | `sessions`, `eventBody` (Zod schema) |
| `routes/dogs.ts` | `GET /trainers/:trainerId/dogs`, `GET /dogs/:id`, `GET /dogs/:id/timeline`, `POST /dogs/:id/sessions` | `dogs` |
| `routes/events.ts` | `GET /events/:id`, `PATCH /events/:id` | `events` |
| `routes/media.ts` | `POST /media/presign`, `POST /events/:id/media`, `GET /media/:id/url` | `media` |
| `test/*.test.ts` | 8 vitest test files (133 tests) covering all routes + config + r2 | `vi.mock`, `app.request()` pattern |

### `apps/mobile/`

| Path | Purpose | Key symbols |
|---|---|---|
| `app/_layout.tsx` | Root layout — `<SafeAreaProvider>` + single `<Stack>` registering all current screens | `RootLayout`, `Stack`, `SafeAreaProvider` |
| `app/index.tsx` | Phase 1 health screen — `GET /health` connectivity proof | `API_URL`, `HealthDTO` |
| `app/dogs/index.tsx` | Trainer dog list | uses `getDogs`, `TRAINER_ID` |
| `app/dogs/[id]/timeline.tsx` | Dog timeline screen | uses `getDogTimeline` |
| `app/sessions/[id]/log.tsx` | 4-tap event log screen | uses `postEvent`, `startSession` |
| `app/events/[id].tsx` | Event detail + video playback | uses `getEvent`, `getMediaPlaybackUrl` |
| `lib/api.ts` | Typed fetch client — all API calls, `ApiError`, `TRAINER_ID` stop-gap | `request<T>`, `ApiError`, `TRAINER_ID`, `API_URL` |
| `lib/upload.ts` | Direct-to-R2 upload helper (uses presign + PUT) | `uploadVideo` |
| `app.json` | Expo config — `web.bundler: metro`, `web.output: static`, `experiments.typedRoutes: true`, new arch enabled | — |
| `babel.config.js` | `babel-preset-expo` only (expo-router needs no separate plugin in SDK 54) | — |

### `packages/shared/src/`

| Path | Purpose | Key symbols |
|---|---|---|
| `enums.ts` | 6 `as const` arrays + union types (single source of truth for pgEnums, Zod, and mobile) | `LEAD_STATUSES`, `BOOKING_TYPES`, `BOOKING_STATUSES`, `TRIGGER_TYPES`, `OUTCOMES`, `MEDIA_TYPES` |
| `dtos.ts` | Phase 1+2 DTOs (interfaces only, no runtime imports) | `BehaviorEventDTO`, `DogSummaryDTO`, `DogTimelineDTO`, `PresignResponse`, `MediaDTO` |
| `index.ts` | Barrel — `export * from './enums'; export * from './dtos'` | — |

---

## 3. Conventions

- **Zod + `@hono/zod-validator` pattern** (`apps/api/src/routes/sessions.ts:30-38`): Zod schemas are built from `@tailsup/shared` const arrays via `z.enum(BOOKING_TYPES)` etc. The `zValidator('json', schema)` middleware auto-replies `400` on failure; the handler reads `c.req.valid('json')` for type-safe access. Every new route should follow this exact pattern.
- **Throw-on-missing config, no fallbacks** (`apps/api/src/config.ts:7-14`): A `required(name)` helper throws at module import time if the var is absent. `PORT` is the lone optional. R2 vars use an identical inline `requiredR2()` helper in `lib/r2.ts:45-51` but deferred to call time (the lazy-config pattern). Phase 3a's `RESEND_API_KEY` must NOT use `required()` — it must be a stub/no-op when absent.
- **ESM `.js` import specifiers in the API** (`apps/api/src/routes/sessions.ts:27-28`): All intra-package imports use `.js` extensions even though source files are `.ts` (ESM + `tsx` convention). Imports from `@tailsup/shared` use the workspace name bare.
- **Static `EXPO_PUBLIC_*` dot-access only in mobile** (`apps/mobile/lib/api.ts:34,38`): `process.env.EXPO_PUBLIC_API_URL` and `process.env.EXPO_PUBLIC_TRAINER_ID` are accessed directly by name (no destructuring, no computed keys) so Metro's build-time inlining works.
- **`{ error: '...' }` JSON error bodies** (`apps/api/src/app.ts:38,41`): Every non-2xx response body has exactly `{ error: string }`. Validated by all existing tests and expected by `lib/api.ts:readErrorMessage`.
- **Vitest test pattern** (`apps/api/src/test/health.test.ts:1-30`): `vi.hoisted()` creates mocks before the factory; `vi.mock('dotenv/config', () => ({}))` neutralizes side-effect; `process.env.DATABASE_URL` is seeded before imports; the Hono app is exercised via `app.request(...)` (no HTTP server). New Phase 3a tests must replicate this setup.

---

## 4. Integration Points (Phase 3a)

### In-Scope — API side

**`apps/api/src/app.ts`** (lines 1–42) — The central mounting file. Phase 3a adds two new route sub-apps:
```
import { leads }    from './routes/leads.js';
import { bookings } from './routes/bookings.js';
app.route('/', leads);
app.route('/', bookings);
```
The existing `cors()` (line 21, currently allow-all) carries a comment already flagging Phase 3 restriction. For 3a (no cookies yet), it can stay allow-all or be pre-tightened with an `ALLOWED_ORIGINS` env var — but that is a 3b hard requirement. Rate-limiting middleware for `POST /leads` and `POST /bookings` also registers here or inside the sub-apps.

**`apps/api/src/routes/sessions.ts`** (lines 17–38) — The canonical template for new routes. Phase 3a creates `apps/api/src/routes/leads.ts` and `apps/api/src/routes/bookings.ts` following the identical `Hono` sub-app + `zValidator('json', schema)` + `z.enum(BOOKING_TYPES)` pattern from this file.

**`apps/api/src/config.ts`** (lines 8–21) — `RESEND_API_KEY` must NOT be added to the `required()` set here. It is intentionally optional; the email module reads it lazily (see below).

**`apps/api/src/lib/r2.ts`** (lines 44–67) — The exact template for `apps/api/src/lib/email.ts` (new). Replicate the lazy-config pattern: a `getResendConfig()` function that reads `RESEND_API_KEY` at call time, but instead of throwing on missing it logs a structured no-op and returns. The R2 module throws on missing (mapped to 503); the email module stubs on missing (insert still returns 201). This is the one deliberate divergence from the throw-on-missing rule.

**`apps/api/src/db/schema.ts`** — `lead` and `booking` tables already exist with the exact columns below. Phase 3a needs **no migration**:

| Table | Columns (TS camelCase) | Notes |
|---|---|---|
| `lead` | `id` uuid PK, `trainerId` uuid NOT NULL FK→trainer, `name` text NOT NULL, `contact` text NOT NULL, `source` text NOT NULL, `message` text nullable, `status` leadStatusEnum default `'new'`, `clientId` uuid nullable FK→client, `createdAt` timestamptz defaultNow | Line 138–150 |
| `booking` | `id` uuid PK, `trainerId` uuid NOT NULL FK→trainer, `leadId` uuid nullable FK→lead, `clientId` uuid nullable FK→client, `type` bookingTypeEnum NOT NULL, `requestedAt` timestamptz NOT NULL, `status` bookingStatusEnum default `'requested'`, `notes` text nullable, `createdAt` timestamptz defaultNow | Lines 156–168 |
| `trainer` | `id` uuid PK, `name` text NOT NULL, `email` text NOT NULL | Line 73–77 — `email` column is the Resend notification target for `POST /leads` |

The `trainerId` for public writes (OQ-8) resolves to the single seeded trainer. A helper query `SELECT id FROM trainer LIMIT 1` (or a seeded UUID in env) is needed in the route handler.

**`apps/api/src/test/`** — New test files `leads.test.ts` and `bookings.test.ts` follow the `vi.hoisted()` + `vi.mock('../db/client.js')` + `app.request()` pattern established in `health.test.ts` and `media.test.ts`.

**`.env.example`** — `RESEND_API_KEY` (line ~45) is already documented as "Phase 3 only — stubbed when absent." No new vars needed for 3a unless `EXPO_PUBLIC_TRAINER_ID` is used as the trainer-resolution fallback (already present). A `WEB_ORIGIN` / `ALLOWED_ORIGINS` var may be added now for documentation, even if CORS tightening waits for 3b.

### In-Scope — Shared package

**`packages/shared/src/enums.ts`** (lines 8–10) — `LEAD_STATUSES`, `BOOKING_TYPES`, `BOOKING_STATUSES` and their union types already exist; they are reused unchanged. For 3a, add `ROLES = ['trainer', 'client'] as const` (and `type Role`) to this file if desired, but it is not strictly required for 3a.

**`packages/shared/src/dtos.ts`** — Add the following interfaces for Phase 3a (pure TS, no imports from server/runtime):
- `LeadDTO` — mirrors the `lead` table row shape (all fields, `createdAt` as ISO string)
- `CreateLeadInput` — `{ name: string; contact: string; source: string; message?: string }`
- `BookingDTO` — mirrors the `booking` table row shape (`requestedAt` as ISO string)
- `CreateBookingInput` — `{ type: BookingType; requestedAt: string; notes?: string }` (plus any contact fields per OQ-8)

### In-Scope — Mobile side

**`apps/mobile/app/_layout.tsx`** (lines 1–37) — The current root layout is a flat `<Stack>` with hardcoded `Stack.Screen` entries. Phase 3a introduces a `(site)` route group; this file must be restructured so the public site group uses its own layout (Design System chrome: header/nav/footer) while the existing screens keep the current dark header. The recommended approach is:

```
app/
  _layout.tsx           ← root: SafeAreaProvider + Slot (not Stack)
  (site)/
    _layout.tsx         ← site chrome: DS header/nav/footer + no auth guard
    index.tsx           ← /  (Αρχική)
    about.tsx           ← /about
    services.tsx        ← /services
    results.tsx         ← /results
    contact.tsx         ← /contact
    booking.tsx         ← /booking
  (app)/
    _layout.tsx         ← existing Stack header + future auth guard
    index.tsx           ← /health (move from app/index.tsx)
    dogs/
    sessions/
    events/
```

The root `_layout.tsx` changes from a `<Stack>` to a `<Slot>` (or `<Stack>` with no `screenOptions` at root) and delegates chrome to group-level layouts. The `Stack.Screen` registrations move to `(app)/_layout.tsx`.

**`apps/mobile/app.json`** — No changes required for 3a. `web.bundler: metro` + `web.output: static` + `experiments.typedRoutes: true` are already configured. The `(site)` route group is a zero-config Expo Router feature (parenthesized dirs are recognized automatically).

**`apps/mobile/babel.config.js`** — No changes needed; `babel-preset-expo` handles everything including expo-router in SDK 54.

**Metro config** — No `metro.config.js` exists currently (SDK 54 auto-configures for npm workspaces). Do not create one pre-emptively. If `@tailsup/shared` or the new font packages fail to resolve, the comment in `app/index.tsx:13-36` documents the exact fallback config to add.

**`apps/mobile/lib/api.ts`** — Add public-endpoint helpers at the bottom following the existing pattern:
```ts
export function postLead(body: CreateLeadInput): Promise<LeadDTO> {
  return request<LeadDTO>('/leads', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
}
export function postBooking(body: CreateBookingInput): Promise<BookingDTO> {
  return request<BookingDTO>('/bookings', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
}
```
No authentication header is needed (public endpoints). The `TRAINER_ID` stop-gap (line 38) is unchanged in 3a.

**Custom fonts (Fraunces + Inter)** — Neither `expo-font` nor `@expo-google-fonts/*` packages are currently installed. Phase 3a must add them:
- `expo install expo-font @expo-google-fonts/fraunces @expo-google-fonts/inter`
- Load fonts in the `(site)/_layout.tsx` via `useFonts` hook before rendering the chrome.
- Fallbacks (`Georgia` for Fraunces, `system-ui` for Inter) must render acceptably if fonts fail to load (DS-2 quality floor).
- No `app.json` plugin change needed for web font loading (Metro handles it); native needs the `expo-font` Babel plugin only if using `@expo-google-fonts`.

**Design System theme module** — Does not exist yet. Create `apps/mobile/lib/theme.ts` (or `theme/index.ts`) encoding the DS-1 color tokens, DS-2 type scale, DS-3 spacing/radii, and DS-4 component style primitives as plain JS/TS constants (`StyleSheet`-compatible values). All six site pages and the `(site)/_layout.tsx` chrome import from this module.

### Out-of-Scope for Phase 3a (do not touch)

- `apps/api/src/routes/dogs.ts`, `events.ts`, `sessions.ts`, `media.ts` — existing trainer endpoints; Phase 3a must not modify them.
- `apps/mobile/app/dogs/`, `sessions/`, `events/` — existing trainer screens; move to `(app)/` group but do not alter behavior.
- BetterAuth integration, `AUTH_SECRET` config, session guards — Phase 3b only.
- `PATCH /bookings/:id/status`, `POST /leads/:id/convert` — Phase 3b only.
- Client dashboard, homework, reminders — Phase 3b only.
- `EXPO_PUBLIC_TRAINER_ID` replacement — Phase 3b only. The stop-gap stays in `lib/api.ts` through 3a.
- AI / Anthropic endpoint — Phase 4.

### New Integration Points (not yet in codebase)

| What | Where it lands | Notes |
|---|---|---|
| `apps/api/src/routes/leads.ts` | New file; mounted in `app.ts` | `POST /leads` — Zod validation, DB insert, email stub trigger |
| `apps/api/src/routes/bookings.ts` | New file; mounted in `app.ts` | `POST /bookings` — Zod validation, DB insert |
| `apps/api/src/lib/email.ts` | New file; imported by `routes/leads.ts` | Resend wrapper with lazy-stub; mirrors `lib/r2.ts` structure |
| `apps/mobile/app/(site)/_layout.tsx` | New file; Expo Router group layout | DS chrome (header/nav/footer), font loading, no auth guard |
| `apps/mobile/app/(site)/*.tsx` | 6 new route files | Home, About, Services, Results, Contact, Booking |
| `apps/mobile/lib/theme.ts` | New file | Design System tokens, type scale, spacing, component styles |
| `packages/shared/src/dtos.ts` | Extend existing file | Add `LeadDTO`, `CreateLeadInput`, `BookingDTO`, `CreateBookingInput` |
| `apps/api/src/test/leads.test.ts` | New file | vitest — POST /leads (201, validation, stub email, Resend-absent) |
| `apps/api/src/test/bookings.test.ts` | New file | vitest — POST /bookings (201, validation 400, bad type/date) |

---

## 5. Notes

- **Design System source is in `prompts/001-tailsup-kickoff.md`**, not a dedicated file. The exact color tokens (DS-1), typography scale (DS-2), spacing (DS-3), component specs (DS-4), progress-curve (DS-5), and principles (DS-6/DS-7) live only in that kickoff document. A `docs/design/design_system.md` reference file should be created before or during Phase 3a implementation so the theme module has a stable, linkable spec — the kickoff is authoritative but not a developer-friendly reference during implementation.
- **`expo-font`, `@expo-google-fonts/fraunces`, and `@expo-google-fonts/inter` are absent** from `apps/mobile/package.json`. The Design System mandates Fraunces (display) and Inter (body). These are new dependencies that must be installed before the theme module can load custom fonts on web or native.
- **No mobile test runner exists**. The existing `apps/mobile/package.json` has no `test` script and no test framework installed. Phase 3a adds no mobile tests (consistent with Phases 1–2), but if component-level testing of the site pages is desired, it requires a separate setup step not currently in scope.
- **The one committed Drizzle migration** (`apps/api/drizzle/0000_amused_brood.sql`) already contains the `lead` and `booking` tables. Phase 3a adds zero schema migrations. The next migration (if any) is BetterAuth's generated migration in Phase 3b.
