// =============================================================================
// /manage/bookings — booking requests and the calendar ahead (Phase 3b-2,
// redesigned).
//
// Three tabs: waiting for an answer (requested), upcoming (confirmed, in the
// future) and past (everything settled). Each booking shows WHO asked (the
// name/contact the public form folds into `notes`), WHAT, and WHEN, with the
// one or two actions that make sense for its stage:
//   requested → Επιβεβαίωση / Απόρριψη
//   confirmed → Ολοκληρώθηκε / Ακύρωση
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BookingDTO, BookingStatus } from '@tailsup/shared';
import { colors, fontFallback, fonts, radii } from '../../../lib/theme';
import { useLang, type Lang } from '../../../lib/i18n';
import { useSession } from '../../../lib/auth-client';
import { ApiError, getTrainerBookings, updateBookingStatus } from '../../../lib/api';
import { BOOKING_TYPE_LABELS, formatTime, parseBookingNotes } from '../../../lib/labels';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Muted,
  Notice,
  Panel,
  Pill,
  Screen,
  Title,
  type PillTone,
} from '../../../components/app/AppKit';
import { IconCheckMark } from '../../../components/app/AppIcons';

type Tab = 'pending' | 'upcoming' | 'past';
type Action = Exclude<BookingStatus, 'requested'>;

const copy = {
  el: {
    title: 'Κρατήσεις',
    subtitle: 'Αιτήματα ραντεβού από τον ιστότοπο και το πρόγραμμα που έρχεται.',
    tabs: { pending: 'Αναμένουν', upcoming: 'Επερχόμενες', past: 'Παλιές' } as Record<Tab, string>,
    empty: {
      pending: 'Καμία κράτηση δεν περιμένει απάντηση.',
      upcoming: 'Τίποτα προγραμματισμένο.',
      past: 'Δεν υπάρχουν παλιές κρατήσεις.',
    } as Record<Tab, string>,
    loading: 'Φόρτωση…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    noTrainer: 'Ο λογαριασμός δεν έχει προφίλ εκπαιδευτή.',
    status: {
      requested: 'Αναμένει',
      confirmed: 'Επιβεβαιώθηκε',
      declined: 'Απορρίφθηκε',
      completed: 'Ολοκληρώθηκε',
      cancelled: 'Ακυρώθηκε',
    } as Record<BookingStatus, string>,
    actions: {
      confirmed: 'Επιβεβαίωση',
      declined: 'Απόρριψη',
      completed: 'Ολοκληρώθηκε',
      cancelled: 'Ακύρωση',
    } as Record<Action, string>,
    unnamed: 'Χωρίς όνομα',
  },
  en: {
    title: 'Bookings',
    subtitle: 'Appointment requests from the website and the schedule ahead.',
    tabs: { pending: 'Waiting', upcoming: 'Upcoming', past: 'Past' } as Record<Tab, string>,
    empty: {
      pending: 'No booking is waiting for an answer.',
      upcoming: 'Nothing scheduled.',
      past: 'No past bookings.',
    } as Record<Tab, string>,
    loading: 'Loading…',
    errorTitle: 'Could not load bookings',
    retry: 'Try again',
    noTrainer: 'This account has no trainer profile.',
    status: {
      requested: 'Waiting',
      confirmed: 'Confirmed',
      declined: 'Declined',
      completed: 'Completed',
      cancelled: 'Cancelled',
    } as Record<BookingStatus, string>,
    actions: {
      confirmed: 'Confirm',
      declined: 'Decline',
      completed: 'Completed',
      cancelled: 'Cancel',
    } as Record<Action, string>,
    unnamed: 'No name',
  },
} as const;

const STATUS_TONE: Record<BookingStatus, PillTone> = {
  requested: 'peach',
  confirmed: 'mint',
  completed: 'mint',
  declined: 'neutral',
  cancelled: 'neutral',
};

type Status = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; bookings: BookingDTO[] };

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

function tabOf(b: BookingDTO, now: number): Tab {
  if (b.status === 'requested') return 'pending';
  if (b.status === 'confirmed' && new Date(b.requestedAt).getTime() >= now) return 'upcoming';
  return 'past';
}

function DateBlock({ iso, lang }: { iso: string; lang: Lang }) {
  const d = new Date(iso);
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  return (
    <View style={styles.dateBlock}>
      <Text style={[styles.dateMonth, fontFallback.body]}>{d.toLocaleDateString(locale, { month: 'short' })}</Text>
      <Text style={[styles.dateDay, fontFallback.display]}>{d.getDate()}</Text>
      <Text style={[styles.dateWeekday, fontFallback.body]}>{d.toLocaleDateString(locale, { weekday: 'short' })}</Text>
    </View>
  );
}

export default function BookingsScreen() {
  const { lang } = useLang();
  const c = copy[lang];
  const { data: session } = useSession();
  const trainerId = session?.user?.trainerId ?? null;
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('pending');
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    if (!trainerId) {
      setStatus({ kind: 'error', message: copy[lang].noTrainer });
      return;
    }
    try {
      setStatus({ kind: 'ready', bookings: await getTrainerBookings(trainerId) });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ApiError ? err.message : String(err) });
    }
  }, [trainerId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAction = useCallback(async (id: string, action: Action) => {
    setBusy({ id, action });
    setActionError(null);
    try {
      const updated = await updateBookingStatus(id, { status: action });
      setStatus((s) =>
        s.kind === 'ready' ? { ...s, bookings: s.bookings.map((b) => (b.id === updated.id ? updated : b)) } : s,
      );
    } catch (err) {
      setActionError({ id, message: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }, []);

  const now = Date.now();
  const bookings = status.kind === 'ready' ? status.bookings : [];
  const visible = bookings
    .filter((b) => tabOf(b, now) === tab)
    .sort((a, b) => {
      const d = new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
      return tab === 'past' ? -d : d;
    });

  return (
    <Screen maxWidth={900}>
      <View style={styles.header}>
        <Title>{c.title}</Title>
        <Muted size={16}>{c.subtitle}</Muted>
      </View>

      {status.kind === 'loading' && <LoadingState label={c.loading} />}
      {status.kind === 'error' && (
        <ErrorState title={c.errorTitle} message={status.message} retryLabel={c.retry} onRetry={() => void load()} />
      )}

      {status.kind === 'ready' && (
        <>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {(['pending', 'upcoming', 'past'] as const).map((t) => {
              const on = t === tab;
              const n = bookings.filter((b) => tabOf(b, now) === t).length;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setTab(t)}
                  style={({ hovered, focused }) => [
                    styles.tab,
                    on ? styles.tabOn : hovered && styles.tabHover,
                    focused && styles.focus,
                    webCursor,
                  ]}
                >
                  <Text style={[styles.tabText, fontFallback.body, on && styles.tabTextOn]}>
                    {c.tabs[t]} · {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {visible.length === 0 ? (
            <EmptyState message={c.empty[tab]} />
          ) : (
            <View style={styles.list}>
              {visible.map((b) => {
                const who = parseBookingNotes(b.notes);
                const actions: Action[] =
                  b.status === 'requested' ? ['confirmed', 'declined'] : b.status === 'confirmed' ? ['completed', 'cancelled'] : [];
                const email = who.contact && /@/.test(who.contact) ? who.contact : null;
                return (
                  <Panel key={b.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <DateBlock iso={b.requestedAt} lang={lang} />
                      <View style={styles.cardText}>
                        <View style={styles.cardHead}>
                          <Text numberOfLines={1} style={[styles.name, fontFallback.body]}>
                            {who.name ?? c.unnamed}
                          </Text>
                          <Pill label={c.status[b.status]} tone={STATUS_TONE[b.status]} />
                        </View>
                        <Text style={[styles.meta, fontFallback.body]}>
                          {BOOKING_TYPE_LABELS[lang][b.type]} · {formatTime(b.requestedAt, lang)}
                        </Text>
                        {who.contact &&
                          (email ? (
                            <Pressable
                              accessibilityRole="link"
                              onPress={() => void Linking.openURL(`mailto:${email}`)}
                              style={webCursor}
                            >
                              <Text style={[styles.link, fontFallback.body]}>{who.contact}</Text>
                            </Pressable>
                          ) : (
                            <Text style={[styles.meta, fontFallback.body]}>{who.contact}</Text>
                          ))}
                        {who.note ? <Text style={[styles.note, fontFallback.body]}>«{who.note}»</Text> : null}
                      </View>
                    </View>
                    {actions.length > 0 && (
                      <View style={styles.actions}>
                        {actions.map((a, i) => (
                          <Button
                            key={a}
                            label={c.actions[a]}
                            variant={i === 0 ? (a === 'confirmed' ? 'primary' : 'green') : 'quiet'}
                            icon={i === 0 ? <IconCheckMark size={18} color={a === 'confirmed' ? colors.text : colors.onDark} /> : undefined}
                            loading={busy?.id === b.id && busy.action === a}
                            disabled={!!busy}
                            onPress={() => void onAction(b.id, a)}
                          />
                        ))}
                      </View>
                    )}
                    {actionError?.id === b.id && <Notice tone="error">{actionError.message}</Notice>}
                  </Panel>
                );
              })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: colors.text, borderColor: colors.text },
  tabHover: { backgroundColor: colors.bgAlt },
  tabText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  tabTextOn: { fontFamily: fonts.bodyBold, color: colors.onDark },
  focus: { outlineColor: colors.accent, outlineWidth: 2, outlineStyle: 'solid' } as object,
  list: { gap: 12 },
  card: { gap: 14 },
  cardRow: { flexDirection: 'row', gap: 16 },
  dateBlock: {
    width: 62,
    borderRadius: 14,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  dateMonth: { fontFamily: fonts.bodyBold, fontSize: 12, textTransform: 'uppercase', color: colors.accent },
  dateDay: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.text },
  dateWeekday: { fontFamily: fonts.body, fontSize: 12, color: colors.textOnPeach },
  cardText: { flex: 1, minWidth: 0, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 14.5, color: colors.textMuted },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.accent },
  note: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
