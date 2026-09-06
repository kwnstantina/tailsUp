// Validated environment loader.
// HARD RULE (project convention / D-11): THROW on any missing required var.
// No fallback values for required configuration — fail fast at startup
// instead of running with a silent default. PORT is the ONLY optional var.

import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  // Required — never defaulted. config.ts throws if absent.
  databaseUrl: required('DATABASE_URL'),
  // The practice's trainer. Public site captures (POST /leads, POST /bookings)
  // have no authenticated actor, but lead.trainerId / booking.trainerId are
  // NOT NULL — so the owning trainer is resolved from config, never from the
  // request body (a client-supplied trainerId would be forgeable). Single
  // trainer today; multi-tenant resolution is Phase 4.
  defaultTrainerId: required('DEFAULT_TRAINER_ID'),
  // Comma-separated list of origins allowed to call this API from a browser.
  // Required, not defaulted: the public site is served from a DIFFERENT origin
  // than the API (Cloudflare Pages -> Railway), so every deployment must state
  // its own allow-list. Defaulting to '*' would silently ship an open API.
  corsOrigins: required('CORS_ORIGINS')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0),
  // The single intentionally-optional var, with a documented default.
  port: Number(process.env.PORT ?? 3000),
} as const;
