// =============================================================================
// Section — full-bleed vertical-rhythm wrapper + centered Container
//
// The playful site alternates cream / peach bands and drops a Wave between the
// ones that need a soft seam, so a Section has to take an ARBITRARY background
// as well as the two named ones — `alt` and `dark` are kept as the shorthands
// the existing pages already use.
//
// `spacing` controls the rhythm: 'normal' is the default section, 'tight' for a
// band that sits directly under another (a sticker run under the hero), 'loose'
// for the page's one big moment, and 'none' when the page owns its own padding.
// =============================================================================

import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, space, useResponsive } from '../../lib/theme';
import { Container } from './Container';

export type SectionSpacing = 'none' | 'tight' | 'normal' | 'loose';

// [wide, narrow] vertical padding per rhythm step.
const PADDING: Record<SectionSpacing, [number, number]> = {
  none: [0, 0],
  tight: [space.lg, space.md],
  normal: [space.xxl, space.xl],
  loose: [space.xxl + 20, space.xl + 10],
};

export function Section({
  children,
  alt = false,
  dark = false,
  /** Any other band colour — wins over `alt`/`dark` when given. */
  background,
  spacing = 'normal',
  prose = false,
  maxWidth,
  /** Render children full-bleed (no inner Container). */
  bleed = false,
  style,
}: {
  children: ReactNode;
  alt?: boolean;
  dark?: boolean;
  background?: string;
  spacing?: SectionSpacing;
  prose?: boolean;
  maxWidth?: number;
  bleed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { isWide } = useResponsive();
  const [wide, narrow] = PADDING[spacing];
  const bg = background ?? (dark ? colors.primarySoft : alt ? colors.bgAlt : colors.bg);

  return (
    <View
      style={[{ backgroundColor: bg, paddingVertical: isWide ? wide : narrow, width: '100%' }, style]}
    >
      {bleed ? (
        children
      ) : (
        <Container prose={prose} maxWidth={maxWidth}>
          {children}
        </Container>
      )}
    </View>
  );
}
