# Investigation: TailsUp Phase 2 — Trainer View Implementation Approach

## Executive Summary

This investigation determines **how** to implement Phase 2 of TailsUp (the trainer-facing Expo screens + the supporting read/media API) on the already-fixed stack (Hono+Drizzle API, Expo Router SDK 54 mobile, Cloudflare R2 presigned **direct** upload, `@tailsup/shared` pure-TS contract). The stack is not re-litigated; only the within-stack wiring is.

Headline recommendations:

1. **R2 presign (server):** Use `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` **pinned to the same exact version** (current `~3.937.0`; any matched 3.7xx+ pair works). Configure `S3Client` with `region: 'auto'`, `endpoint: https://<account>.r2.cloudflarestorage.com`, the R2 credentials, and — **critically** — `requestChecksumCalculation: 'WHEN_REQUIRED'` (+ `responseChecksumValidation: 'WHEN_REQUIRED'`). Without that flag, AWS SDK ≥ v3.729 bakes an `x-amz-checksum-crc32` requirement into the request and **R2 rejects the PUT** (`NotImplemented` / `SignatureDoesNotMatch`). Use a **PUT presign** (`getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: 600 })`), key scheme `events/{eventId}/{uuid}.{ext}`, and `forcePathStyle` is **not** required for R2.

2. **R2 upload (Expo client) — the riskiest path:** Pick the video with **`expo-image-picker`** (`launchImageLibraryAsync({ mediaTypes: ['videos'] })`). For the actual byte upload, do **not** call `FileSystem.uploadAsync` from the main import — in SDK 54 the legacy functions **throw a deprecation error at runtime**. Use the **new `expo-file-system` File API** (`new File(uri).createUploadTask(url, { httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT, headers: { 'Content-Type': … } })`) on native, which streams the `file://` body correctly and gives progress. On **web**, the picker yields a real `File`/`Blob`, so `fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': … } })` works directly. A small platform branch (`Platform.OS === 'web'`) is the clean way to cover both. The Content-Type sent on the PUT **must equal** the `ContentType` baked into the presign or R2 returns 403. **R2 bucket CORS** must allow `PUT` from the web origin (OQ-10) — a bucket setting, not API code.

3. **Lazy R2 config:** Read the R2 vars through the existing `required()` helper **inside the presign route module** (or a small `getR2Config()` invoked in the handler), **not** at top-level `config.ts` import. This keeps the API bootable and unit-testable without R2 creds, still throws on missing vars (no silent fallback — NFR-4), and returns a 503 from the handler.

4. **Read endpoints/queries:** Use Drizzle's **plain `select()` + explicit joins / a small fixed number of queries**, not the `db.query.*` relational builder. Reason: the relational builder needs `relations()` declarations (a schema-file addition) **and** does not fully support **nested `orderBy` on relations** — which the reverse-chronological grouped timeline (FR-A6) needs. Plain `select()` with the existing composite indexes hits every access path without a schema change. (Adding `relations()` is optional sugar, not required; flag it only if the team wants `db.query`.)

5. **Mobile screens:** Use Expo Router file-based routes with dynamic segments: `app/dogs/index.tsx`, `app/dogs/[id]/timeline.tsx`, `app/sessions/[id]/log.tsx`, `app/events/[id].tsx`. Read params with `useLocalSearchParams()`, navigate with `useRouter().push()` / `<Link>`. Keep the 4-tap screen fast with pre-selected defaults, local component state, and optimistic reset — **no data-fetching library**; a tiny typed `lib/api.ts` over `fetch` + `useState/useEffect` is sufficient and matches Phase 1.

6. **Trainer-context-without-auth:** `EXPO_PUBLIC_TRAINER_ID` (static dot-access) + path-scoped reads (`/trainers/:trainerId/dogs`) + a minimal `POST /dogs/:id/sessions` is the simplest workable pre-auth approach and swaps cleanly to BetterAuth in Phase 3 (replace the path/env id with the authenticated session's trainer id).

**Research needed before planning: No** — the R2-from-Expo path (the most likely deep-research candidate) is pinned down with concrete, current API code and the two failure modes (checksum, deprecated uploadAsync) identified. One low-risk "validate on first run" note is flagged at the end.

---

## Context

- **What:** HOW to implement Phase 2 — the three trainer Expo Router screens (4-tap log, post-session detail + video upload, dog timeline), the new read endpoints, `POST /media/presign`, `POST /events/:id/media`, `PATCH /events/:id`, `POST /dogs/:id/sessions`, and the new `@tailsup/shared` DTOs.
- **Refined request:** `docs/reference/refined-request-phase2.md` (scope, endpoint shapes, OQ-1..OQ-10, AC-1..AC-13).
- **Codebase scan:** `docs/reference/codebase-scan-phase2.md` (exact integration points; flagged anomalies: missing `@aws-sdk/client-s3` + `expo-image-picker`; no mobile/shared test infra; R2 vars are `.env.example` placeholders not yet read by `config.ts`).
- **Verified current versions installed** (read from the repo): Expo `~54.0.35`, expo-router `~6.0.24`, react-native `0.81.5`, react `19.1.0`, drizzle-orm `^0.45.0`, zod `^3.25.0`, hono `^4.12.0`, `@hono/zod-validator` `^0.7.0`. Phase 1 already uses `pg` + `casing:'snake_case'`, ESM `.js` import specifiers, `zValidator` + shared arrays, `{ error }` JSON bodies.
- **Key Phase 1 facts that bind Phase 2:** `media` table already has `id/eventId/blobUrl/type/uploadedAt`; `behavior_event` already has nullable `note` + jsonb `tags` (GIN-indexed); `intervention` is `NOT NULL`; composite indexes `session(dog_id, started_at)` and `behavior_event(session_id, occurred_at)` already exist. **No schema migration is required** for Phase 2.

This investigation does not re-open any architecture decision.

---

## Options Identified

The six task areas each have a real either/or. Each is presented as an option set with a recommendation; the consolidated matrix and recommendation follow.

### Area 1 — R2 presign generation (server)

#### Option 1A: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, PUT presign (recommended)
- **Description:** `S3Client` against the R2 S3 endpoint; `getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn })` returns a single signed PUT URL the device PUTs the raw bytes to.
- **Strengths:** Officially documented by Cloudflare; smallest client (one `PUT`, no multipart form fields); matches the refined `PresignResponse` shape (`uploadUrl`, `method:"PUT"`, `headers`, `key`, `expiresInSeconds`); SDK lives only in `apps/api` (NFR-5).
- **Weaknesses:** AWS SDK ≥ v3.729 auto-adds a CRC32 checksum that R2 rejects — **must** set `requestChecksumCalculation:'WHEN_REQUIRED'` (see Pitfalls). Adds a moderately large dependency tree to the API.
- **Effort/Complexity:** Low.
- **Risk:** Low **once the checksum flag is set**; Medium if it is missed.
- **Best suited when:** A single file is uploaded per request and the client controls the bytes (exactly Phase 2).

#### Option 1B: POST-policy presign (`createPresignedPost`)
- **Description:** Presigned POST with a policy document + form fields; client does a multipart form POST.
- **Strengths:** Can enforce a **content-length-range** (server-side size cap) and other policy conditions in the signature.
- **Weaknesses:** More complex client (must assemble `FormData` with all returned fields in order); heavier on React Native where multipart form bodies with a `file://` part are themselves error-prone; the refined spec's response shape and the device-side `expo-file-system` binary upload are both PUT-shaped. R2 supports it but the win (policy-enforced size cap) is explicitly deferred in OQ-6.
- **Effort/Complexity:** Medium.
- **Risk:** Medium (RN multipart-with-file pitfalls).
- **Best suited when:** You need server-enforced size/type limits in the signature itself. Not needed for Phase 2.

#### Option 1C: Cloudflare Worker / R2 binding presign
- **Description:** Generate the URL in a Worker via the R2 binding instead of the AWS SDK.
- **Strengths:** No AWS SDK dependency.
- **Weaknesses:** Off-stack (the API is Hono-on-Node on Railway, not a Worker); the AWS SDK presigner notably **does not run inside Workers** anyway. Irrelevant to this deployment.
- **Effort/Complexity:** High (new runtime).
- **Risk:** High (architecture deviation).
- **Best suited when:** The API itself were a Worker. It is not.

### Area 2 — Video pick + direct upload (Expo client)

#### Option 2A: `expo-image-picker` + new `expo-file-system` File API (native) / `fetch` PUT (web) (recommended)
- **Description:** `launchImageLibraryAsync({ mediaTypes: ['videos'] })` returns `{ uri, mimeType, fileSize }`. Native: `new File(uri).createUploadTask(presignedUrl, { httpMethod:'PUT', uploadType: UploadType.BINARY_CONTENT, headers:{'Content-Type':…}, onProgress })`. Web: the asset is a real `File`/`Blob` → `fetch(url, { method:'PUT', body:file, headers:{'Content-Type':…} })`.
- **Strengths:** `expo-image-picker` is the natural camera-roll/record path for training clips and returns a usable mime type; the new File API **correctly streams `file://` bytes** on native (avoids the classic 0-byte bug) and provides upload progress for FR-M4; web path is a one-line `fetch`.
- **Weaknesses:** Two code paths (native task vs web fetch) behind a `Platform.OS` branch; SDK-54 deprecation of legacy `uploadAsync` must be respected.
- **Effort/Complexity:** Medium.
- **Risk:** Low (both paths are documented and current).
- **Best suited when:** Uploading a single user-picked video directly to a presigned URL — exactly FR-M4.

#### Option 2B: `expo-image-picker` + `fetch(PUT, body: blob-from-uri)` on all platforms
- **Description:** Convert the `file://` uri to a Blob (`await (await fetch(uri)).blob()`) then `fetch(url,{method:'PUT',body:blob})` on every platform.
- **Strengths:** One code path; works on web trivially.
- **Weaknesses:** On native, `fetch` PUT of a `file://`-derived Blob is the historically **flaky** path — multiple reports of **0-byte uploads** / missing `Content-Length` for large videos; no progress callback. Buffering a large video into a JS Blob also pressures memory.
- **Effort/Complexity:** Low.
- **Risk:** Medium-High on native for large videos (the 0-byte class of bugs).
- **Best suited when:** Web-only verification. Acceptable as the **web** branch of 2A, not as the native path.

#### Option 2C: `expo-document-picker` instead of `expo-image-picker`
- **Description:** Pick any file from the Files app.
- **Strengths:** Arbitrary file selection.
- **Weaknesses:** Worse UX for camera-roll/recorded clips; OQ-3 explicitly recommends image-picker. No advantage for video.
- **Effort/Complexity:** Low.
- **Risk:** Low.
- **Best suited when:** Selecting non-media files from Files. Not the Phase 2 case.

#### Option 2D: legacy `FileSystem.uploadAsync` from `expo-file-system` (rejected)
- **Description:** The SDK ≤ 53 pattern: `FileSystem.uploadAsync(url, uri, { httpMethod:'PUT', uploadType: BINARY_CONTENT })`.
- **Strengths:** Battle-tested in older SDKs; binary PUT works.
- **Weaknesses:** In **SDK 54 stable the legacy functions throw a deprecation error at runtime** when called from the main `expo-file-system` import. Still callable via `import * as FileSystem from 'expo-file-system/legacy'`, but the new File API (2A) is the forward path and gives the same binary-PUT capability + progress.
- **Effort/Complexity:** Low.
- **Risk:** Medium (deprecated; will be removed). Use `expo-file-system/legacy` only as an escape hatch if the new File API hits a snag on first run.
- **Best suited when:** A quick fallback if 2A's new API misbehaves during scaffolding.

### Area 3 — R2 config loading

#### Option 3A: Lazy validation inside the presign module (recommended)
- **Description:** Add an `r2.ts` config accessor (e.g. `getR2Config()`) that calls `required('R2_ACCOUNT_ID')` etc. **when the presign handler runs** (or at module-eval of `routes/media.ts`, which is only imported when that route is mounted), not in the top-level `config.ts`.
- **Strengths:** API boots and **all unit tests run without R2 creds**; still throws clearly when R2 is genuinely needed (NFR-4, no silent fallback); presign handler maps the throw to a 503/500. Lets the R2 config test (per `config.test.ts` pattern) delete vars and assert the throw lazily.
- **Weaknesses:** A missing R2 var surfaces at first presign call, not at boot — acceptable and arguably better for a dev who isn't testing media.
- **Effort/Complexity:** Low.
- **Risk:** Low.
- **Best suited when:** Some endpoints (media) need creds others (reads, health, events) don't. Exactly Phase 2.

#### Option 3B: Eager validation in `config.ts` at startup (rejected for Phase 2)
- **Description:** Add `r2AccountId: required('R2_ACCOUNT_ID')`, etc. to the existing `config` object.
- **Strengths:** Fail-fast at boot; one config surface.
- **Weaknesses:** **Breaks the API boot and the entire vitest suite** the moment the read endpoints (which import nothing R2-related) are exercised, because every test that imports the app transitively loads `config.ts`. Forces every developer/CI to set real R2 creds just to run read-endpoint tests. The codebase scan explicitly warns about this (`.env.example` R2 vars are placeholders).
- **Effort/Complexity:** Low.
- **Risk:** Medium (DX/test breakage).
- **Best suited when:** R2 is needed by every request path. It isn't.

### Area 4 — Read endpoint query strategy

#### Option 4A: Plain `select()` + explicit joins / small fixed query count (recommended)
- **Description:** Hand-written Drizzle `select()` with `leftJoin`/`innerJoin` and `inArray` batching; order with `desc()`/`asc()` on the indexed columns; assemble DTOs in TS.
- **Strengths:** No schema change (no `relations()` needed); full control over `orderBy` including the **nested reverse-chronological** timeline; uses existing composite indexes; avoids N+1 with `inArray` (e.g. fetch all events for a dog's session ids in one query, then group). Matches the Phase 1 `select().from().where()` idiom already in `routes/sessions.ts`.
- **Weaknesses:** More manual row→DTO mapping and grouping code than `db.query`.
- **Effort/Complexity:** Medium.
- **Risk:** Low.
- **Best suited when:** Reads need precise ordering/grouping and you want zero schema churn — exactly FR-A3..A8.

#### Option 4B: Drizzle relational query builder (`db.query.*` with `with`)
- **Description:** Declare `relations()` in the schema file, then `db.query.dog.findFirst({ with: { sessions: { with: { events: true } } } })`.
- **Strengths:** Concise nested fetch; auto-mapped nested objects; one round-trip.
- **Weaknesses:** **Requires adding `relations()` declarations to `schema.ts`** (a schema-file change — flag it) and **nested `orderBy` on relations is not fully supported** in the current builder, so the reverse-chronological grouped timeline (FR-A6: sessions desc, events desc within each) cannot be expressed cleanly and would need a post-query sort or a fallback to `select()` anyway. Net: it doesn't remove the manual-ordering work for the one query that most needs it.
- **Effort/Complexity:** Medium (plus schema additions).
- **Risk:** Low-Medium (ordering limitation).
- **Best suited when:** Deeply nested reads **without** nested-ordering requirements. The timeline breaks that assumption.

### Area 5 — Mobile data-fetching layer

#### Option 5A: Tiny typed `lib/api.ts` over `fetch` + `useState/useEffect` (recommended)
- **Description:** A handful of typed functions (`getDogs`, `getDogTimeline`, `getEvent`, `patchEvent`, `presign`, `createMedia`, `postEvent`, `startSession`) returning `@tailsup/shared` DTOs, called from screens with local state, mirroring `app/index.tsx`'s `Status` discriminated-union pattern.
- **Strengths:** Zero new deps (NFR/keep-simple); matches Phase 1 exactly; trivially typed against the shared DTOs (AC-11); keeps the 4-tap screen dependency-light and fast.
- **Weaknesses:** No automatic caching/refetch — fine for three screens; manual refetch after mutations.
- **Effort/Complexity:** Low.
- **Risk:** Low.
- **Best suited when:** A handful of screens with simple read/mutate flows. Exactly Phase 2.

#### Option 5B: TanStack Query (react-query)
- **Description:** Add `@tanstack/react-query` for caching/invalidation.
- **Strengths:** Caching, background refetch, mutation invalidation, retries.
- **Weaknesses:** New dependency + provider boilerplate; overkill for three screens; the brief explicitly asks to keep it simple with no heavy deps.
- **Effort/Complexity:** Medium.
- **Risk:** Low.
- **Best suited when:** Many interdependent cached queries (Phase 3+). Defer.

### Area 6 — Trainer context without auth

#### Option 6A: `EXPO_PUBLIC_TRAINER_ID` + path-scoped reads + minimal `POST /dogs/:id/sessions` (recommended)
- **Description:** App reads a seeded trainer id from `process.env.EXPO_PUBLIC_TRAINER_ID` (static dot-access), calls `/trainers/:trainerId/dogs`, and starts a session via `POST /dogs/:id/sessions` before logging.
- **Strengths:** Production-shaped (the path id becomes the authenticated trainer id in Phase 3 — the swap is "drop the env var, read `c.get('trainer').id`"); unblocks the 4-tap screen (you cannot log events without a session — OQ-7); minimal surface.
- **Weaknesses:** Unauthenticated path id is spoofable — acceptable, since all Phase 2 endpoints are intentionally unauthenticated.
- **Effort/Complexity:** Low.
- **Risk:** Low.
- **Best suited when:** Pre-auth demo/dev with a clean migration to auth. Exactly Phase 2.

#### Option 6B: `GET /trainers` list-all + in-app picker
- **Description:** App lists all trainers and lets the user pick.
- **Strengths:** Demo-friendly with multiple seeded trainers; no env var.
- **Weaknesses:** Less production-shaped; adds a screen and an endpoint not otherwise needed; the picked id is just as unauthenticated.
- **Effort/Complexity:** Low-Medium.
- **Risk:** Low.
- **Best suited when:** Multi-trainer demos. Secondary to 6A.

---

## Comparison Matrix

### Decision A — R2 presign (server)
| Criterion | 1A PUT presign (AWS SDK) | 1B POST-policy | 1C Worker |
|---|---|---|---|
| Matches refined `PresignResponse` (PUT) | Yes | No (form fields) | Partial |
| Client simplicity (RN binary PUT) | High | Low | n/a |
| On-stack (Hono/Node/Railway) | Yes | Yes | No |
| SDK isolated to apps/api (NFR-5) | Yes | Yes | n/a |
| Server-enforced size cap | No (deferred OQ-6) | Yes | n/a |
| Complexity / Risk | Low / Low* | Med / Med | High / High |
| **Fit** | **Best** | Over-spec | Off-stack |

\* Low risk **only** with `requestChecksumCalculation:'WHEN_REQUIRED'`.

### Decision B — Video upload (Expo client)
| Criterion | 2A picker + new File API/fetch | 2B fetch+Blob everywhere | 2C document-picker | 2D legacy uploadAsync |
|---|---|---|---|---|
| Native large-video reliability | High | Low (0-byte risk) | High | High |
| Upload progress (FR-M4) | Yes | No | Yes (new API) | Limited |
| Web path | Yes (fetch) | Yes | Yes | n/a |
| SDK-54 correct (no deprecation throw) | Yes | Yes | Yes | No (throws unless `/legacy`) |
| UX for camera-roll/record clips | Best | Best | Worse | Best |
| Complexity / Risk | Med / Low | Low / Med-High | Low / Low | Low / Med |
| **Fit** | **Best** | web-only | wrong tool | fallback only |

### Decision C — R2 config, queries, data layer, trainer context
| Criterion | Recommended | Alternative |
|---|---|---|
| R2 config | **3A lazy in presign module** | 3B eager in config.ts (breaks tests) |
| Read queries | **4A select()+joins (no schema change)** | 4B db.query (needs relations(), weak nested orderBy) |
| Mobile data | **5A tiny fetch wrapper** | 5B TanStack Query (overkill) |
| Trainer context | **6A EXPO_PUBLIC_TRAINER_ID + POST /dogs/:id/sessions** | 6B list-all picker |

---

## Recommendation

Implement Phase 2 with **1A + 2A + 3A + 4A + 5A + 6A**. Concretely:

### 1. Server presign (`apps/api/src/routes/media.ts`)
Pin both AWS packages to the **same exact version** and disable auto-checksums:

```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Config } from './r2-config.js'; // lazy require()-of-config wrapper

function r2Client() {
  const cfg = getR2Config(); // throws clearly if any R2 var missing (NFR-4)
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',   // <- REQUIRED for R2 (else 403/NotImplemented)
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

// in the handler, after validating eventId exists (404) + contentType in allow-set (400):
const ext = contentType === 'video/quicktime' ? 'mov' : 'mp4';
const key = `events/${eventId}/${crypto.randomUUID()}.${ext}`;
const uploadUrl = await getSignedUrl(
  r2Client(),
  new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }),
  { expiresIn: 600 },
);
// return { uploadUrl, method: 'PUT', headers: { 'Content-Type': contentType }, key, expiresInSeconds: 600 }
```

- **`forcePathStyle` is not needed** for R2's `https://<account>.r2.cloudflarestorage.com` endpoint (default virtual-host-ish addressing works; R2 accepts the bucket-in-path form the SDK produces).
- **ContentType must be signed and echoed:** include `ContentType` in `PutObjectCommand` and return it as the `Content-Type` header the client must send. Mismatch → `403 SignatureDoesNotMatch`.
- **`blobUrl` (OQ-9):** for Phase 2, persist the canonical S3-style reference derived from the key (e.g. `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>`), since playback is not a stated requirement. If the detail screen must **play** the video, add a `R2_PUBLIC_BASE_URL` env var (a public r2.dev `pub-<hash>.r2.dev` host or, better, a custom domain — note r2.dev is rate-limited and meant for dev only) and store `${R2_PUBLIC_BASE_URL}/<key>`, or add a presigned-GET endpoint. **Flag this to the planner** as the one OQ that changes the data written.

### 2. Client upload (`apps/mobile`)
- `expo-image-picker`: `launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 })`. Note the **SDK-54 `mediaTypes` is a string array** (`['videos']`), not the old `MediaTypeOptions.Videos` enum.
- Native upload via the **new File API**: `new File(asset.uri).createUploadTask(uploadUrl, { httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT, headers: { 'Content-Type': asset.mimeType ?? 'video/mp4' }, onProgress })` then `await task.uploadAsync()`.
- Web upload via `fetch(uploadUrl, { method: 'PUT', body: asset.file ?? blob, headers: { 'Content-Type': contentType } })`.
- Branch on `Platform.OS === 'web'`. After a 2xx upload, call `POST /events/:id/media` with `{ key, contentType }`.
- **The Content-Type sent must equal the presign's ContentType** (pass the same value end-to-end: picker mimeType → presign request → PUT header).

### 3. Lazy R2 config (`apps/api/src/routes/r2-config.ts` or inline)
A `getR2Config()` that calls the existing `required()` pattern at **call time**. Do **not** add R2 to the top-level `config` object. Handler wraps the throw as `c.json({ error: 'media storage not configured' }, 503)`. This satisfies NFR-4 (still throws, no fake URL) while keeping boot + tests working without creds.

### 4. Reads (`routes/dogs.ts`, `routes/events.ts`, extend `routes/sessions.ts`)
Plain `select()` + joins, ordered on indexed columns, batched with `inArray` to avoid N+1:
- `GET /trainers/:trainerId/dogs`: `dog` join `client` where `client.trainerId = :trainerId` → `DogSummaryDTO[]` (unknown trainer → `[]` per OQ-1).
- `GET /dogs/:id`: dog row (404 if absent) + sessions with a grouped `count(behaviorEvent.id)` per session for `eventCount`.
- `GET /sessions/:id/events`: events `where sessionId` `orderBy asc(occurredAt)` (chronological, matches the index) + a `mediaCount` per event (OQ-3).
- `GET /dogs/:id/timeline`: one query for the dog's sessions `orderBy desc(startedAt)`, one query for all events of those session ids (`inArray`) `orderBy desc(occurredAt)`, then group in TS → `DogTimelineDTO` (sessions desc, events desc within). This nested ordering is exactly what the relational builder can't express cleanly — hence `select()`.
- `GET /events/:id`: event (404) + its `media[]` → `BehaviorEventWithMediaDTO`.
- `PATCH /events/:id`: zod body of **only** `{ note?, tags? }` (tap fields/intervention not in the schema → immutable, AC-4); `.set()` only provided keys; `.returning()` → `BehaviorEventDTO`.
- `POST /events/:id/media`: insert `media { eventId, blobUrl(from key), type:'video', }` → `201 MediaDTO`.
- `POST /dogs/:id/sessions`: insert `session { dogId, startedAt: now, location? }` → `201 SessionSummaryDTO` (OQ-7).

No `relations()` declarations and **no migration** required. (If the team later wants `db.query`, adding `relations()` to `schema.ts` is the flagged schema-file addition — optional, not for Phase 2.)

### 5. Mobile routing + data layer
- Routes: `app/dogs/index.tsx`, `app/dogs/[id]/timeline.tsx`, `app/sessions/[id]/log.tsx`, `app/events/[id].tsx`. Params via `useLocalSearchParams<{ id: string }>()`; navigate via `useRouter().push()` and `<Link>`. Register in `_layout.tsx` only if you want custom titles (file-based routes auto-register otherwise).
- `lib/api.ts`: typed `fetch` wrapper over `process.env.EXPO_PUBLIC_API_URL` (static dot-access), returning shared DTOs.
- 4-tap fastness: all four fields pre-defaulted (so an unchanged field needs no tap), local state, single submit, immediate optimistic reset on 201, retry-without-retap on failure (FR-M2). Detect the no-protocol-default `400` and surface a one-time intervention prompt (OQ-8).

### 6. Trainer context
`EXPO_PUBLIC_TRAINER_ID` + `/trainers/:trainerId/dogs` + `POST /dogs/:id/sessions`. Document both env vars in `.env.example`/README (AC-13).

### What would change the recommendation
- If the AWS SDK dependency size is unacceptable, hand-roll SigV4 presigning (`aws4fetch` is a tiny alternative) — but that adds signing-correctness risk; the SDK with the checksum flag is the safe default.
- If web upload must be demonstrated (OQ-10 = yes), the **R2 bucket CORS rule allowing PUT from the web origin is a hard prerequisite** for AC-9-on-web; otherwise verify the picker/upload on a native simulator.
- If the detail screen must play video back, OQ-9 flips to "add `R2_PUBLIC_BASE_URL`" and `blobUrl` changes accordingly.

---

## Technical Research Guidance

**Research needed: No.**

The investigation pinned down concrete, current (2026) API code for every Phase 2 item, including the two genuinely tricky areas the brief flagged:

- **R2 presigned direct upload from Expo (native `file://` PUT + web CORS)** — the most likely deep-research candidate — is resolved with specifics:
  - The **AWS SDK ≥ v3.729 CRC32-checksum incompatibility with R2** and its exact fix (`requestChecksumCalculation:'WHEN_REQUIRED'`, semantics confirmed against the AWS SDKs-and-Tools data-integrity reference) are identified.
  - The **SDK-54 `expo-file-system` deprecation** (legacy `uploadAsync` throws at runtime) and the **new File API** binary-PUT pattern with progress are identified, plus the web `fetch` branch and the `expo-file-system/legacy` escape hatch.
  - The **Content-Type-must-match-the-presign** and **R2 bucket CORS for browser PUT** requirements are confirmed against Cloudflare's docs.

One **low-risk "validate on first run, not research"** note (mirrors the Phase 1 investigation's style):

1. **New `expo-file-system` File-API upload on SDK 54 native** — the new object-based API is current and documented, but the exact symbol surface (`File` / `createUploadTask` / `UploadType.BINARY_CONTENT` import path) shifted late in SDK 54's release. On first scaffold, confirm the import works against the installed `expo-file-system` version; if it misbehaves, fall back to `import * as FileSystem from 'expo-file-system/legacy'` with `uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, httpMethod: 'PUT'`. Risk: low; both paths are known and included above. This does not warrant a separate technical-researcher pass before planning.

---

## Implementation Considerations

- **Pin AWS SDK versions and keep them equal.** `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` must be the **same** version (mismatched majors of these two cause `getSignedUrl` runtime breakage, a long-standing v3 footgun). Current: `~3.937.x`; any matched ≥ 3.729 pair works **with** the checksum flag. Add **only to `apps/api`** (NFR-5 — never into `@tailsup/shared` or mobile).
- **Pin `expo-image-picker` via `npx expo install expo-image-picker`** (let Expo choose the SDK-54-compatible version, currently the `~17.x` line) rather than hand-picking from npm, so it matches `expo ~54.0.35`. Same for `expo-file-system` if the new File API needs the latest patch. **Do not** hard-pin from npm latest — Expo's resolver guarantees compatibility.
- **Permissions:** `expo-image-picker` media-library access on native needs the picker permission (and iOS `NSPhotoLibraryUsageDescription` / camera usage strings if `launchCameraAsync` is added). Web needs none. The Phase 2 web verification target sidesteps native permission prompts, but document them for device testing.
- **Key/ext mapping:** map `video/mp4`→`.mp4`, `video/quicktime`→`.mov`; reject anything else with 400 (OQ-6). SDK 54 iOS may return HEIC/original formats for some assets when `allowsEditing:false` — for video this means `.mov`; validate the picked mimeType against the allow-set before presigning.
- **CORS (OQ-10):** if AC-9 must pass on **web**, the R2 bucket needs a CORS policy allowing `PUT` (and the `Content-Type` header) from the Expo web origin (`http://localhost:8081` in dev). This is a bucket setting in the Cloudflare dashboard/API, not code — document it in the README as an AC-9-on-web prerequisite. Native uploads don't enforce CORS.
- **No schema migration (AC-12):** confirmed — `media`, `behavior_event.note`, `behavior_event.tags` already exist. Adding `relations()` is the *only* thing that would touch `schema.ts`, and the recommendation avoids it.
- **Tests:** reuse the `vi.hoisted` + `vi.mock('../db/client.js')` + `app.request()` pattern for the new routes. For the presign test, mock the AWS SDK (or assert the handler returns 503 when R2 config throws) so tests need no real creds — this is the payoff of lazy config (3A). The R2-config throw test mirrors `config.test.ts` (`vi.resetModules` + delete env var + expect throw).
- **First steps:** (1) add Phase 2 DTOs to `packages/shared/src/dtos.ts` (pure TS, reuse `MediaType`); (2) install AWS SDK in `apps/api` + `expo-image-picker`/`expo-file-system` in `apps/mobile` via `npx expo install`; (3) build read endpoints + `PATCH` + `POST /dogs/:id/sessions` (no R2 needed — testable immediately); (4) add lazy R2 config + `POST /media/presign` + `POST /events/:id/media`; (5) build the three screens + `lib/api.ts`; (6) wire CORS on R2 and document run/verify steps.

---

## References

| # | Source | URL | What was learned |
|---|--------|-----|-----------------|
| 1 | Cloudflare R2 — Presigned URLs | https://developers.cloudflare.com/r2/api/s3/presigned-urls/ | Exact `S3Client` config (`region:'auto'`, R2 endpoint, creds); `getSignedUrl`+`PutObjectCommand`; ContentType restricts uploads; CORS required for browser PUT |
| 2 | AWS SDKs & Tools — Data integrity protections | https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html | `request_checksum_calculation`/`response_checksum_validation` accept `WHEN_SUPPORTED`/`WHEN_REQUIRED`; default is `WHEN_SUPPORTED` (auto CRC32) |
| 3 | AWS SDK for JS v3 — S3 checksums | https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-checksums.html | ≥ v3.729 auto-calculates CRC32 on uploads when no algorithm given; pre-3.729 did not |
| 4 | Cloudflare Community — SDK v3.729 breaks R2 | https://community.cloudflare.com/t/aws-sdk-client-s3-v3-729-0-breaks-uploadpart-and-putobject-r2-s3-api-compatibility/758637 | v3.729 mandatory `x-amz-checksum-crc32` → R2 `NotImplemented`; the regression that forces the `WHEN_REQUIRED` flag |
| 5 | aws-sdk-js-v3 issue #3983 | https://github.com/aws/aws-sdk-js-v3/issues/3983 | client-s3 and s3-request-presigner version mismatch breaks `getSignedUrl` — keep them equal |
| 6 | Expo blog — File System major upgrade in SDK 54 | https://expo.dev/blog/expo-file-system | New object-based File API stable in SDK 54; legacy methods throw deprecation error when called from main import; migrate to File/Directory or `expo-file-system/legacy` |
| 7 | Expo Docs — FileSystem | https://docs.expo.dev/versions/latest/sdk/filesystem/ | `new File(...).upload()/createUploadTask()` with `httpMethod:'PUT'`, custom headers, `UploadType.BINARY_CONTENT`, `onProgress`; legacy import path |
| 8 | Expo Docs — ImagePicker | https://docs.expo.dev/versions/latest/sdk/imagepicker/ | `launchImageLibraryAsync`; SDK 54 `mediaTypes` is a string array (`['videos']`); SDK-54 returns original format when not editing |
| 9 | aws-sdk-js issue #966 — 0-byte uploads | https://github.com/aws/aws-sdk-js/issues/966 | Classic 0-byte presigned-PUT failure when feeding file content to fetch — why native uses the File API not raw fetch |
| 10 | Code Daily — RN presigned S3 upload | https://codedaily.io/tutorials/Upload-a-File-to-an-S3-Pre-Signed-URL-with-React-Native | RN `file://` → Blob → PUT pattern and its caveats (web-acceptable, native-fragile) |
| 11 | Cloudflare R2 — Public buckets | https://developers.cloudflare.com/r2/buckets/public-buckets/ | `pub-<hash>.r2.dev` public hostname format; r2.dev is rate-limited/dev-only; custom domain for production; informs OQ-9 |
| 12 | Drizzle — Relational Queries / RQB v2 | https://orm.drizzle.team/docs/rqb-v2 | `db.query.*` with `with` needs `relations()`; nested orderBy on relations not fully supported → use `select()` for the timeline |
| 13 | Drizzle — nested orderBy discussion #2639 / #2650 | https://github.com/drizzle-team/drizzle-orm/discussions/2639 | Ordering by nested relation not directly supported in `query`; recommended to build with `select()` |
| 14 | Expo Docs — Router / dynamic routes | https://docs.expo.dev/router/reference/url-parameters/ | `[id]` segments, `useLocalSearchParams()`, `useRouter().push()`, `<Link>` for the four screens |
| 15 | Transloadit — Browser uploads to R2 with AWS SDK | https://transloadit.com/devtips/browser-uploads-to-cloudflare-r2-with-aws-sdk/ | `S3Client` endpoint + `region:'auto'`; `PutObjectCommand`+`getSignedUrl` with `expiresIn`; browser `fetch` PUT |
| 16 | Ruan Martinelli — R2 pre-signed URLs | https://ruanmartinelli.com/blog/cloudflare-r2-pre-signed-urls/ | Minimal working `S3Client`/`getSignedUrl`(PUT) + client `fetch(url,{method:'PUT',body:file})` |

---

## Original Request

Investigate the best **implementation approach** for TailsUp **Phase 2 — Trainer view** on the fixed stack (Hono+Drizzle API, Expo Router SDK 54 mobile, Cloudflare R2 presigned DIRECT upload, `@tailsup/shared` pure-TS contract). Six areas: (1) R2 presign server-side; (2) R2 presigned upload from the Expo client (native `file://` PUT + web CORS — the riskiest unknown); (3) lazy R2 config so the API boots/tests without creds; (4) read endpoints + Drizzle query strategy; (5) mobile screens in Expo Router; (6) trainer-context-without-auth. Pin versions for new deps and note pitfalls; assess whether any topic needs a deeper technical-researcher dive. Source docs: `docs/reference/refined-request-phase2.md`, `docs/reference/codebase-scan-phase2.md`, `docs/design/project-design.md`, `docs/reference/investigation-tailsup-phase1.md`.
