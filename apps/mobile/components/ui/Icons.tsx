// =============================================================================
// Icons — the drawn icon set (playful direction)
//
// Inline SVG, never emoji: these scale, recolour and export cleanly, and the
// brand's paw mark is a real shape rather than a font glyph that renders
// differently on every platform.
//
// House style: a 24×24 grid, 2.2 stroke weight, round caps and joins. Stroked
// icons take `color`; the paw and the logo mark are fills. Sizes are props so a
// caller never scales an icon with a transform.
// =============================================================================

import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { colors } from '../../lib/theme';

interface IconProps {
  size?: number;
  color?: string;
}

const STROKE = 2.2;

/**
 * The brand mark. It leads every eyebrow on the site, so it defaults to the
 * BRIGHT orange — it is a filled shape, not copy, and the text-safe orange goes
 * muddy at this size.
 */
export function Paw({ size = 20, color = colors.accentBright }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx={6.6} cy={8.6} rx={2.4} ry={3} fill={color} />
      <Ellipse cx={11.4} cy={6.2} rx={2.4} ry={3.2} fill={color} />
      <Ellipse cx={16.4} cy={7} rx={2.4} ry={3} fill={color} />
      <Ellipse cx={20.2} cy={11} rx={2.1} ry={2.6} fill={color} />
      <Path
        d="M11.6 11.2c3.5 0 6.2 2.7 6.2 5.4 0 2.3-1.9 3.5-3.8 3.1-1.7-.4-3.4-.4-5 0-1.9.4-3.8-.8-3.8-3.1 0-2.7 2.9-5.4 6.4-5.4z"
        fill={color}
      />
    </Svg>
  );
}

/** The wordmark's rising curve — the progress line, abstracted. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Path
        d="M0 12C0 5.4 5.4 0 12 0h6c6.6 0 12 5.4 12 12v6c0 6.6-5.4 12-12 12h-6C5.4 30 0 24.6 0 18v-6z"
        fill={colors.primary}
      />
      <Path
        d="M6.5 20.5C11.5 20.5 12 10.5 23.5 9"
        stroke={colors.accentBright}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Footer variant — a translucent tile on the deep-green band. */
export function LogoMarkOnDark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Path
        d="M0 12C0 5.4 5.4 0 12 0h6c6.6 0 12 5.4 12 12v6c0 6.6-5.4 12-12 12h-6C5.4 30 0 24.6 0 18v-6z"
        fill={colors.onDark}
        fillOpacity={0.12}
      />
      <Path
        d="M6.5 20.5C11.5 20.5 12 10.5 23.5 9"
        stroke={colors.accentBright}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Assessment — a proper look at what is actually happening. */
export function IconMagnifier({ size = 28, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={STROKE} />
      <Path d="M15.8 15.8 20.5 20.5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

/** Private sessions — one person, one dog, connected. */
export function IconPair({ size = 28, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={9} r={3.2} stroke={color} strokeWidth={STROKE} />
      <Circle cx={17.2} cy={14.5} r={2.6} stroke={color} strokeWidth={STROKE} />
      <Path
        d="M10.7 10.9c1.9 1.8 2.6 2.4 3.9 3"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Group classes — three, with space between them. */
export function IconTrio({ size = 28, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={7.2} cy={9} r={2.6} stroke={color} strokeWidth={STROKE} />
      <Circle cx={16.8} cy={8.2} r={2.6} stroke={color} strokeWidth={STROKE} />
      <Circle cx={11.8} cy={16} r={2.6} stroke={color} strokeWidth={STROKE} />
      <Path
        d="M9.6 10.3 14.4 14M14.9 10.1 13 13.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        opacity={0.5}
      />
    </Svg>
  );
}

/** The intensive programme — a steady climb. */
export function IconRising({ size = 28, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 17.5C8 17.5 9 8.5 20.5 6.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M16.5 5.6 20.8 6.4 20 10.7"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconCheck({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 12.5 9.5 17.5 19.5 6.5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPin({ size = 20, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.5s7-5.8 7-11.5a7 7 0 1 0-14 0c0 5.7 7 11.5 7 11.5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={2.6} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function IconClock({ size = 20, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 7.2V12l3.2 2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconMail({ size = 20, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 5.5h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M4 7.5 12 13l8-5.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPhone({ size = 20, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.4 3.5c.7 0 1.3.4 1.5 1l1 2.7c.2.6 0 1.3-.5 1.7l-1.2.9a11 11 0 0 0 4.9 4.9l.9-1.2c.4-.5 1.1-.7 1.7-.5l2.7 1c.6.2 1 .8 1 1.5v2.6c0 .9-.7 1.6-1.6 1.5A16.5 16.5 0 0 1 3.4 5.1 1.5 1.5 0 0 1 5 3.5h3.4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconChevronRight({ size = 20, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 6.5 15.5 12 10 17.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Placeholder art for a rectangular photo slot. */
export function IconCamera({ size = 48, color = colors.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 5h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={9} cy={10.5} r={1.7} stroke={color} strokeWidth={1.8} />
      <Path
        d="M3.5 16.5 8.5 12l4 3.5L16 13l4.5 4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Placeholder art for a portrait slot. */
export function IconPerson({ size = 40, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.5} r={4} stroke={color} strokeWidth={1.8} />
      <Path
        d="M4.5 20.5c1.5-4 4.2-6 7.5-6s6 2 7.5 6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
