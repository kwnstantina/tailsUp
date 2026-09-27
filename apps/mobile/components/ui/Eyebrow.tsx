// =============================================================================
// Eyebrow — the paw mark plus a small uppercase label, above every heading
//
// The paw is the brand's repeating device, so the eyebrow leads with it rather
// than the label sitting alone. It renders as a ROW with `alignSelf:
// flex-start` so it never stretches to fill a column parent.
//
// The label uses the TEXT-SAFE orange (colors.accent, 4.6:1); the paw may use
// the bright fill colour, because it is a shape and not copy. `onDark` switches
// both to the light peach so they stay legible on the deep-green band, and
// `color` / `pawColor` override either one for a tinted card.
// =============================================================================

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFallback, space, type } from '../../lib/theme';
import { Paw } from './Icons';

export function Eyebrow({
  children,
  onDark = false,
  /** Override the label colour — e.g. the highlighter peach inside a band. */
  color,
  /** Override the paw fill independently of the label. */
  pawColor,
}: {
  children: ReactNode;
  onDark?: boolean;
  color?: string;
  pawColor?: string;
}) {
  const labelColor = color ?? (onDark ? colors.accentSoft : colors.accent);
  const paw = pawColor ?? (onDark ? colors.accentSoft : colors.accentBright);
  return (
    <View style={styles.row}>
      <Paw size={20} color={paw} />
      <Text style={[styles.eyebrow, fontFallback.body, { color: labelColor }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    marginBottom: space.xs,
  },
  eyebrow: {
    ...type.eyebrow,
  },
});
