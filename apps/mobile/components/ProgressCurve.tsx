// =============================================================================
// ProgressCurve — the signature threshold-over-time visual (DS-5)
//
// A thin gold line on a deep-green panel with a soft gradient fill. PROOF OF
// METHOD, not decoration. Hand-rolled react-native-svg (no charting dep), works
// web + native. Reused across Services (sample data), Results (outcome arc), and
// — in Phase 3b — the client dashboard (live data).
//
// Key correctness points (from the investigation/DS-5):
//   - explicit numeric width/height (percentage sizing can collapse on web);
//     width is measured from the container via onLayout.
//   - per-instance gradient id via useId() — two curves on one page must NOT
//     share a <LinearGradient> id (RNW reuses the first def → wrong fill).
//   - Catmull-Rom → cubic-Bézier smoothing (tension ~0.2) for an elegant curve.
//   - flat-series guard (min === max → flat line; avoids divide-by-zero).
//   - static curve is acceptable; any draw-on animation gates on reduced motion.
// =============================================================================

import { useId, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, radii, space } from '../lib/theme';
// useReducedMotion is imported for the documented animation gate; the default
// render is a static curve, so it is read but not yet driving any Animated value.
import { useReducedMotion } from '../lib/reducedMotion';

type RawPoint = { occurredAt: string; thresholdMeters: number };
type XYPoint = { x: number; y: number };

export interface ProgressCurveProps {
  /** Raw threshold-over-time samples OR pre-normalized {x,y} points. */
  data: number[] | XYPoint[] | RawPoint[];
  /** Explicit width; when omitted the curve measures its container. */
  width?: number;
  /** Panel height (px). Default 220. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const STROKE_W = 2;
const TENSION = 0.2; // Catmull-Rom tension → control-point scale (1/6 * (1 - t)-ish)

// ── Normalize any accepted input into a {x,y} list (x = index, y = value) ──────
function toXY(data: ProgressCurveProps['data']): XYPoint[] {
  if (data.length === 0) return [];
  const first = data[0];
  if (typeof first === 'number') {
    return (data as number[]).map((y, i) => ({ x: i, y }));
  }
  if (typeof first === 'object' && first !== null && 'x' in first && 'y' in first) {
    return data as XYPoint[];
  }
  // RawPoint[] — x = chronological index, y = thresholdMeters (higher = better).
  return (data as RawPoint[]).map((p, i) => ({ x: i, y: p.thresholdMeters }));
}

// ── Catmull-Rom → cubic Bézier: build a smooth "M … C …" path through points ──
// For each segment p1→p2, control points are derived from the neighbouring
// points p0/p3 scaled by TENSION (the classic Catmull-Rom→Bézier conversion).
function smoothPath(pts: { px: number; py: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].px} ${pts[0].py}`;

  let d = `M ${pts[0].px} ${pts[0].py}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    const cp1x = p1.px + (p2.px - p0.px) * TENSION;
    const cp1y = p1.py + (p2.py - p0.py) * TENSION;
    const cp2x = p2.px - (p3.px - p1.px) * TENSION;
    const cp2y = p2.py - (p3.py - p1.py) * TENSION;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.px} ${p2.py}`;
  }
  return d;
}

export function ProgressCurve({ data, width, height = 220, style }: ProgressCurveProps) {
  const gradientId = useId(); // per-instance — avoids RNW def-reuse collisions
  const [measured, setMeasured] = useState(0);
  // The reduced-motion preference is read so a future draw-on animation can be
  // gated; the static curve below is rendered regardless (DS-6 compliant).
  void useReducedMotion();

  const onLayout = (e: LayoutChangeEvent) => {
    if (width == null) setMeasured(e.nativeEvent.layout.width);
  };

  const w = width ?? measured;
  const points = toXY(data);

  // Inner plot rect inside the panel padding.
  const pad = space.md;
  const padTop = space.md;
  const padBottom = space.md;
  const plotW = Math.max(0, w - pad * 2);
  const plotH = Math.max(0, height - padTop - padBottom);

  const gold = colors.accent;

  // Map a value to a screen point. Flat-series guard: min === max → mid line.
  let body: React.ReactNode = null;
  if (w > 0 && points.length > 0) {
    const ys = points.map((p) => p.y);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const range = max - min;
    const n = points.length;

    const sx = (i: number) => pad + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const sy = (v: number) =>
      range === 0 ? padTop + plotH / 2 : padTop + plotH - ((v - min) / range) * plotH;

    const screen = points.map((p, i) => ({ px: sx(i), py: sy(p.y) }));
    const baselineY = padTop + plotH;

    const stroke = smoothPath(screen);
    // Closed fill path: the smoothed curve, then down to baseline and back.
    const fill =
      stroke +
      ` L ${screen[screen.length - 1].px} ${baselineY}` +
      ` L ${screen[0].px} ${baselineY} Z`;

    body = (
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gold} stopOpacity={0.28} />
            <Stop offset="1" stopColor={gold} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Soft gradient fill (gold fading to transparent downward). */}
        <Path d={fill} fill={`url(#${gradientId})`} stroke="none" />
        {/* The thin gold line. */}
        <Path d={stroke} fill="none" stroke={gold} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          backgroundColor: colors.primary,
          borderRadius: radii.lg,
          height,
          width: width ?? '100%',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {body}
    </View>
  );
}
