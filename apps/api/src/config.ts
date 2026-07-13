// Validated environment loader.
// HARD RULE (project convention / D-11): THROW on any missing required var.
// No fallback values for required configuration — fail fast at startup
// instead of running with a silent default.
//
// REQUIRED (throw-on-missing): DATABASE_URL, AUTH_SECRET (Phase 3b — BetterAuth
// cannot sign sessions without it; NFR-3).
// OPTIONAL (documented defaults): PORT, BETTER_AUTH_URL (auth baseURL — defaults
// to the local dev origin), ALLOWED_ORIGINS (CORS allow-list — defaults to the
// Expo web dev origins). These mirror PORT's documented-optional precedent and
// are the dev conveniences; production sets them explicitly (see .env.example).

import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT ?? 3000);

// Parse a comma-separated origin allow-list, trimming + dropping blanks. Falls
// back to the local Expo-web dev origins (8081 = Metro web, 19006 = legacy
// expo-web) + the API's own origin so cookie auth works out of the box in dev.
function parseAllowedOrigins(raw: string | undefined): string[] {
  const trimmed = raw?.trim();
  if (trimmed) {
    return trimmed
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o !== '');
  }
  return [
    'http://localhost:8081',
    'http://localhost:19006',
    `http://localhost:${port}`,
  ];
}

export const config = {
  // Required — never defaulted. config.ts throws if absent.
  databaseUrl: required('DATABASE_URL'),
  // Phase 3b — BetterAuth session-signing secret. Required (NFR-3): auth must not
  // run with a silent default. Never logged.
  authSecret: required('AUTH_SECRET'),
  // The single intentionally-optional numeric var, with a documented default.
  port,
  // Auth baseURL BetterAuth uses to build its endpoint URLs. Documented optional:
  // defaults to the local dev origin; set explicitly in any non-localhost deploy.
  betterAuthUrl: process.env.BETTER_AUTH_URL?.trim() || `http://localhost:${port}`,
  // CORS origin allow-list (credentialed). Documented optional with dev defaults.
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
} as const;
