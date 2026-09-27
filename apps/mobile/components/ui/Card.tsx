// =============================================================================
// Card — the tinted surface of the playful direction
//
// Cards rotate through mint / peach / coral rather than all being white (see
// tints.ts). The tint carries the separation, so a TINTED card has no border;
// only the white card keeps a hairline, because white-on-cream needs an edge.
//
// Copy inside a tinted card must use that tint's ink — `TINTS[tint].ink`, or
// the `ink` render-prop below — never `colors.textMuted`, which is only
// contrast-checked against the page background.
//
// Padding is responsive: 26 on a phone, 34 above the break. `large` is kept for
// the pages that already ask for it and now means "the roomier of the two".
// =============================================================================

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, useResponsive } from '../../lib/theme';
import { TINTS, type Tint } from './tints';

export function Card({
  children,
  tint = 'white',
  large = false,
  /** Explicit padding, overriding the responsive default. */
  padding,
  style,
}: {
  children: ReactNode;
  tint?: Tint;
  large?: boolean;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { isWide } = useResponsive();
  const pad = padding ?? (isWide ? (large ? 34 : 28) : large ? 28 : 24);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: TINTS[tint].bg, padding: pad },
        // Only the white card needs an edge — a tint already separates itself.
        tint === 'white' && styles.bordered,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth, // ~0.5px portable web/native
    borderColor: colors.border,
  },
});
