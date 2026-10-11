// =============================================================================
// /client — the dog owner's dashboard (Phase 3b-2, redesigned).
//
// Written for an owner, not a trainer: the progress card leads with one number
// and one sentence ("6μ — from 20μ at the start"), the chart has axes, and
// homework is a checklist with a progress bar that can be ticked and unticked.
// Then the next appointment and who to contact.
//
// On a phone a bottom tab bar filters the page to one section (Αρχική shows
// everything); on wide screens everything is visible in two columns.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BookingDTO, ClientProgressDTO, HomeworkDTO, MyTrainerDTO } from '@tailsup/shared';
import { colors, fontFallback, fonts, radii, useResponsive } from '../../lib/theme';
import { useLang, type Lang } from '../../lib/i18n';
import { useSession } from '../../lib/auth-client';
import { ApiError, getMyBookings, getMyHomework, getMyProgress, getMyTrainer, setHomeworkCompleted } from '../../lib/api';
import { BOOKING_TYPE_LABELS, formatDay, formatDayTime, formatTime } from '../../lib/labels';
import {
  Avatar,
  EmptyState,
  ErrorState,
  LoadingState,
  Muted,
  Notice,
  Panel,
  Pill,
  Screen,
  SectionHeader,
  Title,
} from '../../components/app/AppKit';
import { IconCalendar, IconChart, IconCheckMark, IconChecklist, IconHome, IconMailOutline } from '../../components/app/AppIcons';
import { ThresholdChart, chartSummary } from '../../components/app/ThresholdChart';

type Tab = 'home' | 'progress' | 'homework' | 'bookings';

const copy = {
  el: {
    hello: (n: string) => (n ? `Γεια σου, ${n}` : 'Γεια σου'),
    subtitle: (dog: string | null) => (dog ? `Δες πώς τα πάει ο ${dog}.` : 'Καλώς ήρθες στο TailsUp.'),
    loading: 'Φόρτωση…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    tabs: { home: 'Αρχική', progress: 'Πρόοδος', homework: 'Ασκήσεις', bookings: 'Ραντεβού' } as Record<Tab, string>,
    progressOf: (dog: string) => `Η πρόοδος του ${dog}`,
    lastSession: (d: string) => `Τελευταία καταγραφή: ${d}`,
    fromStart: (m: number) => `από ${m}μ στην αρχή`,
    great: (dog: string) => `Ο ${dog} μένει πλέον ήρεμος πολύ πιο κοντά στα ερεθίσματα. Εξαιρετική δουλειά!`,
    some: 'Σταθερή πρόοδος — συνέχισε τις ασκήσεις στο σπίτι.',
    flat: 'Η απόσταση ηρεμίας μένει σταθερή. Οι ασκήσεις στο σπίτι κάνουν τη διαφορά.',
    chartLabel: (dog: string, a: number, b: number) => `Απόσταση ηρεμίας του ${dog}: από ${a} σε ${b} μέτρα`,
    explain: 'Η απόσταση ηρεμίας είναι πόσο κοντά σε ένα ερέθισμα (π.χ. άλλο σκύλο) μένει ήρεμος. Όσο μικραίνει, τόσο καλύτερα.',
    noData: (dog: string) => `Μόλις γίνει η πρώτη συνεδρία με τον ${dog}, εδώ θα βλέπεις την πρόοδό του.`,
    noDogs: 'Δεν υπάρχει ακόμα σκύλος στον λογαριασμό σου. Ο εκπαιδευτής σου θα τον προσθέσει.',
    next: 'Επόμενο ραντεβού',
    noNext: 'Κανένα προγραμματισμένο ραντεβού.',
    homework: 'Ασκήσεις',
    doneOf: (d: number, t: number) => `${d} από ${t}`,
    noHomework: 'Καμία άσκηση αυτή τη στιγμή.',
    done: 'Έγινε',
    markDone: (t: string) => `Ολοκληρώθηκε: ${t}`,
    allBookings: 'Τα ραντεβού σου',
    noBookings: 'Δεν υπάρχουν ραντεβού.',
    trainer: 'Ο εκπαιδευτής σου',
    write: 'Στείλε email',
    bookingStatus: { requested: 'Αναμένει', confirmed: 'Επιβεβαιώθηκε', completed: 'Ολοκληρώθηκε', declined: 'Δεν έγινε δεκτό', cancelled: 'Ακυρώθηκε' } as Record<string, string>,
  },
  en: {
    hello: (n: string) => (n ? `Hi, ${n}` : 'Hi'),
    subtitle: (dog: string | null) => (dog ? `See how ${dog} is doing.` : 'Welcome to TailsUp.'),
    loading: 'Loading…',
    errorTitle: 'Could not load your dashboard',
    retry: 'Try again',
    tabs: { home: 'Home', progress: 'Progress', homework: 'Homework', bookings: 'Appointments' } as Record<Tab, string>,
    progressOf: (dog: string) => `${dog}'s progress`,
    lastSession: (d: string) => `Last logged: ${d}`,
    fromStart: (m: number) => `from ${m}m at the start`,
    great: (dog: string) => `${dog} now stays calm much closer to triggers. Great work!`,
    some: 'Steady progress — keep up the homework.',
    flat: 'The calm distance is holding steady. Homework is what moves it.',
    chartLabel: (dog: string, a: number, b: number) => `${dog}'s calm distance: from ${a} to ${b} metres`,
    explain: 'Calm distance is how close to a trigger (e.g. another dog) they stay calm. Smaller is better.',
    noData: (dog: string) => `After the first session with ${dog}, their progress shows up here.`,
    noDogs: 'There is no dog on your account yet. Your trainer will add one.',
    next: 'Next appointment',
    noNext: 'No appointment scheduled.',
    homework: 'Homework',
    doneOf: (d: number, t: number) => `${d} of ${t}`,
    noHomework: 'No homework right now.',
    done: 'Done',
    markDone: (t: string) => `Completed: ${t}`,
    allBookings: 'Your appointments',
    noBookings: 'No appointments.',
    trainer: 'Your trainer',
    write: 'Send an email',
    bookingStatus: { requested: 'Waiting', confirmed: 'Confirmed', completed: 'Completed', declined: 'Not accepted', cancelled: 'Cancelled' } as Record<string, string>,
  },
} as const;

type Status =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; progress: ClientProgressDTO[]; homework: HomeworkDTO[]; bookings: BookingDTO[]; trainer: MyTrainerDTO | null };

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

function nextBooking(bookings: BookingDTO[]): BookingDTO | null {
  const now = Date.now();
  return (
    bookings
      .filter((b) => (b.status === 'confirmed' || b.status === 'requested') && new Date(b.requestedAt).getTime() >= now)
      .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())[0] ?? null
  );
}

function ProgressCard({ entry, lang }: { entry: ClientProgressDTO; lang: Lang }) {
  const c = copy[lang];
  const { dog, points } = entry;
  const summary = chartSummary(points);
  const sentence = !summary ? '' : summary.improvedPct >= 20 ? c.great(dog.name) : summary.improvedPct > 0 ? c.some : c.flat;
  const unit = lang === 'el' ? 'μ' : 'm';
  return (
    <View style={styles.hero}>
      <View style={styles.heroHead}>
        <Avatar name={dog.name} size={52} />
        <View style={styles.heroHeadText}>
          <Text style={[styles.heroTitle, fontFallback.display]}>{c.progressOf(dog.name)}</Text>
          {summary && (
            <Text style={[styles.heroSub, fontFallback.body]}>
              {c.lastSession(formatDay(points[points.length - 1].occurredAt, lang))}
            </Text>
          )}
        </View>
      </View>
      {summary ? (
        <>
          <View style={styles.heroNumber}>
            <Text style={[styles.heroValue, fontFallback.display]}>
              {summary.latest}
              {unit}
            </Text>
            <Text style={[styles.heroFrom, fontFallback.body]}>{c.fromStart(summary.first)}</Text>
          </View>
          <Text style={[styles.heroSentence, fontFallback.body]}>{sentence}</Text>
          <ThresholdChart
            points={points}
            lang={lang}
            tone="dark"
            height={170}
            accessibilityLabel={c.chartLabel(dog.name, summary.first, summary.latest)}
          />
        </>
      ) : (
        <Text style={[styles.heroSentence, fontFallback.body]}>{c.noData(dog.name)}</Text>
      )}
    </View>
  );
}

function HomeworkItem({
  item,
  lang,
  busy,
  onToggle,
}: {
  item: HomeworkDTO;
  lang: Lang;
  busy: boolean;
  onToggle: () => void;
}) {
  const c = copy[lang];
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.completed, busy }}
      accessibilityLabel={c.markDone(item.title)}
      disabled={busy}
      onPress={onToggle}
      style={({ hovered, focused }) => [
        styles.hw,
        item.completed ? styles.hwDone : hovered && styles.hwHover,
        focused && styles.focus,
        webCursor,
      ]}
    >
      <View style={[styles.check, item.completed && styles.checkOn, busy && { opacity: 0.5 }]}>
        {item.completed && <IconCheckMark size={18} color={colors.onDark} />}
      </View>
      <View style={styles.hwText}>
        <Text style={[styles.hwTitle, fontFallback.body, item.completed && { color: colors.textOnMint }]}>{item.title}</Text>
        {item.completed ? (
          <Text style={[styles.hwMeta, fontFallback.body]}>
            {c.done}
            {item.completedAt ? ` · ${formatDay(item.completedAt, lang)}` : ''}
          </Text>
        ) : (
          <Text style={[styles.hwBody, fontFallback.body]}>{item.instructions}</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function ClientScreen() {
  const { lang } = useLang();
  const c = copy[lang];
  const { isWide } = useResponsive();
  const { data: session } = useSession();
  const firstName = (session?.user?.name ?? '').split(' ')[0];
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('home');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const [progress, homework, bookings, trainer] = await Promise.all([
        getMyProgress(),
        getMyHomework(),
        getMyBookings(),
        // The trainer card is a nicety — never fail the dashboard over it.
        getMyTrainer().catch(() => null),
      ]);
      setStatus({ kind: 'ready', progress, homework, bookings, trainer });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = useCallback(async (item: HomeworkDTO) => {
    setBusyId(item.id);
    setActionError(null);
    try {
      const updated = await setHomeworkCompleted(item.id, !item.completed);
      setStatus((s) => (s.kind === 'ready' ? { ...s, homework: s.homework.map((h) => (h.id === updated.id ? updated : h)) } : s));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }, []);

  const firstDog = status.kind === 'ready' ? (status.progress[0]?.dog.name ?? null) : null;
  const header = (
    <View style={styles.header}>
      <Title>{c.hello(firstName)}</Title>
      <Muted size={16}>{c.subtitle(firstDog)}</Muted>
    </View>
  );

  if (status.kind !== 'ready') {
    return (
      <Screen maxWidth={1000}>
        {header}
        {status.kind === 'loading' ? (
          <LoadingState label={c.loading} />
        ) : (
          <ErrorState title={c.errorTitle} message={status.message} retryLabel={c.retry} onRetry={() => void load()} />
        )}
      </Screen>
    );
  }

  const show = (t: Tab) => isWide || tab === 'home' || tab === t;
  const next = nextBooking(status.bookings);
  const done = status.homework.filter((h) => h.completed).length;
  const total = status.homework.length;
  const homework = [...status.homework].sort((a, b) => Number(a.completed) - Number(b.completed));

  const progressSection = show('progress') && (
    <View style={styles.section}>
      {status.progress.length === 0 ? (
        <EmptyState message={c.noDogs} />
      ) : (
        status.progress.map((p) => <ProgressCard key={p.dog.id} entry={p} lang={lang} />)
      )}
      {tab === 'progress' && <Muted size={14}>{c.explain}</Muted>}
    </View>
  );

  const nextSection = (tab === 'home' || tab === 'bookings' || isWide) && (
    <View style={styles.next}>
      <View style={styles.nextDate}>
        <IconCalendar color={colors.accent} />
      </View>
      <View style={styles.nextText}>
        <Text style={[styles.nextLabel, fontFallback.body]}>{c.next}</Text>
        {next ? (
          <>
            <Text style={[styles.nextWhen, fontFallback.body]}>{formatDayTime(next.requestedAt, lang)}</Text>
            <Text style={[styles.nextWhat, fontFallback.body]}>{BOOKING_TYPE_LABELS[lang][next.type]}</Text>
          </>
        ) : (
          <Text style={[styles.nextWhat, fontFallback.body]}>{c.noNext}</Text>
        )}
      </View>
      {next && <Pill label={c.bookingStatus[next.status]} tone={next.status === 'confirmed' ? 'mint' : 'neutral'} />}
    </View>
  );

  const homeworkSection = show('homework') && (
    <View style={styles.section}>
      <SectionHeader title={c.homework} action={total > 0 ? <Muted>{c.doneOf(done, total)}</Muted> : undefined} />
      {total > 0 && (
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }}>
          <View style={[styles.fill, { width: `${Math.round((done / total) * 100)}%` }]} />
        </View>
      )}
      {total === 0 && <EmptyState message={c.noHomework} />}
      {homework.map((h) => (
        <HomeworkItem key={h.id} item={h} lang={lang} busy={busyId === h.id} onToggle={() => void onToggle(h)} />
      ))}
      {actionError && <Notice tone="error">{actionError}</Notice>}
    </View>
  );

  const bookingsSection = (tab === 'bookings' || (isWide && status.bookings.length > 1)) && (
    <View style={styles.section}>
      <SectionHeader title={c.allBookings} />
      {status.bookings.length === 0 && <EmptyState message={c.noBookings} />}
      {status.bookings.length > 0 && (
        <Panel style={styles.bookingList}>
          {status.bookings.map((b, i) => (
            <View key={b.id} style={[styles.bookingRow, i > 0 && styles.divider]}>
              <View style={styles.bookingText}>
                <Text style={[styles.bookingWhen, fontFallback.body]}>
                  {formatDay(b.requestedAt, lang)} · {formatTime(b.requestedAt, lang)}
                </Text>
                <Text style={[styles.nextWhat, fontFallback.body]}>{BOOKING_TYPE_LABELS[lang][b.type]}</Text>
              </View>
              <Pill label={c.bookingStatus[b.status]} tone={b.status === 'confirmed' || b.status === 'completed' ? 'mint' : 'neutral'} />
            </View>
          ))}
        </Panel>
      )}
    </View>
  );

  const trainerSection = (tab === 'home' || isWide) && status.trainer && (
    <Panel style={styles.trainer}>
      <Avatar name={status.trainer.name} size={52} />
      <View style={styles.trainerText}>
        <Text style={[styles.nextLabel, fontFallback.body, { color: colors.textMuted }]}>{c.trainer}</Text>
        <Text style={[styles.trainerName, fontFallback.body]}>{status.trainer.name}</Text>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${c.write}: ${status.trainer.name}`}
        onPress={() => void Linking.openURL(`mailto:${status.trainer!.email}`)}
        style={({ hovered, focused }) => [styles.trainerButton, hovered && { backgroundColor: colors.mintSoft }, focused && styles.focus, webCursor]}
      >
        <IconMailOutline size={18} color={colors.primarySoft} />
      </Pressable>
    </Panel>
  );

  return (
    <View style={styles.root}>
      <View style={styles.flex}>
        <Screen maxWidth={1000} padTop={24}>
          {header}
          {isWide ? (
            <View style={styles.columns}>
              <View style={styles.colMain}>
                {progressSection}
                {bookingsSection}
              </View>
              <View style={styles.colSide}>
                {nextSection}
                {homeworkSection}
                {trainerSection}
              </View>
            </View>
          ) : (
            <>
              {progressSection}
              {nextSection}
              {homeworkSection}
              {bookingsSection}
              {trainerSection}
            </>
          )}
        </Screen>
      </View>
      {!isWide && (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.tabBar}>
          <View accessibilityRole="tablist" style={styles.tabRow}>
            {(
              [
                ['home', IconHome],
                ['progress', IconChart],
                ['homework', IconChecklist],
                ['bookings', IconCalendar],
              ] as const
            ).map(([t, Icon]) => {
              const on = tab === t;
              const fg = on ? colors.primarySoft : colors.textMuted;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setTab(t)}
                  style={[styles.tab, webCursor]}
                >
                  <View style={[styles.tabIcon, on && styles.tabIconOn]}>
                    <Icon color={fg} />
                  </View>
                  <Text style={[styles.tabText, fontFallback.body, { color: fg }, on && { fontFamily: fonts.bodyBold }]}>
                    {c.tabs[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { gap: 6 },
  columns: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  colMain: { flex: 3, minWidth: 0, gap: 24 },
  colSide: { flex: 2, minWidth: 0, gap: 24 },
  section: { gap: 12 },
  focus: { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: 'solid' } as object,
  hero: { backgroundColor: colors.primarySoft, borderRadius: 24, padding: 18, gap: 10 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroHeadText: { flex: 1, minWidth: 0, gap: 2 },
  heroTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.onDark },
  heroSub: { fontFamily: fonts.body, fontSize: 14, color: colors.onDarkMuted },
  heroNumber: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 },
  heroValue: { fontFamily: fonts.display, fontSize: 52, lineHeight: 58, color: colors.accentSoft },
  heroFrom: { fontFamily: fonts.body, fontSize: 15, color: colors.onDarkMuted },
  heroSentence: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 23, color: colors.onDark },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.accentPeach,
  },
  nextDate: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  nextText: { flex: 1, minWidth: 0, gap: 2 },
  nextLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textOnPeach },
  nextWhen: { fontFamily: fonts.bodyBold, fontSize: 16.5, color: colors.text },
  nextWhat: { fontFamily: fonts.body, fontSize: 14.5, color: colors.textOnPeach },
  track: { height: 10, borderRadius: radii.pill, backgroundColor: '#F3ECDF', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },
  hw: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.surface,
  },
  hwDone: { backgroundColor: colors.mintSoft, borderColor: colors.mintSoft, alignItems: 'center' },
  hwHover: { backgroundColor: '#FFFDF8' },
  check: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: { backgroundColor: colors.primary },
  hwText: { flex: 1, minWidth: 0, gap: 4 },
  hwTitle: { fontFamily: fonts.bodyBold, fontSize: 16.5, color: colors.text },
  hwBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  hwMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.textOnMint },
  bookingList: { padding: 0, overflow: 'hidden' },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  divider: { borderTopWidth: 1, borderTopColor: '#F3ECDF' },
  bookingText: { flex: 1, minWidth: 0, gap: 2 },
  bookingWhen: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.text },
  trainer: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  trainerText: { flex: 1, minWidth: 0, gap: 2 },
  trainerName: { fontFamily: fonts.bodyBold, fontSize: 16.5, color: colors.text },
  trainerButton: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.fieldBorder },
  tabRow: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4, minHeight: 52 },
  tabIcon: { width: 54, height: 30, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  tabIconOn: { backgroundColor: colors.mintSoft },
  tabText: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
});
