// API entrypoint. Starts the Node HTTP server via @hono/node-server on
// config.port (process.env.PORT, default 3000 — D-9). config.ts throws at
// import time if a required env var (DATABASE_URL) is missing.

import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`TailsUp API listening on http://localhost:${info.port}`);
});
