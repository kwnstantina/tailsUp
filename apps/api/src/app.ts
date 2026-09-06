// Builds the Hono app: mounts the routes and installs JSON error handling.
//
// Phase 1 routes: GET /health, POST /sessions/:id/events.
// Phase 3 public-site capture: POST /leads, POST /bookings.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { config } from './config.js';
import { bookings } from './routes/bookings.js';
import { health } from './routes/health.js';
import { leads } from './routes/leads.js';
import { sessions } from './routes/sessions.js';

export const app = new Hono();

// The public site runs on a different origin than the API (Cloudflare Pages ->
// Railway), so browser calls need an explicit allow-list. Origins come from
// config — never '*', which would let any site post leads to this practice.
app.use(
  '*',
  cors({
    origin: config.corsOrigins,
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

app.route('/', health);
app.route('/', sessions);
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
