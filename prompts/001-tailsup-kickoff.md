# 001 — TailsUp Project Kickoff Prompt

> Raw request that drives the team-workflow. Architecture is **decided** — do not re-litigate
> unless a genuine blocker is found. Build proceeds **phase by phase**; Phase 1 is the current scope.

## Product
A data-driven dog-training platform. A trainer records structured behavior data during training
sessions on a mobile app. Clients (dog owners) see their dog's progress, do homework between
sessions, and upload videos. A public website captures leads and booking requests. The structured
behavior data feeds cheap AI summaries now and a proprietary dataset later. The differentiator:
nobody else treats dog behavior as structured, queryable, longitudinal data.

## Architecture (DECIDED)
- **App + Site = ONE Expo codebase** (Expo Router). Builds to iOS, Android, and web. No separate Next.js site.
- **Backend API**: Hono + TypeScript, deployed to Railway (scale-to-zero).
- **Database**: PostgreSQL (Railway-managed), accessed via Drizzle ORM.
- **Media**: Cloudflare R2 with presigned upload URLs — clients/app upload DIRECTLY to R2, never through the API.
- **Auth**: BetterAuth (self-hosted), roles `trainer` and `client`.
- **AI**: Anthropic API, model `claude-haiku-4-5` for progress summaries.
- Priorities, in order: low maintenance, low cost, no vendor lock-in.

## Monorepo structure
```
tailsup/
├── apps/
│   ├── mobile/      # Expo (iOS, Android, web)
│   └── api/         # Hono + Drizzle
├── packages/
│   └── shared/      # shared types (enums, DTOs) imported by both
├── package.json     # npm workspaces
```

## Data model
- **Trainer**: id, name, email.
- **Client**: id, trainerId(FK), name, contact.
- **Protocol**: id, name, defaultIntervention. (A training program, e.g. "Reactivity".)
- **Dog**: id, clientId(FK), protocolId(FK, nullable), name, breed, ageMonths, backgroundNotes.
- **Session**: id, dogId(FK), bookingId(FK, nullable), startedAt, location.
- **BehaviorEvent** (THE CORE): id, sessionId(FK), occurredAt, triggerType(enum: dog|human|noise|vehicle|other),
  thresholdMeters(int), intensity(int 1–10), outcome(enum: disengaged|recovered_slowly|over_threshold),
  intervention(text, defaults from Protocol), note(text, optional), tags(jsonb string[], optional).
- **Media**: id, eventId(FK), blobUrl(R2 reference), type(video|image), uploadedAt.
- **Exercise**: id, protocolId(FK), title, instructions.
- **Homework**: id, dogId(FK), exerciseId(FK), completed(bool), completedAt(nullable).
- **Lead**: id, trainerId(FK), name, contact, source, message, status(enum: new|contacted|converted|lost),
  clientId(FK nullable, set on conversion), createdAt.
- **Booking**: id, trainerId(FK), leadId(FK nullable), clientId(FK nullable), type(enum: assessment|private|group),
  requestedAt, status(enum: requested|confirmed|declined|completed|cancelled), notes, createdAt.

### Data rules
- Enums for the 4 "tap" fields (triggerType, intensity, outcome — button-based logging, clean analytics).
- `intervention` defaults from `Protocol.defaultIntervention` so session logging stays 4 taps.
- `tags` as jsonb with a GIN index (filterable, no migration to add new tags).
- Media stores only the R2 URL, never the file.
- Every BehaviorEvent links `intervention → outcome` — the dataset moat; never drop it.

## Endpoints (Hono)
- `GET /health`
- `POST /sessions/:id/events` — 4-tap logging write. Body: triggerType, thresholdMeters, intensity, outcome, intervention.
- `POST /leads` — PUBLIC. Site contact form. After insert, email notification (Resend; stub if no key).
- `POST /bookings` — PUBLIC. Appointment request, defaults to status "requested".
- `PATCH /bookings/:id/status` — TRAINER auth. confirmed|declined|completed|cancelled.
- `POST /leads/:id/convert` — TRAINER auth. Creates a Client from the Lead, sets status=converted + clientId.
- `POST /media/presign` — returns a presigned R2 upload URL.
- `POST /dogs/:id/summary` — serializes the dog's BehaviorEvents to JSON, calls Haiku, returns a 2-sentence summary.

## Indexes
- behaviorEvents (sessionId, occurredAt)
- sessions (dogId, startedAt)
- GIN on behaviorEvents.tags
- dogs (clientId), clients (trainerId)

## Build order (PHASE BY PHASE — stop after each for review)

### Phase 1 — Foundations (CURRENT SCOPE)
1. Scaffold the monorepo with npm workspaces.
2. `apps/api` with Hono + Drizzle. Implement the FULL schema above + migrations.
3. Implement `GET /health` and `POST /sessions/:id/events`.
4. `.env.example` listing all required vars (DATABASE_URL, ANTHROPIC_API_KEY, R2_*, AUTH_SECRET, RESEND_API_KEY).
5. Scaffold `apps/mobile` with Expo Router; one screen that calls `/health` to prove app↔API connectivity.
6. GitHub Action: daily `pg_dump` uploaded to R2 (backup from day one).
→ Summarize what was built and how to run locally, then STOP.

### Phase 2 — Trainer view
4-tap quick-logging screen writing BehaviorEvents; post-session detail screen (note, tags, video upload via R2 presign); dog timeline.

### Phase 3 — Public site + Client view
All website pages (Home, About, Services with tracking-as-a-service, Results, Contact + lead form, Booking),
Design System applied. Then app side: auth with roles; client dashboard (threshold-over-time graph, homework,
reminders); trainer view to list/approve leads & bookings and convert leads.

### Phase 4 — AI & scale
`/dogs/:id/summary` Haiku endpoint; spend cap reminder; prep for multi-tenant SaaS.

## Conventions
- TypeScript strict mode everywhere.
- Shared enums/types live in `packages/shared`, imported by both api and mobile.
- Secrets in `.env`, never committed. Provide `.env.example`.
- Simplest thing that works; add complexity only when needed.
- Each phase: provide exact commands to run and test before moving on.

## Website (business-first, for Phase 3)
A real business website for a dog-training practice, NOT an app showcase. The data-driven tracking
platform is ONE premium service, not the homepage's main message. Journey: who we are → services →
where to find us → leave a lead / request a booking. Pages: Home, About, Services, Results,
Contact (location + lead form), Booking. Premium aesthetic; full Design System reference below.

## Design System (for Phase 3 site pages)
Premium, refined, calm, precise — trustworthy specialist brand, not a "cute" pet brand. Avoid the
cliché cream + terracotta look; deep green is the differentiator.

Color tokens:
```css
--color-bg: #FAF7F0; --color-bg-alt: #F0EADD; --color-surface: #FFFFFF;
--color-primary: #1B3A32; --color-primary-soft: #3D5249;
--color-accent: #B07D48; --color-accent-soft: #E8C9A0; --color-mint: #9FC4B5;
--color-text: #1B3A32; --color-text-muted: #6B7D74; --color-border: rgba(27,58,50,0.12);
```
Deep green for weight/trust (CTA, footer, dark "proof" band). Copper ONLY for small details. Never large copper surfaces.

Typography: Display = Fraunces (fallback Georgia), headings only, weight 400–500, ls -0.02em.
Body = Inter (fallback system-ui), weight 400, lh 1.6. Scale: H1 44–48 / H2 27–32 / H3 18–20 /
body-lg 16 / body 14–15 / eyebrow 12.5 uppercase ls 0.16em / caption 11.5.

Spacing: xs8 sm16 md24 lg32 xl54 2xl80; radius6 radius-lg14; max-width1080 max-prose720.

Components: primary button (green bg, off-white text, radius6, padding 13/28); secondary (transparent, 1px border);
eyebrow label (copper, uppercase, 0.16em); card (white surface, 0.5px border, radius-lg); dark proof-band (used ONCE per page).

Signature element: the progress curve (threshold-over-time) — thin gold line on deep-green background with soft
gradient fill. Proof of method, not decoration. Appears in the data-driven service section only.

Principles: spend boldness in one place; whitespace = premium; proof not promises; quality floor (responsive,
visible focus, respect prefers-reduced-motion); subtle motion.
