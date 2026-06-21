// =============================================================================
// TailsUp Design System — token module (Phase 3a, Unit C1 · DS-1..DS-4)
//
// The OPERATIONAL source of truth for the public site's look. Plain TS objects
// consumed via `StyleSheet.create` (React Native does NOT read CSS variables).
// Values transcribe `design_system.md`; units are RN-converted:
//   - letterSpacing → POINTS  (= em × fontSize), NOT em
//   - lineHeight    → ABSOLUTE PX (≈ multiplier × fontSize), NOT unitless
// Brand intent: premium, calm, precise. Deep green carries weight; copper is a
// small accent only. No new dependency — this is the styling layer.
// =============================================================================

import { useWindowDimensions, Platform, type TextStyle } from 'react-native';

export { useReducedMotion } from './reducedMotion';

// ── Colors (DS-1) ────────────────────────────────────────────────────────────
// Deep green (#1B3A32) is the differentiator: CTAs, footer, proof band, body
// text. Copper (accent) is small details ONLY — never a large copper surface.
export const colors = {
  bg: '#FAF7F0', // page background (warm off-white)
  bgAlt: '#F0EADD', // alternating section background
  surface: '#FFFFFF', // card / input surface
  primary: '#1B3A32', // deep green — CTAs, footer, proof band, body text
  primarySoft: '#3D5249', // hover/pressed green
  accent: '#B07D48', // copper — eyebrows, focus ring, the curve's gold line
  accentSoft: '#E8C9A0', // curve gradient highlight, faint copper detail
  mint: '#9FC4B5', // sparing supporting tint
  text: '#1B3A32', // default text (= deep green)
  textMuted: '#6B7D74', // captions, secondary copy
  border: 'rgba(27,58,50,0.12)', // card 0.5px border, hairlines
} as const;

// ── Fonts (DS-2) ───────────────────────────────────────────────────────────
// Use the exact imported google-fonts family names (NOT "Fraunces"). Only three
// cuts are loaded (Fraunces 400/500 + Inter 400) for a smaller bundle / faster
// FOUT. Display = headings only; body/UI never uses Fraunces.
export const fonts = {
  display: 'Fraunces_500Medium', // headings (H1/H2)
  displayRegular: 'Fraunces_400Regular', // lighter headings (H3)
  body: 'Inter_400Regular', // all body / UI text
} as const;

// Web FOUT fallback stacks (DS-2 quality floor). Spread these into a heading /
// body text style on web so Georgia / system-ui show acceptably while the
// webfont loads; never block the whole site on font load.
export const fontFallback = {
  display: Platform.select({ web: { fontFamily: '"Fraunces", Georgia, serif' } as TextStyle, default: {} }),
  body: Platform.select({ web: { fontFamily: '"Inter", system-ui, sans-serif' } as TextStyle, default: {} }),
} as const;

// ── Type scale (DS-2 · RN-converted) ─────────────────────────────────────────
// letterSpacing in POINTS (em × fontSize); lineHeight in PX (≈ multiplier ×
// fontSize). A single concrete fontSize is chosen inside each kickoff range so
// the build is deterministic.
export const type = {
  h1: { fontFamily: fonts.display, fontSize: 46, lineHeight: 52, letterSpacing: -0.92 },
  h2: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h3: { fontFamily: fonts.displayRegular, fontSize: 19, lineHeight: 26 },
  bodyLg: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: colors.accent,
  },
  caption: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
} as const;

// ── Spacing / radii / layout (DS-3) ───────────────────────────────────────────
// Whitespace is a premium signal — prefer the larger steps for section rhythm.
export const space = { xs: 8, sm: 16, md: 24, lg: 32, xl: 54, xxl: 80 } as const;
export const radii = { base: 6, lg: 14 } as const; // base = buttons/inputs; lg = cards/curve/map
export const layout = { maxWidth: 1080, maxProse: 720 } as const; // page container / prose column
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
