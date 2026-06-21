# Expo Router SDK 54 — Per-Page `<head>` (SEO) with Static Web Output

**Scope:** expo-router v6 / Expo SDK 54 (`expo-router ~6.0.24`, `react 19.1.0`, `web.output: "static"`)
**Purpose:** Answer whether `<Head>` from `expo-router/head` statically emits per-page title/meta into pre-rendered HTML, how to use it inside a `(site)` route group with a `<Slot>`-based root layout, and what to do if it is unreliable.

---

## 1. The Supported API: `<Head>` from `expo-router/head`

The officially documented approach for per-page `<head>` in Expo Router is the `<Head>` component imported from `expo-router/head`.

```tsx
import Head from 'expo-router/head';
import { Text } from 'react-native';

export default function Page() {
  return (
    <>
      <Head>
        <title>My Blog Website</title>
        <meta name="description" content="This is my blog." />
      </Head>
      <Text>About</Text>
    </>
  );
}
```

**Import path (exact, SDK 54):**
```ts
import Head from 'expo-router/head';
```

This is a named-default export. There is no named export. It is web-only at runtime (a no-op on iOS/Android), which is expected and harmless.

**Underpinning:** Internally `expo-router/head` wraps `react-native-helmet-async` — a fork of `react-helmet-async` that removes the `react-dom` peer dependency. As of expo-router 3.5.x (April 2024) the package switched fully to this fork. The public `<Head>` API is unchanged; only the internal dep changed.

**`generateMetadata`:** This function-based API for metadata is SSR-only (`web.output: "server"`, SDK 55+). It is **not available** in `output: "static"` mode. Do not attempt to use it in this project.

---

## 2. Static Emission Verdict: UNCERTAIN (MEDIUM confidence — verification required)

### What the official docs say

The current Expo documentation (last modified June 3, 2026) states:

> "You can add meta tags to your pages with the `<Head />` module from `expo-router`. The head elements can be updated dynamically using the same API. However, it's **useful for SEO to have static head elements rendered ahead of time.**"

This wording intentionally hedges. It does **not** say "are statically emitted" — it says it is "useful" to have them "rendered ahead of time", which implies they should be but does not confirm they are.

### The SDK 49 bug (Issue #833, August 2023)

A confirmed bug was reported under expo-router v2 / SDK 49: `expo export --platform web` produced per-route HTML files that **only contained meta tags from `app/+html.tsx`** — per-page `<Head>` content was absent from the HTML source (though it appeared after client-side hydration in browser DevTools). The old expo/router repo was archived March 2025 with no explicit fix documented.

### What changed between SDK 49 and SDK 54

Several improvements are relevant:

1. **expo-router 3.5.x (SDK 51/52, April 2024)** switched to `react-native-helmet-async`. The changelog note says "switched to react-native-helmet-async fork to eliminate react-dom peer dependency" — this is a refactor of the head machinery, not a confirmed bug fix.

2. **React 19.1.0** (used in SDK 54) natively hoists `<title>`, `<meta>`, and `<link>` tags anywhere in the component tree into `<document.head>` during SSR/static rendering, as a built-in React feature — independent of Helmet. This means that even if Helmet's extraction path has an issue, React 19's own hoisting mechanism may produce the tags in the static output. However, this React 19 path only applies if the renderer (Expo's static export) uses `react-dom/server`'s `renderToPipeableStream` or `prerender` — not `renderToStaticMarkup`. Whether Expo's build pipeline takes advantage of React 19 hoisting for static export is not confirmed in public docs.

3. The current documentation continues to show `<Head>` as the canonical static-rendering SEO mechanism without issuing any caveat about SDK 49-era failures — which suggests either the issue was silently fixed in a later version, or it was treated as low-priority and the documentation was updated to reflect aspirational behavior.

### Verification method (mandatory before relying on static head)

After adding `<Head>` to at least one `(site)` page, run:

```sh
cd apps/mobile
npx expo export --platform web
```

Then inspect the output HTML directly:

```sh
# Windows PowerShell
Get-Content dist\about.html | Select-String -Pattern "<title>|<meta name"

# bash
grep -i "<title\|<meta name" dist/about.html
```

**Pass criterion:** The `<title>` and `<meta name="description">` values appear in the raw HTML source of the file — **not** just visible in browser DevTools after hydration (which would be client-side only).

If the tags appear: static emission is confirmed working for SDK 54.
If the tags are absent: fall back to Option A below.

---

## 3. Route Groups and `<Slot>` Root Layout

**Route groups do not affect static output URL structure.** `app/(site)/about.tsx` generates `dist/about.html` and resolves to `/about`. This is confirmed Expo Router behavior: parenthesized directories are organizational only and contribute no URL segment. The `dist/` directory will have:

```
dist/
  index.html          ← (site)/index.tsx  (Home, /)
  about.html          ← (site)/about.tsx  (/about)
  services.html       ← (site)/services.tsx
  results.html        ← (site)/results.tsx
  contact.html        ← (site)/contact.tsx
  booking.html        ← (site)/booking.tsx
  _expo/static/...    ← JS/CSS bundles
  favicon.ico
```

**`<Slot>` root layout:** No known issue with `<Slot>` in the root `app/_layout.tsx` and static export. `<Slot>` simply renders the matched child route directly — it is less opinionated than `<Stack>` and does not add navigation wrappers that could interfere with the static renderer. The per-page `<Head>` content is rendered as part of the route component tree; as long as the route component renders during static export (which it does for static routes), `<Head>` is present in the render tree.

**`(site)/_layout.tsx` using `<Stack screenOptions={{ headerShown: false }}>` or `<Slot>`:** Both work. For web-only pages with no native stack chrome needed, `<Slot>` is simpler. Using `<Stack>` with `headerShown: false` is fine too and gives you the web back-button behaviour.

---

## 4. Caveats

### 4a. Duplicate/conflicting tags and Helmet merge behaviour

`react-native-helmet-async` (like all Helmet variants) merges tags from the deepest component wins. If you set a `<title>` in `(site)/_layout.tsx` (site-wide default) and also in `about.tsx` (per-page override), the per-page one wins on the client. During static export the behaviour is the same merge — the last `<Head>` in the render tree wins. This is the correct behaviour for per-page overrides.

If two `<Head>` components in the same render tree both set `<title>`, only the last one (deepest in the component tree) is kept. There is no accumulation for `<title>`.

For `<meta>` tags: tags are deduplicated by `name` attribute — only the last value for a given name is retained.

### 4b. `<html lang>` and favicon

These belong in `app/+html.tsx`, **not** in `<Head>`:

- `<html lang="el">` (Greek site) — set on the `<html>` element in `+html.tsx`
- `<link rel="icon" ...>` / `favicon.ico` — put `favicon.ico` in `public/` (it is automatically served at `/favicon.ico` by Expo CLI and copied to `dist/`). Or add a `<link rel="icon">` in `+html.tsx`'s `<head>`.

`<Head>` cannot set attributes on `<html>` or `<body>` — those require `+html.tsx`.

### 4c. Ordering with the root HTML template

`+html.tsx` renders first (it is the shell). Its `<head>` content (charset, viewport, etc.) is always present. Per-page `<Head>` content is injected by Helmet after the static render. In practice this means if the static renderer does extract Helmet state, the per-page meta appears after the global meta in `<head>` — which is fine for SEO; ordering within `<head>` does not affect search engine parsing.

### 4d. Client-side navigation updates

Even if static emission works for the initial HTML, `<Head>` also updates `document.title` on client-side navigation between pages (via `react-native-helmet-async`'s context). This is the correct SPA navigation behaviour and works regardless of static emission status.

### 4e. `<Head>` is a no-op on native

On iOS/Android, `<Head>` silently does nothing. This is expected. Do not check for per-page title behaviour on native.

### 4f. Open Graph image (`og:image`)

Place OG images in `public/` (e.g. `public/og/home.png`). They are copied to `dist/` and accessible at `/og/home.png`. Reference them with an absolute URL (including domain) in the `og:image` meta tag for crawler compatibility:

```tsx
<meta property="og:image" content="https://tailsup.gr/og/home.png" />
```

During development, use a placeholder. The domain can be injected from an `EXPO_PUBLIC_SITE_URL` env var.

---

## 5. Recommended Pattern (Copy-Pasteable)

### 5a. `app/+html.tsx` — Root HTML shell (global, web-only)

Create this file if it doesn't exist. It runs in Node.js only and is the right place for `<html lang>`, charset, viewport, and a fallback `<title>`:

```tsx
// apps/mobile/app/+html.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="el">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* Fallback title — per-page <Head> overrides this */}
        <title>TailsUp — Επαγγελματική Εκπαίδευση Σκύλων</title>
        <meta
          name="description"
          content="Επαγγελματική εκπαίδευση σκύλων στην Αθήνα. Αποδεδειγμένα αποτελέσματα."
        />
        <link rel="icon" href="/favicon.ico" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 5b. `app/(site)/_layout.tsx` — Site-wide default Head + Chrome

The layout renders a `<Head>` with the site-wide default. Individual pages override it:

```tsx
// apps/mobile/app/(site)/_layout.tsx
import Head from 'expo-router/head';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// import { SiteChrome } from '../../components/SiteChrome'; // header/nav/footer

export default function SiteLayout() {
  return (
    <SafeAreaProvider>
      {/*
        Site-wide default Head.
        Per-page <Head> in child routes overrides <title> and <meta name="description">.
        OG defaults stay here; pages can add page-specific og: tags on top.
      */}
      <Head>
        <title>TailsUp — Επαγγελματική Εκπαίδευση Σκύλων</title>
        <meta
          name="description"
          content="Επαγγελματική εκπαίδευση σκύλων στην Αθήνα. Αποδεδειγμένα αποτελέσματα."
        />
        <meta property="og:site_name" content="TailsUp" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://tailsup.gr/og/default.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      {/* <SiteChrome> */}
        <Slot />
      {/* </SiteChrome> */}
    </SafeAreaProvider>
  );
}
```

### 5c. Per-page override — `app/(site)/about.tsx`

```tsx
// apps/mobile/app/(site)/about.tsx
import Head from 'expo-router/head';
import { ScrollView, View, Text } from 'react-native';

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>Ποιοι Είμαστε — TailsUp</title>
        <meta
          name="description"
          content="Μάθετε για την TailsUp και τη φιλοσοφία μας στην εκπαίδευση σκύλων."
        />
        <meta property="og:title" content="Ποιοι Είμαστε — TailsUp" />
        <meta
          property="og:description"
          content="Μάθετε για την TailsUp και τη φιλοσοφία μας στην εκπαίδευση σκύλων."
        />
        <meta property="og:url" content="https://tailsup.gr/about" />
      </Head>
      <ScrollView>
        <View>
          <Text>Ποιοι Είμαστε content…</Text>
        </View>
      </ScrollView>
    </>
  );
}
```

### 5d. Apply the same pattern to all six `(site)` pages

| Page | `<title>` | `<meta name="description">` |
|------|-----------|------------------------------|
| `index.tsx` (Home `/`) | `TailsUp — Επαγγελματική Εκπαίδευση Σκύλων` | `Επαγγελματική εκπαίδευση σκύλων στην Αθήνα. Αποδεδειγμένα αποτελέσματα.` |
| `about.tsx` (`/about`) | `Ποιοι Είμαστε — TailsUp` | `Μάθετε για την TailsUp και τη φιλοσοφία μας.` |
| `services.tsx` (`/services`) | `Υπηρεσίες — TailsUp` | `Προγράμματα εκπαίδευσης για κάθε σκύλο και ιδιοκτήτη.` |
| `results.tsx` (`/results`) | `Αποτελέσματα — TailsUp` | `Δείτε τα μετρήσιμα αποτελέσματα της εκπαίδευσής μας.` |
| `contact.tsx` (`/contact`) | `Επικοινωνία — TailsUp` | `Βρείτε μας στην Αθήνα ή στείλτε μήνυμα.` |
| `booking.tsx` (`/booking`) | `Κλείστε Ραντεβού — TailsUp` | `Κλείστε το πρώτο σας ραντεβού εύκολα online.` |

Home (`index.tsx`) can re-use the site-wide default from the layout (no `<Head>` override needed) or override with the same values — both are fine.

---

## 6. Fallback Strategy (if static emission is unreliable)

If the verification step (section 2) shows that per-page `<Head>` tags are **absent** from the exported HTML source, use the following fallback. The build does not block on this — static Helmet is a "nice to have"; the page still works correctly, just without pre-rendered meta.

### Option A: React 19 native metadata hoisting (PRIMARY FALLBACK — try first)

React 19.1.0 (used in SDK 54) natively hoists `<title>` and `<meta>` tags from anywhere in the component tree into `document.head` during SSR/static rendering, without requiring Helmet. If Expo's static export pipeline is using React 19's `prerender` or `renderToPipeableStream` (which it likely does given React 19 is the base), these tags will appear in the static HTML automatically.

To try this fallback, replace `<Head>` with bare React 19 native tags:

```tsx
// apps/mobile/app/(site)/about.tsx  — React 19 native metadata path
import { ScrollView, View, Text } from 'react-native';

export default function AboutPage() {
  return (
    <>
      {/* React 19: <title> and <meta> anywhere in the tree are hoisted to <head> on web */}
      <title>Ποιοι Είμαστε — TailsUp</title>
      <meta
        name="description"
        content="Μάθετε για την TailsUp και τη φιλοσοφία μας."
      />
      <meta property="og:title" content="Ποιοι Είμαστε — TailsUp" />
      <ScrollView>
        <View>
          <Text>Ποιοι Είμαστε content…</Text>
        </View>
      </ScrollView>
    </>
  );
}
```

**Important:** This syntax is **web-only semantically** (on native, bare `<title>` will error or render as a visible element). Wrap in a Platform check or use a `.web.tsx` / `.native.tsx` file split if targeting native too. Since the `(site)` pages are web-first marketing pages and native rendering is secondary, the Platform guard is the simpler approach:

```tsx
import { Platform } from 'react-native';

// In JSX:
{Platform.OS === 'web' && (
  <>
    <title>Ποιοι Είμαστε — TailsUp</title>
    <meta name="description" content="…" />
  </>
)}
```

Verify with the same `grep`/`Get-Content` check on the exported HTML.

### Option B: Per-page data baked into `+html.tsx` (SECONDARY FALLBACK)

This approach is the most reliable for static emission but requires a build-time mapping:

```tsx
// apps/mobile/app/+html.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Build-time page metadata map — update whenever a page is added/renamed
const PAGE_META: Record<string, { title: string; description: string }> = {
  '/':         { title: 'TailsUp — Επαγγελματική Εκπαίδευση Σκύλων', description: '…' },
  '/about':    { title: 'Ποιοι Είμαστε — TailsUp', description: '…' },
  '/services': { title: 'Υπηρεσίες — TailsUp', description: '…' },
  '/results':  { title: 'Αποτελέσματα — TailsUp', description: '…' },
  '/contact':  { title: 'Επικοινωνία — TailsUp', description: '…' },
  '/booking':  { title: 'Κλείστε Ραντεβού — TailsUp', description: '…' },
};

export default function Root({ children }: PropsWithChildren) {
  // process.env.__EXPO_ROUTER_PATHNAME is available at export time
  const path = (process.env.__EXPO_ROUTER_PATHNAME ?? '/') as string;
  const meta = PAGE_META[path] ?? PAGE_META['/'];

  return (
    <html lang="el">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="icon" href="/favicon.ico" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Caveat:** The env var `__EXPO_ROUTER_PATHNAME` is an internal Expo CLI convention (not documented publicly) and may not be reliable across SDK versions. **Verify it is populated during export** by logging `process.env.__EXPO_ROUTER_PATHNAME` in the +html.tsx before using this. If it is not available, this approach falls back to the site-wide default for all pages — same result as doing nothing.

### Option C: Accept client-side head only (LOWEST EFFORT)

If static emission cannot be confirmed and the fallbacks above are deferred:

- Put the site-wide default title and description in `+html.tsx` (always statically emitted because it is in the HTML template itself).
- Use `<Head>` per-page anyway for client-side navigation title updates (correct tab title on navigation).
- Accept that the initial HTML crawled by search engines shows only the site-wide title/description.

For a Phase 3a demo, this is acceptable. For production SEO, revisit Options A/B.

---

## 7. Recommended Pragmatic Path

Apply this decision tree:

1. **Start with `<Head>` from `expo-router/head`** (documented, idiomatic, Option 5b/5c above) — it's what the docs say to use.
2. **Run `expo export --platform web` early** (not just `expo start --web`) and grep the output HTML for your `<title>` values.
3. If tags are present: done — static emission works in SDK 54.
4. If tags are absent: try **Option A** (bare React 19 `<title>`/`<meta>` with `Platform.OS === 'web'` guard). Run export again and verify.
5. If neither works: fall back to **Option C** (client-side only) with site-wide defaults in `+html.tsx`. The marketing site functions correctly; only the initial crawl sees a generic title. This is a minor SEO cost, not a blocker.

**Do not block Phase 3a on this.** The verification is a 10-minute step. Options A and C are 15-minute fallbacks if needed.

---

## 8. Assumptions and Scope

| Assumption | Confidence | Impact if Wrong |
|---|---|---|
| `<Head>` from `expo-router/head` is the correct import for SDK 54 / expo-router 6.x | HIGH | Trivial — the import path hasn't changed since v2 |
| Route groups produce flat URLs in static export (confirmed by docs) | HIGH | None — well-documented |
| SDK 49 issue #833 (head not emitted) may have been silently fixed in v3–v6 | MEDIUM | If still present: use Option A or C |
| React 19 native metadata hoisting works in Expo's static export pipeline | MEDIUM | If not: Option A doesn't work; fall to Option C |
| `<Slot>` root layout has no special static export interaction | HIGH | Minimal — `<Slot>` is the simplest layout type |
| `generateMetadata` is SSR-only and not relevant here | HIGH | None |
| `__EXPO_ROUTER_PATHNAME` env var is available in `+html.tsx` during export | LOW | Option B is not viable; skip it |

**Out of scope:** SSR (`web.output: "server"`); `generateMetadata` API (SDK 55+/SSR only); dynamic routes and `generateStaticParams`; native title/head behaviour (no-op on iOS/Android, expected).

---

## References

| # | Source | URL | What was learned |
|---|---|---|---|
| 1 | Expo — Static Rendering docs (current) | https://docs.expo.dev/router/web/static-rendering/ | Full static rendering guide; `<Head>` from `expo-router/head` usage; `+html.tsx` shape; static export command and dist structure; route group URL behavior confirmed; meta tags section wording verbatim (modified June 3 2026) |
| 2 | Expo — Server Rendering docs | https://docs.expo.dev/router/web/server-rendering/ | Confirmed `generateMetadata` is SSR-only (`output: server`); `<Head>` component is the comparison for static output; SDK 55+ feature |
| 3 | GitHub expo/router issue #833 | https://github.com/expo/router/issues/833 | SDK 49 bug: per-page `<Head>` tags absent from exported HTML, only `+html.tsx` tags present; repo archived March 2025 with no documented fix |
| 4 | Expo Router CHANGELOG.md | https://github.com/expo/expo/blob/main/packages/expo-router/CHANGELOG.md | v3.5.5 switched to `react-native-helmet-async` fork; no explicit head/meta static-emission fix logged |
| 5 | React 19 release blog | https://react.dev/blog/2024/12/05/react-19 | React 19 natively hoists `<title>`, `<meta>`, `<link>` to `<head>` during SSR/static rendering without Helmet; works with client apps, streaming SSR, Server Components |
| 6 | Expo SDK 54 changelog | https://expo.dev/changelog/sdk-54 | SDK 54 uses React 19.1; no head/SEO-specific changes noted |
| 7 | DeepWiki — expo-head | https://deepwiki.com/expo/router/3.3-expo-head | Confirmed expo-head wraps `react-native-helmet-async` on web, UserActivity integration on iOS |
| 8 | Expo Router notation docs | https://docs.expo.dev/router/basics/notation/ | Route groups (parentheses) confirmed to not affect URL structure; `app/(site)/about.tsx` → `/about` |
| 9 | Expo Router introduction | https://docs.expo.dev/router/introduction/ | Route groups, `<Head>` for SEO, static rendering for discoverable web content |

### Recommended for deep reading

- **Source 1** (static-rendering docs): The authoritative guide — read the "Meta tags" and "Root HTML" sections carefully.
- **Source 5** (React 19 blog): If Option A is needed, this explains the native hoisting mechanism and its rendering-mode coverage.
- **Source 3** (issue #833): The historical failure mode — know what to look for if verification fails.
