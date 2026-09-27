// =============================================================================
// Sticker — a trust claim as a slightly rotated pill
//
// The run of stickers under the hero is the direction's loudest cheap trick and
// the one that most needs restraint: rotation stays within ±2°. Past that it
// stops reading as deliberate and starts reading as a broken layout.
//
// Copy sits on a tint, so the label takes the tint's own ink (see tints.ts) —
// never `textMuted`, which is only checked against the page background.
// =============================================================================

import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFallback, fonts, radii, type } from '../../lib/theme';
import { TINTS, type Tint } from './tints';
import { IconCheck } from './Icons';

export function Sticker({
  label,
  tint = 'white',
  /** Degrees of tilt. Clamped to ±2 — see the note above. */
  rotate = 0,
  /** Prefix the label with a tick. Used for the claims that are guarantees. */
  tick = false,
}: {
  label: string;
  tint?: Tint;
  rotate?: number;
  tick?: boolean;
}) {
  const t = TINTS[tint];
  const tilt = Math.max(-2, Math.min(2, rotate));
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: t.bg, transform: [{ rotate: `${tilt}deg` }] },
      ]}
    >
      {tick ? <IconCheck size={18} color={colors.primary} /> : null}
      <Text style={[styles.label, fontFallback.body, { color: t.ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    paddingVertical: 11,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  label: {
    ...type.body,
    fontFamily: fonts.bodySemiBold,
  },
});
