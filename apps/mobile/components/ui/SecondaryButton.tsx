// =============================================================================
// SecondaryButton — quiet outline button (DS-4.2)
//
// Transparent bg → faint border fill on hover; 1px solid primary border;
// primary text. Same radius/padding/focus contract as PrimaryButton.
// `onDark` variant flips colors to read on the deep-green proof band.
//
// Hover fills with the mint wash rather than a grey — in the playful palette a
// neutral hover reads as a disabled state next to all the colour around it.
// =============================================================================

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFallback, fonts, radii, type } from '../../lib/theme';

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  onDark = false,
  size = 'default',
  /** Stretch to the container's width — the phone default for a page CTA. */
  block = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  onDark?: boolean;
  size?: 'default' | 'small';
  block?: boolean;
}) {
  const blocked = disabled || loading;
  const small = size === 'small';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ hovered, focused, pressed }) => [
        styles.base,
        {
          minHeight: small ? 46 : 60,
          paddingVertical: small ? 9 : 16,
          paddingHorizontal: small ? 20 : 30,
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        onDark ? styles.baseDark : styles.baseLight,
        (hovered || pressed) && (onDark ? styles.hoverDark : styles.hoverLight),
        focused && styles.focused,
        blocked && styles.blocked,
        Platform.select({ web: { cursor: blocked ? 'default' : 'pointer' } as object, default: {} }),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={onDark ? colors.bg : colors.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            onDark ? styles.labelDark : styles.labelLight,
            fontFallback.body,
            { fontSize: small ? 15.5 : 18 },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'transparent',
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // 2.5px, not 1px — a hairline outline reads timid next to a filled pill.
    borderWidth: 2.5,
  },
  baseLight: {
    borderColor: colors.primary,
  },
  baseDark: {
    borderColor: colors.bg,
  },
  hoverLight: {
    backgroundColor: colors.mintSoft,
  },
  hoverDark: {
    backgroundColor: 'rgba(250,247,240,0.12)',
  },
  focused: {
    borderColor: colors.accent, // visible focus ring (width already 2.5)
  },
  blocked: {
    opacity: 0.6,
  },
  label: {
    ...type.body,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
  },
  labelLight: {
    color: colors.primary,
  },
  labelDark: {
    color: colors.bg,
  },
});
