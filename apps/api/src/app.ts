// Builds the Hono app: mounts the Phase 1 routes (GET /health,
// POST /sessions/:id/events) plus the Phase 2 trainer-view routes (dogs, events,
// media) and the Phase 3a PUBLIC capture routes (leads, bookings). Phase 3b adds
// BetterAuth: the /api/auth/* handler, a global session middleware, tightened
// (credentialed) CORS, and role guards on the trainer routes.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { rateLimiter } from 'hono-rate-limiter';
import { config } from './config.js';
import { auth } from './lib/auth.js';
import {
  requireClient,
  requireTrainer,
  requireTrainerOwnsParam,
  sessionMiddleware,
  type AppEnv,
} from './middleware/auth.js';
import { health } from './routes/health.js';
import { sessions } from './routes/sessions.js';
import { dogs } from './routes/dogs.js';
import { events } from './routes/events.js';
import { media } from './routes/media.js';
import { leads } from './routes/leads.js';
import { bookings } from './routes/bookings.js';
import { management } from './routes/management.js';
import { me } from './routes/me.js';

export const app = new Hono<AppEnv>();

// ── CORS (Phase 3b — FR-AUTH6) ─────────────────────────────────────────────────
// Phase 3a used allow-all cors(). Auth introduces cookies, and a credentialed
// CORS response MUST name explicit origins (never `*`). So we restrict to the
// configured allow-list (config.allowedOrigins — the Expo web dev origins by
// default; set ALLOWED_ORIGINS in prod) and enable credentials so the browser
// sends/stores the session cookie cross-origin. Native (iOS/Android) doesn't
// enforce CORS and is unaffected.
app.use(
  '*',
  cors({
    origin: config.allowedOrigins,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

// ── Session population (Phase 3b) ──────────────────────────────────────────────
// Resolve the session (cookie OR bearer) into c.var.user on every request. Public
// routes ignore it; guarded routes read it. Runs before the guards + routes.
app.use('*', sessionMiddleware);

// ── Rate limiting for the PUBLIC capture endpoints (Phase 3a — D-8 / AC-3a-9) ──
// A lightweight in-memory limiter (hono-rate-limiter) scoped ONLY to the two
// unauthenticated POST routes, keyed by client IP. Rapid repeats → 429 with the
// standard { error } body. In-memory state resets on restart and is not shared
// across instances — fine for the single Phase 3 instance + local acceptance.
// DEFERRED: production should add an edge/proxy limiter in front of this (D-8);
// no prod deploy exists in Phase 3.
const publicWriteLimiter = rateLimiter({
  windowMs: 60_000, // 1 minute
  limit: 10, // 10 requests / minute / IP
  standardHeaders: 'draft-6',
  // Key by the connecting IP. Behind a proxy, x-forwarded-for's first hop is the
  // client; fall back to a single bucket if neither header is present.
  keyGenerator: (c) =>
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'public',
  handler: (c) => c.json({ error: 'too many requests' }, 429),
});
app.use('/leads', publicWriteLimiter);
app.use('/bookings', publicWriteLimiter);

// ── BetterAuth handler (Phase 3b — FR-AUTH1) ───────────────────────────────────
// PUBLIC by nature — it IS the sign-in/sign-out/session endpoint. BetterAuth owns
// everything under /api/auth/* (sign-in/email, sign-up/email, get-session, …). It
// takes the raw Request and returns a Response. Registered before the guards so
// it is never gated by them.
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// ── Role guards on the Phase 2 trainer routes (Phase 3b — FR-AUTH5) ────────────
// These were unauthenticated in Phase 2 (trainer context came from the
// EXPO_PUBLIC_TRAINER_ID stop-gap). Now they require a trainer session. The
// /trainers/:trainerId/* routes additionally require the path id to MATCH the
// session trainer (OQ-10) — the session is the authoritative trainer id.
// Registered BEFORE app.route so they run ahead of the route handlers.
app.use('/trainers/:trainerId/*', requireTrainerOwnsParam);
app.use('/dogs/*', requireTrainer);
app.use('/sessions/*', requireTrainer);
app.use('/events/*', requireTrainer);
app.use('/media/*', requireTrainer);

// ── Client-only guard for the Phase 3b-2 client dashboard (FR-C*) ───────────────
// The `/me/*` prefix requires a client session (no collision — nothing under /me is
// public). The client id comes from the SESSION, not a path param (DG-2). The
// trainer management MUTATIONS (convert / status / create-login) are NOT prefix-
// guarded here: they live under /leads, /bookings, /clients which collide with the
// PUBLIC POST /leads + POST /bookings, so they carry a route-scoped requireTrainer
// inside management.ts instead (a prefix guard would gate the public POSTs).
app.use('/me/*', requireClient);

// ── Routes ─────────────────────────────────────────────────────────────────────
// PUBLIC: health + the Phase 3a capture endpoints. GUARDED (above): the trainer
// routes under dogs/sessions/events/media/trainers.
app.route('/', health);
app.route('/', sessions);

app.route('/', dogs);
app.route('/', events);
app.route('/', media);

// Phase 3a — PUBLIC capture endpoints (design P3a). Unauthenticated.
app.route('/', leads);
app.route('/', bookings);

// Phase 3b-2 — role-scoped endpoints. `management` = trainer leads/bookings +
// convert / status / create-login (GET lists gated by the /trainers/:trainerId/*
// prefix guard; the three mutations route-scoped-guarded). `me` = the client
// dashboard reads/write (gated by the /me/* prefix guard above).
app.route('/', management);
app.route('/', me);

// Consistent JSON error handling — never leak internals.
app.onError((err, c) => {
  // HTTPException (e.g. malformed JSON body) carries its own status/response.
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'not found' }, 404));
