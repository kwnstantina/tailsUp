// =============================================================================
// Field — a labelled TextInput with visible focus and an inline error
//
// Both public forms (contact + booking) carried their own copy of this. One
// component instead, so the focus ring, the error colour and the rounded field
// shape can only ever be defined once.
//
// Focus is drawn as a 2px BRIGHT-orange border with a -1 margin, so the ring
// appears without the field jumping a pixel. On web the UA outline is removed —
// we draw our own, which is the only reason removing it is acceptable.
//
// The error colour is `danger`, not the accent orange: an error that is the
// same colour as every eyebrow on the page does not read as an error.
// =============================================================================

import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFallback, fonts, radii, type } from '../../lib/theme';

export function Field({
  label,
  error,
  multiline = false,
  containerStyle,
  ...inputProps
}: {
  label: string;
  error?: string;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
} & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={[styles.label, fontFallback.body]}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={colors.placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.multiline,
          fontFallback.body,
          focused && styles.focused,
          error != null && styles.errored,
          Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
        ]}
      />
      {error != null && <Text style={[styles.error, fontFallback.body]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 7,
  },
  label: {
    ...type.body,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.fieldBorder,
    borderRadius: radii.base,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 52, // comfortable tap target, and it matches the small button
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  focused: {
    borderColor: colors.accentBright,
  },
  errored: {
    borderColor: colors.danger,
  },
  error: {
    ...type.caption,
    color: colors.danger,
  },
});
