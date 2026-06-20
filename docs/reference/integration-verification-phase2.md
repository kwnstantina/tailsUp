# Integration Verification — Phase 2 (Trainer View)

**Date:** 2026-06-20 · **Node:** v20.20.2 · **npm:** 10.8.2 · **Platform:** Windows 11
**Scope:** Whole-monorepo build / typecheck / test / Expo-web-export verification of
Phase 2 against `docs/reference/refined-request-phase2.md` (AC-1..AC-13) and the
Phase 2 section of `docs/design/project-design.md`.

**Environment note (by design):** No live PostgreSQL and no R2 credentials were
available — the user chose "no R2 yet". DB-runtime and R2 acceptance criteria are
verified via the **mocked unit tests** + **static review**; the live smoke tests are
documented as manual steps in §7. Docker / a live DB / a live R2 were **not** started.

---

## Overall verdict: **READY** (for the user's Phase 2 review)

All build/typecheck/test/export gates pass. All AC-1..AC-13 are **met** — the
DB/R2-runtime ACs via mocked tests + static review, with the live smoke test
flagged as a documented manual step. The one gap found (a stale README missing the
Phase 2 run/seed/CORS docs required by AC-13) was **fixed** in this pass (README
working-tree change only). No code, schema, or test changes were required or made.

---

## 1. Results summary

| Step | Command | Result |
| --- | --- | --- |
| Typecheck — shared | `npx tsc --noEmit -p packages/shared/tsconfig.json` | **exit 0** (0 errors) |
| Typecheck — api | `npm run -s typecheck -w @tailsup/api` | **exit 0** (0 errors) |
| Typecheck — mobile | `npm run -s typecheck -w @tailsup/mobile` | **exit 0** (0 errors) |
| API build | `npm run -s build -w @tailsup/api` (`tsc --noEmit`) | **exit 0** |
| Test suite | `npm run -s test -w @tailsup/api` (vitest) | **133 passed / 133** (8 files) |
| No migration | `git status --porcelain apps/api/drizzle` | **empty** (clean) |
| Schema unchanged | `git status --porcelain apps/api/src/db/schema.ts` | **empty**; last touched by the Phase 1 commit `0ed0e8f` |
| Mobile web bundle | `npx expo export --platform web` | **exit 0** — 7 static routes bundled |
| Lint | — | **none configured** (no eslint config / `lint` script anywhere) |

### Test breakdown (133 = 31 Phase 1 + 102 Phase 2)

| File | Tests | Phase |
| --- | --- | --- |
| `config.test.ts` | 6 | P1 |
| `health.test.ts` | 3 | P1 |
| `events.test.ts` (`POST /sessions/:id/events`) | 22 | P1 |
| `r2.test.ts` | 23 | P2 |
| `media.test.ts` (`POST /media/presign`, `GET /media/:id/url`) | 20 | P2 |
| `events-phase2.test.ts` (`GET`/`PATCH /events/:id`, `POST /events/:id/media`) | 22 | P2 |
| `dogs.test.ts` (trainers/dogs/timeline/start-session) | 27 | P2 |
| `sessions-phase2.test.ts` (`GET /sessions/:id/events`) | 10 | P2 |
| **Total** | **133** | 31 P1 + 102 P2 |

> The 31 Phase 1 tests = config(6) + health(3) + events(22). The 102 Phase 2 tests =
> r2(23) + media(20) + events-phase2(22) + dogs(27) + sessions-phase2(10). The suite
> runs **credential-free**: the DB client is mocked and R2 presign is mocked — exactly
> what the lazy `getR2Config()` design (R-4) enables. **No failures; no fixes needed.**

### Expo web export (Metro wiring proof)

`npx expo export --platform web` bundled **exit 0**, with the entry bundle
(`entry-*.js`, 1.07 MB) and **7 static routes**, including all four new Phase 2
screens:

```
/ (index)              /_sitemap            /+not-found
/dogs                  /events/[id]         /sessions/[id]/log        /dogs/[id]/timeline
```

This proves the new routes, `apps/mobile/lib/api.ts`, `apps/mobile/lib/upload.ts`,
the `@tailsup/shared` Phase 2 DTOs, and the new native modules
(`expo-image-picker`, `expo-video`, `expo-file-system/legacy`) all resolve through
Metro on web. (Temp output dir was created in the scratchpad and deleted after.)

---

## 2. Endpoint inventory (phase boundary — AC-12)

Exactly the intended endpoints exist; **no Phase 3/4 features**. Grep for
`betterauth|/leads|/bookings|/summary|claude-haiku|authMiddleware|requireAuth|client-dashboard|/auth`
across `apps/api/src` → **no matches**.

| Method · path | File · line | Phase |
| --- | --- | --- |
| `GET /health` | `routes/health.ts:14` | P1 (unchanged) |
| `POST /sessions/:id/events` | `routes/sessions.ts:42` | P1 (unchanged) |
| `GET /sessions/:id/events` | `routes/sessions.ts:125` | P2 |
| `GET /events/:id` | `routes/events.ts:58` | P2 |
| `PATCH /events/:id` | `routes/events.ts:89` | P2 |
| `POST /events/:id/media` | `routes/events.ts:130` | P2 |
| `POST /media/presign` | `routes/media.ts:39` | P2 |
| `GET /media/:id/url` | `routes/media.ts:65` | P2 (G-7 user override — playback) |
| `GET /trainers/:trainerId/dogs` | `routes/dogs.ts:66` | P2 |
| `GET /dogs/:id` | `routes/dogs.ts:95` | P2 |
| `GET /dogs/:id/timeline` | `routes/dogs.ts:130` | P2 |
| `POST /dogs/:id/sessions` | `routes/dogs.ts:185` | P2 (OQ-7 — start a session) |

`app.ts` mounts `health`, `sessions` (P1) then `dogs`, `events`, `media` (P2);
`cors()` / `onError` / `notFound` reused unchanged.

---

## 3. Per-criterion AC verdicts

| AC | Verdict | Evidence |
| --- | --- | --- |
| **AC-1** Typecheck passes (strict, all 3 workspaces) | **MET** | shared / api / mobile `tsc --noEmit` all exit 0 (§1). |
| **AC-2** Shared DTOs present + pure | **MET** | All 11 required DTOs (+`BehaviorEventListItemDTO`, `MediaPlaybackUrlDTO`) exported via the `packages/shared/src/index.ts` barrel from `dtos.ts`. Purity grep for `drizzle\|pg\|aws\|@aws-sdk\|node:\|require(` in `packages/shared/src` → only comment text, **no imports**. |
| **AC-3** Read endpoints + shapes | **MET (mocked + static; live = manual M-3)** | Handlers in `routes/dogs.ts`, `routes/events.ts:58`, `routes/sessions.ts:125` return the documented DTOs; `404`/`200 []` paths covered by `dogs.test.ts` (27), `events-phase2.test.ts` (`GET /events/:id`), `sessions-phase2.test.ts` (10). |
| **AC-4** PATCH note/tags only (moat) | **MET** | `routes/events.ts:84-122` — Zod body is `{ note?, tags? }` ONLY, so tap fields & `intervention` are structurally un-settable. Test `events-phase2.test.ts:328` "sending tap fields in the body does not update them (moat protection)" + null-clear + empty-body + 404 tests. |
| **AC-5** Presign returns usable PUT | **MET (mocked + static; live = manual M-5)** | `routes/media.ts:39` + `lib/r2.ts:101 presignPutUrl`: `200 PresignResponse` (PUT, echoed `Content-Type`, key `events/<id>/<uuid>.<ext>`, 600s); `400` disallowed type (Zod enum), `404` unknown event, `503` when R2 unset (lazy throw → catch). No media row created. Tests: `media.test.ts:145-277` (incl. 400/404/503/200). |
| **AC-6** Direct-to-R2 upload, no API egress | **MET (static; live = manual M-6)** | The API has **no** file-receiving route (inventory §2); `lib/upload.ts` PUTs bytes to the R2 `uploadUrl` host (web `fetch` / native `createUploadTask` BINARY_CONTENT). `lib/r2.ts` checksum flags (`requestChecksumCalculation`/`responseChecksumValidation: 'WHEN_REQUIRED'`, R-1) set so the presigned PUT is R2-compatible. |
| **AC-7** Media row persisted after upload | **MET (mocked + static; live = manual M-7)** | `routes/events.ts:130` `POST /events/:id/media` → `201 MediaDTO`, `blobUrl` derived from key, `type:'video'`; appears in `GET /events/:id`. Tests `events-phase2.test.ts:407-531` (201 mp4/quicktime, blobUrl https, 400 bad type, 404, 503). |
| **AC-8** 4-tap quick-log screen | **MET (web bundle + static; live = manual M-8)** | `app/sessions/[id]/log.tsx`: tap targets for `triggerType`/`intensity`/`outcome`/`thresholdMeters`, `postEvent` **omits** `intervention`, optimistic reset after `201`, retry without re-tap, OQ-8 one-time intervention on the no-default 400. Bundles in the web export. |
| **AC-9** Detail screen edits + uploads | **MET (web bundle + static; live = manual M-9, needs R2+CORS)** | `app/events/[id].tsx`: loads event, edits note/tags via `patchEvent`, full pick→presign→PUT→`createMedia` flow with progress, `expo-video` `<VideoView>` playback via `GET /media/:id/url`. Bundles in the web export. **Web upload requires the R2 bucket CORS rule (M-CORS).** |
| **AC-10** Timeline grouped, reverse-chron | **MET (web bundle + static; live = manual M-10)** | `app/dogs/[id]/timeline.tsx` maps `sessions`→`events` (server returns both desc; `routes/dogs.ts:130` orders `desc(startedAt)` / `desc(occurredAt)`), event rows show tap fields + intervention + note/tag/media indicators, row tap → `/events/[id]`. Server ordering tested in `dogs.test.ts:443/457`. |
| **AC-11** Typed mobile API client | **MET** | `apps/mobile/lib/api.ts` — every wrapper returns a `@tailsup/shared` DTO (no `any` on responses); `API_URL`/`TRAINER_ID` read via **static dot-access** `process.env.EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_TRAINER_ID`. |
| **AC-12** No migration / phase boundary | **MET** | `git status --porcelain apps/api/drizzle` empty; `schema.ts` clean (last touched by Phase 1 commit `0ed0e8f`); `media`/`note`/`tags` reused. No auth/site/client-dashboard/leads/bookings/AI code (grep §2). Phase 1 endpoints unchanged. |
| **AC-13** Run/test docs updated | **MET (fixed in this pass)** | README previously had **no** Phase 2 section (it still read "Phase 1 — Foundations" only). Added a **Phase 2 — Trainer view** section: endpoint table, manual seed inserts (trainer→client→dog→protocol→session), run commands, `EXPO_PUBLIC_TRAINER_ID`, R2 env, the **R2 bucket CORS prerequisite**, the presign→PUT→persist→playback curl flow, and an AC-3..AC-10 verification table. |

**No AC is partial or not-met.**

---

## 4. Static-review confirmations (NFRs / design gates)

- **NFR-2 / NFR-4 (no egress, no fallback):** API has no file route; R2 vars read
  via lazy `getR2Config()` that **throws** on missing → handlers map to `503` (never
  a fabricated URL). R2 vars are deliberately **not** in `config.ts` (would break
  boot + the credential-free test suite — R-4).
- **NFR-5 (shared purity):** AWS SDK is imported only in `apps/api/src/lib/r2.ts`;
  `packages/shared` has zero server imports (grep clean).
- **R-1 (R2 checksum):** both `WHEN_REQUIRED` flags set on the S3 client.
- **R-6 (Content-Type match):** the presigned `Content-Type` is echoed end-to-end
  (presign `headers` → PUT header in `lib/upload.ts`).
- **blobUrl ↔ key round-trip:** `blobUrlForKey` (write) and `keyFromBlobUrl` (read,
  `routes/media.ts`) round-trip; covered by `r2.test.ts:217/226`.
- **NFR-7 (no N+1):** timeline is 2 queries (`inArray` batch); `GET /sessions/:id/events`
  batches media counts in one grouped query.

---

## 5. The one gap found — and the fix applied

**AC-13 (run/test docs) was the only gap.** The README still described the repo as
"Phase 1 — Foundations" with only two endpoints and **listed Phase 2 as NOT built**;
it contained none of the Phase 2 run/seed/flow/CORS documentation AC-13 requires
(per the design, `README.md` Phase 2 docs were Unit B's deliverable and had not
landed).

**Fix (working tree only — not committed):** edited `README.md` to (a) update the
intro + Phase boundary to reflect Phase 1+2 shipped, and (b) add a **Phase 2 —
Trainer view** section covering the endpoint table, **manual seed inserts** (the
spec permits "documented manual inserts" since there is no seed script), the run
commands, `EXPO_PUBLIC_TRAINER_ID`, R2 env, the **R2 bucket CORS prerequisite for
web upload**, the presign→PUT→persist→playback curl flow, and an AC-3..AC-10
verification table. Re-ran mobile typecheck after the edit → still exit 0 (README is
not compiled). **No code/schema/test changes.**

---

## 6. Lint

**None.** No `.eslintrc*` / `eslint.config.*` and no `"lint"` script in the root or
any workspace `package.json`. Consistent with Phase 1.

---

## 7. MANUAL steps to fully verify against real infrastructure

These exercise the DB-runtime and R2 criteria that were verified here only via
mocked tests + static review. Pull the canonical commands from the README
"Phase 2 — Trainer view" section and `docs/design/project-design.md` §P2.

### (a) Live DB

> The migration was already applied in Phase 1; `db:migrate` is **idempotent** —
> re-running it on an already-migrated DB is a no-op (no Phase 2 migration exists).

```bash
# M-1  set the connection string
export DATABASE_URL=postgresql://user:pass@host:5432/tailsup

# M-2  apply migrations (idempotent — Phase 1 SQL only; AC-12 = no new migration)
npm run db:migrate -w apps/api

# M-3  seed the org graph (manual inserts — see README "Seed the org graph");
#      capture the trainer id and a session id
psql "$DATABASE_URL" -f <(your seed inserts)   # trainer → client → dog → protocol → session

# M-4  start the API
npm run dev -w apps/api

# M-5  exercise the new read / start-session endpoints (AC-3)
curl -s http://localhost:3000/trainers/<TRAINER_ID>/dogs
curl -s http://localhost:3000/dogs/<DOG_ID>
curl -s http://localhost:3000/dogs/<DOG_ID>/timeline
curl -s http://localhost:3000/sessions/<SESSION_ID>/events
curl -s http://localhost:3000/events/<EVENT_ID>
curl -s -X POST http://localhost:3000/dogs/<DOG_ID>/sessions \
  -H 'Content-Type: application/json' -d '{ "location": "park" }'   # 201 SessionSummaryDTO
# unknown ids → 404 (trainers list → 200 [])
```

### (b) Live R2 (presign → upload → persist → playback)

```bash
# set the R2 vars in .env (the media bucket, NOT the backups bucket)
R2_ACCOUNT_ID=...   R2_ACCESS_KEY_ID=...   R2_SECRET_ACCESS_KEY=...   R2_BUCKET=tailsup-media
```

**M-CORS — THE ONE HARD PREREQUISITE for browser (Expo web) upload (AC-9 on web).**
The browser `PUT` to R2 is cross-origin; it is blocked unless the **R2 bucket's CORS
policy** allows `PUT` (+ the `content-type` header) from the Expo web origin
(`http://localhost:8081` in dev). This is a **Cloudflare bucket setting, not API
code** (Cloudflare dashboard → R2 → media bucket → Settings → CORS Policy):

```json
[
  { "AllowedOrigins": ["http://localhost:8081"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600 }
]
```

Native (iOS/Android) uploads do **not** enforce CORS — if you cannot set the rule,
verify the picker/upload on a native simulator instead.

```bash
# M-6  presign (AC-5) — no media row created
curl -s -X POST http://localhost:3000/media/presign \
  -H 'Content-Type: application/json' \
  -d '{ "eventId": "<EVENT_ID>", "contentType": "video/mp4" }'

# M-7  upload bytes DIRECTLY to R2 (AC-6) — echo the SAME Content-Type the
#      presign signed (mismatch → R2 403 SignatureDoesNotMatch)
curl -s -X PUT "<uploadUrl>" -H 'Content-Type: video/mp4' --data-binary @./clip.mp4

# M-8  persist the media row (AC-7)
curl -s -X POST http://localhost:3000/events/<EVENT_ID>/media \
  -H 'Content-Type: application/json' \
  -d '{ "key": "<key from presign>", "contentType": "video/mp4" }'   # 201 MediaDTO

# M-9  confirm it shows + fetch a playback URL (G-7)
curl -s http://localhost:3000/events/<EVENT_ID>            # media[] includes it
curl -s http://localhost:3000/media/<MEDIA_ID>/url         # 200 MediaPlaybackUrlDTO
```

Then exercise the **mobile** screens on Expo web (AC-8/9/10): set
`EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_TRAINER_ID`, `npm run web -w apps/mobile`, and
drive dog list → timeline → detail (edit + upload) and session → 4-tap log.

---

## 8. Deferred dependency advisories (carried from Phase 1, unchanged)

No new deps beyond the two AWS SDK packages (matched versions; R-5 footgun not
present per the prior code review) and the Expo native modules
(`expo-image-picker`, `expo-video`, `expo-file-system`). The Phase 1 npm-audit
advisories remain deferred (Expo SDK 54 pin → `postcss`/`uuid`/`js-yaml` transitive;
`drizzle-kit` → `@esbuild-kit` → `esbuild@0.18`). All are transitive dev/build
tooling — none in the production API or shipped mobile bundle. See
`Issues - Pending Items.md`.
