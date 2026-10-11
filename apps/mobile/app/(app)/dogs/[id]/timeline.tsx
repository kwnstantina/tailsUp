// =============================================================================
// /dogs/[id]/timeline — the dog's profile (FR-A6).
//
// Leads with the answer a trainer actually wants: is this dog getting better?
// A calm-distance chart across every logged event (lower = better), then the
// sessions, newest first, each a collapsible group of events with the outcome
// as a coloured pill. Any event opens its detail (note, tags, video).
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { BehaviorEventDTO, DogTimelineDTO, Outcome } from '@tailsup/shared';
import { colors, fontFallback, fonts } from '../../../../lib/theme';
import { useLang, type Lang } from '../../../../lib/i18n';
import { ApiError, getDogTimeline, startSession } from '../../../../lib/api';
import { OUTCOME_LABELS, formatAge, formatDay, formatTime, triggerLabel } from '../../../../lib/labels';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Muted,
  Notice,
  Panel,
  Pill,
  Screen,
  SectionHeader,
  type PillTone,
} from '../../../../components/app/AppKit';
import { IconBack, IconChevron, IconPlus } from '../../../../components/app/AppIcons';
import { ThresholdChart, chartSummary } from '../../../../components/app/ThresholdChart';

const copy = {
  el: {
    back: 'Πίσω στους σκύλους',
    newSession: 'Νέα συνεδρία',
    loading: 'Φόρτωση…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    progress: 'Απόσταση ηρεμίας',
    progressHelp: 'Πόσο κοντά στο ερέθισμα μένει ήρεμος. Χαμηλότερα = καλύτερα.',
    chartLabel: (a: number, b: number, n: number) => `Απόσταση ηρεμίας από ${a} σε ${b} μέτρα σε ${n} καταγραφές`,
    noData: 'Μόλις καταγραφούν συμβάντα, εδώ θα φαίνεται η πρόοδος.',
    sessions: 'Συνεδρίες',
    noSessions: 'Καμία συνεδρία ακόμα.',
    events: (n: number) => (n === 1 ? '1 καταγραφή' : `${n} καταγραφές`),
    noEvents: 'Δεν καταγράφηκε τίποτα σε αυτή τη συνεδρία.',
    intensity: 'ένταση',
    startFailed: 'Η συνεδρία δεν ξεκίνησε:',
  },
  en: {
    back: 'Back to dogs',
    newSession: 'New session',
    loading: 'Loading…',
    errorTitle: 'Could not load',
    retry: 'Try again',
    progress: 'Calm distance',
    progressHelp: 'How close to the trigger they stay calm. Lower = better.',
    chartLabel: (a: number, b: number, n: number) => `Calm distance from ${a} to ${b} metres over ${n} events`,
    noData: 'Once events are logged, progress shows up here.',
    sessions: 'Sessions',
    noSessions: 'No sessions yet.',
    events: (n: number) => (n === 1 ? '1 event' : `${n} events`),
    noEvents: 'Nothing was logged in this session.',
    intensity: 'intensity',
    startFailed: 'Could not start the session:',
  },
} as const;

const OUTCOME_TONE: Record<Outcome, PillTone> = {
  disengaged: 'mint',
  recovered_slowly: 'peach',
  over_threshold: 'coral',
};

type Status =
  | { kind: 'loading' }
  | { kind: 'success'; timeline: DogTimelineDTO }
  | { kind: 'error'; message: string };

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

function EventRow({ event, lang, onPress, first }: { event: BehaviorEventDTO; lang: Lang; onPress: () => void; first: boolean }) {
  const c = copy[lang];
  const unit = lang === 'el' ? 'μ' : 'm';
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ hovered, focused }) => [
        styles.event,
        !first && styles.divider,
        hovered && styles.hover,
        focused && styles.focus,
        webCursor,
      ]}
    >
      <Text style={[styles.eventTime, fontFallback.body]}>{formatTime(event.occurredAt, lang)}</Text>
      <View style={styles.eventText}>
        <Text style={[styles.eventTitle, fontFallback.body]}>
          {triggerLabel(event.triggerType, event.triggerDetail, lang)} · {event.thresholdMeters}
          {unit} · {c.intensity} {event.intensity}
        </Text>
        <Text numberOfLines={1} style={[styles.eventMeta, fontFallback.body]}>
          {event.intervention}
          {event.note ? ` · ${event.note}` : ''}
        </Text>
      </View>
      <Pill label={OUTCOME_LABELS[lang][event.outcome]} tone={OUTCOME_TONE[event.outcome]} />
    </Pressable>
  );
}

export default function DogProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const c = copy[lang];
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      setStatus({ kind: 'success', timeline: await getDogTimeline(id) });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onStart = useCallback(async () => {
    if (status.kind !== 'success') return;
    setStarting(true);
    setStartError(null);
    try {
      const s = await startSession(id);
      router.push({
        pathname: '/sessions/[id]/log',
        params: { id: s.id, dog: status.timeline.dog.name, dogId: id },
      });
    } catch (err) {
      setStartError(`${c.startFailed} ${err instanceof ApiError ? err.message : String(err)}`);
    } finally {
      setStarting(false);
    }
  }, [status, id, router, c]);

  const back = (
    <IconButton
      icon={<IconBack color={colors.primarySoft} />}
      accessibilityLabel={c.back}
      tone="outline"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/dogs'))}
    />
  );

  if (status.kind === 'loading') {
    return (
      <Screen maxWidth={820}>
        {back}
        <LoadingState label={c.loading} />
      </Screen>
    );
  }
  if (status.kind === 'error') {
    return (
      <Screen maxWidth={820}>
        {back}
        <ErrorState title={c.errorTitle} message={status.message} retryLabel={c.retry} onRetry={() => void load()} />
      </Screen>
    );
  }

  const { dog, sessions } = status.timeline;
  const points = sessions
    .flatMap((s) => s.events)
    .map((e) => ({ occurredAt: e.occurredAt, thresholdMeters: e.thresholdMeters }));
  const summary = chartSummary(points);
  const unit = lang === 'el' ? 'μ' : 'm';

  return (
    <Screen maxWidth={820}>
      <View style={styles.hero}>
        {back}
        <View style={styles.heroMain}>
          <Avatar name={dog.name} size={72} />
          <View style={styles.heroText}>
            <Text accessibilityRole="header" style={[styles.dogName, fontFallback.display]}>
              {dog.name}
            </Text>
            <Muted size={16}>
              {dog.breed} · {formatAge(dog.ageMonths, lang)}
            </Muted>
          </View>
          <Button
            label={c.newSession}
            size="lg"
            loading={starting}
            onPress={() => void onStart()}
            icon={<IconPlus size={18} color={colors.text} />}
          />
        </View>
      </View>

      {startError && <Notice tone="error">{startError}</Notice>}

      <Panel style={styles.progress}>
        <View style={styles.progressHead}>
          <Text style={[styles.panelTitle, fontFallback.display]}>{c.progress}</Text>
          {summary && summary.improvedPct !== 0 && (
            <Pill
              label={`${summary.improvedPct > 0 ? '↓' : '↑'} ${Math.abs(summary.improvedPct)}%`}
              tone={summary.improvedPct > 0 ? 'mint' : 'coral'}
            />
          )}
        </View>
        <Muted>{c.progressHelp}</Muted>
        {summary ? (
          <>
            <View style={styles.headline}>
              <Text style={[styles.headlineValue, fontFallback.display]}>
                {summary.latest}
                {unit}
              </Text>
              <Muted>
                ← {summary.first}
                {unit}
              </Muted>
            </View>
            <ThresholdChart
              points={points}
              lang={lang}
              height={200}
              accessibilityLabel={c.chartLabel(summary.first, summary.latest, points.length)}
            />
          </>
        ) : (
          <EmptyState message={c.noData} />
        )}
      </Panel>

      <View style={styles.section}>
        <SectionHeader title={c.sessions} />
        {sessions.length === 0 && <EmptyState message={c.noSessions} />}
        {sessions.map((s, i) => {
          const isCollapsed = collapsed[s.id] ?? i > 0;
          return (
            <Panel key={s.id} style={styles.session}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: !isCollapsed }}
                onPress={() => setCollapsed((m) => ({ ...m, [s.id]: !isCollapsed }))}
                style={({ focused }) => [styles.sessionHead, focused && styles.focus, webCursor]}
              >
                <View style={styles.sessionHeadText}>
                  <Text style={[styles.sessionDay, fontFallback.body]}>{formatDay(s.startedAt, lang)}</Text>
                  <Text style={[styles.sessionMeta, fontFallback.body]}>
                    {[s.location, formatTime(s.startedAt, lang), c.events(s.events.length)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={{ transform: [{ rotate: isCollapsed ? '90deg' : '-90deg' }] }}>
                  <IconChevron color={colors.textOnPeach} />
                </View>
              </Pressable>
              {!isCollapsed &&
                (s.events.length === 0 ? (
                  <View style={styles.noEvents}>
                    <Muted>{c.noEvents}</Muted>
                  </View>
                ) : (
                  s.events.map((e, j) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      lang={lang}
                      first={j === 0}
                      onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
                    />
                  ))
                ))}
            </Panel>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 16 },
  heroMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  heroText: { flex: 1, minWidth: 180, gap: 2 },
  dogName: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.text },
  progress: { gap: 10 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.text },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 },
  headlineValue: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, color: colors.primarySoft },
  section: { gap: 12 },
  session: { padding: 0, overflow: 'hidden' },
  sessionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.bgAlt,
    minHeight: 56,
  },
  sessionHeadText: { flex: 1, minWidth: 0, gap: 2 },
  sessionDay: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  sessionMeta: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textOnPeach },
  noEvents: { padding: 16 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  divider: { borderTopWidth: 1, borderTopColor: '#F3ECDF' },
  hover: { backgroundColor: '#FFFDF8' },
  focus: { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: 'solid' } as object,
  eventTime: { width: 48, fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted },
  eventText: { flex: 1, minWidth: 0, gap: 2 },
  eventTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  eventMeta: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted },
});
