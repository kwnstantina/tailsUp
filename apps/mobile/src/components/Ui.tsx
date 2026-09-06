// Buttons, cards, stickers and the highlighter mark — the pieces that carry
// the playful direction.

import type { ReactNode } from 'react';
import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radii, space } from '../design/tokens';
import { useBreakpoint } from '../design/useBreakpoint';
import { Body, EyebrowText, Label } from './Type';
import { IconCheck, Paw } from './Icons';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'green' | 'ghostOnDark';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  href?: Href;
  variant?: ButtonVariant;
  size?: 'default' | 'small';
  /** Stretch to the container's width — the phone default for primary CTAs. */
  block?: boolean;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS: Record<
  ButtonVariant,
  { bg: string; pressedBg: string; label: string; border?: string }
> = {
  // Orange with DARK text: 5.1:1, and it makes the CTA the loudest thing on
  // the page without needing a heavier weight.
  primary: { bg: colors.accent, pressedBg: '#DE8330', label: colors.text },
  secondary: {
    bg: 'transparent',
    pressedBg: colors.mintSoft,
    label: colors.primary,
    border: colors.primary,
  },
  green: { bg: colors.primary, pressedBg: colors.primaryDeep, label: colors.onDark },
  ghostOnDark: {
    bg: 'transparent',
    pressedBg: 'rgba(255,252,245,0.12)',
    label: colors.onDark,
    border: 'rgba(255,252,245,0.45)',
  },
};

export function Button({
  label,
  onPress,
  href,
  variant = 'primary',
  size = 'default',
  block = false,
  busy = false,
  disabled = false,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const height = size === 'small' ? 46 : 60;
  const inactive = disabled || busy;

  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      style={({ pressed }) => [
        {
          height,
          minHeight: 44, // never below the touch-target floor
          borderRadius: radii.pill,
          paddingHorizontal: size === 'small' ? 22 : 32,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.xs,
          backgroundColor: pressed && !inactive ? v.pressedBg : v.bg,
          borderWidth: v.border ? 2.5 : 0,
          borderColor: v.border,
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: inactive ? 0.55 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={v.label} /> : null}
      <Label
        color={v.label}
        style={{ fontSize: size === 'small' ? 15.5 : 18, fontFamily: fonts.bodyBold }}
      >
        {label}
      </Label>
    </Pressable>
  );

  // A real anchor on the web: right-click, middle-click and crawlers all work.
  // Nothing is passed to Link but `href` — with `asChild` it clones the child,
  // so any style here would replace the Pressable's own (function) style rather
  // than merge with it. `block` is already handled by alignSelf on the Pressable.
  if (href && !inactive) {
    return (
      <Link href={href} asChild>
        {button}
      </Link>
    );
  }
  return button;
}

/* -------------------------------------------------------------------- Card */

export type Tint = 'mint' | 'peach' | 'coral' | 'white' | 'highlight';

export const TINTS: Record<Tint, { bg: string; ink: string; iconInk: string }> = {
  mint: { bg: colors.mintSoft, ink: colors.textOnMint, iconInk: colors.primary },
  peach: { bg: colors.accentSoft, ink: colors.textOnPeach, iconInk: colors.accentInk },
  coral: { bg: colors.coralSoft, ink: colors.textOnCoral, iconInk: colors.danger },
  white: { bg: colors.surface, ink: colors.textMuted, iconInk: colors.primary },
  highlight: { bg: colors.highlight, ink: colors.textOnPeach, iconInk: colors.accentInk },
};

export function Card({
  children,
  tint = 'white',
  padding,
  style,
}: {
  children: ReactNode;
  tint?: Tint;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const r = useBreakpoint();
  return (
    <View
      style={[
        {
          backgroundColor: TINTS[tint].bg,
          borderRadius: radii.card,
          padding: padding ?? (r.isPhone ? 26 : 34),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The white circle an icon sits in at the top of a service card. */
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

/* ----------------------------------------------------------------- Sticker */

/**
 * A trust claim as a slightly rotated pill. Rotation stays within ±2° — past
 * that it stops reading as deliberate and starts reading as broken.
 */
export function Sticker({
  label,
  tint = 'white',
  rotate = 0,
  tick = false,
}: {
  label: string;
  tint?: Tint;
  rotate?: number;
  tick?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: TINTS[tint].bg,
        borderRadius: radii.pill,
        paddingVertical: 11,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        transform: [{ rotate: `${rotate}deg` }],
      }}
    >
      {tick ? <IconCheck size={18} color={colors.primary} /> : null}
      <Label>{label}</Label>
    </View>
  );
}

/* --------------------------------------------------------------- Highlight */

/**
 * The highlighter mark behind one word of a headline.
 *
 * React Native can't reliably paint a box behind an inline run of text, so the
 * headline line is composed as a row: the marked word sits in its own rotated,
 * filled View and the rest of the line follows it. That is why headline copy
 * is passed as separate pieces rather than one string.
 */
export function Highlight({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.highlight,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 2,
        transform: [{ rotate: '-1.4deg' }],
        alignSelf: 'flex-start',
      }}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------ Eyebrow line */

/** Paw mark plus uppercase kicker — the section opener used site-wide. */
export function Eyebrow({
  children,
  color,
  pawColor = colors.accent,
}: {
  children: ReactNode;
  color?: string;
  pawColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Paw size={20} color={pawColor} />
      <EyebrowText color={color}>{children}</EyebrowText>
    </View>
  );
}

/* --------------------------------------------------------------- Bullet row */

/** A ticked list item — used for "You leave with" on the Services page. */
export function Bullet({ children, color = colors.text }: { children: ReactNode; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
      <View style={{ marginTop: 4 }}>
        <IconCheck size={18} color={colors.primary} />
      </View>
      <Body color={color} style={{ flex: 1 }}>
        {children}
      </Body>
    </View>
  );
}
