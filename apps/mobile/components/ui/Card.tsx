// =============================================================================
// Card — white surface, 0.5px border, radius-lg (DS-4.4)
//
// The 0.5px border IS the separation — no heavy shadow (not premium-calm).
// Default padding space.md; pass `large` for space.lg on bigger cards.
// =============================================================================

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, space } from '../../lib/theme';

export function Card({
  children,
  large = false,
  style,
}: {
  children: React.ReactNode;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, { padding: large ? space.lg : space.md }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, // ~0.5px portable web/native
    borderColor: colors.border,
    borderRadius: radii.lg,
  },
});
