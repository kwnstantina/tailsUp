---
status: deprecations_found
mode: fix
package_manager: npm
ecosystem: node
iterations_run: 1
deprecations_initial: 0
deprecations_final: 0
vulnerabilities_initial: 23
vulnerabilities_final: 23
target_path: C:/Users/KonstantinaKirtsia/source/repos/tailsUp
validated_at: 2026-06-20T00:00:00Z
last_validated_commit: 163162ee3d8d12fe0f99b3edd3e4433d07120c88
---

# Dependency Validation — TailsUp

## 1. Summary

This is an npm workspaces monorepo (root + `apps/api` + `apps/mobile` + `packages/shared`) using Node v20.20.2 / npm 10.8.2. The initial `npm install` produced **zero deprecation warnings** — no direct dependency is itself deprecated. The `npm audit` reports **23 moderate-severity vulnerabilities**, all of which are:

1. Transitive under `expo@54.x` / Expo SDK internals — the only safe fix is a full Expo SDK upgrade (`npx expo install --check` targeting SDK 56), which is a coordinated major upgrade outside the scope of this tool and guarded by the Expo SDK 54 pin constraint.
2. Transitive under `drizzle-kit@0.31.x` via the abandoned `@esbuild-kit` ecosystem — npm's suggested "fix" (downgrade to `drizzle-kit@0.18.1`) is a semver-major regression that would break migrations and must not be applied.

No auto-fix was applied. All 23 advisories are deferred to manual review. All three workspaces typecheck cleanly (`tsc --noEmit` passes with zero errors).

---

## 2. Initial State

### 2a. Deprecation Warnings (from `npm install` output)

None. `npm install` completed without any `npm warn deprecated` lines.

### 2b. Direct Dependencies with Audit Advisories

| Package | Workspace | Current | Scope | Severity | Advisory / Root Cause | npm's Suggested Fix | Fix Feasible? |
|---|---|---|---|---|---|---|---|
| `expo` | apps/mobile | 54.0.35 | direct | moderate | Transitive via `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `expo-asset`, `expo-constants` | `expo@56.0.12` (major) | **No — Expo-managed pin** |
| `expo-constants` | apps/mobile | 18.0.13 | direct | moderate | Transitive via `@expo/config` → `@expo/config-plugins` → `xcode` → `uuid@7` (GHSA-w5hq-g745-h8pq) | `expo-constants@56.0.18` (major) | **No — Expo-managed pin** |
| `expo-linking` | apps/mobile | 8.0.12 | direct | moderate | Transitive via `expo-constants` | `expo-linking@56.0.14` (major) | **No — Expo-managed pin** |
| `expo-router` | apps/mobile | 6.0.24 | direct | moderate | Transitive via `expo-constants`, `expo-linking` | `expo-router@56.2.11` (major) | **No — Expo-managed pin** |
| `react-native` | apps/mobile | 0.81.5 | direct | moderate | Transitive via `babel-jest` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml@3.x` (GHSA-h67p-54hq-rp68) | `react-native@0.86.0` (major) | **No — Expo-managed pin** |
| `drizzle-kit` | apps/api | 0.31.10 | direct (devDep) | moderate | Transitive via `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → `esbuild@~0.18.20` (GHSA-67mh-4wv8-2f99) | `drizzle-kit@0.18.1` (major downgrade) | **No — regression** |

### 2c. Pure Transitive Vulnerabilities (no direct manifest entry)

| Package | Severity | Advisory | Parent Chain |
|---|---|---|---|
| `esbuild` (≤0.24.2) | moderate | GHSA-67mh-4wv8-2f99 — dev server CORS bypass | `drizzle-kit` → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → `esbuild@~0.18.20` |
| `@esbuild-kit/core-utils` | moderate | (advisory on esbuild ≤0.24.2) | `drizzle-kit` → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` |
| `@esbuild-kit/esm-loader` | moderate | (advisory on esbuild ≤0.24.2) | `drizzle-kit` → `@esbuild-kit/esm-loader` |
| `postcss` (<8.5.10) | moderate | GHSA-qx2v-qp2m-jg93 — XSS in CSS stringify | `expo` → `@expo/metro-config` → `postcss@8.4.49` |
| `uuid` (<11.1.1) | moderate | GHSA-w5hq-g745-h8pq — buffer bounds check | `expo` → `@expo/config-plugins` → `xcode` → `uuid@7.0.3` |
| `xcode` | moderate | (advisory via uuid) | `expo` → `@expo/config-plugins` → `xcode` |
| `@expo/cli` | moderate | (advisory via sub-deps) | `expo` → `@expo/cli` |
| `@expo/config` | moderate | (advisory via sub-deps) | `expo` → `@expo/config` |
| `@expo/config-plugins` | moderate | (advisory via uuid/xcode) | `expo` → `@expo/config-plugins` |
| `@expo/metro-config` | moderate | (advisory via postcss) | `expo` → `@expo/metro-config` |
| `@expo/prebuild-config` | moderate | (advisory via sub-deps) | `expo` → `@expo/prebuild-config` |
| `expo-asset` | moderate | (advisory via expo-constants) | `expo` → `expo-asset` |
| `js-yaml` (≤4.1.1) | moderate | GHSA-h67p-54hq-rp68 — DoS via repeated aliases | `react-native` → `babel-jest` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml@3.14.2` |
| `@istanbuljs/load-nyc-config` | moderate | (advisory via js-yaml) | `react-native` → `babel-jest` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` |
| `babel-plugin-istanbul` | moderate | (advisory via @istanbuljs) | `react-native` → `babel-jest` → `babel-plugin-istanbul` |
| `babel-jest` | moderate | (advisory via babel-plugin-istanbul) | `react-native` → `babel-jest` |
| `@jest/transform` | moderate | (advisory via babel-plugin-istanbul) | (test tooling) |

### 2d. Outdated Packages (from `npm outdated`)

All packages below satisfy their pinned range (`wanted == current`). Latest versions are shown for awareness.

| Package | Workspace | Current | Latest | Notes |
|---|---|---|---|---|
| `expo` | mobile | 54.0.35 | 56.0.12 | Expo SDK 54 pin — do not bump independently |
| `expo-constants` | mobile | 18.0.13 | 56.0.18 | Expo-managed |
| `expo-linking` | mobile | 8.0.12 | 56.0.14 | Expo-managed |
| `expo-router` | mobile | 6.0.24 | 56.2.11 | Expo-managed |
| `expo-status-bar` | mobile | 3.0.9 | 56.0.4 | Expo-managed |
| `react` | mobile | 19.1.0 | 19.2.7 | Expo-managed |
| `react-dom` | mobile | 19.1.0 | 19.2.7 | Expo-managed |
| `react-native` | mobile | 0.81.5 | 0.86.0 | Expo-managed |
| `react-native-safe-area-context` | mobile | 5.6.2 | 5.8.0 | Expo-managed |
| `react-native-screens` | mobile | 4.16.0 | 4.25.2 | Expo-managed |
| `@types/react` | mobile | 19.1.17 | 19.2.17 | Expo-managed |
| `@hono/zod-validator` | api | 0.7.6 | 0.8.0 | Minor — no advisory; safe to bump when ready |
| `@types/node` | api | 22.20.0 | 26.0.0 | Major — breaking changes expected |
| `zod` | api | 3.25.76 | 4.4.3 | Major — Zod v4 has breaking API changes |
| `typescript` | root/api/mobile | 5.9.3 | 6.0.3 | Major — review TS 6 breaking changes |

---

## 3. Replacements Applied

None. Analysis of every flagged vulnerability shows that all auto-fix paths are blocked:

- **Expo-managed packages** (`expo`, `expo-constants`, `expo-linking`, `expo-router`, `react-native`, `react`, `react-dom`, `react-native-*`, `@types/react`): All fixes require a semver-major upgrade to Expo SDK 56. The correct procedure is `npx expo install --check` after deciding to upgrade the SDK. Bumping any subset of these independently will break the Expo interdependency set.
- **`drizzle-kit` advisory**: npm reports the fix as `drizzle-kit@0.18.1`. This is a **downgrade** of 13 minor versions (from 0.31.10 to 0.18.1) and predates the current Drizzle ORM API. The issue (`@esbuild-kit` pinning an abandoned esbuild 0.18.x) is an upstream bug in drizzle-kit that the drizzle team has not yet resolved in the stable release channel. The fix will come from the drizzle-kit maintainers; it cannot be applied from this manifest.

The fix loop stalled at iteration 1 with zero applicable replacements.

---

## 4. Manual Review Needed

### MR-1 — Expo SDK upgrade (addresses 20 of 23 advisories)

**Packages affected:** `expo`, `expo-constants`, `expo-linking`, `expo-router`, `expo-status-bar`, `react`, `react-dom`, `react-native`, `react-native-web`, `react-native-safe-area-context`, `react-native-screens`, `@types/react`, plus all transitive `@expo/*` internals.

**Why it cannot be auto-fixed:** The entire Expo SDK is a coordinated version set. Changing any one package without the others breaks runtime compatibility. The safe upgrade path is:

```bash
# From apps/mobile:
npx expo install expo@^56 --fix
# then follow the SDK migration guide at https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
```

**Severity of remaining advisories if deferred:** All moderate. The vulnerabilities affect:
- `postcss` XSS (GHSA-qx2v-qp2m-jg93): only exploitable if user-controlled CSS is stringified server-side — not relevant to a dev-only Metro bundler usage.
- `uuid` buffer bounds (GHSA-w5hq-g745-h8pq): in `xcode` (iOS project manipulation tool), only runs during `expo prebuild` — not in the production runtime.
- `js-yaml` DoS (GHSA-h67p-54hq-rp68): in `@istanbuljs/load-nyc-config`, a test tooling dependency — not in production bundle.
- `esbuild` CORS bypass (GHSA-67mh-4wv8-2f99): only in the dev server, not in production.

**Risk assessment:** All 23 advisories are development-tooling / build-tooling vulnerabilities. None are in the production API (`apps/api`) or the production mobile bundle sent to end-users. The risk of keeping Expo SDK 54 for now is low in practice, but should be tracked and resolved before a public launch.

---

### MR-2 — drizzle-kit transitive esbuild advisory (addresses 3 of 23 advisories)

**Packages affected:** `drizzle-kit` (direct, devDep in `apps/api`), `@esbuild-kit/esm-loader`, `@esbuild-kit/core-utils`, `esbuild@~0.18.20`.

**Advisory:** GHSA-67mh-4wv8-2f99 — esbuild ≤0.24.2 dev server can be accessed cross-origin.

**Why it cannot be auto-fixed:** The `@esbuild-kit` packages are an abandoned ecosystem (last published September 2023). `drizzle-kit@0.31.x` depends on `@esbuild-kit/esm-loader@^2.5.5` which in turn pins `esbuild@~0.18.20`. The npm audit's suggested remedy (downgrade to `drizzle-kit@0.18.1`) predates the 0.19+ rewrite and would break migrations. The Drizzle team is aware; a fix is expected in a future stable release.

**Recommended action:** Monitor the drizzle-kit changelog. When a release notes removal of the `@esbuild-kit` dependency (expected in the 0.32+ or 1.x stable line), upgrade `drizzle-kit` in `apps/api/package.json`.

**Risk assessment:** `drizzle-kit` is a development-only tool (migrations CLI). The esbuild advisory affects only the esbuild development server. Since `drizzle-kit` does not run a web server during normal `drizzle-kit generate` / `drizzle-kit migrate` invocations, the advisory's attack surface is not present in normal use.

---

### MR-3 — Non-advisory outdated packages (safe to bump when ready)

These are outdated but carry no active advisories and are not Expo-managed:

| Package | Current | Latest | Action |
|---|---|---|---|
| `@hono/zod-validator` | 0.7.6 | 0.8.0 | Minor bump — check changelog for breaking changes to `zValidator` helper signatures; likely safe |
| `@types/node` | 22.20.0 | 26.0.0 | Major — only affects type definitions; review Node 24/26 type additions before bumping |
| `zod` | 3.25.76 | 4.4.3 | Major — Zod v4 has breaking API changes; requires migration of all schema definitions in `apps/api` |
| `typescript` | 5.9.3 | 6.0.3 | Major — TypeScript 6 drops some legacy emit options; review breaking changes before bumping |

---

## 5. Security Audit

**Tool:** `npm audit --json` (npm 10.8.2)
**Total vulnerabilities found:** 23 moderate, 0 high, 0 critical

| # | Package (vulnerable) | Severity | Advisory ID | Title | CVSS | Root cause package | Fix path |
|---|---|---|---|---|---|---|---|
| 1 | `esbuild` ≤0.24.2 | moderate | GHSA-67mh-4wv8-2f99 | Dev server cross-origin request | 5.3 | `drizzle-kit` (devDep) | Upstream drizzle-kit fix |
| 2 | `@esbuild-kit/core-utils` | moderate | (via esbuild) | — | — | `drizzle-kit` (devDep) | Upstream drizzle-kit fix |
| 3 | `@esbuild-kit/esm-loader` | moderate | (via esbuild) | — | — | `drizzle-kit` (devDep) | Upstream drizzle-kit fix |
| 4 | `postcss` <8.5.10 | moderate | GHSA-qx2v-qp2m-jg93 | XSS via unescaped `</style>` in CSS stringify | 6.1 | `expo` (SDK 54) | Expo SDK upgrade |
| 5 | `uuid` <11.1.1 | moderate | GHSA-w5hq-g745-h8pq | Missing buffer bounds check in v3/v5/v6 | 7.5 | `expo` → `@expo/config-plugins` → `xcode` | Expo SDK upgrade |
| 6 | `js-yaml` ≤4.1.1 | moderate | GHSA-h67p-54hq-rp68 | Quadratic DoS via repeated YAML aliases | 5.3 | `react-native` → `babel-plugin-istanbul` | Expo SDK upgrade |
| 7–23 | Various `@expo/*`, `expo-*`, `babel-*`, `@jest/*` | moderate | (all via #4, #5, #6 above) | — | — | `expo` / `react-native` | Expo SDK upgrade |

**Context note:** All 23 vulnerabilities are in build-time / dev-server tooling only. None are in the production API server bundle or the compiled mobile app bundle distributed to users.

---

## 6. Final State

**No changes were made to any manifest file.** The project is in the same state as at the start of validation.

- `npm install` completes with 0 deprecation warnings.
- `npm run typecheck` passes in all three workspaces with 0 errors.
- 23 moderate advisories remain, all deferred to manual review (MR-1 and MR-2 above).
- 0 direct-dependency deprecations with safe drop-in replacements were found.

The honest state is: **no direct-dependency deprecations; 23 transitive advisories deferred to manual review** — split into 20 owned by the Expo SDK 54 pin (MR-1) and 3 owned by the drizzle-kit / @esbuild-kit upstream dependency (MR-2).

---

## 7. Commands Run

| # | Command | Working Dir | Exit Code | Notes |
|---|---|---|---|---|
| 1 | `node -v` | root | 0 | v20.20.2 — correct, no nvm switch needed |
| 2 | `npm -v` | root | 0 | 10.8.2 |
| 3 | `npm install` | root | 0 | up to date, 748 packages, 0 deprecation warnings |
| 4 | `npm audit --json` | root | 1 | Exit 1 is expected when vulnerabilities exist; JSON parsed successfully |
| 5 | `npm outdated --json` | root | 1 | Exit 1 is expected when outdated packages exist; JSON parsed successfully |
| 6 | `npm ls @esbuild-kit/core-utils` | root | 0 | Confirmed transitive chain: drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils |
| 7 | `npm ls postcss` | root | 0 | Confirmed transitive chain: expo → @expo/metro-config → postcss |
| 8 | `npm ls uuid` | root | 0 | Confirmed transitive chain: expo → @expo/config-plugins → xcode → uuid@7.0.3 |
| 9 | `npm ls js-yaml` | root | 0 | Confirmed transitive chain: react-native → babel-jest → babel-plugin-istanbul → @istanbuljs/load-nyc-config → js-yaml@3.14.2 |
| 10 | `npm ls expo-constants expo-linking expo-router` | root | 0 | Confirmed direct dependencies in apps/mobile |
| 11 | `npm run typecheck` | root | 0 | All three workspaces pass tsc --noEmit with 0 errors |
| 12 | `npm show drizzle-kit@latest version` | root | 0 | 0.31.10 — confirms project is on latest stable drizzle-kit |
