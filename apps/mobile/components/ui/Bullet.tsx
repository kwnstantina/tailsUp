// =============================================================================
// Bullet — a ticked list item
//
// Used for "what you leave with" style lists, where a plain dot reads as filler
// and a tick reads as a promise. The tick sits in its own View nudged down 4px
// so it lines up with the first line's x-height rather than its box top.
// =============================================================================

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFallback, type } from '../../lib/theme';
import { IconCheck } from './Icons';

export function Bullet({
  children,
  color = colors.text,
  tickColor = colors.primary,
}: {
  children: ReactNode;
  color?: string;
  tickColor?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.tick}>
        <IconCheck size={18} color={tickColor} />
      </View>
      <Text style={[styles.text, fontFallback.body, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
  },
  tick: {
    marginTop: 4,
  },
  text: {
    ...type.body,
    flex: 1,
  },
});
