// =============================================================================
// ThresholdChart — calm distance over time, with axes.
//
// The site's ProgressCurve is a decorative signature (no axes, smoothed). The
// app needs the honest version: each logged event is a point, the y-axis says
// how many metres, the x-axis says when. Lower is better — the dog stays calm
// closer to the trigger — and the latest point is filled so the eye lands on
// "where we are now".
// =============================================================================

import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../lib/theme';
import type { Lang } from '../../lib/i18n';
import { formatShortDate, formatTime } from '../../lib/labels';

export interface ChartPoint {
  occurredAt: string;
  thresholdMeters: number;
}

const PALETTE = {
  light: { grid: '#F3ECDF', label: colors.textMuted, fill: colors.accentPeach, dot: colors.surface, last: colors.accentBright },
  dark: { grid: 'rgba(255,252,245,0.14)', label: colors.onDarkMuted, fill: colors.primary, dot: colors.primarySoft, last: colors.accentBright },
} as const;

const FONT = fonts.body;
const PAD = { left: 34, right: 12, top: 14, bottom: 26 };
const MAX_X_LABELS = 5;

function niceMax(max: number): number {
  if (max <= 5) return 5;
  if (max <= 10) return 10;
  return Math.ceil(max / 10) * 10;
}

export function ThresholdChart({
  points,
  lang,
  height = 180,
  tone = 'light',
  accessibilityLabel,
}: {
  points: ChartPoint[];
  lang: Lang;
  height?: number;
  tone?: 'light' | 'dark';
  accessibilityLabel: string;
}) {
  const [width, setWidth] = useState(0);
  const p = PALETTE[tone];
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const sorted = [...points].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const yMax = niceMax(Math.max(...sorted.map((pt) => pt.thresholdMeters), 1));
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (sorted.length === 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW);
  const y = (m: number) => PAD.top + plotH - (m / yMax) * plotH;

  // One day of points → label the times; across days → label the dates.
  const sameDay =
    sorted.length > 0 &&
    sorted.every((pt) => new Date(pt.occurredAt).toDateString() === new Date(sorted[0].occurredAt).toDateString());
  const step = Math.max(1, Math.ceil(sorted.length / MAX_X_LABELS));
  const label = (iso: string) => (sameDay ? formatTime(iso, lang) : formatShortDate(iso, lang));
  // Several events on one day would print "15/6 15/6 15/6" — label a date once,
  // at its first point (the last point is always labelled: it is "now").
  const shown = sorted.map((pt, i) => {
    const last = i === sorted.length - 1;
    if (!last && i % step !== 0) return false;
    if (sameDay || i === 0) return true;
    return last || label(pt.occurredAt) !== label(sorted[i - 1].occurredAt);
  });

  const line = sorted.map((pt, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(pt.thresholdMeters)}`).join(' ');
  const area =
    sorted.length > 1
      ? `${line} L${x(sorted.length - 1)} ${PAD.top + plotH} L${x(0)} ${PAD.top + plotH} Z`
      : '';
  const unit = lang === 'el' ? 'μ' : 'm';

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ height }}>
      {width > 0 && sorted.length > 0 && (
        <Svg width={width} height={height}>
          {[0, yMax / 2, yMax].map((m) => (
            <Line key={`g${m}`} x1={PAD.left} x2={width - PAD.right} y1={y(m)} y2={y(m)} stroke={p.grid} strokeWidth={1} />
          ))}
          {[0, yMax / 2, yMax].map((m) => (
            <SvgText key={`y${m}`} x={PAD.left - 8} y={y(m) + 4} fontSize={11} fontFamily={FONT} fill={p.label} textAnchor="end">
              {`${m}${unit}`}
            </SvgText>
          ))}
          {area !== '' && <Path d={area} fill={p.fill} opacity={tone === 'light' ? 0.7 : 1} />}
          <Path d={line} fill="none" stroke={colors.accentBright} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          {sorted.map((pt, i) => {
            const last = i === sorted.length - 1;
            return (
              <Circle
                key={`p${i}`}
                cx={x(i)}
                cy={y(pt.thresholdMeters)}
                r={last ? 6 : 4.5}
                fill={last ? p.last : p.dot}
                stroke={colors.accentBright}
                strokeWidth={last ? 0 : 2.5}
              />
            );
          })}
          {sorted.map((pt, i) =>
            shown[i] ? (
              <SvgText
                key={`x${i}`}
                x={x(i)}
                y={height - 6}
                fontSize={11}
                fontFamily={FONT}
                fill={p.label}
                textAnchor={i === 0 && sorted.length > 1 ? 'start' : i === sorted.length - 1 && sorted.length > 1 ? 'end' : 'middle'}
              >
                {label(pt.occurredAt)}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
    </View>
  );
}

/** First and latest distance, for the headline number above a chart. */
export function chartSummary(points: ChartPoint[]): { first: number; latest: number; improvedPct: number } | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const first = sorted[0].thresholdMeters;
  const latest = sorted[sorted.length - 1].thresholdMeters;
  const improvedPct = first > 0 ? Math.round(((first - latest) / first) * 100) : 0;
  return { first, latest, improvedPct };
}
