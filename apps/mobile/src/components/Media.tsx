// Image placeholders and the wave divider.
//
// The photo slots are deliberately obvious placeholders rather than stock
// imagery: a marked empty frame is honest, and stock photos of other people's
// dogs would be the wrong first impression for a practice that sells honesty.

import Svg, { Path } from 'react-native-svg';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '../design/tokens';
import { IconCamera, IconPerson } from './Icons';
import { Label, Small } from './Type';
import { TINTS, type Tint } from './Ui';

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
  kind?: 'photo' | 'portrait' | 'map';
  style?: StyleProp<ViewStyle>;
}) {
  const ink = tint === 'mint' ? colors.primary : colors.accentInk;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        {
          width: '100%',
          height,
          borderRadius: 36,
          backgroundColor: TINTS[tint].bg,
          borderWidth: 3,
          borderStyle: 'dashed',
          borderColor: tint === 'mint' ? colors.mint : colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          paddingHorizontal: 24,
        },
        style,
      ]}
    >
      {kind === 'portrait' ? (
        <IconPerson size={44} color={ink} />
      ) : (
        <IconCamera size={48} color={ink} />
      )}
      <Label color={ink} style={{ textAlign: 'center' }}>
        {label}
      </Label>
    </View>
  );
}

/** A circular photo slot with a caption — the "crew" strip. */
export function CirclePhoto({
  name,
  caption,
  tint,
}: {
  name: string;
  caption: string;
  tint: Tint;
}) {
  const ink = tint === 'mint' ? colors.primary : tint === 'coral' ? colors.danger : colors.accentInk;
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View
        accessible
        accessibilityLabel={`Photo of ${name}`}
        style={{
          width: '100%',
          aspectRatio: 1,
          borderRadius: radii.pill,
          backgroundColor: TINTS[tint].bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <Label color={ink} style={{ fontSize: 13, textAlign: 'center' }}>
          [PHOTO]
        </Label>
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Label style={{ fontSize: 17 }}>{name}</Label>
        <Small>{caption}</Small>
      </View>
    </View>
  );
}

/**
 * The soft divider between two bands. One per transition — used everywhere it
 * stops being a signature and starts being noise.
 */
export function Wave({
  color = colors.bgAlt,
  height = 64,
}: {
  color?: string;
  height?: number;
}) {
  return (
    <View style={{ width: '100%', height }} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 1440 64" preserveAspectRatio="none">
        <Path
          d="M0 34C180 64 360 4 540 26s360 34 540 4 270-24 360-12v46H0z"
          fill={color}
        />
      </Svg>
    </View>
  );
}
