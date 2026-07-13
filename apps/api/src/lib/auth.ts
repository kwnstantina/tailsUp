// BetterAuth server instance (Phase 3b — FR-AUTH1/2/4) — self-hosted on Hono.
//
// Roles: 'trainer' | 'client' as an input:false `role` field on the BetterAuth
// user, plus input:false `trainerId`/`clientId` link fields that map a login to
// its domain row. A logged-in trainer's session.user.trainerId is what RETIRES
// the EXPO_PUBLIC_TRAINER_ID stop-gap (the server resolves the trainer from the
// session, never a build-time env var). These link fields are set server-side
// (seed / trainer-provisioning), never by the client (input:false).
//
// NO admin plugin: it adds a ban/impersonate surface we don't want and a
// server-to-server createUser auth dance we don't need. Accounts are created via
// signUpEmail + a direct Drizzle role/link patch (seed.ts); authorization is
// enforced by our own requireTrainer/requireClient middleware.
//
// TABLE-NAME COLLISION: the domain schema already has a `session` table (training
// sessions). BetterAuth's auth-session table is renamed to `auth_session`
// (session.modelName) so the two never collide in Postgres. The CLI-generated
// tables live in db/auth-schema.ts and are passed to the adapter explicitly (see
// the `schema` mapping) so they are NOT merged into the runtime db schema (which
// would re-introduce the `session` name clash).
//
// secret + baseURL come from config.ts (AUTH_SECRET is REQUIRED — throw-on-missing).

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { account, session, user, verification } from '../db/auth-schema.js';

export const auth = betterAuth({
  secret: config.authSecret,
  baseURL: config.betterAuthUrl,

  // Explicit schema mapping keyed by BetterAuth MODEL name (user/session/account/
  // verification). `session` maps to our `auth_session` table (its SQL name lives
  // on the Drizzle object, so BetterAuth addresses it as `session` while Postgres
  // sees `auth_session` — no collision with the domain `session`). Passing the
  // tables explicitly means they are NOT merged into the runtime db schema (which
  // would re-introduce the `session` name clash). The default CRUD path uses
  // db.insert/db.select directly (the db.query relational path is gated behind
  // experimental.joins, which we leave off), so the auth tables need not be in
  // the db client's relational schema.
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  // role + domain links carried on the user row. input:false → never settable by
  // the client at signUp; set server-side (seed / provisioning) via Drizzle.
  user: {
    additionalFields: {
      role: { type: 'string', input: false, defaultValue: 'client', required: false },
      trainerId: { type: 'string', input: false, required: false },
      clientId: { type: 'string', input: false, required: false },
    },
  },

  // expo(): rewrites Origin -> expo-origin for native (CSRF) + encodes the session
  // for the deep-link callback. bearer(): also accept Authorization: Bearer <token>
  // so getSession() resolves cookie (web) OR bearer (native/secure-storage) — LBD-3.
  plugins: [expo(), bearer()],

  // CSRF allow-list: the credentialed web origin(s) + the native app scheme. In dev
  // also allow Expo Go's exp:// URLs. Mirrors the CORS allow-list in app.ts.
  trustedOrigins: [
    ...config.allowedOrigins,
    'tailsup://',
    ...(process.env.NODE_ENV !== 'production' ? ['exp://', 'exp://*'] : []),
  ],
});

export type Auth = typeof auth;
