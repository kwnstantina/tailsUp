// Builds the Hono app: mounts the two Phase 1 routes and installs JSON error
// handling. Only GET /health and POST /sessions/:id/events exist (AC-12).

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { health } from './routes/health.js';
import { sessions } from './routes/sessions.js';

export const app = new Hono();

// CORS — required so the Expo *web* build (served from a different origin/port)
// can call the API from the browser. Native iOS/Android fetches don't enforce
// CORS, but the web target does. The Phase 1 endpoints are unauthenticated and
// public, so allow all origins for now; Phase 3 should restrict this to the
// known site/app origins once auth/cookies are introduced.
app.use('*', cors());

app.route('/', health);
app.route('/', sessions);

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
