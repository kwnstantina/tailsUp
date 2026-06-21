// =============================================================================
// SecondaryButton — quiet outline button (DS-4.2)
//
// Transparent bg → faint border fill on hover; 1px solid primary border;
// primary text. Same radius/padding/focus contract as PrimaryButton.
// `onDark` variant flips colors to read on the deep-green proof band.
// =============================================================================

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFallback, radii, type } from '../../lib/theme';

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  onDark = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  onDark?: boolean;
}) {
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ hovered, focused, pressed }) => [
        styles.base,
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
        <Text style={[styles.label, onDark ? styles.labelDark : styles.labelLight, fontFallback.body]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'transparent',
    borderRadius: radii.base,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  baseLight: {
    borderColor: colors.primary,
  },
  baseDark: {
    borderColor: colors.bg,
  },
  hoverLight: {
    backgroundColor: colors.border,
  },
  hoverDark: {
    backgroundColor: 'rgba(250,247,240,0.12)',
  },
  focused: {
    borderWidth: 2,
    borderColor: colors.accent, // visible copper focus ring
  },
  blocked: {
    opacity: 0.6,
  },
  label: {
    ...type.body,
    letterSpacing: 0.2,
  },
  labelLight: {
    color: colors.primary,
  },
  labelDark: {
    color: colors.bg,
  },
});
