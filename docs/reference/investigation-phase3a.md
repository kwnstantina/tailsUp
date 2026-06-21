# Investigation: TailsUp Phase 3a — Implementation Approach (Public Website + Public Capture Endpoints)

## Executive Summary

This investigation determines **how** to build Phase 3a — the public dog-training business website (six pages) plus the two public capture endpoints (`POST /leads`, `POST /bookings`) — inside the **fixed** stack: ONE Expo Router SDK 54 codebase (no Next.js), Hono + Drizzle API, Resend email, and the pure-TS `@tailsup/shared` contract. Auth and dashboards are explicitly Phase 3b and are not investigated here.

The recommendation is concrete and low-risk because the stack is already 95% in place: SDK 54.0.35, expo-router 6.0.24, react-native-web 0.21.0, and — importantly — **`web.output: "static"` is already enabled in `app.json`**, so static HTML rendering for SEO comes for free with no config change. The build-out is therefore mostly additive:

1. **Routing** — add a public `app/(site)/` route group with its own `_layout.tsx` (Design-System chrome) and convert the root `_layout.tsx` from a `<Stack>` to a `<Slot>`; move the existing five screens into an `(app)/` group with their current `<Stack>` header. No auth guard this cycle. Use `expo-router/head` `<Head>` per page for `<title>`/meta (works under static rendering).
2. **Design System** — a single `lib/theme.ts` token module (plain TS objects, `StyleSheet`-compatible), consumed via `StyleSheet.create`, with responsive layout via `useWindowDimensions` + max-width containers, hover/focus via `Pressable`'s `({ hovered, focused, pressed })` callback (web-only hover, harmless on native), and `prefers-reduced-motion` via `AccessibilityInfo.isReduceMotionEnabled` (covers web + native).
3. **Fonts** — `expo-font@~14.0.12`, `@expo-google-fonts/fraunces`, `@expo-google-fonts/inter`, loaded with `useFonts` in the `(site)/_layout.tsx`; native uses splash-gating, web uses `@font-face` + a `Georgia`/`system-ui` fallback so the quality floor holds even on FOUT.
4. **Progress-curve** — hand-rolled `react-native-svg@15.12.1` `<Svg>` with a Catmull-Rom→Bézier smoothed `<Path>` stroke (thin gold) over a closed `<Path>` gradient fill (`<Defs><LinearGradient>`), on a deep-green panel. No charting dependency. Works on web and native.
5. **Keyless map** — `Platform.OS === 'web'` branch rendering an OpenStreetMap `https://www.openstreetmap.org/export/embed.html` `<iframe>` (no API key); native branch renders a static card with an "Open in Maps" `Linking` deep link.
6. **Endpoints** — `routes/leads.ts` + `routes/bookings.ts` following the existing `Hono` + `zValidator('json', …)` + `z.enum(BOOKING_TYPES)` pattern; resolve the single-practice `trainerId` from a new optional `PRACTICE_TRAINER_ID` env var with a `SELECT id FROM trainer ORDER BY ... LIMIT 1` fallback (throw 503 only if neither yields a trainer). A `lib/email.ts` mirrors the `lib/r2.ts` lazy-config pattern but **stubs (logs) instead of throwing** when `RESEND_API_KEY` is absent, and the send is **fire-and-forget** so it can never fail or delay the 201.
7. **Rate-limiting** — recommend the lightweight `hono-rate-limiter` in-memory limiter scoped to the two public routes, with an explicit, documented option to defer to a proxy/edge limiter in production.

No part of Phase 3a requires a technology the project hasn't used; **one** topic (Expo static-web `<Head>` SEO behaviour under route groups) is flagged for a short confirmatory deep-dive because it is the only area where the docs are version-shifting (helmet-async fork, `generateMetadata` arriving in later SDKs).

---

## Context

- **What** — choose the concrete implementation approach for Phase 3a per `docs/reference/refined-request-phase3.md` (FR-W1…W10, FR-A1…A3, DS-1…DS-7, NFR-1…NFR-9) and `docs/reference/codebase-scan-phase3.md`.
- **Why** — Phase 3a is the practice's first externally visible product + the lead funnel; it must ship demoable on Expo web, look premium, and not break native, before any auth work (LBD-1).
- **Fixed constraints (not re-litigated):** ONE Expo Router SDK 54 codebase; Hono + Drizzle; Resend (stub when keyless); `@tailsup/shared` stays pure (no runtime deps). BetterAuth and dashboards are Phase 3b.
- **Ground-truth versions (from `apps/mobile/package.json`):** `expo ~54.0.35`, `expo-router ~6.0.24`, `react-native 0.81.5`, `react 19.1.0`, `react-native-web ~0.21.0`, `react-native-safe-area-context ~5.6.0`. `app.json` already has `web.bundler: metro`, `web.output: static`, `experiments.typedRoutes: true`, `newArchEnabled: true`.
- **API ground truth:** `routes/sessions.ts` is the canonical Hono+Zod template; `lib/r2.ts` is the lazy-config template; `config.ts` throws on missing required vars; `lead`/`booking`/`trainer` tables already exist; vitest with `app.request()` + `vi.mock('../db/client.js')`.

---

## Topic 1 — Public `(site)` route group in ONE Expo Router tree (the routing keystone)

### Options Identified

**Option 1A — Route groups: `app/(site)/*` + `app/(app)/*`, root layout becomes `<Slot>`** *(recommended)*
- **Description:** Parenthesized directories `(site)` and `(app)` group routes **without adding a URL segment** (so `app/(site)/about.tsx` → `/about`, not `/site/about`). Each group owns a `_layout.tsx`: `(site)/_layout.tsx` renders the Design-System chrome (header/nav with Greek labels + deep-green footer) and loads fonts; `(app)/_layout.tsx` holds the existing dark `<Stack>` header. The root `app/_layout.tsx` drops to `<SafeAreaProvider><Slot /></SafeAreaProvider>` (plus `<StatusBar>`), delegating all chrome to the groups. The five Phase-2 screens move under `(app)/` (`(app)/index.tsx` = health, `(app)/dogs/…`, `(app)/sessions/…`, `(app)/events/…`).
- **URL mapping:** `/`→`(site)/index.tsx`, `/about`, `/services`, `/results`, `/contact`, `/booking` all flat under `(site)`. This matches FR-W1 exactly and the scan's recommended tree.
- **Strengths:** Idiomatic Expo Router; zero config (parenthesized dirs auto-recognized); clean separation lets 3b bolt an auth guard onto `(app)/_layout.tsx` only; preserves the existing native `<Stack>` UX; site pages can use a `<ScrollView>` web-style layout independent of the stack header.
- **Weaknesses:** The root index changes ownership — currently `/` is the health screen; in Phase 3a `/` becomes the marketing Home and health moves to `(app)/index.tsx` (i.e. still `/` unless namespaced). **Collision risk:** two `index.tsx` both resolving to `/` is an error. Resolve by giving the site Home `/` and moving health to an explicit path (e.g. `(app)/health.tsx` → `/health`, matching the kickoff's "`/health` stays reachable"), updating the one `Link href="/dogs"` reference.
- **Effort/Complexity:** Low–Medium (mechanical file moves + one layout rewrite).
- **Risk:** Low.
- **Best suited when:** Two audiences (public vs authed) must coexist in one tree with different chrome — exactly this case.

**Option 1B — No groups; flat routes + conditional chrome in root layout**
- **Description:** Keep a flat `app/` tree; render site chrome conditionally based on `usePathname()`.
- **Strengths:** No file moves.
- **Weaknesses:** Layout logic becomes a pathname `switch`; loses Expo Router's per-group `_layout` model; makes the 3b auth guard a tangle of path checks rather than a single group boundary; against the scan's and LBD-2's recommendation.
- **Effort:** Low now, High later. **Risk:** Medium (tech debt that 3b inherits).
- **Best suited when:** Throwaway prototype — not this.

**Option 1C — Two separate navigators (Stack for app, plain web pages for site) without groups**
- **Description:** Hand-roll separate navigation trees.
- **Weaknesses:** Fights the framework; not idiomatic; more code. **Risk:** Medium-High.

### Static rendering & SEO

`web.output: "static"` is **already set**, so `npx expo export --platform web` emits one static HTML file per route with content pre-rendered — real SEO for a marketing site, which is the whole point of a public business website. **Recommendation: keep it on.** It is the correct mode for a marketing site (vs `single` SPA), it is already configured, and it has no downside for these six static pages (none are request-time dynamic — the lead/booking forms POST to the API client-side after hydration, which is fine).

For per-page `<head>`: use **`import Head from 'expo-router/head'`** and render `<Head><title>…</title><meta name="description" …/></Head>` at the top of each site page. Under static rendering these are emitted into the pre-rendered HTML (good for SEO); they also update dynamically on client navigation. Set a sensible default `<title>` in `(site)/_layout.tsx` and override per page.

**Pitfalls (Topic 1):**
- **Double-`index` collision** — only one route may map to `/`. Give Home `(site)/index.tsx`; do **not** also leave `app/index.tsx`.
- **`<Head>` only meaningfully affects web** — it is a no-op on native; that's expected.
- **Static export must be exercised**, not just `expo start --web` — `expo start --web` runs the dev server (Metro) and may render fine while a `export`-time issue (e.g. a route that reads request data) only surfaces on `expo export`. Verify with `npx expo export --platform web` as part of AC-3a-3.
- **`generateStaticParams`** is only needed for **dynamic** routes (`[id].tsx`); all six site routes are static, so none is required.
- **`expo-router/head` is backed by a helmet-async fork** in current SDKs; the API (`<Head>`) is stable for SDK 54, but later SDKs introduce a `generateMetadata` server API — do not reach for that here (it targets server rendering, not `output: static`).

### Recommended concrete layout

```
app/
  _layout.tsx              // SafeAreaProvider + <Slot/> + <StatusBar/> (no Stack here)
  (site)/
    _layout.tsx            // DS chrome: <Head> defaults, useFonts(), header/nav (Greek), footer; <Slot/> or <Stack screenOptions={{headerShown:false}}/>
    index.tsx              // /          Αρχική (Home)
    about.tsx              // /about     Ποιοι είμαστε
    services.tsx           // /services  Υπηρεσίες (progress-curve lives here)
    results.tsx            // /results   Αποτελέσματα
    contact.tsx            // /contact   Επικοινωνία (map + lead form)
    booking.tsx            // /booking   Booking form
  (app)/
    _layout.tsx            // existing dark <Stack> header (moved from root); 3b adds auth guard here
    index.tsx  OR  health.tsx   // health screen (keep reachable; see collision note)
    dogs/...  sessions/...  events/...   // moved verbatim, behaviour unchanged
```
For `(site)/_layout.tsx`, prefer `<Stack screenOptions={{ headerShown: false }}>` (so the site renders its own custom header) **or** a `<Slot/>` wrapped in the chrome component — both work; `<Stack headerShown:false>` integrates better with web title/back behaviour. Keep chrome in a shared `SiteChrome` component so every page is consistent (FR-W9).

---

## Topic 2 — Design System in React Native Web

### Options Identified

**Option 2A — A single plain-TS token module + `StyleSheet.create` per component, `Pressable` state callbacks, `useWindowDimensions` breakpoints** *(recommended)*
- **Description:** `apps/mobile/lib/theme.ts` exports plain objects: `colors` (DS-1 hex tokens verbatim), `type` (DS-2 scale as `{ fontSize, lineHeight, fontFamily, letterSpacing }` presets for h1/h2/h3/bodyLg/body/eyebrow/caption), `space` (DS-3 `xs:8…2xl:80`), `radii` (`6`/`14`), `layout` (`maxWidth:1080`, `maxProse:720`). Components consume tokens inside `StyleSheet.create` and inline arrays. Hover/focus via `Pressable`'s `style={({hovered,focused,pressed}) => [...]}`. Responsiveness via `useWindowDimensions()` + a `useBreakpoint()` helper plus max-width centered containers (`alignSelf:'center', width:'100%', maxWidth: layout.maxWidth`).
- **Strengths:** No new dependency (NFR-6 keeps shared pure and avoids a styling lib); matches the existing `app/index.tsx` `StyleSheet` + `Platform.select` idiom; works identically on web + native; tokens are the single source of truth (AC-3a-4 token check is a grep of `theme.ts` + usages).
- **Weaknesses:** `StyleSheet` lacks media queries and pseudo-elements; need `useWindowDimensions` for breakpoints instead of CSS `@media`; a few web-only properties (e.g. `cursor`, `outline`, `transition`, `position:'fixed'` sticky header) must be applied via `Platform.OS === 'web'` style branches — RN typings reject some, so use `Platform.select({ web: { ...webOnly } as any })` narrowly.
- **Effort:** Medium (one-time theme + primitives). **Risk:** Low.

**Option 2B — Add NativeWind (Tailwind for RN)**
- **Strengths:** `md:`/`lg:` responsive modifiers, `hover:`/`focus:` variants, familiar utility model.
- **Weaknesses:** New build dependency + Babel/Metro config + a `tailwind.config`; more moving parts than six pages need; the kickoff's exact token/scale values are better expressed as a small typed module than re-encoded as Tailwind theme extensions; adds risk to a "simplest thing that works" project. Defer unless the page count grows substantially.
- **Effort:** Medium-High. **Risk:** Medium.

**Option 2C — Inline style objects, no central module**
- **Weaknesses:** Violates FR-W9 (one shared module) and makes the token check (AC-3a-4) unverifiable; inconsistent. **Risk:** Medium.

### Recommended theme module shape

```ts
// apps/mobile/lib/theme.ts  (plain TS — NOT in @tailsup/shared; mobile-only)
export const colors = {
  bg: '#FAF7F0', bgAlt: '#F0EADD', surface: '#FFFFFF',
  primary: '#1B3A32', primarySoft: '#3D5249',
  accent: '#B07D48', accentSoft: '#E8C9A0', mint: '#9FC4B5',
  text: '#1B3A32', textMuted: '#6B7D74', border: 'rgba(27,58,50,0.12)',
} as const;

export const fonts = {
  display: 'Fraunces_500Medium',     // headings; fallback handled below
  displayRegular: 'Fraunces_400Regular',
  body: 'Inter_400Regular',
  bodyFallback: "system-ui",          // web; native uses System
} as const;

export const type = {
  h1: { fontFamily: fonts.display, fontSize: 46, lineHeight: 52, letterSpacing: -0.92 }, // -0.02em*46
  h2: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h3: { fontFamily: fonts.displayRegular, fontSize: 19, lineHeight: 26 },
  bodyLg: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26 },   // ~1.6
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
  eyebrow: { fontFamily: fonts.body, fontSize: 12.5, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent }, // 0.16em*12.5≈2
  caption: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
} as const;

export const space = { xs: 8, sm: 16, md: 24, lg: 32, xl: 54, xxl: 80 } as const;
export const radii = { base: 6, lg: 14 } as const;
export const layout = { maxWidth: 1080, maxProse: 720 } as const;
export const breakpoints = { sm: 640, md: 768, lg: 1024 } as const;
```

**Responsive approach:** a `useBreakpoint()` hook over `useWindowDimensions()` returning `'sm'|'md'|'lg'`; pages switch column→row and adjust `space`/`fontSize` by breakpoint. Wrap page content in a `Container` primitive (`maxWidth`, centered) per DS-3.

**Hover/focus (web) + reduced motion:**
- `Pressable` exposes `{ hovered, focused, pressed }` in its `style`/`children` callbacks on react-native-web. **`hovered` is web-only (mouse) and simply never fires on native** — so the same component code is safe everywhere (the scan/NFR-1 "visible focus" requirement is met by styling `focused`).
- Visible focus: style the `focused` branch (e.g. add a copper outline/ring); on web also set `Platform.select({ web: { outlineColor: colors.accent } })` as needed — but the `Pressable` `focused` state is the portable mechanism.
- `prefers-reduced-motion`: use **`AccessibilityInfo.isReduceMotionEnabled()` + `AccessibilityInfo.addEventListener('reduceMotionChanged', …)`** — on web this is wired to the `(prefers-reduced-motion: reduce)` media query by react-native-web, so a single RN API covers both targets (NFR-1). Gate any `Animated`/transition on the result.

**Limits of `StyleSheet` on web (when to drop to web-only props):** sticky header (`position:'fixed'`/`'sticky'`), `cursor:'pointer'`, CSS `transition`, text `outline`, and `100vh`/`vw` units are not in RN's type surface — apply them through `Platform.select({ web: {…} as any })` localized to the component, never globally. Keep these to the chrome (sticky header), buttons (cursor), and focus ring.

**Pitfalls (Topic 2):** RN `letterSpacing` is in **points, not em** — convert (`em * fontSize`); RN has no `lineHeight` unitless multiplier (use absolute px ≈ `1.6 × fontSize`); `textTransform:'uppercase'` is supported; `gap` is supported in RN 0.81/RNW 0.21 (used already in `app/index.tsx`); shadows differ web vs native (`boxShadow` web string vs `shadow*`/`elevation` native) — for the 0.5px card border prefer `borderWidth` over shadow to stay portable.

---

## Topic 3 — Custom fonts (Fraunces display + Inter body)

### Recommendation: `expo-font` + `@expo-google-fonts/*`, loaded in `(site)/_layout.tsx`

**Version pins (SDK 54 bundledNativeModules):**
- `expo-font@~14.0.12` (the SDK-54-pinned version)
- `@expo-google-fonts/fraunces` (latest; these packages are SDK-agnostic JS wrappers that depend on a compatible `expo-font` peer — install via `npx expo install` so the resolver picks a compatible line)
- `@expo-google-fonts/inter` (same)

Install with **`npx expo install expo-font @expo-google-fonts/fraunces @expo-google-fonts/inter`** so Expo resolves the exact compatible versions for SDK 54 (do not hand-pick majors — the google-fonts packages version independently and `expo install` is the supported path).

**Loading pattern (root or site layout):**
```tsx
import { useFonts, Fraunces_400Regular, Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();
// inside SiteLayout:
const [loaded] = useFonts({ Fraunces_400Regular, Fraunces_500Medium, Inter_400Regular });
useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
if (!loaded) return null; // native: splash stays; web: brief, fallback acceptable
```
- Required weights only: **Fraunces 400 + 500** (DS-2 headings 400–500) and **Inter 400** (body). Do not load extra weights (smaller bundle, faster web load).
- Letter-spacing: applied in `theme.ts` per preset (points, see Topic 2 pitfall).

**Web rendering:** `expo-font` generates a `@font-face` block in a shared stylesheet on web (no manual CSS). Use `FontDisplay.SWAP` semantics so fallback text shows immediately while the webfont loads — the **quality floor (DS-2) requires the `Georgia`/`system-ui` fallbacks to look acceptable**, so set fallbacks in the type presets and accept a brief FOUT rather than blocking render.

**Pitfalls (Topic 3):**
- **FOUT on web** — webfonts load over the network at runtime; expect a flash. Mitigate by (a) acceptable fallbacks (`Georgia`, `system-ui`) baked into presets, and (b) `SWAP` display. Do **not** block the whole site on font load on web (returning `null` until loaded is fine for the brief splash but consider rendering with fallback if load is slow).
- **Native needs the font available before first paint** — splash-gate (above). The `expo-font` config-plugin (build-time embedding) is the more efficient native path but is **not required** for `@expo-google-fonts` runtime loading; runtime `useFonts` is simplest and works on all three targets — start there.
- **Font family name must match the imported symbol exactly** (`'Fraunces_500Medium'`), not `'Fraunces'`.
- **Variable-font weight selection** — `@expo-google-fonts` exposes named static cuts (`_400Regular`, `_500Medium`); use those rather than a `fontWeight` numeric on a single variable face (RN's variable-font weight support is inconsistent across platforms).
- **Metro monorepo resolution** — if the new packages fail to resolve, the documented `metro.config.js` fallback in `app/index.tsx:9-33` applies (watchFolders + nodeModulesPaths). Do not add it pre-emptively.

---

## Topic 4 — The signature progress-curve (react-native-svg, hand-rolled)

### Recommendation: hand-rolled `<Svg>` with `react-native-svg@15.12.1` (no charting dep)

This matches OQ-16's recommended default and NFR-6 (no charting lib in shared; minimal deps). `react-native-svg` is the SDK-54-bundled version **15.12.1** and **supports web** via react-native-web (Expo docs list Web among supported platforms). It provides `Svg, Path, Defs, LinearGradient, Stop, Line` — everything the visual needs.

**Component shape (`apps/mobile/components/ProgressCurve.tsx`, mobile-only):**
- A deep-green (`colors.primary`) rounded panel (`borderRadius: radii.lg`).
- `<Defs><LinearGradient id="fill" x1=0 y1=0 x2=0 y2=1><Stop offset="0" stopColor={gold} stopOpacity={0.28}/><Stop offset="1" stopColor={gold} stopOpacity={0}/></LinearGradient></Defs>` — the soft gradient fill, gold fading to transparent.
- A **closed** `<Path>` (curve down to baseline and back) filled with `url(#fill)`.
- A **stroke-only** `<Path>` (the same top curve, `fill="none"`, `stroke={gold}`, `strokeWidth={2}`, `strokeLinecap="round"`) — the thin gold line. Gold ≈ `colors.accent`/`accentSoft` per the Design System (the "gold line"; use a refined copper-gold, not a neon yellow).

**Data → smooth path mapping:**
1. Inputs: `points: { x: number; y: number }[]` already normalized, or raw `{ occurredAt, thresholdMeters }[]`.
2. Compute plot rect from `useWindowDimensions`/container width and a fixed height (e.g. 220).
3. Scale: `sx = (i)=> padL + (i/(n-1))*(w-padL-padR)`; `sy = (v)=> h-padB - ((v-min)/(max-min))*(h-padT-padB)`. Threshold-over-time → x = time index, y = `thresholdMeters` (higher threshold = better = higher line, the "outcome arc").
4. **Smoothing:** convert the polyline to a smooth path with a Catmull-Rom→cubic-Bézier conversion (standard: for each segment compute two control points from neighbouring points with a tension ~0.2) building a `M … C … C …` string. This gives the elegant curve without a charting lib.
5. Stroke path = that `M/C` string; fill path = same string + `L (lastX,baselineY) L (firstX,baselineY) Z`.

**Reduced motion:** if the curve animates a draw-on (e.g. `strokeDashoffset`), gate it on `AccessibilityInfo.isReduceMotionEnabled()` — render the final static curve when reduce-motion is on (NFR-1/DS-6). For Phase 3a a static curve is fully acceptable; motion is optional and subtle.

**Reuse:** the same component takes data props so Services uses sample/placeholder data (FR-W8), Results can reuse it for an outcome arc (FR-W5), and Phase 3b's client dashboard (FR-C1) can feed it live `behaviorEvent` data — one component, three call sites.

**Pitfalls (Topic 4):**
- **`Svg` needs explicit `width`/`height`** (or `viewBox` + a sized container) on web — percentage sizing can collapse; measure the container (`onLayout` or `useWindowDimensions`) and pass numbers.
- **Gradient `id` collisions** if two curves render on one page — namespace the `LinearGradient` id per instance (`useId()`), or RNW may reuse the first def.
- **Single data point / flat series** — guard `min===max` (avoid divide-by-zero in `sy`); render a flat line.
- **Install via `npx expo install react-native-svg`** to lock 15.12.1; it is a native module so a rebuild is needed on native (web/Metro picks it up live).

---

## Topic 5 — Keyless embedded map (Contact page)

### Recommendation: OpenStreetMap `export/embed.html` `<iframe>` on web; static-card + `Linking` fallback on native

This matches OQ-6 (avoid Google Maps Embed which needs a key). OSM's `https://www.openstreetmap.org/export/embed.html` is a no-key, no-cost iframe embed supporting `bbox`, `marker`, and `layer=mapnik`.

**Web/native branch:**
```tsx
// components/PracticeMap.tsx
import { Platform, View, Text, Pressable, Linking } from 'react-native';
const LAT = 37.9838, LON = 23.7275;            // practice coordinates (in-code, OQ-7)
const BBOX = `${LON-0.01},${LAT-0.006},${LON+0.01},${LAT+0.006}`;
const SRC = `https://www.openstreetmap.org/export/embed.html?bbox=${BBOX}&layer=mapnik&marker=${LAT},${LON}`;

export function PracticeMap() {
  if (Platform.OS === 'web') {
    // react-native-web passes unknown DOM via... not directly; use a raw iframe:
    // Easiest: render the iframe through a web-only file or React.createElement('iframe', …)
    return React.createElement('iframe', {
      src: SRC, title: 'Map', loading: 'lazy',
      style: { border: 0, width: '100%', height: 320, borderRadius: 14 },
    });
  }
  // native fallback: a card + open-in-maps
  return (
    <Pressable onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${LAT}&mlon=${LON}#map=16/${LAT}/${LON}`)}>
      <View style={/* DS card */}><Text>Δείτε τον χάρτη / Open in Maps</Text></View>
    </Pressable>
  );
}
```
Cleaner alternative for the web branch: a **`PracticeMap.web.tsx` / `PracticeMap.native.tsx`** platform-extension pair — Metro picks the right file per target, so the web file uses a plain JSX `<iframe>` and the native file the card. This avoids `React.createElement` and keeps `<iframe>` (an unknown element to RN's type system) out of the native bundle entirely. **Recommended: use the `.web.tsx`/`.native.tsx` split.**

**Pitfalls (Topic 5):**
- **`<iframe>` is not a React Native element** — it only exists on web. Use the platform-extension file split (or `Platform.OS==='web'` + `React.createElement('iframe', …)`); never import `<iframe>` JSX in shared code (TS + native bundler will reject it).
- **`sandbox="allow-scripts"`** can be added for hardening, but the bare OSM embed works; keep `loading="lazy"`.
- **Only one `marker`** is supported by the OSM embed; fine for a single practice.
- **bbox sizing** controls zoom — pick a tight bbox around the address for a useful default zoom.
- Native fallback should be honest (it is a static link, not an interactive map) — that satisfies AC-3a-5 ("loads without an API key") because the **web** verification surface shows the real embed; native shows a graceful link.

---

## Topic 6 — Public endpoints `POST /leads` + `POST /bookings` + Resend stub

### 6a. Route + validation (follow `routes/sessions.ts` verbatim)

`apps/api/src/routes/leads.ts` and `routes/bookings.ts` as new `Hono` sub-apps, mounted in `app.ts` via `app.route('/', leads)` / `app.route('/', bookings)`. Validators reuse `@tailsup/shared` arrays:

```ts
// leads.ts
const createLead = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().min(1).max(200),
  source: z.string().min(1).max(100),
  message: z.string().max(2000).optional(),
});
// bookings.ts
const createBooking = z.object({
  type: z.enum(BOOKING_TYPES),
  requestedAt: z.string().datetime(),     // ISO; convert to Date on insert
  name: z.string().min(1).max(200),       // contact capture (OQ-8)
  contact: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});
```
- `.max(...)` length caps satisfy FR-A3 input-size limits.
- `z.string().datetime()` enforces ISO `requestedAt` → `400` on bad input (AC-3a-7); insert as `new Date(requestedAt)`.
- Insert `lead` with `status` left to DB default (`'new'`), `clientId: null`; insert `booking` with `status` left to DB default (`'requested'`). Return `201` with the DTO (map `createdAt`/`requestedAt` → `.toISOString()`).

### 6b. Single-practice `trainerId` resolution

**Options:**
- **Env var `PRACTICE_TRAINER_ID`** — explicit, fast, no query; but must be set/seeded.
- **`SELECT id FROM trainer ORDER BY createdAt ASC LIMIT 1`** — zero-config (works against whatever was seeded), but ambiguous if multiple trainers exist.

**Recommendation (simplest robust default):** a small `resolveTrainerId()` helper that **prefers `PRACTICE_TRAINER_ID` when set, else falls back to the sole/oldest trainer row**, and **throws → mapped to 503** if neither yields a trainer (consistent with the lazy-config throw-on-missing discipline; never silently insert with a fabricated/empty `trainerId`, which would violate the NOT NULL FK and leak a 500). This mirrors `lib/r2.ts`: read at call time, throw clearly if unconfigured, map to a clean status. Document `PRACTICE_TRAINER_ID` in `.env.example` as optional ("defaults to the single seeded trainer").
- **Throw-vs-empty behaviour:** **throw** (→ 503 "practice not configured"), never insert empty. The FK would reject an empty `trainerId` anyway; an explicit 503 is the honest, debuggable signal.
- For `POST /bookings`, OQ-8 also allows auto-creating/attaching a `lead` from the booking contact — **recommend keeping 3a simple: insert the booking with `leadId: null`** (the link is a Phase 3b nicety; do not add complexity now unless desired). Note this as a deferred option.

### 6c. Resend email stub (`lib/email.ts`) — lazy, stub-not-throw, fire-and-forget

Mirror `lib/r2.ts`'s lazy-config shape **but invert the missing-key behaviour**: R2 throws (→503) on missing creds; email **logs a structured stub and returns success** on missing `RESEND_API_KEY` (kickoff: "stub if no key"; NFR-9: insert is source of truth).

**Version pin:** `resend@^6.13.0` (latest Node SDK as of mid-2026). Lives only in `apps/api` (NFR-6).

```ts
// apps/api/src/lib/email.ts
import { Resend } from 'resend';
let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim() === '') return null;     // STUB path (no throw)
  client ??= new Resend(key);
  return client;
}
export async function sendLeadNotification(to: string, lead: LeadDTO): Promise<void> {
  const c = getClient();
  if (!c) { console.log('[email:stub] new lead', { to, id: lead.id, name: lead.name, contact: lead.contact }); return; }
  const { error } = await c.emails.send({
    from: process.env.RESEND_FROM ?? 'TailsUp <onboarding@resend.dev>',
    to, subject: `New lead: ${lead.name}`,
    html: `<p>New lead from ${lead.source}</p><p>${lead.name} — ${lead.contact}</p><p>${lead.message ?? ''}</p>`,
  });
  if (error) console.error('[email] resend error (non-fatal)', error);  // resend resolves {data,error}; it does NOT throw on API errors
}
```

**Fire-and-forget in the route (the send must never block/fail the 201):**
```ts
const created = await db.insert(lead).values({...}).returning();
const dto = toLeadDTO(created);
// best-effort: do NOT await; catch so an unhandled rejection can't crash the process
void sendLeadNotification(trainerEmail, dto).catch((e) => console.error('[email] send failed (non-fatal)', e));
return c.json(dto, 201);
```
- The Resend SDK's `emails.send()` **resolves with `{ data, error }`** (it does not throw on API errors) — but network/DNS failures can still reject, so the `.catch()` on the un-awaited promise is the safety net (AC-3a-6: email failure never fails insert; NFR-9).
- **Recipient (OQ-7):** look up the resolved trainer's `email` column (`trainer.email`) and use it as `to`. The "from" needs a Resend-verified domain in production; default to `onboarding@resend.dev` for dev, documented in `.env.example` as `RESEND_FROM`.

**Pitfalls (Topic 6):**
- **Do not `await` the email before returning 201** — awaiting couples request latency to Resend and risks a 5xx if Resend is slow/down (violates NFR-9). Fire-and-forget + `.catch()`.
- **`RESEND_API_KEY` must NOT go in `config.ts` `required()`** — it is intentionally optional (scan §3). Read it lazily in `email.ts`.
- **Unhandled promise rejection** — an un-awaited promise that rejects can crash Node; always attach `.catch()`.
- **Email tests (vitest):** mock `resend` (or the `email.ts` module) à la `vi.mock`; assert the stub log path when the key is unset and that the 201 is returned regardless. Mirror `media.test.ts`'s `vi.hoisted` + `vi.mock('../db/client.js')` setup.

---

## Topic 7 — Rate-limiting awareness for the public endpoints

### Options Identified

**Option 7A — `hono-rate-limiter` in-memory limiter on the two public routes** *(recommended for 3a)*
- **Description:** A small Hono middleware (`hono-rate-limiter`) applied only to `POST /leads` and `POST /bookings` (e.g. 5–10 requests/min/IP), keyed by client IP. Returns `429` with the standard `{ error }` body on exceed (FR-A3, AC-3a-9, NFR-2).
- **Strengths:** Tiny, no external store, demonstrable (rapid repeats get throttled → satisfies AC-3a-9); idiomatic Hono; lives entirely in `apps/api`.
- **Weaknesses:** In-memory state resets on restart and isn't shared across instances — fine for a single scale-to-zero Railway instance and for local acceptance; not a distributed limiter.
- **Effort:** Low. **Risk:** Low.

**Option 7B — Hand-rolled in-memory token bucket / fixed window**
- **Strengths:** Zero dependency.
- **Weaknesses:** Reinventing a solved problem; easy to get edge cases wrong (IP extraction behind proxy, cleanup). **Risk:** Low-Medium.

**Option 7C — Defer to edge/proxy (Railway/Cloudflare) limiter; ship only input-size caps in 3a**
- **Strengths:** No app code; production-grade when deployed.
- **Weaknesses:** Not demonstrable in local acceptance (AC-3a-9 wants a shown throttle); production deploy is explicitly out of scope for Phase 3.
- **Effort:** None now. **Risk:** Low, but fails the "demonstrable" half of AC-3a-9.

**Recommendation:** **Option 7A** for a lightweight, demonstrable per-IP throttle scoped to the two public routes, **plus** the Zod `.max()` input-size caps (Topic 6a) which are independently required. Document that production should additionally rely on an edge limiter (Option 7C) when the practice deploys (deferred, consistent with "no production deploy in Phase 3"). Keep limits generous (a real human submitting one form won't hit them) and the `429` body to the standard `{ error }` shape (no internal leak — NFR-2). IP extraction: use Hono's `c.req.header('x-forwarded-for')` fallback to the connecting address; note that behind a proxy the limiter needs the real client IP (document the `trust proxy`-equivalent assumption).

---

## Comparison Matrix (recommended option per topic)

| Topic | Recommended | Alt considered | Key criterion that decided it | Complexity | Risk |
|---|---|---|---|---|---|
| 1. Routing | `(site)`/`(app)` groups, root `<Slot>` | flat + pathname chrome | idiomatic; clean 3b auth boundary (LBD-2) | Low-Med | Low |
| 1. SEO | keep `web.output:static` + `expo-router/head` `<Head>` | SPA `single` | already enabled; real SEO for marketing site | None | Low |
| 2. Design System | `lib/theme.ts` tokens + `StyleSheet` + `Pressable` states | NativeWind | no new dep; matches existing idiom (NFR-6) | Med | Low |
| 3. Fonts | `expo-font@~14.0.12` + google-fonts via `expo install` | manual `@font-face` | supported path; web+native; FOUT-tolerable | Low | Low |
| 4. Progress-curve | hand-rolled `react-native-svg@15.12.1` | victory/chart lib | full DS control; minimal deps (OQ-16/NFR-6) | Med | Low |
| 5. Map | OSM `embed.html` iframe (`.web.tsx`) + native link | Google Embed (key) | no API key (OQ-6) | Low | Low |
| 6. Endpoints | sessions.ts pattern + `resolveTrainerId()` + lazy fire-and-forget email | await email; require key | NFR-9 (insert is source of truth) | Med | Low |
| 7. Rate-limit | `hono-rate-limiter` on 2 routes + Zod caps | edge-only / hand-rolled | demonstrable (AC-3a-9), simple (NFR-2) | Low | Low |

---

## Recommendation (consolidated)

Build Phase 3a as an **additive** change to the existing tree, in this order:

1. **`@tailsup/shared`** — add `LeadDTO`, `CreateLeadInput`, `BookingDTO`, `CreateBookingInput` to `dtos.ts` (pure TS; `createdAt`/`requestedAt` as ISO strings). Optionally add `ROLES` (not needed until 3b).
2. **API** — `routes/leads.ts`, `routes/bookings.ts` (sessions.ts pattern + Zod caps), `lib/email.ts` (lazy stub, fire-and-forget, `resend@^6.13.0`), a `resolveTrainerId()` helper (`PRACTICE_TRAINER_ID` → sole trainer → throw 503), mount in `app.ts`, add `hono-rate-limiter` on the two routes. Vitest for both routes (201, validation 400, stub-email path, key-set path mocked, trainer-missing 503). Document `PRACTICE_TRAINER_ID` + `RESEND_FROM` in `.env.example`.
3. **Mobile routing** — convert root `_layout.tsx` to `<Slot>`; create `(site)/_layout.tsx` (chrome + fonts + `<Head>` defaults) and the six `(site)/*.tsx` pages; move the five existing screens under `(app)/` with their `<Stack>` header; resolve the `/`-collision (Home owns `/`, health → `/health`). Add `postLead`/`postBooking` to `lib/api.ts`.
4. **Design System** — `lib/theme.ts` + primitive components (`Container`, `Button` primary/secondary, `Eyebrow`, `Card`, `ProofBand`, `SiteChrome`).
5. **Signature visual** — `components/ProgressCurve.tsx` (react-native-svg).
6. **Map** — `components/PracticeMap.web.tsx` / `.native.tsx`.
7. Apply fonts via `npx expo install expo-font @expo-google-fonts/fraunces @expo-google-fonts/inter` and `react-native-svg` via `npx expo install react-native-svg`.

**Why this set over alternatives:** every choice favours the project's stated priorities (low maintenance, low cost, no lock-in, "simplest thing that works") and the fixed constraints (one Expo codebase, pure shared package, Resend-stub-not-throw). It adds exactly three runtime deps to mobile (`expo-font` + the two font packages are effectively one capability; `react-native-svg`) and one to the API (`resend`, plus a tiny `hono-rate-limiter`), all on the supported Expo-managed versions. It introduces no styling framework, no charting library, and no map key — each of which would add maintenance/cost/lock-in for no Phase-3a benefit.

**When the recommendation would change:** if the site grows well beyond six pages with many variants, NativeWind (Topic 2) becomes worth its setup cost; if the practice needs a multi-instance production deploy with strict abuse protection, the rate-limiter must move to a shared store / edge (Topic 7); if interactive native maps become a requirement, a keyed provider or `react-native-maps` would replace the static native fallback (Topic 5).

---

## Technical Research Guidance

**Research needed: Yes — one narrow, confirmatory topic.**

### Topic 1: Expo Router SDK 54 static-web `<Head>`/SEO behaviour under route groups + `expo export` output
- **Why:** This is the routing/SEO keystone and the **only** area where the current docs are version-shifting: `expo-router/head` is backed by a `react-native-helmet-async` fork, later SDKs add a `generateMetadata` server API, and there are historical GitHub issues about static export not emitting per-page meta tags. We should confirm, for SDK 54 specifically with `web.output: "static"`, that (a) `<Head>` per page is statically emitted into each route's HTML on `npx expo export --platform web`, (b) route groups `(site)` produce the expected flat URLs in the export, and (c) there is no `EXPO_ROUTER_APP_ROOT`/export gotcha when the root layout is a `<Slot>`.
- **Focus:** `expo export --platform web` output inspection (per-route `index.html` + `<title>`/`<meta>`); `expo-router/head` `<Head>` under static rendering on SDK 54; route-group URL flattening in the export; `<Slot>` root-layout interaction with static export; any `unstable_settings`/`generateStaticParams` need (should be none — all routes static).
- **Depth:** Intermediate (a focused doc + a small export smoke-test; ~30–60 min).
- **Relevance:** Directly validates Topic 1's recommendation (keep `output: static`, use `<Head>`). If `<Head>` does not statically emit on SDK 54, the fallback (a small post-export script, or accepting client-side title only) is minor — but knowing before planning avoids a late surprise on the primary verification surface.

Everything else is sufficiently pinned by this investigation and does not need a deeper dive:
- Fonts, react-native-svg, resend, OSM embed, Hono/Zod patterns, theme/responsive patterns, and rate-limiting are all well-understood, version-pinned, and have concrete code shapes above.

---

## Implementation Considerations

- **Decisions still open (defaults recommended above, confirm at design gate):** OQ-7 contact details/recipient (in-code details + resolved trainer email — recommended), OQ-8 booking auto-lead linkage (skip in 3a — recommended), OQ-9 `WEB_ORIGIN` var (document now, CORS tightening is 3b), OQ-13 copy language (Greek nav/headings + in-code Greek body — recommended).
- **Prerequisites:** a seeded `trainer` row with a real-ish `email` (for the lead-notification recipient and `resolveTrainerId`); decide `PRACTICE_TRAINER_ID` vs sole-trainer fallback for the dev env.
- **Pitfalls to watch (cross-cutting):**
  - The `/` route collision when moving health out of root `app/index.tsx` — handle deliberately; update the one `Link href="/dogs"` in the current health screen.
  - Verify the **static export** (`npx expo export --platform web`), not just `expo start --web`, for AC-3a-3.
  - Keep `<iframe>` out of any code path the native bundler compiles (use `.web.tsx`/`.native.tsx`).
  - Email **fire-and-forget with `.catch()`**; never `await` before the 201.
  - `RESEND_API_KEY` stays out of `config.ts` `required()`.
  - `letterSpacing` in points, `lineHeight` in px (RN units), not em — convert from the DS spec.
  - `npx expo install` (not bare `npm i`) for `expo-font`/google-fonts/`react-native-svg` so SDK-54-compatible versions are locked.
- **Suggested first steps:** (1) add the four DTOs to `@tailsup/shared`; (2) build `routes/leads.ts` + `lib/email.ts` + `resolveTrainerId()` with vitest (fastest verifiable slice, no UI); (3) restructure the router groups and stand up the `(site)/_layout.tsx` chrome + theme module; (4) build the six pages, ProgressCurve, and PracticeMap last.

---

## References

| # | Source | URL | What was learned |
|---|---|---|---|
| 1 | Expo — Static Rendering | https://docs.expo.dev/router/web/static-rendering/ | `web.output:"static"` enables per-route static HTML for SEO; `Head` from `expo-router/head` sets per-page `<title>`/meta; no request-time rendering; `generateStaticParams` only for dynamic routes |
| 2 | Expo — Router (groups/head) | https://docs.expo.dev/router/introduction/ | Route groups via parenthesized dirs add no URL segment; `<Head>` for SEO; static rendering recommended for discoverable web content |
| 3 | Expo SDK 54 bundledNativeModules | https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json | Pinned SDK-54 versions: `react-native-svg 15.12.1`, `expo-font ~14.0.12`, `expo-linear-gradient ~15.0.8` |
| 4 | Expo — Font (SDK 54) | https://docs.expo.dev/versions/v54.0.0/sdk/font/ | `useFonts` runtime loading; web generates a `@font-face` block; `FontDisplay.SWAP` recommended; splash-gate to avoid layout shift |
| 5 | Expo google-fonts | https://github.com/expo/google-fonts | Install `@expo-google-fonts/<font> expo-font`; named cuts (`Fraunces_500Medium`, `Inter_400Regular`); works web+iOS+Android; useFonts pattern |
| 6 | Expo — react-native-svg (SDK 54) | https://docs.expo.dev/versions/latest/sdk/svg/ | Web supported; primitives incl. Path/LinearGradient; install via `expo install` to pin version |
| 7 | Resend Node SDK | https://github.com/resend/resend-node | Latest `v6.13.0` (Jun 2026); `new Resend(key)`; `emails.send()` resolves `{ data, error }` (does not throw on API errors) |
| 8 | Resend — Send with Hono | https://resend.com/docs/send-with-hono | Resend works in any JS runtime incl. Node; fire-and-forget pattern (don't await; `.catch()` to log) keeps the response unblocked |
| 9 | OpenStreetMap embed URL | https://simonwillison.net/2024/Nov/25/openstreetmap-embed-url/ | `export/embed.html?bbox=…&layer=mapnik&marker=lat,lon` is a no-key iframe; single marker; `sandbox="allow-scripts"` ok |
| 10 | OSM export/embed | https://www.openstreetmap.org/export/embed.html | The keyless embed endpoint itself (bbox + marker params) |
| 11 | react-native-web — Pressable | https://necolas.github.io/react-native-web/docs/pressable/ | `style`/`children` callback receives `{ hovered, focused, pressed }`; `hovered` is mouse-only (web), inert on native — safe cross-platform |
| 12 | Expo SDK 54 changelog | https://expo.dev/changelog/sdk-54 | SDK-54 router/web context; web modals; server middleware (experimental) — no route-group breaking changes |

---

## Original Request

Investigate the best **implementation approach** for **Phase 3a** of TailsUp: the public business website (one Expo Router SDK 54 codebase, web-first) + the two public capture endpoints, with the stack fixed (one Expo Router codebase, Hono+Drizzle API, Resend email, pure-TS `@tailsup/shared`). Research HOW (concrete 2026 recommendations, version pins, explicit pitfalls) for: (1) public `(site)` route group + static-web SEO; (2) Design System in react-native-web; (3) Fraunces+Inter via expo-font/google-fonts; (4) the signature progress-curve via react-native-svg; (5) keyless OSM map embed; (6) public `POST /leads` + `POST /bookings` incl. single-practice `trainerId` resolution and the Resend lazy stub; (7) rate-limiting awareness. Auth/dashboards are Phase 3b and out of scope. Reference: `docs/reference/refined-request-phase3.md` (Phase 3a scope), `docs/reference/codebase-scan-phase3.md`, `prompts/001-tailsup-kickoff.md`, `docs/design/project-design.md`.
