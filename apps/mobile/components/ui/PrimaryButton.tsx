// =============================================================================
// PrimaryButton — deep-green CTA (DS-4.1)
//
// Green bg → primarySoft on hover/pressed; off-white text; radius 6;
// padding 13/28. Visible copper focus ring (the portable `focused` branch).
// `loading` shows an ActivityIndicator and blocks onPress; `disabled`/`loading`
// → opacity 0.6. Web gets cursor:pointer.
// =============================================================================

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFallback, radii, type } from '../../lib/theme';

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
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
        (hovered || pressed) && styles.hover,
        focused && styles.focused,
        blocked && styles.blocked,
        Platform.select({ web: { cursor: blocked ? 'default' : 'pointer' } as object, default: {} }),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.bg} />
      ) : (
        <Text style={[styles.label, fontFallback.body]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.primary,
    borderRadius: radii.base,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    // Reserve the focus-ring border width so layout doesn't shift on focus.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  hover: {
    backgroundColor: colors.primarySoft,
  },
  focused: {
    borderColor: colors.accent, // visible copper focus ring (quality floor)
  },
  blocked: {
    opacity: 0.6,
  },
  label: {
    ...type.body,
    color: colors.bg,
    letterSpacing: 0.2,
  },
});
