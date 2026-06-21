// =============================================================================
// Section — full-bleed vertical-rhythm wrapper + centered Container (DS-4.5)
//
// Vertical padding space.xl (narrow) → space.xxl (lg). `alt` = bgAlt background,
// `dark` = deep-green proof-band surface. Wraps its content in a centered
// Container by default. Alternate bg/bgAlt between adjacent sections for quiet
// separation (no borders needed).
// =============================================================================

import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, useResponsive } from '../../lib/theme';
import { Container } from './Container';

export function Section({
  children,
  alt = false,
  dark = false,
  prose = false,
  maxWidth,
  /** Set true to render children full-bleed (no inner Container). */
  bleed = false,
  style,
}: {
  children: React.ReactNode;
  alt?: boolean;
  dark?: boolean;
  prose?: boolean;
  maxWidth?: number;
  bleed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { sectionPadV } = useResponsive();
  const background = dark ? colors.primary : alt ? colors.bgAlt : colors.bg;

  return (
    <View style={[{ backgroundColor: background, paddingVertical: sectionPadV, width: '100%' }, style]}>
      {bleed ? children : <Container prose={prose} maxWidth={maxWidth}>{children}</Container>}
    </View>
  );
}
