// Page scaffolding: the centred column, full-bleed sections, and the simple
// responsive grid the cards sit in.

import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, space } from '../design/tokens';
import { useBreakpoint } from '../design/useBreakpoint';

interface ContainerProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** The 1160px centred column with the right gutter for this width. */
export function Container({ children, style }: ContainerProps) {
  const r = useBreakpoint();
  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: layout.maxWidth,
          alignSelf: 'center',
          paddingHorizontal: r.gutter,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface SectionProps {
  children: ReactNode;
  /** Full-bleed background behind the centred column. */
  background?: string;
  /** Vertical rhythm. `tight` for stacked bands, `none` to control it yourself. */
  spacing?: 'none' | 'tight' | 'normal' | 'loose';
  style?: StyleProp<ViewStyle>;
}

const SECTION_PADDING: Record<NonNullable<SectionProps['spacing']>, [number, number]> = {
  none: [0, 0],
  tight: [space.lg, space.md],
  normal: [space.xxl, space.xl],
  loose: [space.xxl + 20, space.xl],
};

export function Section({
  children,
  background = 'transparent',
  spacing = 'normal',
  style,
}: SectionProps) {
  const r = useBreakpoint();
  const [desktop, phone] = SECTION_PADDING[spacing];
  return (
    <View style={[{ backgroundColor: background, paddingVertical: r.isPhone ? phone : desktop }, style]}>
      <Container>{children}</Container>
    </View>
  );
}

interface GridProps {
  children: ReactNode;
  /** Gap between items, both axes. */
  gap?: number;
  /** Vertically align the row's items. Cards want 'stretch'. */
  align?: ViewStyle['alignItems'];
  style?: StyleProp<ViewStyle>;
}

/**
 * Equal-width columns on anything wider than a phone, a plain stack below it.
 * Children each take `flex: 1`, so no percentage maths and no wrapping edge
 * cases — the site never has more than five items in a row.
 */
export function Grid({ children, gap = space.md, align = 'stretch', style }: GridProps) {
  const r = useBreakpoint();
  return (
    <View
      style={[
        {
          flexDirection: r.isPhone ? 'column' : 'row',
          alignItems: r.isPhone ? 'stretch' : align,
          gap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** One cell of a Grid. `weight` widens a column relative to its siblings. */
export function Col({
  children,
  weight = 1,
  /** Fixed width on desktop instead of a flexible share (sidebars). */
  width,
  style,
}: {
  children: ReactNode;
  weight?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const r = useBreakpoint();
  if (!r.isPhone && width != null) {
    return <View style={[{ width, flexGrow: 0, flexShrink: 0 }, style]}>{children}</View>;
  }
  return <View style={[{ flex: r.isPhone ? undefined : weight, minWidth: 0 }, style]}>{children}</View>;
}

/** A vertical stack with a consistent gap — the most common layout on the site. */
export function Stack({
  children,
  gap = space.sm,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** A horizontal run that wraps — sticker rows, footer link groups. */
export function Wrap({
  children,
  gap = space.sm,
  justify = 'flex-start',
  style,
}: {
  children: ReactNode;
  gap?: number;
  justify?: ViewStyle['justifyContent'];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap, justifyContent: justify },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A hairline divider on light backgrounds. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 1, backgroundColor: colors.fieldBorder, width: '100%' }, style]} />
  );
}
