// =============================================================================
// PracticeMap (NATIVE) — card + "Open in Maps" deep link (DS / D-3, Topic 5)
//
// Native has no <iframe>; this honest fallback is a Card with the location and a
// Pressable that opens the OSM location via `Linking`. Metro picks this file on
// iOS/Android; the `.web.tsx` sibling shows the real embed on web (the primary
// verification surface). Generic Athens coords placeholder (D-9).
// =============================================================================

import { Linking, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radii, space, type } from '../lib/theme';

const LAT = 37.9838;
const LON = 23.7275;

export interface PracticeMapProps {
  lat?: number;
  lon?: number;
  label?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function PracticeMap({ lat = LAT, lon = LON, label, height = 320, style }: PracticeMapProps) {
  const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;

  return (
    <View style={[styles.card, { minHeight: height }, style]}>
      <View style={styles.pin}>
        <Text style={styles.pinGlyph}>📍</Text>
      </View>
      <Text style={styles.title}>{label ?? 'TailsUp'}</Text>
      <Text style={styles.coords}>
        {lat.toFixed(4)}, {lon.toFixed(4)}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void Linking.openURL(url)}
        style={({ hovered, focused, pressed }) => [
          styles.button,
          (hovered || pressed) && styles.buttonHover,
          focused && styles.buttonFocused,
          Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
        ]}
      >
        <Text style={styles.buttonText}>Άνοιγμα στους χάρτες · Open in Maps</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  pin: {
    marginBottom: space.xs,
  },
  pinGlyph: {
    fontSize: 32,
  },
  title: {
    ...type.h3,
    color: colors.text,
  },
  coords: {
    ...type.caption,
  },
  button: {
    marginTop: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.base,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonHover: {
    backgroundColor: colors.primarySoft,
  },
  buttonFocused: {
    borderColor: colors.accent,
  },
  buttonText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.bg,
  },
});
