// Builds the Hono app: mounts the two Phase 1 routes and installs JSON error
// handling. Only GET /health and POST /sessions/:id/events exist (AC-12).

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { health } from './routes/health.js';
import { sessions } from './routes/sessions.js';

export const app = new Hono();

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
