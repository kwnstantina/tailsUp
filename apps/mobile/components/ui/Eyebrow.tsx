// =============================================================================
// Eyebrow — a small copper uppercase label above a heading (DS-4.3)
//
// Copper used here as a small detail (compliant). Sits directly above its
// H2/H3 with a small bottom margin. `onDark` switches to a lighter copper so it
// stays legible on the deep-green proof band.
// =============================================================================

import { StyleSheet, Text } from 'react-native';
import { colors, fontFallback, space, type } from '../../lib/theme';

export function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return <Text style={[styles.eyebrow, fontFallback.body, onDark && styles.onDark]}>{children}</Text>;
}

const styles = StyleSheet.create({
  eyebrow: {
    ...type.eyebrow,
    marginBottom: space.xs,
  },
  onDark: {
    color: colors.accentSoft,
  },
});
