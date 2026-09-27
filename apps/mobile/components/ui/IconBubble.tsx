// =============================================================================
// IconBubble — the white circle an icon sits in at the top of a tinted card
//
// On a tinted card the icon needs its own ground or it reads as a smudge on the
// fill. The bubble is always `surface` white, whatever the card's tint.
// =============================================================================

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors, radii } from '../../lib/theme';

export function IconBubble({ children, size = 62 }: { children: ReactNode; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
