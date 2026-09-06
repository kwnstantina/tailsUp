// Typography primitives. Every piece of text on the site goes through one of
// these, so the font families and the responsive scale live in exactly one
// place. Pass `color` to override; everything else comes from tokens.

import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';
import { colors, fonts, type } from '../design/tokens';
import { useBreakpoint } from '../design/useBreakpoint';

interface TypeProps {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  /** Web/native accessibility role for headings. */
  accessibilityRole?: 'header' | 'text';
  numberOfLines?: number;
}

function useScale(key: keyof typeof type) {
  const r = useBreakpoint();
  const entry = type[key];
  return { fontSize: r.t(entry.size), lineHeight: r.t(entry.lineHeight) };
}

export function H1({ children, color = colors.text, style, numberOfLines }: TypeProps) {
  const scale = useScale('h1');
  return (
    <RNText
      accessibilityRole="header"
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: fonts.displaySemiBold, color, letterSpacing: -0.3 },
        scale,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

export function H2({ children, color = colors.text, style, numberOfLines }: TypeProps) {
  const scale = useScale('h2');
  return (
    <RNText
      accessibilityRole="header"
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: fonts.displaySemiBold, color, letterSpacing: -0.2 },
        scale,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

export function H3({ children, color = colors.text, style, numberOfLines }: TypeProps) {
  const scale = useScale('h3');
  return (
    <RNText
      accessibilityRole="header"
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts.displaySemiBold, color }, scale, style]}
    >
      {children}
    </RNText>
  );
}

/** Larger body copy — hero paragraphs and section intros. */
export function BodyLg({ children, color = colors.text, style, numberOfLines }: TypeProps) {
  const scale = useScale('bodyLg');
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts.body, color }, scale, style]}
    >
      {children}
    </RNText>
  );
}

export function Body({ children, color = colors.text, style, numberOfLines }: TypeProps) {
  const scale = useScale('body');
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts.body, color }, scale, style]}
    >
      {children}
    </RNText>
  );
}

export function Small({ children, color = colors.textMuted, style, numberOfLines }: TypeProps) {
  const scale = useScale('small');
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts.body, color }, scale, style]}
    >
      {children}
    </RNText>
  );
}

/** Bold inline label — form labels, sticker text, list emphasis. */
export function Label({ children, color = colors.text, style, numberOfLines }: TypeProps) {
  const scale = useScale('small');
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts.bodyBold, color }, scale, style]}
    >
      {children}
    </RNText>
  );
}

/**
 * The small uppercase kicker above a heading. React Native's letterSpacing is
 * in pixels, so the design's 0.1em at 13px is 1.3 here.
 */
export function EyebrowText({ children, color = colors.accentInk, style }: TypeProps) {
  const scale = useScale('eyebrow');
  return (
    <RNText
      style={[
        {
          fontFamily: fonts.bodyBold,
          color,
          letterSpacing: scale.fontSize * 0.1,
          textTransform: 'uppercase',
        },
        scale,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
