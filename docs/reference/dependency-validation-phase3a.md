---
status: deprecations_found
mode: fix
package_manager: npm
ecosystem: node
iterations_run: 1
deprecations_initial: 0
deprecations_final: 0
vulnerabilities_initial: 24
vulnerabilities_final: 24
target_path: C:/Users/KonstantinaKirtsia/source/repos/tailsUp
validated_at: 2026-06-21T19:05:00Z
last_validated_commit: 5dc73d3ed12cfd0d357640569acbbd80532ed53f
---

# Dependency Validation — TailsUp Phase 3a

## 1. Summary

This is an npm workspaces monorepo (`apps/api`, `apps/mobile`, `packages/shared`) running Node
v20.20.2 / npm 10.8.2 (Expo SDK 54 pin). The Phase 3a additions — `resend@6.13.0`,
`hono-rate-limiter@0.4.2` (api), and `expo-font@14.0.12`, `@expo-google-fonts/fraunces@0.4.1`,
`@expo-google-fonts/inter@0.4.2`, `react-native-svg@15.12.1`, `expo-splash-screen@31.0.13`
(mobile) — are **clean**: `resend` and `hono-rate-limiter` appear in zero security advisories
and produced zero deprecation warnings during `npm install`. The 24 moderate advisories found
are a net +1 from Phase 2's 23. The new entry is `expo-splash-screen` (now a direct dependency,
adding a distinct advisory row), which is fully Expo-managed and follows the same SDK-upgrade
deferral as the rest of the Expo cluster. No safely auto-fixable direct-dependency issue was
found; all 24 advisories are deferred to manual review per project guardrails. All three
workspaces typecheck cleanly and all 148 API tests pass.

---

## 2. Initial State

### Deprecation warnings from `npm install`

None. `npm install` completed with "up to date, audited 897 packages" and zero deprecation
warning lines.

### Phase 3a new dependencies — clean status

| Package | Workspace | Installed version | In audit? | Notes |
|---------|-----------|-------------------|-----------|-------|
| `resend` | apps/api | 6.13.0 | **No** | No advisory; no deprecation warning |
| `hono-rate-limiter` | apps/api | 0.4.2 | **No** | No advisory; no deprecation warning |
| `expo-font` | apps/mobile | 14.0.12 | No | Expo SDK 54 compatible (via `expo install`) |
| `@expo-google-fonts/fraunces` | apps/mobile | 0.4.1 | No | Expo SDK 54 compatible |
| `@expo-google-fonts/inter` | apps/mobile | 0.4.2 | No | Expo SDK 54 compatible |
| `react-native-svg` | apps/mobile | 15.12.1 | No | Expo SDK 54 compatible (via `expo install`) |
| `expo-splash-screen` | apps/mobile | 31.0.13 | Yes — see note | Expo-managed; advisory = SDK 56 upgrade path (guardrailed) |

**Note on `expo-splash-screen`:** This package was already transitively present via Expo SDK 54
in Phase 2. Phase 3a adds it as a direct dependency (`expo install expo-splash-screen`), which
is why it now surfaces as `isDirect: true` in the audit. The underlying advisory is the same
`@expo/prebuild-config` chain that was already counted under the Expo cluster in Phase 2. The
+1 advisory count increase (23 → 24) is entirely explained by this reclassification from
transitive to direct.

### Security advisories — 24 moderate, 0 high/critical

All 24 are `moderate` severity. None are `high` or `critical`.

| # | Package | Direct? | Workspace | Advisory / root cause | Advisory IDs | Severity | Fix available |
|---|---------|---------|-----------|----------------------|--------------|----------|---------------|
| 1 | `drizzle-kit` | Yes (devDep) | api | Pulls `@esbuild-kit/esm-loader` → `esbuild <=0.24.2` (dev-server SSRF) | GHSA-67mh-4wv8-2f99 | moderate | `drizzle-kit@0.18.1` — semver **major downgrade** (regression) |
| 2 | `@esbuild-kit/core-utils` | No (via drizzle-kit) | api | Same esbuild SSRF chain | GHSA-67mh-4wv8-2f99 | moderate | Requires drizzle-kit major downgrade |
| 3 | `@esbuild-kit/esm-loader` | No (via drizzle-kit) | api | Same esbuild SSRF chain | GHSA-67mh-4wv8-2f99 | moderate | Requires drizzle-kit major downgrade |
| 4 | `esbuild` | No (via drizzle-kit) | api | dev-server SSRF; path traversal on Windows | GHSA-67mh-4wv8-2f99 / GHSA-g7r4-m6w7-qqqr | moderate | Requires parent updates |
| 5 | `expo` | Yes | mobile | SDK 54 chain: `@expo/config-plugins` → `xcode` → `uuid<11.1.1`; `@expo/metro-config` → `postcss<8.5.10`; `@expo/cli` → `@expo/config` | GHSA-w5hq-g745-h8pq / GHSA-qx2v-qp2m-jg93 | moderate | `expo@56.0.12` — SDK 56 upgrade |
| 6 | `expo-constants` | Yes | mobile | Via `@expo/config` chain | — | moderate | `expo-constants@56.0.18` — SDK 56 upgrade |
| 7 | `expo-linking` | Yes | mobile | Via expo-constants | — | moderate | `expo-linking@56.0.14` — SDK 56 upgrade |
| 8 | `expo-router` | Yes | mobile | Via expo-constants + expo-linking | — | moderate | `expo-router@56.2.11` — SDK 56 upgrade |
| 9 | `expo-splash-screen` | **Yes (new direct)** | mobile | Via `@expo/prebuild-config` → `@expo/config` + `@expo/config-plugins` | — | moderate | `expo-splash-screen@56.0.10` — SDK 56 upgrade |
| 10 | `react-native` | Yes | mobile | Via `babel-jest` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml<=4.1.1` | GHSA-h67p-54hq-rp68 | moderate | `react-native@0.86.0` — major upgrade |
| 11 | `@expo/cli` | No (via expo) | mobile | Via @expo/config-plugins + postcss | — | moderate | Requires expo SDK 56 upgrade |
| 12 | `@expo/config` | No (via expo) | mobile | Via @expo/config-plugins | — | moderate | Requires expo SDK 56 upgrade |
| 13 | `@expo/config-plugins` | No (via expo) | mobile | Via xcode/uuid | — | moderate | Requires expo SDK 56 upgrade |
| 14 | `@expo/metro-config` | No (via expo) | mobile | Via @expo/config + postcss | — | moderate | Requires expo SDK 56 upgrade |
| 15 | `@expo/prebuild-config` | No (via expo-splash-screen) | mobile | Via @expo/config + @expo/config-plugins | — | moderate | Fixable via expo SDK upgrade |
| 16 | `expo-asset` | No (via expo) | mobile | Via expo-constants | — | moderate | Requires expo SDK 56 upgrade |
| 17 | `@istanbuljs/load-nyc-config` | No (via react-native) | mobile | Via js-yaml | — | moderate | Requires react-native major upgrade |
| 18 | `@jest/transform` | No (via react-native) | mobile | Via babel-plugin-istanbul | — | moderate | Fixable via react-native major upgrade |
| 19 | `babel-jest` | No (via react-native) | mobile | Via @jest/transform + babel-plugin-istanbul | — | moderate | Requires react-native major upgrade |
| 20 | `babel-plugin-istanbul` | No (via react-native) | mobile | Via @istanbuljs/load-nyc-config | — | moderate | Requires react-native major upgrade |
| 21 | `js-yaml` | No (via react-native) | mobile | GHSA-h67p-54hq-rp68 — quadratic-complexity DoS via merge key aliases | GHSA-h67p-54hq-rp68 | moderate | Requires react-native major upgrade |
| 22 | `postcss` | No (via expo) | mobile | GHSA-qx2v-qp2m-jg93 — XSS via unescaped `</style>` in CSS output | GHSA-qx2v-qp2m-jg93 | moderate | Requires expo SDK 56 upgrade |
| 23 | `uuid` | No (via expo → xcode) | mobile | GHSA-w5hq-g745-h8pq — missing buffer bounds check in v3/v5/v6 | GHSA-w5hq-g745-h8pq | moderate | Requires expo SDK 56 upgrade |
| 24 | `xcode` | No (via expo) | mobile | Via uuid<11.1.1 | — | moderate | Requires expo SDK 56 upgrade |

---

## 3. Replacements Applied

No replacements were applied in this run. `resend` and `hono-rate-limiter` — the two genuinely
new non-Expo direct dependencies introduced in Phase 3a — are clean. All identified advisories
fall under explicit guardrails (Expo SDK pin, drizzle-kit Phase 1 deferral, semver-major
prohibitions) or are transitive. No safely auto-fixable direct dependency was found.

The loop terminated after iteration 1 with no changes to make.

---

## 4. Manual Review Needed

### Item A — Expo SDK 54 cluster (13 advisory rows) — deferred to SDK upgrade

**Packages affected (direct):** `expo`, `expo-constants`, `expo-linking`, `expo-router`,
`expo-splash-screen`, `react-native` (and 10 transitives they pull in).

**Phase 3a change:** `expo-splash-screen` was previously transitive; it is now direct (Phase 3a
adds it explicitly via `expo install`). This accounts for the +1 advisory count increase from
Phase 2 (23 → 24). The advisory itself is identical to what was already deferred.

**Why not auto-fixed:** Every fix requires a semver-major jump to Expo SDK 56
(`expo@56.0.12`). The project guardrail explicitly prohibits independent manual bumping of
Expo-managed packages. Bumping `expo`, `expo-router`, `react-native`, etc. independently
without the full SDK upgrade breaks the app (peer dep mismatches across the entire Expo
ecosystem). `react-native@0.86.0` is also a major version upgrade.

**Risk context:** All affected advisories are `moderate` severity, none `high`/`critical`.
The highest-CVSS advisory in this cluster is `postcss` (CVSS 6.1, XSS in CSS stringification
— a build-tool path, not runtime API surface). The `uuid` advisory (CVSS 7.5) affects `xcode`,
a native build tool used by `@expo/config-plugins` during iOS prebuild — not runtime application
code. The `js-yaml` DoS (CVSS 5.3) is inside `@istanbuljs/load-nyc-config` (test
instrumentation), not application code.

**Recommended next step:** When the team is ready for an SDK upgrade (after Phase 3b completes
or as a dedicated upgrade sprint):
```bash
# In apps/mobile:
npx expo install expo@~56.0.0 expo-router expo-constants expo-linking expo-status-bar \
  expo-image-picker expo-video expo-file-system expo-font expo-splash-screen \
  react-native react-native-safe-area-context react-native-screens react-native-svg
# Also update @expo-google-fonts/* if new versions are compatible with SDK 56
# Then verify all three workspaces typecheck and all 148 API tests pass
```
Do not bump these individually. Use `npx expo install` to resolve the full compatible set.

### Item B — `drizzle-kit` / `@esbuild-kit` chain (3 advisory rows) — Phase 1 known deferral

**Package affected (direct):** `drizzle-kit@^0.31.0` in `apps/api` devDependencies.

**Why not auto-fixed:** The only npm-offered fix is a downgrade to `drizzle-kit@0.18.1` — a
semver-major **downgrade** (0.31 → 0.18). This is a regression: 0.18 is an older major with
different migration tooling and does not support the current `drizzle-orm@^0.45` API. This
advisory has been known since Phase 1; the `drizzle-kit` team has not released a newer version
with a patched esbuild dependency.

**Risk context:** The `esbuild` SSRF advisory (GHSA-67mh-4wv8-2f99) applies only to esbuild's
development server mode, which `drizzle-kit` does not expose. `drizzle-kit` runs exclusively
as a local CLI tool (`db:generate`, `db:push`). The Windows path-traversal advisory
(GHSA-g7r4-m6w7-qqqr, CVSS 2.5 low) is similarly confined to the local dev context. Neither
advisory affects the running API or mobile app.

**Recommended next step:** Watch the `drizzle-kit` release feed. When a new `0.31.x` or
`0.32+` release drops the `@esbuild-kit/*` dependency (the drizzle team is actively working to
remove it), run `npm update drizzle-kit -w @tailsup/api` and re-validate.

---

## 5. Security Audit

`npm audit --json` was run (exit code 1 due to found advisories). The full vulnerability set is
the 24 moderate entries in Section 2. A summary by root cause cluster:

| Root cause | Advisory IDs | Severity | CVSS (max) | Affected direct deps | Fix path |
|------------|-------------|----------|------------|----------------------|----------|
| `drizzle-kit` → `esbuild` dev-server SSRF | GHSA-67mh-4wv8-2f99 | moderate | 5.3 | `drizzle-kit` | Await drizzle-kit patch release |
| `esbuild` path traversal (Windows) | GHSA-g7r4-m6w7-qqqr | low | 2.5 | `drizzle-kit` | Await drizzle-kit patch release |
| Expo SDK 54 → `postcss` XSS in CSS stringify | GHSA-qx2v-qp2m-jg93 | moderate | 6.1 | `expo` | SDK 56 upgrade |
| Expo SDK 54 → `uuid` buffer bounds check | GHSA-w5hq-g745-h8pq | moderate | 7.5 | `expo` (via xcode) | SDK 56 upgrade |
| `react-native` → `js-yaml` quadratic DoS | GHSA-h67p-54hq-rp68 | moderate | 5.3 | `react-native` | react-native major upgrade (within SDK 56) |

**Zero high or critical advisories.**

**New in Phase 3a:** None. `resend@6.13.0` and `hono-rate-limiter@0.4.2` are not in any
advisory. The only count change (23 → 24) is `expo-splash-screen` becoming a direct dependency
— it was already in the Phase 2 transitive advisory cluster.

---

## 6. Final State

The project is in a **known-and-accepted advisory state**, structurally identical to Phase 2.

- **0 deprecation warnings** from `npm install`
- **24 moderate advisories** (0 high, 0 critical) — same root causes as Phase 2 (+1 count from
  `expo-splash-screen` reclassifying from transitive to direct)
- **`resend@6.13.0`** — clean, no advisory
- **`hono-rate-limiter@0.4.2`** — clean, no advisory
- **All 3 workspaces typecheck** with zero errors (`@tailsup/shared`, `@tailsup/api`,
  `@tailsup/mobile`)
- **148 API tests pass** (vitest, exit 0)
- **No safely auto-fixable issue exists** within the project guardrails
- All remaining advisories require either (a) Expo SDK 56 upgrade or (b) a future
  `drizzle-kit` patch release — both are upstream-owned deferrals, unchanged from Phase 2

---

## 7. Commands Run

| # | Command | Exit code | Notes |
|---|---------|-----------|-------|
| 1 | `node -v` | 0 | v20.20.2 — correct, Node 20 active |
| 2 | `npm -v` | 0 | 10.8.2 |
| 3 | `ls package-lock.json` | 0 | Lockfile present |
| 4 | `npm install` (root) | 0 | "up to date, audited 897 packages in 7s"; 0 deprecation warnings |
| 5 | `npm audit --json` | 1 | 24 moderate vulnerabilities; 0 high/critical; JSON parsed for advisory details |
| 6 | `npm outdated --json` | 1 | Returns outdated list (non-zero exit is normal when outdated packages exist) |
| 7 | `npx tsc -p packages/shared/tsconfig.json --noEmit` | 0 | Clean |
| 8 | `npm run typecheck -w @tailsup/api` | 0 | Clean |
| 9 | `npm run typecheck -w @tailsup/mobile` | 0 | Clean |
| 10 | `npm run test -w @tailsup/api` | 0 | 148/148 tests pass (vitest v3.2.6) |

### Outdated packages (informational — not treated as deprecations)

Packages where installed version is current within the pinned range but a newer major exists:

| Package | Workspace | Current | Latest | Guardrail |
|---------|-----------|---------|--------|-----------|
| `expo` | mobile | 54.0.35 | 56.0.12 | Expo SDK pin — do not bump |
| `expo-*` (all) | mobile | SDK 54 set | SDK 56 set | Expo SDK pin — do not bump |
| `react-native` | mobile | 0.81.5 | 0.86.0 | Expo SDK pin — do not bump |
| `react-native-svg` | mobile | 15.12.1 | 15.15.5 | Expo-managed — do not bump independently |
| `@types/react` | mobile | 19.1.17 | 19.2.17 | Expo-managed pin (~19.1.0) — do not bump |
| `drizzle-kit` | api | 0.31.x (satisfied) | 0.31.x → latest | Within range; no action |
| `hono-rate-limiter` | api | 0.4.2 | 0.5.3 | Minor update available; not a security issue; upgrade optional |
| `@hono/zod-validator` | api | 0.7.6 | 0.8.0 | Minor update available; not a security issue; upgrade optional |
| `typescript` | all | 5.9.3 | 6.0.3 | Major upgrade; do not bump without testing all workspaces |
| `vitest` / `@vitest/coverage-v8` | api | 3.2.6 | 4.1.9 | Major upgrade; not a security issue |
| `zod` | api | 3.25.76 | 4.4.3 | Major upgrade — Zod 4 has breaking API changes; do not bump without migration |

`hono-rate-limiter@0.5.3` is a minor bump with no advisory — safe to test-upgrade but not
required. It is not classified as a deprecation.

---

## Anomalies

None. Lockfile was in sync with manifest. No network errors. No postinstall hooks of concern.
This is a monorepo (`apps/*`, `packages/*` workspaces declared in root `package.json`) — install
and audit run at the root per npm workspaces semantics; per-package validation is out of scope.
