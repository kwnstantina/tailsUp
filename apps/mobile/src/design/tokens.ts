// The TailsUp design system — "playful" direction (Phase 3).
//
// Single source of truth for every colour, size and radius the public site
// uses. Pages and components import from here; no screen hard-codes a hex.
//
// Contrast notes (checked against WCAG AA, 4.5:1 for body text):
//   text on bg .......... #2B3A31 on #FFFCF5 — 13.5:1
//   textMuted on bg ..... #5F7268 on #FFFCF5 —  5.1:1
//   text on accent ...... #2B3A31 on #EF9440 —  5.1:1  <- why CTAs are orange
//                                                         with DARK labels
//   onDark on primary ... #FFFCF5 on #3B7A63 —  5.1:1
//   accentInk on bg ..... #B45D14 on #FFFCF5 —  4.6:1  <- the text-safe copper
//   coral ............... 3.9:1 — DECORATION ONLY. Never put copy on it.

export const colors = {
  // Surfaces
  bg: '#FFFCF5',
  bgAlt: '#FFF1DC',
  surface: '#FFFFFF',

  // Green — section anchors, secondary buttons, the dark proof band
  primary: '#3B7A63',
  primaryDeep: '#2A5B49',

  // Orange — the primary CTA colour in this direction
  accent: '#EF9440',
  accentInk: '#B45D14', // text-safe orange, for labels and links on light
  accentSoft: '#FFE6C9',
  highlight: '#F9D9A6', // the highlighter mark behind a headline word

  // Rotating card tints
  mint: '#A8DCC4',
  mintSoft: '#DFF0E7',
  coral: '#E4736B', // decoration only — fails AA for text
  coralSoft: '#FBD5D1',

  // Ink
  text: '#2B3A31',
  textMuted: '#5F7268',
  textOnMint: '#3E5147',
  textOnPeach: '#52412F',
  textOnCoral: '#5A3733',

  // On the dark band
  onDark: '#FFFCF5',
  onDarkMuted: '#CFE3D8',
  onDarkFaint: '#A9C2B4',

  // Form chrome
  fieldBorder: '#EADFCE',
  fieldBorderFocus: '#EF9440',
  placeholder: '#97A69D',
  danger: '#A33B32',
} as const;

// Font families map to the exact export names from @expo-google-fonts.
// Loaded in app/_layout.tsx; nothing renders until they resolve.
export const fonts = {
  displayMedium: 'Fredoka_500Medium',
  displaySemiBold: 'Fredoka_600SemiBold',
  body: 'NunitoSans_400Regular',
  bodySemiBold: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
} as const;

// Type scale. Each entry is [desktop, mobile] — pick with `t()` below.
// React Native's letterSpacing is in PIXELS, not em: the design's 0.1em on a
// 13px eyebrow is 1.3 here.
export const type = {
  h1: { size: [60, 37], lineHeight: [65, 41] },
  h2: { size: [40, 29], lineHeight: [46, 34] },
  h3: { size: [24, 21], lineHeight: [30, 27] },
  bodyLg: { size: [19.5, 17], lineHeight: [32, 28] },
  body: { size: [16.5, 16], lineHeight: [27, 26] },
  small: { size: [15, 14.5], lineHeight: [25, 24] },
  eyebrow: { size: [13, 12.5], lineHeight: [18, 17] },
} as const;

export const radii = {
  sm: 12,
  field: 16,
  card: 32,
  band: 40,
  pill: 999,
} as const;

export const space = {
  xs: 8,
  sm: 14,
  md: 22,
  lg: 34,
  xl: 56,
  xxl: 76,
} as const;

export const layout = {
  maxWidth: 1160,
  gutterDesktop: 40,
  gutterMobile: 20,
  // Below this the site switches to the single-column phone layout.
  breakpoint: 900,
  // Between these the grid drops to two columns but keeps desktop type.
  breakpointWide: 1120,
} as const;
