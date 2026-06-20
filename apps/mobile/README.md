# @tailsup/mobile

Expo Router app (iOS / Android / web) for TailsUp Phase 1. It contains **one
screen** (`app/index.tsx`) that calls the API's `GET /health` to prove
app to API connectivity (AC-9). It imports `HealthDTO` from `@tailsup/shared`,
which doubles as proof that the shared workspace package resolves from the Expo
bundler.

## Run (web target is sufficient for Phase 1 verification)

```bash
# from the repo root (single install hoists all workspaces)
npm install

# point the app at the running API (copy then edit if needed)
cp apps/mobile/.env.example apps/mobile/.env

# start the API first (separate terminal): npm run dev -w apps/api  (port 3000)

npm run web -w apps/mobile        # Expo web — open the printed URL
# or: npm run start -w apps/mobile (then press w / a / i)
```

The screen fetches `${EXPO_PUBLIC_API_URL}/health` on mount and shows:

- **loading** — while the request is in flight,
- **success** — `✓ Connected` with `status`, `db`, and the raw JSON payload
  (or `⚠ Connected — degraded` when the API reports `status: 'degraded'`),
- **failure** — `✕ Cannot reach API` ("API unreachable") when the request fails.

A **Re-check** button re-runs the request. Stop the API and tap Re-check to see
the failure state.

## Environment

`EXPO_PUBLIC_API_URL` selects the API base URL (default `http://localhost:3000`).
It is read via static dot-access (`process.env.EXPO_PUBLIC_API_URL`) so Expo can
inline it. `EXPO_PUBLIC_*` values are **public** — no secrets. See
`apps/mobile/.env.example` for the full dev-networking matrix
(web / iOS sim = `localhost`, Android emulator = `10.0.2.2`, device = LAN IP).

## Metro config (fallback only — currently NONE on purpose)

Expo SDK 54 auto-configures Metro for npm workspaces, so there is **no
`metro.config.js`**. Only if `@tailsup/shared` fails to resolve at bundle time
("Unable to resolve module @tailsup/shared") create `apps/mobile/metro.config.js`
with exactly this, then restart the bundler:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
// 1) Watch the whole monorepo so changes in packages/shared trigger reload.
config.watchFolders = [workspaceRoot];
// 2) Resolve from the app's node_modules first, then the hoisted root's.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

Do **not** add stale `extraNodeModules` / `disableHierarchicalLookup` — SDK 52+
guidance drops those when relying on auto-config.
