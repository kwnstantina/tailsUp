// =============================================================================
// Highlight — the highlighter mark behind one word of a headline
//
// React Native cannot reliably paint a rotated box behind an inline run of
// text: there is no inline-block, and a nested <Text> with a backgroundColor
// draws a square, unrotated rectangle that clips its own descenders on web.
//
// So the headline line is composed as a ROW instead — the marked word lives in
// its own filled, rotated View and the rest of the line follows it. That is why
// headline copy in the playful pages is passed as separate pieces rather than
// one string, and why `HeadlineRow` exists to keep the baselines aligned.
// =============================================================================

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../lib/theme';

export function Highlight({ children }: { children: ReactNode }) {
  return <View style={styles.mark}>{children}</View>;
}

/**
 * One line of a composed headline: lays its pieces out in a row that wraps, so
 * a long Greek word still breaks to the next line instead of overflowing.
 * `alignItems: center` keeps the marked word's box centred on the plain words
 * either side of it.
 */
export function HeadlineRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.highlight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    transform: [{ rotate: '-1.4deg' }],
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
});
