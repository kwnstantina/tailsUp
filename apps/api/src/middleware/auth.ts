// Auth middleware (Phase 3b — FR-AUTH4/5) — session population + role guards.
//
// sessionMiddleware runs globally and populates c.var.user from whatever
// transport is present: BetterAuth's getSession resolves a cookie (web) OR an
// Authorization: Bearer token (native/secure-storage) transparently — LBD-3.
// The guards then gate protected routes purely from c.var.user (server-side —
// NFR-3: role is never trusted from the client).
//
// TYPES: we deliberately use an explicit AuthedUser shape and cast the getSession
// result, rather than `auth.$Infer.Session`. Pulling BetterAuth's inferred
// session type into every route's Hono generic is what makes tsc pathologically
// slow; the explicit shape keeps type-checking fast and is the exact projection
// the app consumes (mirrors @tailsup/shared SessionUserDTO).

import type { Context, MiddlewareHandler } from 'hono';
import { auth } from '../lib/auth.js';

// The authenticated user as our handlers consume it — the BetterAuth user row
// projected to the fields we set (role + domain links are the additionalFields).
export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: string | null; // 'trainer' | 'client' (nullable at the column level)
  trainerId: string | null;
  clientId: string | null;
}

// Hono env: the vars sessionMiddleware sets. Route sub-apps that read the user
// (or the whole app) type themselves with this so c.get('user') is typed.
export type AppEnv = { Variables: { user: AuthedUser | null } };

// Read the authenticated user off the context (already populated by
// sessionMiddleware). Usable from any handler without re-typing its Hono.
export function getUser(c: Context): AuthedUser | null {
  return c.get('user') ?? null;
}

// Populate c.var.user on every request. Never throws — a missing/invalid session
// just yields user=null (the guards decide what to reject).
export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('user', (session?.user as AuthedUser | undefined) ?? null);
  await next();
};

// Any authenticated user (trainer or client). 401 when unauthenticated.
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'unauthorized' }, 401);
  await next();
};

// Trainer-only. 401 when unauthenticated, 403 when authenticated but not a trainer.
export const requireTrainer: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  if (user.role !== 'trainer') return c.json({ error: 'forbidden' }, 403);
  await next();
};

// Client-only. 401 when unauthenticated, 403 when authenticated but not a client.
export const requireClient: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  if (user.role !== 'client') return c.json({ error: 'forbidden' }, 403);
  await next();
};

// For the Phase 2 `/trainers/:trainerId/*` routes (OQ-10): require a trainer whose
// session trainerId MATCHES the path param — a trainer can only read their own
// data (→ 403 on mismatch). This RETIRES the EXPO_PUBLIC_TRAINER_ID stop-gap:
// the authoritative trainer id is the session's, not a build-time env var. The
// param is available because the middleware is registered on the param pattern.
export const requireTrainerOwnsParam: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  if (user.role !== 'trainer') return c.json({ error: 'forbidden' }, 403);
  const paramTrainerId = c.req.param('trainerId');
  if (paramTrainerId && user.trainerId !== paramTrainerId) {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
};
