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
validated_at: 2026-06-20T21:51:00Z
last_validated_commit: 608be02c0a1a5165a8380e30f0efa66bf6555ae8
---

# Dependency Validation — TailsUp Phase 2

## 1. Summary

This is an npm workspaces monorepo (`apps/api`, `apps/mobile`, `packages/shared`). The
Phase 2 additions — `@aws-sdk/client-s3@3.1073.0`, `@aws-sdk/s3-request-presigner@3.1073.0`
(both matched, as required), `expo-image-picker@17.0.11`, `expo-video@3.0.16`, and
`expo-file-system@19.0.23` — are clean: none appear in any security advisory, and `npm install`
produced zero deprecation warnings. The 23 moderate advisories found are carry-forwards from
Phase 1 — all trace to two root causes: (1) the `drizzle-kit` / `@esbuild-kit` chain (known
Phase 1 deferral), and (2) the Expo SDK 54 internal dependency cluster whose fix requires a
full Expo SDK upgrade (`expo@56`). Both root causes are explicitly guardrailed against
independent manual bumping. No safely auto-fixable direct-dependency issue was found; all 23
advisories are deferred to manual review per the project guardrails. All three workspaces
typecheck cleanly and all 31 API tests pass.

## 2. Initial State

### Deprecation warnings from `npm install`

None. `npm install` completed with "up to date, audited 875 packages" and zero deprecation
warning lines.

### Security advisories — 23 moderate, 0 high/critical

| # | Package | Direct? | Installed version | Advisory / root cause | Advisory ID | Severity | Fix available |
|---|---------|---------|-------------------|-----------------------|-------------|----------|---------------|
| 1 | `drizzle-kit` | Yes (api devDep) | 0.31.x | Pulls `@esbuild-kit/esm-loader` → `esbuild <=0.24.2` (dev-server SSRF, GHSA-67mh-4wv8-2f99) | GHSA-67mh-4wv8-2f99 | moderate | `drizzle-kit@0.18.1` — semver **major downgrade** |
| 2 | `@esbuild-kit/core-utils` | No (transitive via drizzle-kit) | * | Same esbuild chain | GHSA-67mh-4wv8-2f99 | moderate | Requires drizzle-kit major downgrade |
| 3 | `@esbuild-kit/esm-loader` | No (transitive via drizzle-kit) | * | Same esbuild chain | GHSA-67mh-4wv8-2f99 | moderate | Requires drizzle-kit major downgrade |
| 4 | `esbuild` | No (transitive via drizzle-kit + vite) | <=0.24.2 | dev-server SSRF; also GHSA-g7r4-m6w7-qqqr (path traversal on Windows, low) | GHSA-67mh-4wv8-2f99 / GHSA-g7r4-m6w7-qqqr | moderate/low | Requires parent updates |
| 5 | `expo` | Yes (mobile dep) | 54.0.35 | Expo SDK 54 internal chain: `@expo/config-plugins` → `xcode` → `uuid<11.1.1`; `@expo/metro-config` → `postcss<8.5.10`; `@expo/cli` → `@expo/config` chain | multiple | moderate | `expo@56.0.12` — SDK 56 upgrade |
| 6 | `expo-constants` | Yes (mobile dep) | 18.0.13 | Via `@expo/config` chain | — | moderate | `expo-constants@56.0.18` — SDK 56 upgrade |
| 7 | `expo-linking` | Yes (mobile dep) | 8.0.12 | Via `expo-constants` | — | moderate | `expo-linking@56.0.14` — SDK 56 upgrade |
| 8 | `expo-router` | Yes (mobile dep) | 6.0.24 | Via `expo-constants` + `expo-linking` | — | moderate | `expo-router@56.2.11` — SDK 56 upgrade |
| 9 | `react-native` | Yes (mobile dep) | 0.81.5 | Via `babel-jest` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml<=4.1.1` (GHSA-h67p-54hq-rp68, quadratic-complexity DoS) | GHSA-h67p-54hq-rp68 | moderate | `react-native@0.86.0` — major upgrade |
| 10 | `@expo/cli` | No (transitive via expo) | * | Via @expo/config-plugins + postcss | — | moderate | Requires expo SDK 56 upgrade |
| 11 | `@expo/config` | No (transitive via expo) | * | Via @expo/config-plugins | — | moderate | Requires expo SDK 56 upgrade |
| 12 | `@expo/config-plugins` | No (transitive via expo) | * | Via xcode/uuid | — | moderate | Requires expo SDK 56 upgrade |
| 13 | `@expo/metro-config` | No (transitive via expo) | * | Via @expo/config + postcss | — | moderate | Requires expo SDK 56 upgrade |
| 14 | `@expo/prebuild-config` | No (transitive via expo) | * | Via @expo/config + @expo/config-plugins | — | moderate | Fixable by expo SDK upgrade |
| 15 | `expo-asset` | No (transitive via expo) | * | Via expo-constants | — | moderate | Requires expo SDK 56 upgrade |
| 16 | `@istanbuljs/load-nyc-config` | No (transitive via react-native) | * | Via js-yaml | — | moderate | Requires react-native major upgrade |
| 17 | `@jest/transform` | No (transitive via react-native) | * | Via babel-plugin-istanbul | — | moderate | Fixable by react-native major upgrade |
| 18 | `babel-jest` | No (transitive via react-native) | * | Via @jest/transform + babel-plugin-istanbul | — | moderate | Requires react-native major upgrade |
| 19 | `babel-plugin-istanbul` | No (transitive via react-native) | * | Via @istanbuljs/load-nyc-config | — | moderate | Requires react-native major upgrade |
| 20 | `js-yaml` | No (transitive via react-native) | <=4.1.1 | GHSA-h67p-54hq-rp68 — quadratic DoS via merge key aliases | GHSA-h67p-54hq-rp68 | moderate | Requires react-native major upgrade |
| 21 | `postcss` | No (transitive via expo) | <8.5.10 | GHSA-qx2v-qp2m-jg93 — XSS via unescaped `</style>` in CSS output | GHSA-qx2v-qp2m-jg93 | moderate | Requires expo SDK 56 upgrade |
| 22 | `uuid` | No (transitive via expo → @expo/config-plugins → xcode) | <11.1.1 | GHSA-w5hq-g745-h8pq — missing buffer bounds check in v3/v5/v6 | GHSA-w5hq-g745-h8pq | moderate | Requires expo SDK 56 upgrade |
| 23 | `xcode` | No (transitive via expo) | >=0.9.2 | Via uuid<11.1.1 | — | moderate | Requires expo SDK 56 upgrade |

### Phase 2 new dependencies — clean status

| Package | Workspace | Installed version | In audit? | Notes |
|---------|-----------|-------------------|-----------|-------|
| `@aws-sdk/client-s3` | apps/api | 3.1073.0 | No | Matched with s3-request-presigner — correct |
| `@aws-sdk/s3-request-presigner` | apps/api | 3.1073.0 | No | Matched with client-s3 — correct |
| `expo-image-picker` | apps/mobile | 17.0.11 | No | Expo SDK 54 compatible |
| `expo-video` | apps/mobile | 3.0.16 | No | Expo SDK 54 compatible |
| `expo-file-system` | apps/mobile | 19.0.23 | No | Expo SDK 54 compatible |

## 3. Replacements Applied

No replacements were applied in this run. All identified advisories fall under explicit
guardrails (Expo SDK pin, drizzle-kit Phase 1 deferral, semver-major prohibitions) or are
transitive. No safely auto-fixable direct dependency was found.

## 4. Manual Review Needed

### Item A — Expo SDK 54 cluster (11 advisories) — deferred to SDK upgrade

**Packages affected (direct):** `expo`, `expo-constants`, `expo-linking`, `expo-router`,
`react-native` (and 9 transitives they pull in).

**Why not auto-fixed:** Every fix requires a semver-major jump to Expo SDK 56
(`expo@56.0.12`). The project guardrail explicitly prohibits independent manual bumping of
Expo-managed packages. Bumping `expo`, `expo-router`, `react-native`, etc. independently
without the full SDK upgrade breaks the app (peer dep mismatches across the entire Expo
ecosystem). React Native `0.86.0` is also a major version upgrade.

**Risk context:** All affected advisories are `moderate` severity. The highest-CVSS advisory in
this cluster is `postcss` (CVSS 6.1, XSS in CSS stringification — a build-tool path, not
runtime API surface). The `uuid` advisory (CVSS 7.5) affects `xcode`, which is a native build
tool used by `@expo/config-plugins` during iOS prebuild — not runtime application code. The
`js-yaml` DoS is inside `@istanbuljs/load-nyc-config` (test instrumentation), not application
code.

**Recommended next step:** When the team is ready for an SDK upgrade:
```bash
# In apps/mobile:
npx expo install expo@~56.0.0 expo-router expo-constants expo-linking \
  expo-status-bar expo-image-picker expo-video expo-file-system \
  react-native react-native-safe-area-context react-native-screens
# Then verify all three workspaces typecheck and 31 api tests pass
```
Do not bump these individually. Use `npx expo install` to resolve the full compatible set.

### Item B — `drizzle-kit` / `@esbuild-kit` chain (2 advisories) — Phase 1 known deferral

**Package affected (direct):** `drizzle-kit@^0.31.0` in `apps/api` devDependencies.

**Why not auto-fixed:** The only npm-offered fix is to downgrade to `drizzle-kit@0.18.1`
(a semver-major **downgrade**, from 0.31 to 0.18). This would be a regression, not a fix —
0.18 is an older major with different migration tooling and does not support the current
`drizzle-orm@^0.45` API. This is a known advisory from Phase 1 validation; the `drizzle-kit`
team has not yet released a newer version with a patched esbuild dependency.

**Risk context:** The `esbuild` advisory (GHSA-67mh-4wv8-2f99) is a dev-server SSRF
vulnerability — it applies only to esbuild's development server mode, which `drizzle-kit`
does not expose to external networks. `drizzle-kit` runs as a local CLI tool only (`db:generate`,
`db:push`). The second esbuild advisory (GHSA-g7r4-m6w7-qqqr, path traversal on Windows,
CVSS 2.5 low) is similarly confined to the local dev context. These advisories do not affect
the running API or mobile app.

**Recommended next step:** Monitor `drizzle-kit` releases. Once `drizzle-kit` ships a version
>=0.31 that depends on `esbuild>=0.24.3` (or removes the `@esbuild-kit` dependency), a
patch-level upgrade of `drizzle-kit` in `apps/api/package.json` will resolve both advisories.
Check periodically: `npm show drizzle-kit dist-tags`.

## 5. Security Audit

Security audit was run (`npm audit --json`). Exit code 1 (vulnerabilities found). Full
breakdown:

| Severity | Count | Root causes |
|----------|-------|-------------|
| critical | 0 | — |
| high | 0 | — |
| moderate | 23 | Expo SDK 54 cluster (18), drizzle-kit/esbuild chain (3), js-yaml via react-native (2) |
| low | 0 | (esbuild GHSA-g7r4-m6w7-qqqr is embedded inside the moderate esbuild entry; total count = 23) |
| **total** | **23** | |

**Key advisory references:**

| Advisory ID | Package | CVSS | Title | Runtime exposure |
|-------------|---------|------|-------|-----------------|
| GHSA-67mh-4wv8-2f99 | esbuild | 5.3 | dev-server SSRF | No — local dev tool only |
| GHSA-g7r4-m6w7-qqqr | esbuild | 2.5 | path traversal on Windows (dev server) | No — local dev tool only |
| GHSA-qx2v-qp2m-jg93 | postcss | 6.1 | XSS in CSS stringify output | No — build tooling, not runtime |
| GHSA-h67p-54hq-rp68 | js-yaml | 5.3 | Quadratic DoS via merge key aliases | No — test instrumentation only |
| GHSA-w5hq-g745-h8pq | uuid | 7.5 | Buffer bounds check (v3/v5/v6 with buf param) | No — native iOS build tool (xcode pkg) only |

No advisories affect runtime application code or the API server in production. All are
confined to native build tooling, local dev servers, or test infrastructure.

## 6. Final State

The project dependency tree is in the same state as after Phase 1 validation. The 23 moderate
advisories carry over unchanged — none were introduced by Phase 2 additions, and none of the
Phase 2 additions (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `expo-image-picker`,
`expo-video`, `expo-file-system`) carry any advisory. The two AWS SDK packages are correctly
matched at `3.1073.0`.

**Verification results at end of run:**
- `npx tsc -p packages/shared/tsconfig.json --noEmit` — exit 0 (clean)
- `npm run typecheck -w @tailsup/api` — exit 0 (clean)
- `npm run typecheck -w @tailsup/mobile` — exit 0 (clean)
- `npm run test -w @tailsup/api` — exit 0 (31/31 tests pass)
- No deprecation warnings from `npm install`

**Status: no safely-fixable direct-dependency issues found. 23 transitive/guardrailed
advisories deferred to manual review per project guardrails.**

## 7. Commands Run

| # | Command | Exit code | Notes |
|---|---------|-----------|-------|
| 1 | `node -v` | 0 | v20.20.2 — correct |
| 2 | `npm --version` | 0 | 10.8.2 |
| 3 | `npm install` (root) | 0 | 875 packages, up to date, 0 deprecation warnings |
| 4 | `npm audit --json` | 1 | 23 moderate vulnerabilities found |
| 5 | `npm outdated --json` | 1 | Outdated packages listed (all either Expo-pinned or semver-major jumps) |
| 6 | `npm ls @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` | 0 | Both at 3.1073.0 — matched |
| 7 | `npm ls expo-image-picker expo-video expo-file-system` | 0 | SDK 54 versions installed |
| 8 | `npx tsc -p packages/shared/tsconfig.json --noEmit` | 0 | Shared typecheck clean |
| 9 | `npm run typecheck -w @tailsup/api` | 0 | API typecheck clean |
| 10 | `npm run typecheck -w @tailsup/mobile` | 0 | Mobile typecheck clean |
| 11 | `npm run test -w @tailsup/api` | 0 | 31/31 tests pass |

## Anomalies

None. The lockfile was in sync with the manifests (no "lockfile out of date" warnings). The
`npm outdated` non-zero exit code is expected behavior (npm exits 1 when any outdated packages
exist, not an error condition).

## Workspace note

This is an npm workspaces monorepo with `apps/api`, `apps/mobile`, and `packages/shared`. The
`npm audit` and `npm install` commands were run at the repository root, which covers all three
workspaces. Per-package validation was not run independently; root-level audit covers the full
dependency tree.
