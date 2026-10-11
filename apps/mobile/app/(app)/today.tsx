// =============================================================================
// /today — the trainer's home base.
//
// Answers "what do I need to do?" before anything else: requests and bookings
// waiting for a reply, today's schedule, then the dogs and how they trend.
// Replaces the old /dogs landing, which was a bare list with two dark buttons
// for leads and bookings.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import type { BookingDTO, DogSummaryDTO, LeadDTO } from '@tailsup/shared';
import { colors, fontFallback, fonts } from '../../lib/theme';
import { useLang } from '../../lib/i18n';
import { useSession } from '../../lib/auth-client';
import { ApiError, getDogs, getTrainerBookings, getTrainerLeads } from '../../lib/api';
import {
  BOOKING_TYPE_LABELS,
  formatDayTime,
  formatLongDay,
  formatTime,
  isSameDay,
  parseBookingNotes,
} from '../../lib/labels';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  LoadingState,
  Panel,
  Pill,
  Screen,
  SectionHeader,
  Title,
} from '../../components/app/AppKit';
import { IconCalendar, IconCheckMark, IconChevron, IconInbox, IconPlus } from '../../components/app/AppIcons';
import { DogCard } from '../../components/app/DogCard';
import { useDogTrends } from '../../components/app/useDogTrends';

const LEADS = '/manage/leads' as Href;
const BOOKINGS = '/manage/bookings' as Href;
const DOGS = '/dogs' as Href;

const copy = {
  el: {
    greeting: (h: number, name: string) => `${h < 12 ? 'Καλημέρα' : 'Καλησπέρα'}, ${name}`,
    newSession: 'Νέα συνεδρία',
    loading: 'Φόρτωση…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    noTrainer: 'Ο λογαριασμός δεν έχει προφίλ εκπαιδευτή.',
    newLeads: (n: number) => (n === 1 ? '1 νέο αίτημα' : `${n} νέα αιτήματα`),
    pendingBookings: (n: number) => (n === 1 ? '1 κράτηση προς επιβεβαίωση' : `${n} κρατήσεις προς επιβεβαίωση`),
    allClear: 'Όλα απαντημένα',
    allClearBody: 'Δεν περιμένει κανείς απάντηση.',
    fromSite: 'από τον ιστότοπο',
    schedule: 'Το πρόγραμμα σήμερα',
    nothingToday: 'Τίποτα προγραμματισμένο για σήμερα.',
    next: (when: string) => `Επόμενο: ${when}`,
    dogs: 'Οι σκύλοι σας',
    all: 'Όλοι',
    noDogs: 'Δεν υπάρχουν σκύλοι ακόμα. Μετατρέψτε ένα αίτημα σε πελάτη για να ξεκινήσετε.',
    requested: 'Αναμένει',
  },
  en: {
    greeting: (h: number, name: string) => `${h < 12 ? 'Good morning' : 'Good afternoon'}, ${name}`,
    newSession: 'New session',
    loading: 'Loading…',
    errorTitle: 'Could not load',
    retry: 'Try again',
    noTrainer: 'This account has no trainer profile.',
    newLeads: (n: number) => (n === 1 ? '1 new request' : `${n} new requests`),
    pendingBookings: (n: number) => (n === 1 ? '1 booking to confirm' : `${n} bookings to confirm`),
    allClear: 'All caught up',
    allClearBody: 'Nobody is waiting for a reply.',
    fromSite: 'from the website',
    schedule: "Today's schedule",
    nothingToday: 'Nothing scheduled today.',
    next: (when: string) => `Next: ${when}`,
    dogs: 'Your dogs',
    all: 'All',
    noDogs: 'No dogs yet. Convert a request into a client to get started.',
    requested: 'Pending',
  },
} as const;

type Status =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; dogs: DogSummaryDTO[]; leads: LeadDTO[]; bookings: BookingDTO[] };

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

function AttentionCard({
  tint,
  icon,
  title,
  body,
  onPress,
}: {
  tint: 'peach' | 'mint';
  icon: React.ReactNode;
  title: string;
  body: string;
  onPress?: () => void;
}) {
  const ink = tint === 'peach' ? colors.textOnPeach : colors.textOnMint;
  const inner = (
    <>
      <View style={styles.attIcon}>{icon}</View>
      <View style={styles.attText}>
        <Text style={[styles.attTitle, fontFallback.body, { color: ink }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.attBody, fontFallback.body, { color: ink }]}>
          {body}
        </Text>
      </View>
      {onPress && <IconChevron color={ink} />}
    </>
  );
  const bg = { backgroundColor: tint === 'peach' ? colors.accentPeach : colors.mintSoft };
  if (!onPress) return <View style={[styles.att, bg]}>{inner}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ hovered, focused }) => [styles.att, bg, hovered && { opacity: 0.9 }, focused && styles.focus, webCursor]}
    >
      {inner}
    </Pressable>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const c = copy[lang];
  const { data: session } = useSession();
  const trainerId = session?.user?.trainerId ?? null;
  const firstName = (session?.user?.name ?? '').split(' ')[0];
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    if (!trainerId) {
      setStatus({ kind: 'error', message: copy[lang].noTrainer });
      return;
    }
    try {
      const [dogs, leads, bookings] = await Promise.all([
        getDogs(trainerId),
        getTrainerLeads(trainerId),
        getTrainerBookings(trainerId),
      ]);
      setStatus({ kind: 'ready', dogs, leads, bookings });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) });
    }
  }, [trainerId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const trends = useDogTrends(status.kind === 'ready' ? status.dogs : null);
  const now = new Date();

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Eyebrow>{formatLongDay(now, lang)}</Eyebrow>
        <Title>{c.greeting(now.getHours(), firstName)}</Title>
      </View>
      <Button
        label={c.newSession}
        size="lg"
        icon={<IconPlus size={18} color={colors.text} />}
        onPress={() => router.push(DOGS)}
      />
    </View>
  );

  if (status.kind === 'loading') {
    return (
      <Screen>
        {header}
        <LoadingState label={c.loading} />
      </Screen>
    );
  }
  if (status.kind === 'error') {
    return (
      <Screen>
        {header}
        <ErrorState title={c.errorTitle} message={status.message} retryLabel={c.retry} onRetry={() => void load()} />
      </Screen>
    );
  }

  const newLeads = status.leads
    .filter((l) => l.status === 'new')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pending = status.bookings
    .filter((b) => b.status === 'requested')
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  const today = status.bookings
    .filter((b) => (b.status === 'confirmed' || b.status === 'requested') && isSameDay(b.requestedAt, now))
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  const nextUp = status.bookings
    .filter((b) => b.status === 'confirmed' && new Date(b.requestedAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())[0];

  return (
    <Screen>
      {header}

      <View style={styles.attGrid}>
        {newLeads.length > 0 && (
          <AttentionCard
            tint="peach"
            icon={<IconInbox color={colors.accent} />}
            title={c.newLeads(newLeads.length)}
            body={`${newLeads[0].name} · ${c.fromSite}`}
            onPress={() => router.push(LEADS)}
          />
        )}
        {pending.length > 0 && (
          <AttentionCard
            tint="mint"
            icon={<IconCalendar color={colors.primary} />}
            title={c.pendingBookings(pending.length)}
            body={`${BOOKING_TYPE_LABELS[lang][pending[0].type]} · ${formatDayTime(pending[0].requestedAt, lang)}`}
            onPress={() => router.push(BOOKINGS)}
          />
        )}
        {newLeads.length === 0 && pending.length === 0 && (
          <AttentionCard
            tint="mint"
            icon={<IconCheckMark color={colors.primary} />}
            title={c.allClear}
            body={c.allClearBody}
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={c.schedule} />
        {today.length === 0 ? (
          <EmptyState message={nextUp ? `${c.nothingToday} ${c.next(formatDayTime(nextUp.requestedAt, lang))}` : c.nothingToday} />
        ) : (
          <Panel style={styles.list}>
            {today.map((b, i) => {
              const who = parseBookingNotes(b.notes);
              const title = who.name ?? (who.note || BOOKING_TYPE_LABELS[lang][b.type]);
              return (
                <View key={b.id} style={[styles.slot, i > 0 && styles.slotDivider]}>
                  <Text style={[styles.slotTime, fontFallback.display]}>{formatTime(b.requestedAt, lang)}</Text>
                  <Avatar name={title} size={44} />
                  <View style={styles.slotText}>
                    <Text numberOfLines={1} style={[styles.slotTitle, fontFallback.body]}>
                      {title}
                    </Text>
                    <Text style={[styles.slotMeta, fontFallback.body]}>{BOOKING_TYPE_LABELS[lang][b.type]}</Text>
                  </View>
                  {b.status === 'requested' && <Pill label={c.requested} tone="peach" />}
                </View>
              );
            })}
          </Panel>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title={c.dogs}
          action={
            status.dogs.length > 0 ? (
              <Pressable accessibilityRole="link" onPress={() => router.push(DOGS)} style={webCursor}>
                <Text style={[styles.link, fontFallback.body]}>{c.all} →</Text>
              </Pressable>
            ) : undefined
          }
        />
        {status.dogs.length === 0 ? (
          <EmptyState message={c.noDogs} />
        ) : (
          <View style={styles.dogGrid}>
            {status.dogs.slice(0, 6).map((dog) => (
              <DogCard
                key={dog.id}
                dog={dog}
                lang={lang}
                points={trends[dog.id]?.points}
                lastSessionAt={trends[dog.id]?.lastSessionAt}
                onOpen={() => router.push({ pathname: '/dogs/[id]/timeline', params: { id: dog.id } })}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  headerText: { gap: 6, flexShrink: 1 },
  attGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  att: {
    flexGrow: 1,
    flexBasis: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  attIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attText: { flex: 1, minWidth: 0, gap: 2 },
  attTitle: { fontFamily: fonts.bodyBold, fontSize: 16 },
  attBody: { fontFamily: fonts.body, fontSize: 14 },
  focus: { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: 'solid' } as object,
  section: { gap: 14 },
  list: { padding: 0, overflow: 'hidden' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18 },
  slotDivider: { borderTopWidth: 1, borderTopColor: '#F3ECDF' },
  slotTime: { width: 58, fontFamily: fonts.display, fontSize: 19, color: colors.text },
  slotText: { flex: 1, minWidth: 0, gap: 2 },
  slotTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  slotMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  link: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.accent },
  dogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
