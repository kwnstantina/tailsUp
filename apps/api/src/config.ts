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
  // The single intentionally-optional var, with a documented default.
  port: Number(process.env.PORT ?? 3000),
} as const;
