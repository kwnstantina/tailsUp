// =============================================================================
// PrimaryButton — the filled CTA
//
// Bright orange bg with DARK text, pill radius, 60px tall. The dark label is
// not a style choice: #2B3A31 on #EF9440 clears 5.1:1, while off-white on the
// same orange is 2.0:1 and fails outright. Never flip the label to light.
//
// `tone="green"` is the quieter filled button used INSIDE a tinted card, where
// an orange fill would fight the card's own tint; it is off-white on deep green
// (8.9:1), so that one does take a light label.
//
// Hover/pressed deepens the fill. Focus ring uses the text-safe `accent` (the
// portable `focused` branch). `loading` shows an ActivityIndicator and blocks
// onPress; `disabled`/`loading` → opacity 0.6. Web gets cursor:pointer.
// =============================================================================

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFallback, fonts, radii, type } from '../../lib/theme';

type Tone = 'orange' | 'green';

const TONES: Record<Tone, { bg: string; hover: string; label: string }> = {
  orange: { bg: colors.accentBright, hover: '#DE8330', label: colors.text },
  green: { bg: colors.primary, hover: colors.primarySoft, label: colors.onDark },
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'orange',
  size = 'default',
  /** Stretch to the container's width — the phone default for a page CTA. */
  block = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: Tone;
  size?: 'default' | 'small';
  block?: boolean;
}) {
  const blocked = disabled || loading;
  const t = TONES[tone];
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
          backgroundColor: hovered || pressed ? t.hover : t.bg,
          minHeight: small ? 46 : 60, // both clear the 44px touch-target floor
          paddingVertical: small ? 10 : 16,
          paddingHorizontal: small ? 22 : 32,
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        focused && styles.focused,
        blocked && styles.blocked,
        Platform.select({ web: { cursor: blocked ? 'default' : 'pointer' } as object, default: {} }),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.label} />
      ) : (
        <Text
          style={[
            styles.label,
            fontFallback.body,
            { color: t.label, fontSize: small ? 15.5 : 18 },
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
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Reserve the focus-ring border width so layout doesn't shift on focus.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focused: {
    borderColor: colors.accent, // visible focus ring (quality floor)
  },
  blocked: {
    opacity: 0.6,
  },
  label: {
    ...type.body,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
  },
});
