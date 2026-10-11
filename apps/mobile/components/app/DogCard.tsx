// =============================================================================
// DogCard — one dog at a glance: who, how they are trending, and a way in.
//
// Used on the trainer's Today screen and the Dogs list. The trend is a
// sparkline of calm distance (lower = better) from the dog's timeline; a dog
// with no sessions yet says so instead of drawing an empty chart.
// =============================================================================

import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { DogSummaryDTO } from '@tailsup/shared';
import { colors, fontFallback, fonts } from '../../lib/theme';
import type { Lang } from '../../lib/i18n';
import { formatAge, formatDay } from '../../lib/labels';
import { Avatar, Button,
} from './AppKit';
import { IconPlus } from './AppIcons';
import type { ChartPoint } from './ThresholdChart';

const copy = {
  el: {
    calm: 'Απόσταση ηρεμίας',
    none: 'Καμία συνεδρία ακόμα',
    last: 'Τελευταία',
    start: 'Νέα συνεδρία',
    trend: (a: number, b: number) => `Απόσταση ηρεμίας από ${a} σε ${b} μέτρα`,
  },
  en: {
    calm: 'Calm distance',
    none: 'No sessions yet',
    last: 'Last',
    start: 'New session',
    trend: (a: number, b: number) => `Calm distance from ${a} to ${b} metres`,
  },
} as const;

function Sparkline({ points, label }: { points: ChartPoint[]; label: string }) {
  const [w, setW] = useState(0);
  const h = 44;
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  const max = Math.max(...points.map((p) => p.thresholdMeters), 1);
  const x = (i: number) => (points.length === 1 ? w / 2 : 5 + (i / (points.length - 1)) * (w - 10));
  const y = (m: number) => 5 + (1 - m / max) * (h - 10);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(p.thresholdMeters)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <View onLayout={onLayout} style={{ height: h }} accessible accessibilityRole="image" accessibilityLabel={label}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Path d={d} fill="none" stroke={colors.accentBright} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={x(points.length - 1)} cy={y(last.thresholdMeters)} r={4.5} fill={colors.accentBright} />
        </Svg>
      )}
    </View>
  );
}

export function DogCard({
  dog,
  points,
  lastSessionAt,
  lang,
  onOpen,
  onStart,
  starting = false,
}: {
  dog: DogSummaryDTO;
  /** Chronological calm-distance points; undefined while loading. */
  points?: ChartPoint[];
  lastSessionAt?: string | null;
  lang: Lang;
  onOpen: () => void;
  onStart?: () => void;
  starting?: boolean;
}) {
  const c = copy[lang];
  const has = !!points && points.length > 0;
  const first = has ? points[0].thresholdMeters : 0;
  const latest = has ? points[points.length - 1].thresholdMeters : 0;
  const unit = lang === 'el' ? 'μ' : 'm';

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={dog.name}
        onPress={onOpen}
        style={({ hovered, focused }) => [
          styles.open,
          hovered && styles.hover,
          focused && styles.focus,
          Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
        ]}
      >
        <View style={styles.head}>
          <Avatar name={dog.name} size={52} />
          <View style={styles.headText}>
            <Text style={[styles.name, fontFallback.display]}>{dog.name}</Text>
            <Text style={[styles.meta, fontFallback.body]}>
              {dog.breed} · {formatAge(dog.ageMonths, lang)}
            </Text>
          </View>
        </View>

        {has ? (
          <Sparkline points={points} label={c.trend(first, latest)} />
        ) : (
          <View style={styles.noData}>
            <Text style={[styles.noDataText, fontFallback.body]}>{points ? c.none : ' '}</Text>
          </View>
        )}

        <View style={styles.foot}>
          <Text style={[styles.meta, fontFallback.body]}>
            {has ? c.calm : lastSessionAt ? `${c.last}: ${formatDay(lastSessionAt, lang)}` : ''}
          </Text>
          {has && (
            <Text style={[styles.trend, fontFallback.body]}>
              {first}
              {unit} → {latest}
              {unit}
            </Text>
          )}
        </View>
      </Pressable>
      {onStart && (
        <View style={styles.action}>
          <Button
            label={c.start}
            variant="green"
            block
            loading={starting}
            onPress={onStart}
            icon={<IconPlus size={18} color={colors.onDark} />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  open: { padding: 18, gap: 14 },
  hover: { backgroundColor: '#FFFDF8' },
  focus: { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: 'solid' } as object,
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, fontSize: 21, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  noData: { height: 44, borderRadius: 12, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  noDataText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textOnPeach },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, minHeight: 20 },
  trend: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.primarySoft },
  action: { paddingHorizontal: 18, paddingBottom: 18 },
});
