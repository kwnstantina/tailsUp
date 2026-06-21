// =============================================================================
// Container — centered content column (DS-4.5)
//
// width 100%, capped at layout.maxWidth (or maxProse for reading-width text),
// centered, with horizontal padding. The inner half of the Section rhythm.
// =============================================================================

import { View, type StyleProp, type ViewStyle } from 'react-native';
import { layout, space } from '../../lib/theme';

export function Container({
  children,
  prose = false,
  maxWidth,
  style,
}: {
  children: React.ReactNode;
  /** Use the reading-width column (720) for long copy. */
  prose?: boolean;
  /** Explicit cap; overrides `prose`/default. */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const cap = maxWidth ?? (prose ? layout.maxProse : layout.maxWidth);
  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: cap,
          alignSelf: 'center',
          paddingHorizontal: space.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
