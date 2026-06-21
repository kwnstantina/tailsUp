// Builds the Hono app: mounts the Phase 1 routes (GET /health,
// POST /sessions/:id/events) plus the Phase 2 trainer-view routes (dogs, events,
// media) and installs JSON error handling. Phase 1 mounts stay unchanged (AC-12).

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { rateLimiter } from 'hono-rate-limiter';
import { health } from './routes/health.js';
import { sessions } from './routes/sessions.js';
import { dogs } from './routes/dogs.js';
import { events } from './routes/events.js';
import { media } from './routes/media.js';
import { leads } from './routes/leads.js';
import { bookings } from './routes/bookings.js';

export const app = new Hono();

// CORS — required so the Expo *web* build (served from a different origin/port)
// can call the API from the browser. Native iOS/Android fetches don't enforce
// CORS, but the web target does. The Phase 1 endpoints are unauthenticated and
// public, so allow all origins for now; Phase 3 should restrict this to the
// known site/app origins once auth/cookies are introduced.
app.use('*', cors());

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

app.route('/', health);
app.route('/', sessions);

// Phase 2 — Trainer View read/media/start-session routes (design P2.3.11).
app.route('/', dogs);
app.route('/', events);
app.route('/', media);

// Phase 3a — PUBLIC capture endpoints (design P3a). Unauthenticated; CORS stays
// allow-all for 3a (3b tightens it).
app.route('/', leads);
app.route('/', bookings);

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
