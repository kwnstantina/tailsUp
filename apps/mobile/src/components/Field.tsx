// Form controls for the two public forms.
//
// Deliberately built from RN primitives rather than a native <select>: the same
// components have to render on iOS, Android and the web, and a row of tappable
// chips is both easier to hit on a phone and easier to make accessible than a
// picker.

import { useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radii, space } from '../design/tokens';
import { Body, Label, Small } from './Type';
import { IconCheck, IconInfo } from './Icons';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  /** Shown small and muted to the right of the label. */
  hint?: string;
  multiline?: boolean;
  numberOfLines?: number;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: 'name' | 'email' | 'tel' | 'off';
  textContentType?: 'name' | 'emailAddress' | 'telephoneNumber' | 'none';
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  multiline = false,
  numberOfLines = 4,
  error,
  keyboardType,
  autoComplete = 'off',
  textContentType = 'none',
  maxLength,
  style,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.fieldBorderFocus
      : colors.fieldBorder;

  return (
    <View style={[{ gap: 8 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.xs }}>
        <Label>{label}</Label>
        {hint ? <Small>{hint}</Small> : null}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : undefined}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        textContentType={textContentType}
        maxLength={maxLength}
        accessibilityLabel={label}
        style={{
          minHeight: multiline ? 112 : 56,
          borderRadius: radii.field,
          borderWidth: 2,
          borderColor,
          backgroundColor: colors.bg,
          paddingHorizontal: 18,
          paddingVertical: multiline ? 16 : 0,
          fontFamily: fonts.body,
          fontSize: 16.5, // 16+ so mobile Safari never zooms on focus
          lineHeight: multiline ? 26 : undefined,
          color: colors.text,
        }}
      />

      {error ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <IconInfo size={16} color={colors.danger} />
          <Small color={colors.danger}>{error}</Small>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ Choice chips */

interface ChoiceChipsProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (next: T) => void;
  error?: string;
  hint?: string;
}

/** A single-select row of pills. Used for the lead form's `source`. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
}: ChoiceChipsProps<T>) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.xs }}>
        <Label>{label}</Label>
        {hint ? <Small>{hint}</Small> : null}
      </View>

      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option}
              onPress={() => onChange(option)}
              style={({ pressed }) => ({
                minHeight: 46,
                justifyContent: 'center',
                paddingHorizontal: 20,
                borderRadius: radii.pill,
                borderWidth: 2,
                borderColor: selected ? colors.primary : colors.fieldBorder,
                backgroundColor: selected
                  ? colors.mintSoft
                  : pressed
                    ? colors.bgAlt
                    : colors.bg,
              })}
            >
              <Label color={selected ? colors.primary : colors.text}>{option}</Label>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <IconInfo size={16} color={colors.danger} />
          <Small color={colors.danger}>{error}</Small>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ Option cards */

export interface OptionCard<T extends string> {
  value: T;
  title: string;
  meta: string;
}

/** The big selectable cards for the booking form's session type. */
export function OptionCards<T extends string>({
  options,
  value,
  onChange,
  isPhone,
}: {
  options: OptionCard<T>[];
  value: T;
  onChange: (next: T) => void;
  isPhone: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: isPhone ? 'column' : 'row', gap: 14 }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.title}, ${option.meta}`}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              flex: isPhone ? undefined : 1,
              minHeight: 96,
              borderRadius: 20,
              borderWidth: selected ? 3 : 2,
              borderColor: selected ? colors.primary : colors.fieldBorder,
              backgroundColor: selected
                ? colors.mintSoft
                : pressed
                  ? colors.bgAlt
                  : colors.bg,
              padding: 20,
              gap: 7,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Label style={{ fontSize: 16.5, flex: 1 }}>{option.title}</Label>
              {selected ? (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radii.pill,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCheck size={14} color={colors.onDark} />
                </View>
              ) : null}
            </View>
            <Small>{option.meta}</Small>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------- Form notes */

/** A whole-form failure — network down, server error, validation rejected. */
export function FormError({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
        backgroundColor: colors.coralSoft,
        borderRadius: radii.field,
        padding: 18,
      }}
    >
      <View style={{ marginTop: 2 }}>
        <IconInfo size={20} color={colors.danger} />
      </View>
      <Body color={colors.textOnCoral} style={{ flex: 1 }}>
        {message}
      </Body>
    </View>
  );
}

/** The post-submit confirmation that replaces the form. */
export function FormSuccess({ title, body }: { title: string; body: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.mintSoft,
        borderRadius: radii.card,
        padding: 34,
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.pill,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCheck size={28} color={colors.onDark} />
      </View>
      <Label style={{ fontSize: 22, fontFamily: fonts.displaySemiBold }}>{title}</Label>
      <Body color={colors.textOnMint}>{body}</Body>
    </View>
  );
}
