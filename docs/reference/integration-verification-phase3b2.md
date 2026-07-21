# Integration Verification — Phase 3b-2 (Role dashboards + lead/booking management)

Status: **READY for review** (one manual live-DB step pending — see §4).

Whole-monorepo integration verification (2026-07-21, Node v20.20.2 / npm 10.8.2,
TypeScript 5.9.3, Windows 11). Verified against `refined-request-phase3.md` (the
**Phase 3b** ACs), `plan-004-tailsup-phase3b2-dashboards.md`, and the live
committed code (`deb3335`). **No live PostgreSQL** here (by design, matching the
Phase 3a / 3b-1 checkpoints) — DB-runtime ACs are covered by the mocked vitest
suite + static review; the live per-role walkthrough is a documented manual step
(§4). Phase 3b-2 completes Phase 3.

Phase 3b-2 turns the 3b-1 authed shell into a working two-audience product: a
**client dashboard** (threshold-over-time graph reusing the 3a `ProgressCurve`, a
homework list with mark-complete, in-app derived reminders) and a **trainer
management** area (triage leads/bookings, convert a lead → client, provision that
client's login, transition a booking's status), backed by role-scoped auth'd
endpoints. No schema migration — reads/writes existing columns only.

## 0. Verdict

**READY** for the user's Phase 3 review. All automated gates are green:
typecheck (3 workspaces) exit 0 · **226/226 API tests pass** · no migration ·
`@tailsup/shared` pure · no Phase 4 leakage · Expo **web export** exit 0 (all 31
routes, incl. `/client`, `/manage/leads`, `/manage/bookings`).

**One working-tree fix was required this pass** (see §3, FIX-1): the 3b-2 commit
left `apps/api/tsconfig.json` with an invalid `"ignoreDeprecations": "6.0"` that
TypeScript 5.9.x rejects (`TS5103`), which blocked the API typecheck (AC-3b-1).
The line was removed (the base config has no deprecated options; `apps/mobile`
and `apps/shared` extend the same base without it). After the fix, all three
workspaces typecheck clean — reconciling the repo with what `README.md` already
claims ("typecheck → clean", "226 pass").

## 1. What was built (3b-2)

| Area | Files |
| --- | --- |
| Shared | `packages/shared/src/dtos.ts` — `UpdateBookingStatusInput`, `ClientDTO`, `ConvertLeadResponse`, `CreateClientLoginInput`, `ClientLoginDTO`, `HomeworkDTO`, `UpdateHomeworkInput`, `ProgressPointDTO`, `ClientProgressDTO` (9 new, pure TS, auto-exported via barrel) |
| API — trainer | `apps/api/src/routes/management.ts` — `GET /trainers/:trainerId/leads`, `GET /trainers/:trainerId/bookings`, `PATCH /bookings/:id/status`, `POST /leads/:id/convert`, `POST /clients/:id/login` (mutations carry route-scoped `requireTrainer`) |
| API — client | `apps/api/src/routes/me.ts` — `GET /me/progress`, `GET /me/homework`, `PATCH /me/homework/:id`, `GET /me/bookings` |
| App wiring | `apps/api/src/app.ts` — mount `management` + `me`, single `app.use('/me/*', requireClient)` prefix guard (public `POST /leads|/bookings` stay open) |
| Tests | `apps/api/src/test/management.test.ts` (24), `apps/api/src/test/me.test.ts` (17) |
| Mobile — api | `apps/mobile/lib/api.ts` — 9 helpers (`getTrainerLeads/Bookings`, `updateBookingStatus`, `convertLead`, `createClientLogin`, `getMyProgress/Homework/Bookings`, `completeHomework`) |
| Mobile — primitives | `apps/mobile/components/StatusBadge.tsx`, `components/HomeworkRow.tsx` |
| Mobile — screens | `app/(app)/client.tsx` (dashboard — replaces placeholder), `app/(app)/manage/leads.tsx`, `app/(app)/manage/bookings.tsx`, `(app)/_layout.tsx` (registers `manage/*`), `(app)/dogs/index.tsx` (nav to management) |
| Docs | `README.md` Phase 3b-2 section (endpoints, seed logins, per-role curl walkthrough, verify) |

## 2. Verified (automated) ✅

- **Typecheck — all 3 workspaces** — `npm run typecheck --workspaces` → **exit 0**
  (`@tailsup/shared`, `apps/api`, `apps/mobile`) after FIX-1. (AC-3b-1)
- **API tests — 226 pass / 16 files** — `npm run test -w apps/api` → exit 0. Adds
  `management.test.ts` (24) + `me.test.ts` (17) on top of the 3b-1 suite (185).
  The `[email:stub]` / `[email] send failed (non-fatal)` lines are expected
  fire-and-forget/stub test output, not failures. (AC-3b-12)
  - Role rejection asserted **by request** (not UI): client→trainer-mutation
    `403`, trainer→`/me/*` `403`, cross-owner `404`, unauthenticated `401`.
    (AC-3b-6)
  - `PATCH /bookings/:id/status`: valid → `200`; `requested`/garbage → `400`;
    not-theirs → `404`. (AC-3b-7)
  - `POST /leads/:id/convert`: `201` (client row + lead `converted`+`clientId` in
    one txn); already-converted → `409`; not-theirs → `404`. (AC-3b-8)
  - `POST /clients/:id/login`: `201` (role/clientId patched); dup email → `409`;
    client not-theirs → `404`.
- **No migration** — `git status --porcelain apps/api/drizzle` → **empty**;
  `schema.ts` unchanged. 3b-2 reads/writes existing columns only. (AC-3b-2 not
  regressed)
- **`@tailsup/shared` purity** — `git grep -nE "drizzle|from 'pg'|aws|resend|better-auth|node:" packages/shared/src`
  → **no matches**. The 9 new DTOs are pure types. (AC-3b-11)
- **No Phase 4 leakage** —
  `git grep -niE "anthropic|claude|/summary|spend.?cap|multi.?tenant"` over
  `apps/api/src`, `apps/mobile/{app,lib}`, `packages/shared/src` → **none**. No
  `POST /dogs/:id/summary`, no spend cap, no multi-tenant. (AC-3b-12)
- **Mobile web export** — `expo export -p web` → **exit 0**; 31 static routes
  emitted, including the new `/client`, `/manage/leads`, `/manage/bookings` (and
  their `(app)/…` group variants). Confirms the 3b-2 surface bundles on web.
  (AC-3b-3 / 3b-9 / 3b-10 — render path)

## 3. Fixes applied this pass

- **FIX-1 — `apps/api/tsconfig.json`: removed invalid `"ignoreDeprecations": "6.0"`.**
  The 3b-2 commit (`deb3335`) added this line; the value `"6.0"` is not accepted
  by the pinned TypeScript (`^5.9.0`, installed 5.9.3) — it becomes valid only
  when TS 6.0 ships — so `tsc --noEmit` in `apps/api` failed with
  `TS5103: Invalid value for '--ignoreDeprecations'`, blocking AC-3b-1. Root
  cause: `tsconfig.base.json` uses no deprecated options (`moduleResolution:
  "bundler"`, `skipLibCheck: true`), and `apps/mobile` / `apps/shared` extend the
  same base without any `ignoreDeprecations`, so the option was both **invalid and
  unnecessary**. Removing it (via-negativa, matching the sibling workspaces) makes
  the API typecheck clean (exit 0) with no other change. Deviation rule 3
  (auto-fix blocker, smallest documented fix).

## 4. Pending manual step — live-DB per-role walkthrough

Not run here (no local Postgres started). This is the end-to-end check for the
role-scoped reads/writes against real seeded rows. Full steps are in `README.md`
(Phase 3b-2 → "Seed logins + per-role verify"); summary:

```bash
# Postgres (Docker) + .env DATABASE_URL + AUTH_SECRET, then:
npm run db:migrate -w apps/api      # applies 0000 + 0001_betterauth_tables (idempotent)
npm run db:seed    -w apps/api      # trainer@tailsup.local / client@tailsup.local
npm run dev        -w apps/api

# CLIENT: sign in → /me/progress (dog + 5 points) · /me/homework (2 rows) ·
#   PATCH /me/homework/:id {completed:true} (completedAt set) · /me/bookings.
#   A client cookie against a trainer mutation → 403.
# TRAINER: /trainers/:id/leads|bookings · POST /leads/:id/convert (201; re-convert 409) ·
#   POST /clients/:id/login (201) · PATCH /bookings/:id/status (200; invalid 400; not-theirs 404).
# WEB UI: expo start --web, log in as each role → AC-3b-9 (management) + AC-3b-10 (dashboard).
```

Acceptance: each role sees only its own data; every trainer mutation verifies row
ownership server-side; the client dashboard renders the threshold graph from real
`behavior_event` rows, the homework list, and derived reminders. (3b-1's live
sign-in smoke test is a prerequisite — see `integration-verification-phase3b1.md`
§4.)

## 5. Acceptance criteria coverage (Phase 3b — the ACs 3b-2 closes)

- **AC-3b-1** typecheck across all 3 workspaces — ✅ (after FIX-1).
- **AC-3b-6** role-scoped authorization server-side (client↔trainer rejection,
  cross-owner `404`/`403`, client sees only own data) — ✅ (vitest by request;
  live in §4).
- **AC-3b-7** `PATCH /bookings/:id/status` — ✅ (vitest; live in §4).
- **AC-3b-8** `POST /leads/:id/convert` (txn, `409` idempotency, `404`) — ✅
  (vitest; live in §4).
- **AC-3b-9** trainer management screens (leads + convert/login, bookings +
  status) — code complete; web export passes; UI walkthrough in §4.
- **AC-3b-10** client dashboard (threshold graph, homework mark-complete, derived
  reminders; own data only) — code complete; web export passes; UI walkthrough in
  §4.
- **AC-3b-11** new DTOs present + `@tailsup/shared` stays pure — ✅.
- **AC-3b-12** new vitest coverage; full suite passes (226); no Phase 4 feature;
  Phase 1/2/3a/3b-1 intact — ✅.
- **AC-3b-13** README documents seed logins, per-role login, and how to verify
  AC-3b-6..10 — ✅ (README Phase 3b-2 section).

*(AC-3b-2 auth-tables-via-migration, AC-3b-3 login+role-routing, AC-3b-4
web/native session, AC-3b-5 stop-gap replaced were closed by 3b-1 and are not
regressed here — no migration, guards intact, session context unchanged.)*

## 6. Unresolved / follow-ups (non-blocking)

- **Live-DB per-role walkthrough pending** (§4) — the only runtime gap; high
  confidence given the mocked suite + web export.
- **Deferred dependency advisories** (carried from Phases 1/2/3a, unchanged) —
  the pre-existing moderate npm-audit advisories (Expo SDK 54 transitive + the
  `drizzle-kit`→`esbuild` chain) remain deferred; all transitive dev/build
  tooling, none in the production API or shipped mobile bundle. Resolve before
  public launch.
- **No new advisories from 3b-2** — 3b-2 added no runtime dependencies (routes,
  DTOs, and screens reuse existing libs).

---

_Phase 3a verification: `integration-verification-phase3a.md` · 3b-1:
`integration-verification-phase3b1.md` · Plan: `plan-004-tailsup-phase3b2-dashboards.md`
· This report: `integration-verification-phase3b2.md`._
