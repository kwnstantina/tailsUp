// =============================================================================
// TailsUp Design System — token module (Phase 3a, Unit C1 · DS-1..DS-4)
//
// The OPERATIONAL source of truth for the public site's look. Plain TS objects
// consumed via `StyleSheet.create` (React Native does NOT read CSS variables).
// Values transcribe `design_system.md`; units are RN-converted:
//   - letterSpacing → POINTS  (= em × fontSize), NOT em
//   - lineHeight    → ABSOLUTE PX (≈ multiplier × fontSize), NOT unitless
// Brand intent: WARM AND PLAYFUL — a friendly local practice, not a clinic.
// Green still carries the trust, but orange is the call-to-action and colour is
// spent freely rather than rationed. No new dependency — this is the styling
// layer; `design_system.md` describes the earlier, austere direction.
// =============================================================================

import { useWindowDimensions, Platform, type TextStyle } from 'react-native';

export { useReducedMotion } from './reducedMotion';

// ── Colors (DS-1 · PLAYFUL direction) ────────────────────────────────────────
// Green still carries trust, but lifted out of near-black so the page reads as
// a colour rather than a shadow. Orange is now the CTA colour — the rule that
// copper may only be a small detail is deliberately retired.
//
// `accent` KEEPS its old contract: it is the TEXT-SAFE orange, because the
// pages use it for eyebrow copy, links and focus rings (about.tsx, contact.tsx,
// results.tsx, booking.tsx …). The bright orange lives in `accentBright` and is
// for FILLS ONLY — it is 2.0:1 on the page background and would fail every one
// of those text usages.
//
// Contrast, checked (AA needs 4.5:1 for body text):
//   text      #2B3A31 on bg      → 13.5:1
//   textMuted #5F7268 on bg      →  5.1:1
//   accent    #B45D14 on bg      →  4.6:1   ← why eyebrows use this, not bright
//   text      #2B3A31 on bright  →  5.1:1   ← why CTA labels are DARK on orange
//   bg        #FFFCF5 on primary →  5.1:1
//   accentSoft#F9D9A6 on primaryDeep → light-on-dark, for the footer/proof band
export const colors = {
  bg: '#FFFCF5', // page background (bright warm cream)
  bgAlt: '#FFF1DC', // alternating section background (peach)
  surface: '#FFFFFF', // card / input surface
  primary: '#3B7A63', // fresh green — section anchors, secondary buttons
  primarySoft: '#2A5B49', // deeper green — hover/pressed, footer, proof band
  accent: '#B45D14', // TEXT-SAFE orange — eyebrows, links, focus rings
  accentBright: '#EF9440', // FILLS ONLY — primary CTA, the curve's line, paw
  accentSoft: '#F9D9A6', // light peach — text on the dark band, highlighter
  mint: '#A8DCC4', // supporting tint — card fills, decorative shapes
  coral: '#E4736B', // DECORATION ONLY (3.9:1) — never put copy on it
  coralSoft: '#FBD5D1', // coral card tint
  mintSoft: '#DFF0E7', // mint card tint
  text: '#2B3A31', // default text
  textMuted: '#5F7268', // captions, secondary copy
  border: 'rgba(43,58,49,0.10)', // card border, hairlines

  // ── Playful-direction additions ────────────────────────────────────────────
  // Everything above keeps its contract; these are the extra tokens the
  // stickers, tinted cards, wave dividers and the deep-green band need. Adding
  // rather than renaming is deliberate — no existing consumer changes.

  // A second, paler peach. `accentSoft` is the highlighter yellow-peach; this
  // is the lighter wash used for card fills where copy still has to be legible.
  accentPeach: '#FFE6C9',
  // Alias for the highlighter mark behind a headline word. Same value as
  // accentSoft, named for the job so `Highlight` reads honestly.
  highlight: '#F9D9A6',

  // Ink for copy sitting ON a tinted card. Each is checked against its own
  // tint, not against the page background:
  //   textOnMint  #3E5147 on #DFF0E7 →  7.2:1
  //   textOnPeach #52412F on #F9D9A6 →  7.0:1
  //   textOnCoral #5A3733 on #FBD5D1 →  7.4:1
  textOnMint: '#3E5147',
  textOnPeach: '#52412F',
  textOnCoral: '#5A3733',

  // On the deep-green band / footer. `onDark` is the page cream reused as ink.
  //   onDark      #FFFCF5 on #2A5B49 →  8.9:1
  //   onDarkMuted #CFE3D8 on #2A5B49 →  6.3:1
  //   onDarkFaint #A9C2B4 on #2A5B49 →  4.1:1  ← captions/hairlines ONLY
  onDark: '#FFFCF5',
  onDarkMuted: '#CFE3D8',
  onDarkFaint: '#A9C2B4',

  // Form chrome. The warm border reads as part of the palette where the
  // translucent `border` above reads as a grey hairline on peach sections.
  fieldBorder: '#EADFCE',
  placeholder: '#97A69D',
  danger: '#A33B32', // error copy + the coral card's icon ink (5.9:1 on bg)
} as const;

// ── Fonts (DS-2) ───────────────────────────────────────────────────────────
// Use the exact imported google-fonts family names (NOT "Fraunces"). Only three
// cuts are loaded (Fraunces 400/500 + Inter 400) for a smaller bundle / faster
// FOUT. Display = headings only; body/UI never uses Fraunces.
export const fonts = {
  display: 'Fredoka_600SemiBold', // headings (H1/H2)
  displayRegular: 'Fredoka_500Medium', // lighter headings (H3)
  body: 'NunitoSans_400Regular', // all body / UI text
  bodySemiBold: 'NunitoSans_600SemiBold', // labels, nav
  bodyBold: 'NunitoSans_700Bold', // button labels, eyebrows, emphasis
} as const;

// Web FOUT fallback stacks (DS-2 quality floor). Spread these into a heading /
// body text style on web so Georgia / system-ui show acceptably while the
// webfont loads; never block the whole site on font load.
export const fontFallback = {
  display: Platform.select({
    web: { fontFamily: '"Fredoka", "Trebuchet MS", sans-serif' } as TextStyle,
    default: {},
  }),
  body: Platform.select({
    web: { fontFamily: '"Nunito Sans", system-ui, sans-serif' } as TextStyle,
    default: {},
  }),
} as const;

// ── Type scale (DS-2 · RN-converted) ─────────────────────────────────────────
// letterSpacing in POINTS (em × fontSize); lineHeight in PX (≈ multiplier ×
// fontSize). A single concrete fontSize is chosen inside each kickoff range so
// the build is deterministic.
// Fredoka is rounder and wider than Fraunces, so the negative tracking that
// tightened the old serif is dialled back — over-tightening a rounded face
// makes it look cramped rather than crafted. Sizes go UP across the board and
// body line-height loosens: the playful direction is generous, not dense.
export const type = {
  h1: { fontFamily: fonts.display, fontSize: 52, lineHeight: 58, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.displayRegular, fontSize: 21, lineHeight: 28 },
  bodyLg: { fontFamily: fonts.body, fontSize: 17.5, lineHeight: 29 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26 },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    // RN letterSpacing is POINTS, not em: the spec's 0.1em at 13px = 1.3.
    // Loosened from the old 0.16em — tight tracking reads formal.
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
    color: colors.accent,
  },
  caption: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
} as const;

// ── Spacing / radii / layout (DS-3) ───────────────────────────────────────────
// Whitespace is a premium signal — prefer the larger steps for section rhythm.
export const space = { xs: 8, sm: 16, md: 24, lg: 32, xl: 54, xxl: 80 } as const;
// Corners get much rounder in this direction: fields 16, cards 28, the proof
// band 40, and buttons go fully pill. `base`/`lg` keep their old names so every
// existing consumer picks the new values up without a change.
export const radii = { base: 16, lg: 28, card: 32, band: 40, pill: 999 } as const;
export const layout = { maxWidth: 1160, maxProse: 720 } as const; // page container / prose column
export const breakpoints = { sm: 640, md: 768, lg: 1024 } as const; // RN has no @media

// ── Responsive (DS-3 · RN has no media queries) ──────────────────────────────
export type Breakpoint = 'sm' | 'md' | 'lg';

/**
 * Current breakpoint bucket from window width. `lg` ≥ 1024, `md` ≥ 768, else
 * `sm`. Pages switch column→row and adjust rhythm against this.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  return 'sm';
}

export interface Responsive {
  width: number;
  breakpoint: Breakpoint;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  /** True at >= md — the common "lay out as a row" threshold. */
  isWide: boolean;
  /** Section vertical padding: xxl when wide, xl when narrow (DS-3 rhythm). */
  sectionPadV: number;
}

/**
 * One hook for the responsive primitives a page needs: the live width, the
 * breakpoint bucket, convenience booleans, and the section vertical-rhythm
 * value (`space.xl`→`space.xxl` by breakpoint).
 */
export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const breakpoint: Breakpoint = width >= breakpoints.lg ? 'lg' : width >= breakpoints.md ? 'md' : 'sm';
  const isWide = width >= breakpoints.md;
  return {
    width,
    breakpoint,
    isSm: breakpoint === 'sm',
    isMd: breakpoint === 'md',
    isLg: breakpoint === 'lg',
    isWide,
    sectionPadV: breakpoint === 'lg' ? space.xxl : space.xl,
  };
}

// ── Responsive type (playful direction) ──────────────────────────────────────
// Fredoka at 52px is right on a desktop hero and wrong on a 375px phone — it
// breaks to three words a line and the page loses its shape. `type` above stays
// the DESKTOP scale (every existing consumer keeps its values); `typePhone`
// holds the narrow cuts, and `useType()` picks between them at the `md` break.
//
// Only the display cuts and the lead paragraph change. Body copy is already at
// a comfortable reading size and shrinking it would hurt, not help.
export const typePhone = {
  h1: { ...type.h1, fontSize: 37, lineHeight: 42, letterSpacing: -0.3 },
  h2: { ...type.h2, fontSize: 27, lineHeight: 33, letterSpacing: -0.2 },
  h3: { ...type.h3, fontSize: 19, lineHeight: 26 },
  bodyLg: { ...type.bodyLg, fontSize: 16.5, lineHeight: 27 },
} as const;

// Widened so the phone cuts are assignable: `type` is `as const`, which pins
// every fontSize to its literal, and 37 is not assignable to 52.
export type TypeScale = { [K in keyof typeof type]: TextStyle };

/**
 * The type scale for the current width: the desktop `type` at >= md, and the
 * phone cuts below it. Spread the result exactly like `type`:
 *
 *   const ty = useType();
 *   <Text style={[ty.h1, fontFallback.display]}>…</Text>
 *
 * Styles that depend on it can't live in a module-level `StyleSheet.create`,
 * so pages pass them inline — that is the intended trade.
 */
export function useType(): TypeScale {
  const { isWide } = useResponsive();
  return isWide ? type : { ...type, ...typePhone };
}
