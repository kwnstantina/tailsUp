// Shared test double for ../lib/auth.js (Phase 3b). Route tests import app.js,
// which imports the real BetterAuth instance; that would construct BetterAuth +
// hit the DB on every request via the session middleware. Instead each route
// test does:
//
//   import { authState, trainerSession } from './authMock.js';
//   vi.mock('../lib/auth.js', () => import('./authMock.js'));
//   beforeEach(() => { authState.session = trainerSession(TRAINER_ID); });
//
// The vi.mock factory and the top-level import resolve to THIS same module, so
// mutating `authState.session` controls what sessionMiddleware sees.

import { vi } from 'vitest';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string | null;
  trainerId: string | null;
  clientId: string | null;
}
export interface MockSession {
  user: MockUser;
  session: { id: string };
}

// Mutable holder — set before each request in a test.
export const authState: { session: MockSession | null } = { session: null };

// The mock BetterAuth instance app.ts + middleware/auth.ts import. handler is a
// stub (tests never hit /api/auth/*); getSession returns the current authState.
// signUpEmail is used by the Phase 3b-2 trainer create-login route — tests drive it
// with mockResolvedValue / mockRejectedValueOnce (a rejection = "email exists").
export const auth = {
  handler: vi.fn(
    async () =>
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
  ),
  api: {
    getSession: vi.fn(async () => authState.session),
    signUpEmail: vi.fn(async () => ({ user: { id: 'auth-new' } })),
  },
};

export function trainerSession(trainerId: string): MockSession {
  return {
    user: {
      id: `auth-${trainerId}`,
      email: 'trainer@test.local',
      name: 'Test Trainer',
      role: 'trainer',
      trainerId,
      clientId: null,
    },
    session: { id: 'sess-trainer' },
  };
}

export function clientSession(clientId: string): MockSession {
  return {
    user: {
      id: `auth-${clientId}`,
      email: 'client@test.local',
      name: 'Test Client',
      role: 'client',
      trainerId: null,
      clientId,
    },
    session: { id: 'sess-client' },
  };
}
