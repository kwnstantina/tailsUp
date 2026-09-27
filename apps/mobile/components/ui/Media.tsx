// =============================================================================
// Media — photo slots and the wave divider
//
// The photo slots are deliberately OBVIOUS placeholders rather than stock
// imagery. A marked empty frame is honest; stock photos of other people's dogs
// would be exactly the wrong first impression for a practice whose pitch is
// "proof, not promises". Each carries an accessibilityLabel describing the
// photo that belongs there, so dropping a real <Image> in later changes markup
// and nothing else.
// =============================================================================

import Svg, { Path } from 'react-native-svg';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFallback, fonts, radii, type } from '../../lib/theme';
import { IconCamera, IconPerson } from './Icons';
import { TINTS, type Tint } from './tints';

/** A rectangular photo slot — hero and section imagery. */
export function PhotoPlaceholder({
  label,
  height,
  tint = 'peach',
  kind = 'photo',
  style,
}: {
  label: string;
  height: number;
  tint?: Tint;
  kind?: 'photo' | 'portrait';
  style?: StyleProp<ViewStyle>;
}) {
  const ink = tint === 'mint' ? colors.primary : colors.accent;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.frame,
        {
          height,
          backgroundColor: TINTS[tint].bg,
          borderColor: tint === 'mint' ? colors.mint : colors.accentBright,
        },
        style,
      ]}
    >
      {kind === 'portrait' ? (
        <IconPerson size={44} color={ink} />
      ) : (
        <IconCamera size={48} color={ink} />
      )}
      <Text style={[styles.frameLabel, fontFallback.body, { color: ink }]}>{label}</Text>
    </View>
  );
}

/** A circular photo slot with a caption — the "dogs we've worked with" strip. */
export function CirclePhoto({
  name,
  caption,
  tint,
}: {
  name: string;
  caption: string;
  tint: Tint;
}) {
  const ink = TINTS[tint].iconInk;
  return (
    <View style={styles.circleWrap}>
      <View
        accessible
        accessibilityLabel={`Photo — ${name}`}
        style={[styles.circle, { backgroundColor: TINTS[tint].bg }]}
      >
        <Text style={[styles.circleTag, fontFallback.body, { color: ink }]}>[PHOTO]</Text>
      </View>
      <View style={styles.circleCaption}>
        <Text style={[styles.circleName, fontFallback.body]}>{name}</Text>
        <Text style={[styles.circleSub, fontFallback.body]}>{caption}</Text>
      </View>
    </View>
  );
}

/**
 * The soft divider between two bands. ONE per transition — used everywhere it
 * stops being a signature and starts being noise.
 *
 * `preserveAspectRatio="none"` is what lets a fixed-height band stretch the
 * path across any width; the wave is decorative so it is also aria-hidden.
 */
export function Wave({ color = colors.bgAlt, height = 64 }: { color?: string; height?: number }) {
  return (
    <View style={{ width: '100%', height }} pointerEvents="none" accessibilityElementsHidden>
      <Svg width="100%" height="100%" viewBox="0 0 1440 64" preserveAspectRatio="none">
        <Path d="M0 34C180 64 360 4 540 26s360 34 540 4 270-24 360-12v46H0z" fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: 36,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  frameLabel: {
    ...type.body,
    fontFamily: fonts.bodySemiBold,
    textAlign: 'center',
  },
  circleWrap: {
    alignItems: 'center',
    gap: 12,
  },
  circle: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  circleTag: {
    ...type.caption,
    fontFamily: fonts.bodySemiBold,
    textAlign: 'center',
  },
  circleCaption: {
    alignItems: 'center',
    gap: 2,
  },
  circleName: {
    ...type.body,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
    fontSize: 17,
  },
  circleSub: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
