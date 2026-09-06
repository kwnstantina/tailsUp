// Responsive helper. The site is one Expo codebase serving phones, tablets and
// the web (NFR-7), so every layout decision reads from window width rather than
// from Platform — a narrow browser window must lay out like a phone.

import { useWindowDimensions } from 'react-native';
import { layout, type } from './tokens';

export type Breakpoint = 'phone' | 'wide' | 'desktop';

export interface Responsive {
  bp: Breakpoint;
  /** True below 900px — the single-column layout. */
  isPhone: boolean;
  /** Horizontal page padding for the current width. */
  gutter: number;
  /**
   * Pick the desktop or phone value from a `type` scale entry, or from any
   * [desktop, phone] tuple.
   */
  t: (pair: readonly [number, number]) => number;
  /** Columns for a card grid that wants `desktopCols` when there is room. */
  cols: (desktopCols: number) => number;
}

export function useBreakpoint(): Responsive {
  const { width } = useWindowDimensions();

  // During the static web export there is no window, so RN Web reports width 0.
  // Treat that as desktop rather than as the narrowest phone: the pre-rendered
  // HTML is what crawlers and link previews read, and it should carry the full
  // desktop layout. Real widths are always > 0, so this only affects SSG.
  const isPhone = width > 0 && width < layout.breakpoint;
  const bp: Breakpoint = isPhone
    ? 'phone'
    : width < layout.breakpointWide
      ? 'wide'
      : 'desktop';

  return {
    bp,
    isPhone,
    gutter: isPhone ? layout.gutterMobile : layout.gutterDesktop,
    t: (pair) => (isPhone ? pair[1] : pair[0]),
    cols: (desktopCols) => (isPhone ? 1 : bp === 'wide' ? Math.min(2, desktopCols) : desktopCols),
  };
}

/**
 * Convenience: the full text style for a scale entry at the current width.
 * `const r = useBreakpoint(); <Text style={textStyle(r, 'h2')}>`
 */
export function textStyle(r: Responsive, key: keyof typeof type) {
  const entry = type[key];
  return {
    fontSize: r.t(entry.size),
    lineHeight: r.t(entry.lineHeight),
  };
}
