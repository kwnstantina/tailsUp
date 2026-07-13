// =============================================================================
// BetterAuth Expo client (Phase 3b — FR-AUTH2/3) — ONE client for web + native.
//
// Transport (LBD-3): on WEB the browser holds the httpOnly session cookie and
// sends it automatically (fetch credentials:'include' in lib/api.ts). On NATIVE
// there is no cookie jar, so `expoClient` persists the session cookie in
// expo-secure-store and re-attaches it — for calls made THROUGH this client
// automatically, and for our own API calls via authClient.getCookie() (see
// lib/api.ts). The `expoClient` plugin is web-safe: it guards all SecureStore
// access behind Platform.OS !== 'web'.
//
// `better-auth/react` gives the useSession() hook; inferAdditionalFields teaches
// the client about our server-side user fields (role + domain links) so
// session.user.role / .trainerId / .clientId are typed. `scheme` must match
// app.json ("tailsup"); required on native only.
// =============================================================================

import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';

// Same base URL + static dot-access convention as lib/api.ts (Metro inlines it).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: 'tailsup', // must match app.json "scheme"
      storagePrefix: 'tailsup',
      storage: SecureStore, // native cookie jar; unused on web
    }),
    // Mirror the server user.additionalFields so session.user is typed with them.
    inferAdditionalFields({
      user: {
        role: { type: 'string' },
        trainerId: { type: 'string' },
        clientId: { type: 'string' },
      },
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;
