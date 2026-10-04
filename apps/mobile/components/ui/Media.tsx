// =============================================================================
// Media — photo slots and the wave divider
//
// A photo slot shows the REAL photograph when `lib/photos.ts` has one for its
// slot, and a deliberately OBVIOUS marked frame when it does not. The empty
// frame is honest; stock photos of other people's dogs would be exactly the
// wrong first impression for a practice whose pitch is "proof, not promises".
// Either way the `label` is the accessible description, so a slot needs no page
// change when its photograph arrives — only a `require` in photos.ts.
// =============================================================================

import Svg, { Path } from 'react-native-svg';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fontFallback, fonts, radii, type } from '../../lib/theme';
import { IconCamera, IconPerson } from './Icons';
import { TINTS, type Tint } from './tints';

/**
 * A rectangular photo slot — hero and section imagery. Pass `source` (from
 * `lib/photos.ts`) and it renders the photograph; leave it null and it renders
 * the marked frame. `label` is the accessible description in both cases.
 */
export function PhotoPlaceholder({
  label,
  height,
  tint = 'peach',
  kind = 'photo',
  style,
  source,
}: {
  label: string;
  height: number;
  tint?: Tint;
  kind?: 'photo' | 'portrait';
  style?: StyleProp<ViewStyle>;
  source?: ImageSourcePropType | null;
}) {
  const ink = tint === 'mint' ? colors.primary : colors.accent;

  if (source) {
    return (
      <Image
        source={source}
        accessible
        accessibilityLabel={label}
        // `cover` + a fixed height: the frame's proportions are the layout's to
        // decide, not the photographer's. Portraits are cropped to the same
        // rounded rectangle as everything else.
        resizeMode="cover"
        // Cast: `style` is typed for the placeholder's View; RN's ImageStyle
        // rejects ViewStyle's `overflow: 'scroll'`, which no caller passes.
        style={[styles.photo, { height }, style] as StyleProp<ImageStyle>}
      />
    );
  }

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
  source,
}: {
  name: string;
  caption: string;
  tint: Tint;
  source?: ImageSourcePropType | null;
}) {
  const ink = TINTS[tint].iconInk;
  return (
    <View style={styles.circleWrap}>
      {source ? (
        // The ROUND SHAPE lives on the wrapper, not the Image: react-native-web
        // stamps an inline `height` equal to the file's intrinsic height onto an
        // Image with no explicit one, which beats `aspectRatio` and stretched
        // these into tall pills. The wrapper owns the square; the image fills it.
        <View
          accessible
          accessibilityLabel={`${name} — ${caption}`}
          style={[styles.circle, styles.circleClip]}
        >
          <Image source={source} resizeMode="cover" style={styles.circleImage} />
        </View>
      ) : (
        <View
          accessible
          accessibilityLabel={`Photo — ${name}`}
          style={[styles.circle, styles.circleEmpty, { backgroundColor: TINTS[tint].bg }]}
        >
          <Text style={[styles.circleTag, fontFallback.body, { color: ink }]}>[PHOTO]</Text>
        </View>
      )}
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
  // A real photograph keeps the frame's radius and width but has none of its
  // dashed outline or centring — it fills the slot edge to edge.
  photo: {
    width: '100%',
    borderRadius: 36,
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
    // Capped, because the strip's column width is set by how MANY dogs are in
    // it — three across a 1160px page would otherwise render 370px heads.
    maxWidth: 260,
    aspectRatio: 1,
    borderRadius: radii.pill,
  },
  circleClip: {
    overflow: 'hidden',
  },
  circleImage: {
    width: '100%',
    height: '100%',
  },
  circleEmpty: {
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
