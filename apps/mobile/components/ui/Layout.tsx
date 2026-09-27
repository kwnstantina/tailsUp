// =============================================================================
// Layout — Grid / Col / Stack / Wrap / Divider
//
// The playful pages are built from rows of tinted cards, sticker runs and
// two-column splits. Doing that with a per-page StyleSheet meant every page
// carrying the same six `flexDirection` style pairs; these primitives replace
// them, and they are the only place the column→stack breakpoint is decided.
//
// `Grid` gives each child `flex: 1` rather than a percentage, so there is no
// wrapping edge case — the site never puts more than four cards in a row.
// =============================================================================

import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, space, useResponsive } from '../../lib/theme';

/**
 * Equal-width columns above the `md` break, a plain stack below it.
 * `align="stretch"` (the default) is what a row of cards wants, so that the
 * shortest card still reaches the bottom of the row.
 */
export function Grid({
  children,
  gap = space.md,
  align = 'stretch',
  /** Keep the row direction even on a phone (short items, e.g. a 2-up stat row). */
  keepRow = false,
  style,
}: {
  children: ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  keepRow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { isWide } = useResponsive();
  const row = isWide || keepRow;
  return (
    <View
      style={[
        {
          flexDirection: row ? 'row' : 'column',
          alignItems: row ? align : 'stretch',
          gap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** One cell of a Grid. `weight` widens a column relative to its siblings. */
export function Col({
  children,
  weight = 1,
  /** A fixed width above the break instead of a flexible share (sidebars). */
  width,
  style,
}: {
  children: ReactNode;
  weight?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { isWide } = useResponsive();
  if (isWide && width != null) {
    return <View style={[{ width, flexGrow: 0, flexShrink: 0 }, style]}>{children}</View>;
  }
  // minWidth:0 lets a long unbroken word shrink rather than blow the row out.
  return (
    <View style={[{ flex: isWide ? weight : undefined, minWidth: 0 }, style]}>{children}</View>
  );
}

/** A vertical stack with one consistent gap — the commonest layout on the site. */
export function Stack({
  children,
  gap = space.sm,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** A horizontal run that wraps — sticker rows, footer link groups, chip lists. */
export function Wrap({
  children,
  gap = space.sm,
  justify = 'flex-start',
  style,
}: {
  children: ReactNode;
  gap?: number;
  justify?: ViewStyle['justifyContent'];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap,
          justifyContent: justify,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A warm hairline on light backgrounds. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, width: '100%', backgroundColor: colors.fieldBorder }, style]} />;
}
