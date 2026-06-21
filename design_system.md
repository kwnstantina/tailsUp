# TailsUp — Design System

> **Status:** The canonical Design System reference for the TailsUp public site. The
> kickoff (`prompts/001-tailsup-kickoff.md`) says this file "lives in the repo"; this is
> that file. It **transcribes and operationalizes** the kickoff's Design System for *this*
> codebase — the exact tokens, the type scale with **React Native-converted units**, the
> spacing/radii/layout scales, the component primitives, the signature progress-curve spec,
> and the enforceable principles.
>
> **Who applies this:** the Phase 3a mobile coders (Units C1 + C2 in
> `docs/design/plan-003-tailsup-phase3a-public-site.md`). The values below are the source
> of truth for `apps/mobile/lib/theme.ts` and every primitive component.
>
> **Brand intent (do not drift):** premium, refined, **calm, precise** — a *trustworthy
> specialist* brand, **not** a "cute" pet brand. Avoid the cliché cream + terracotta look.
> **Deep green (`#1B3A32`) is the differentiator.** Copper is a small accent only.
>
> **Platform note:** TailsUp is ONE Expo Router codebase (web + native). CSS variables are
> given for reference/parity; the **operational source** is the React Native token module
> (`lib/theme.ts`), because React Native `StyleSheet` does not consume CSS variables. Where
> the two differ (units, fallbacks), the **RN column governs the build**.

---

## 1. Color tokens

The exact kickoff tokens. Deep green carries **weight/trust** (CTAs, footer, the dark proof
band). Copper (`accent`) is for **small details only** — never a large copper surface
(no copper hero, no copper section background, no copper button fill).

| Token | Hex / value | CSS variable | RN (`colors.*`) | Role |
| --- | --- | --- | --- | --- |
| Background | `#FAF7F0` | `--color-bg` | `colors.bg` | Page background (warm off-white) |
| Background alt | `#F0EADD` | `--color-bg-alt` | `colors.bgAlt` | Alternating section background |
| Surface | `#FFFFFF` | `--color-surface` | `colors.surface` | Card / input surface |
| Primary | `#1B3A32` | `--color-primary` | `colors.primary` | **Deep green** — CTAs, footer, proof band, body text |
| Primary soft | `#3D5249` | `--color-primary-soft` | `colors.primarySoft` | Hover/pressed green, secondary green surfaces |
| Accent | `#B07D48` | `--color-accent` | `colors.accent` | **Copper** — eyebrows, focus ring, the progress-curve gold line. Small details ONLY |
| Accent soft | `#E8C9A0` | `--color-accent-soft` | `colors.accentSoft` | Curve gradient highlight, faint copper detail |
| Mint | `#9FC4B5` | `--color-mint` | `colors.mint` | Sparing supporting tint (e.g. small status dot) |
| Text | `#1B3A32` | `--color-text` | `colors.text` | Default text (= deep green) |
| Text muted | `#6B7D74` | `--color-text-muted` | `colors.textMuted` | Captions, secondary copy |
| Border | `rgba(27,58,50,0.12)` | `--color-border` | `colors.border` | Card 0.5px border, hairlines |

```css
/* reference only — RN does not read these */
--color-bg: #FAF7F0; --color-bg-alt: #F0EADD; --color-surface: #FFFFFF;
--color-primary: #1B3A32; --color-primary-soft: #3D5249;
--color-accent: #B07D48; --color-accent-soft: #E8C9A0; --color-mint: #9FC4B5;
--color-text: #1B3A32; --color-text-muted: #6B7D74; --color-border: rgba(27,58,50,0.12);
```

```ts
// apps/mobile/lib/theme.ts — the operational source
export const colors = {
  bg: '#FAF7F0', bgAlt: '#F0EADD', surface: '#FFFFFF',
  primary: '#1B3A32', primarySoft: '#3D5249',
  accent: '#B07D48', accentSoft: '#E8C9A0', mint: '#9FC4B5',
  text: '#1B3A32', textMuted: '#6B7D74', border: 'rgba(27,58,50,0.12)',
} as const;
```

**On-color contrast pairs (use these, do not improvise):**
- On `primary` (deep green): text = `bg` (`#FAF7F0`) / pure `surface` white. (This is the proof-band + primary-button text.)
- On `bg` / `bgAlt` / `surface`: text = `text` (`#1B3A32`); secondary = `textMuted`.

---

## 2. Typography — scale with RN-converted units

**Families.** Display = **Fraunces** (fallback Georgia), **headings only**, weight **400–500**,
letter-spacing **-0.02em**. Body = **Inter** (fallback `system-ui`), weight **400**,
line-height **1.6**.

- Load via `expo-font` + `@expo-google-fonts/fraunces` (400 + 500) + `@expo-google-fonts/inter`
  (400). **Load only those three cuts** (smaller bundle / faster FOUT).
- Use the exact imported family names: `Fraunces_400Regular`, `Fraunces_500Medium`,
  `Inter_400Regular` (not `"Fraunces"`).

```ts
export const fonts = {
  display: 'Fraunces_500Medium',        // headings (H1/H2)
  displayRegular: 'Fraunces_400Regular',// lighter headings (H3, large display where 500 is too heavy)
  body: 'Inter_400Regular',             // all body / UI text
} as const;
```

### 2.1 The conversion rules (RN ≠ CSS — read once)

React Native does **not** accept `em` or unitless line-heights. The kickoff scale is given
in CSS terms; convert as follows and bake the result into `theme.ts`:

- **`letterSpacing` → POINTS** = `em × fontSize`. The kickoff's heading rule is `-0.02em`;
  the eyebrow rule is `0.16em`. Compute per step against that step's `fontSize`.
- **`lineHeight` → ABSOLUTE PX** ≈ `multiplier × fontSize`. Body multiplier is `1.6`
  (kickoff). Headings use a tighter ratio (~1.13–1.37) so display type does not float apart.
- **`textTransform: 'uppercase'`** is supported in RN (eyebrow).

### 2.2 The scale (kickoff CSS spec → RN values)

A single concrete `fontSize` is chosen inside each kickoff range (e.g. H1 44–48 → **46**) so
the build is deterministic. `letterSpacing` shown only where non-zero.

| Step | Kickoff spec | Family | RN `fontSize` | RN `lineHeight` (px) | RN `letterSpacing` (pt) | Conversion shown |
| --- | --- | --- | --- | --- | --- | --- |
| **H1** | 44–48, Fraunces 400–500, ls -0.02em | `display` (500) | **46** | **52** | **-0.92** | `-0.02 × 46 = -0.92`; `52/46 ≈ 1.13` |
| **H2** | 27–32, Fraunces, ls -0.02em | `display` (500) | **30** | **36** | **-0.60** | `-0.02 × 30 = -0.60`; `36/30 = 1.20` |
| **H3** | 18–20, Fraunces, ls -0.02em | `displayRegular` (400) | **19** | **26** | **-0.38** *(≈0; may drop)* | `-0.02 × 19 = -0.38`; `26/19 ≈ 1.37` |
| **body-lg** | 16, Inter 400, lh 1.6 | `body` | **16** | **26** | — | `1.6 × 16 = 25.6 → 26` |
| **body** | 14–15, Inter 400, lh 1.6 | `body` | **15** | **24** | — | `1.6 × 15 = 24` |
| **eyebrow** | 12.5, uppercase, ls 0.16em | `body` | **12.5** | (auto) | **2** | `0.16 × 12.5 = 2.0`; `textTransform:'uppercase'`; color `accent` |
| **caption** | 11.5 | `body` | **11.5** | **16** | — | `~1.4 × 11.5 ≈ 16`; color `textMuted` |

> **H3 letter-spacing note:** `-0.38pt` is visually negligible at 19px; including it is
> harmless and keeps the "-0.02em headings" rule literal. The plan's `theme.ts` contract
> omits it on H3 for simplicity — **either is acceptable**; do not put letter-spacing on
> body/caption (Inter at body sizes reads best at 0).

```ts
// letterSpacing in POINTS (em × fontSize); lineHeight in PX (≈ multiplier × fontSize).
// NOT em / NOT unitless.
export const type = {
  h1:      { fontFamily: fonts.display,        fontSize: 46,   lineHeight: 52, letterSpacing: -0.92 },
  h2:      { fontFamily: fonts.display,        fontSize: 30,   lineHeight: 36, letterSpacing: -0.6 },
  h3:      { fontFamily: fonts.displayRegular, fontSize: 19,   lineHeight: 26 },
  bodyLg:  { fontFamily: fonts.body,           fontSize: 16,   lineHeight: 26 },
  body:    { fontFamily: fonts.body,           fontSize: 15,   lineHeight: 24 },
  eyebrow: { fontFamily: fonts.body,           fontSize: 12.5, letterSpacing: 2,
             textTransform: 'uppercase' as const, color: colors.accent },
  caption: { fontFamily: fonts.body,           fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
} as const;
```

### 2.3 Fallbacks (quality floor)

- **Headings only** use the display face. Body/UI never uses Fraunces.
- Web FOUT is acceptable: set `Georgia` (display) and `system-ui` (body) as the rendering
  fallback and use `FontDisplay.SWAP` semantics so text shows immediately. **Never block the
  whole web site on font load.** Native splash-gates briefly via `useFonts`/`SplashScreen`.
- Provide a web fallback family stack via `Platform.select({ web: { fontFamily: '"Fraunces", Georgia, serif' } })`
  on the headings and `'"Inter", system-ui, sans-serif'` on body if a face fails to resolve.

---

## 3. Spacing, radii, layout

The kickoff spacing scale `xs8 sm16 md24 lg32 xl54 2xl80`, radii `6 / 14`, max-widths
`1080 / 720`. Whitespace is a premium signal — prefer the larger steps for section rhythm.

```ts
export const space  = { xs: 8, sm: 16, md: 24, lg: 32, xl: 54, xxl: 80 } as const;
export const radii  = { base: 6, lg: 14 } as const;            // base = buttons/inputs; lg = cards/curve panel
export const layout = { maxWidth: 1080, maxProse: 720 } as const; // page container / prose column
export const breakpoints = { sm: 640, md: 768, lg: 1024 } as const; // RN has no @media — use useWindowDimensions
```

| Scale | Token | Value (px) | Typical use |
| --- | --- | --- | --- |
| Spacing | `xs` | 8 | Gaps inside a control, icon↔label |
| | `sm` | 16 | Paragraph gap, card inner padding (small) |
| | `md` | 24 | Card padding, stack gap |
| | `lg` | 32 | Sub-section gap, grid gutter |
| | `xl` | 54 | Section vertical padding (narrow) |
| | `xxl` | 80 | Section vertical padding (wide), hero breathing room |
| Radius | `base` | 6 | Buttons, inputs |
| | `lg` | 14 | Cards, the progress-curve panel, the map |
| Layout | `maxWidth` | 1080 | Centered page container |
| | `maxProse` | 720 | Reading-width text column (About, long copy) |

**Section rhythm rule:** every page section is wrapped in `Section` → `Container`
(centered, `maxWidth`). Vertical padding is `space.xl` at narrow widths, `space.xxl` at
`lg`. Alternate `bg` / `bgAlt` between adjacent sections for quiet separation (no borders
needed between sections).

---

## 4. Component primitives (exact styles)

Each is a React Native component consuming `theme.ts`. Interaction state on web comes from
`Pressable`'s `({ hovered, focused, pressed })` callback — `hovered` is mouse-only (inert on
native, safe), `focused` is the **portable visible-focus mechanism** (quality floor).

### 4.1 PrimaryButton

| Property | Value |
| --- | --- |
| Background | `colors.primary` (`#1B3A32`); hover/pressed → `colors.primarySoft` |
| Text | off-white `colors.bg` (`#FAF7F0`), `type.body` weight, slight letter-spacing optional |
| Radius | `radii.base` (6) |
| Padding | **13 vertical / 28 horizontal** (kickoff `13/28`) |
| Focus | visible ring: `borderWidth 2` + `borderColor colors.accent` (copper) OR web `outline` via `Platform.select` |
| Disabled / loading | `opacity 0.6`; `loading` shows an `ActivityIndicator` and blocks `onPress` |
| Cursor (web) | `Platform.select({ web: { cursor: 'pointer' } })` |

### 4.2 SecondaryButton

| Property | Value |
| --- | --- |
| Background | transparent; hover → faint `colors.border` fill |
| Border | `1px` solid `colors.primary` (or `colors.border` for a quieter variant) |
| Text | `colors.primary` |
| Radius / Padding / Focus | same as PrimaryButton (`radii.base`, `13/28`, copper focus ring) |

### 4.3 Eyebrow

A small copper label above a heading. Copper used here as a **small detail** (compliant).

| Property | Value |
| --- | --- |
| Style | `type.eyebrow` → `fontSize 12.5`, `letterSpacing 2`, `textTransform uppercase`, `color colors.accent` |
| Spacing | `marginBottom space.xs` (sits directly above its H2/H3) |

### 4.4 Card

| Property | Value |
| --- | --- |
| Background | `colors.surface` (white) |
| Border | **0.5px** solid `colors.border` (use `borderWidth`, NOT shadow — portable web/native) |
| Radius | `radii.lg` (14) |
| Padding | `space.md` (24); larger cards `space.lg` |
| Elevation | none by default (the 0.5px border is the separation); avoid heavy shadows (not premium-calm) |

### 4.5 Section + Container

| Component | Behavior |
| --- | --- |
| `Section` | Full-bleed vertical rhythm wrapper. Props `{ children, alt?, dark?, maxWidth? }`. `alt` → `bgAlt` background; `dark` → `colors.primary` background (this is the ProofBand surface). Vertical padding `space.xl`→`space.xxl` by breakpoint. |
| `Container` | Centered content column: `width '100%'`, `maxWidth layout.maxWidth` (or `maxProse` when passed), `alignSelf 'center'`, horizontal padding `space.md`. |

### 4.6 ProofBand (dark, once per page)

The single bold/dark moment per page (kickoff: "spend boldness in one place"; dark
proof-band "used ONCE per page").

| Property | Value |
| --- | --- |
| Background | `colors.primary` (deep green) |
| Text | off-white (`colors.bg`); headings still Fraunces |
| Usage | **At most one per page.** Implemented as `<Section dark>` or a dedicated `ProofBand` wrapper. Holds a proof statement, a key stat, or a strong CTA — not decorative. |
| Copper | only as a small accent inside (e.g. an eyebrow or a thin rule), never a copper fill |

---

## 5. Signature element — the progress-curve

> **Threshold-over-time visual: a thin gold line on a deep-green background with a soft
> gradient fill.** It is **proof of method, not decoration**, and appears in the
> **data-driven service section only** (Services), optionally reused for an outcome arc on
> Results. **Never on Home.** (Kickoff DS-5 / business-first rule.)

**Implementation:** hand-rolled `react-native-svg` (no charting dependency). Component
`apps/mobile/components/ProgressCurve.tsx`.

| Element | Spec |
| --- | --- |
| Panel | rounded rectangle, `colors.primary` background, `radii.lg` (14), generous inner padding |
| Gradient fill | `<Defs><LinearGradient id={useId()} x1=0 y1=0 x2=0 y2=1>` `Stop 0 → gold @ ~0.28 opacity`, `Stop 1 → gold @ 0 opacity` (gold fading to transparent downward) |
| Fill path | a **closed** `<Path fill="url(#id)">` (the smoothed curve, then down to baseline and back) |
| Line path | a **stroke-only** `<Path fill="none">`, `stroke = gold`, `strokeWidth 2`, `strokeLinecap "round"` — the thin gold line |
| Gold | a refined copper-gold — `colors.accent` / `colors.accentSoft`, **not** a neon yellow |
| Smoothing | Catmull-Rom → cubic-Bézier (tension ~0.2) so the polyline becomes an elegant curve |
| Sizing | explicit numeric `width`/`height` (measure container / `useWindowDimensions`); percentage sizing can collapse on web |
| Per-instance id | gradient `id` via `useId()` — two curves on one page must NOT share a `<LinearGradient>` id (RNW reuses the first def → wrong fill) |
| Flat-series guard | guard `min === max` (avoid divide-by-zero in the y-scale) → render a flat line |
| Motion | a static curve is fully acceptable; any draw-on animation must be gated on `useReducedMotion()` (renders final static curve when reduce-motion is on) |

Data props: `{ occurredAt: string; thresholdMeters: number }[]` **or** pre-normalized
`{ x: number; y: number }[]`, plus optional `height`. Higher threshold = better outcome =
higher line (the "outcome arc"). One component, reused across Services (sample data),
Results (outcome arc), and — in Phase 3b — the client dashboard (live data).

---

## 6. Principles (enforceable quality floor)

These are **verifiable by inspection** and gate every page.

1. **Spend boldness in one place.** **One** bold/dark moment per page (one `ProofBand` max).
   The rest is calm and restrained. The progress-curve lives on Services only.
2. **Whitespace = premium.** Use the larger spacing steps for section rhythm (`xl`/`xxl`).
   Do not crowd. Generous margins are the brand.
3. **Proof over promises.** Show data, outcomes, structured method — avoid hype copy and
   exclamation marks. The progress-curve and Results case studies are the "proof."
4. **Deep green carries weight; copper is a detail.** CTAs / footer / proof band are green.
   Copper appears only in eyebrows, the focus ring, small rules, and the curve's gold line.
   **Never a large copper surface.**
5. **Quality floor (hard requirements):**
   - **Responsive** — column→row at breakpoints via `useWindowDimensions`/`useBreakpoint`;
     no horizontal scroll; readable at narrow and wide widths.
   - **Visible focus** — every interactive element shows a focus state (the `Pressable`
     `focused` branch; copper ring). Keyboard users must see where they are.
   - **`prefers-reduced-motion`** — respected via `AccessibilityInfo.isReduceMotionEnabled()`
     (`useReducedMotion()`); reduced/disabled animation; no information conveyed by motion
     alone.
6. **Subtle motion only.** If motion is used, it is quiet (gentle fade/slide). No bounce, no
   attention-grabbing animation. Default to none.

---

_Source authority: `prompts/001-tailsup-kickoff.md` (Design System + Website sections).
Operationalized for `apps/mobile/lib/theme.ts` per `docs/design/investigation-phase3a.md`
(RN-unit conversions) and `docs/design/plan-003-tailsup-phase3a-public-site.md` (the theme
contract). Applied by Phase 3a Units C1 (primitives) and C2 (pages)._
