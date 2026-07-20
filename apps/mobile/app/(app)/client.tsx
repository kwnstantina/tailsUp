// =============================================================================
// /client — the CLIENT DASHBOARD (Phase 3b-2, Unit C2 · AC-3b-10)
//
// Replaces the 3b-1 placeholder with the real dashboard. On mount it fetches the
// client's progress, homework and bookings in parallel (session-scoped /me/*),
// tracked by a discriminated-union Status (idle → pending → success | error).
// It renders:
//   (a) Progress — one ProgressCurve per dog fed the DTO's chronological points.
//       DG-8: thresholdMeters FALLS over time; a shorter coping distance means
//       the dog stays calm even when the trigger is closer — so the caption
//       frames a falling line as IMPROVEMENT (before → now distance).
//   (b) Homework — a HomeworkRow per item (incomplete first); "mark complete"
//       calls completeHomework(id) with a pending row and updates it on success,
//       surfacing an ApiError inline on failure.
//   (c) Reminders — DERIVED in-app (DG-3, no new fetch): pending-homework count
//       + the next upcoming booking (future requestedAt, not declined/cancelled).
// Keeps the useLang() EL/EN copy-object pattern; empty data → friendly cards.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BookingDTO, ClientProgressDTO, HomeworkDTO } from '@tailsup/shared';
import { colors, fontFallback, layout, radii, space, type as t, useReducedMotion } from '../../lib/theme';
import { useLang, type Lang } from '../../lib/i18n';
import { useSession } from '../../lib/auth-client';
import { ApiError, completeHomework, getMyBookings, getMyHomework, getMyProgress } from '../../lib/api';
import { ProgressCurve } from '../../components/ProgressCurve';
import { HomeworkRow } from '../../components/HomeworkRow';

const copy = {
  el: {
    eyebrow: 'Ο λογαριασμός μου',
    greeting: (name: string) => `Γεια σου, ${name}`,
    loading: 'Φόρτωση του πίνακά σου…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    progressTitle: 'Πρόοδος',
    progressHelp:
      'Η γραμμή δείχνει την απόσταση στην οποία ο σκύλος σου μένει ήρεμος. Όσο πιο κοντά (χαμηλότερη), τόσο καλύτερα — μαθαίνει να παραμένει ήρεμος ακόμη κι όταν το ερέθισμα πλησιάζει.',
    distanceLabel: (from: number, to: number) => `Απόσταση ηρεμίας: ${from}m → ${to}m`,
    distanceImproved: 'Πλησιάζει με άνεση — πρόοδος.',
    distanceSteady: 'Σταθερή απόσταση ηρεμίας.',
    noSessions: 'Δεν έχουν καταγραφεί ακόμη συνεδρίες για αυτόν τον σκύλο.',
    noDogs: 'Δεν υπάρχει ακόμη σκύλος συνδεδεμένος με τον λογαριασμό σου.',
    homeworkTitle: 'Ασκήσεις για το σπίτι',
    noHomework: 'Δεν υπάρχουν ασκήσεις αυτή τη στιγμή.',
    remindersTitle: 'Υπενθυμίσεις',
    pendingHomework: (n: number) =>
      n === 1 ? '1 άσκηση σε εκκρεμότητα' : `${n} ασκήσεις σε εκκρεμότητα`,
    noPendingHomework: 'Όλες οι ασκήσεις ολοκληρώθηκαν 🎉',
    nextBooking: (type: string, date: string) => `Επόμενη συνεδρία: ${type} — ${date}`,
    noBooking: 'Καμία προγραμματισμένη συνεδρία.',
  },
  en: {
    eyebrow: 'My account',
    greeting: (name: string) => `Hello, ${name}`,
    loading: 'Loading your dashboard…',
    errorTitle: 'Could not load your dashboard',
    retry: 'Try again',
    progressTitle: 'Progress',
    progressHelp:
      "The line shows the distance at which your dog stays calm. Closer (lower) is better — it means they cope even as the trigger gets nearer.",
    distanceLabel: (from: number, to: number) => `Coping distance: ${from}m → ${to}m`,
    distanceImproved: 'Coping at a closer distance — that’s progress.',
    distanceSteady: 'Steady coping distance.',
    noSessions: 'No sessions logged yet for this dog.',
    noDogs: 'No dog is linked to your account yet.',
    homeworkTitle: 'Homework',
    noHomework: 'No homework right now.',
    remindersTitle: 'Reminders',
    pendingHomework: (n: number) => (n === 1 ? '1 homework item pending' : `${n} homework items pending`),
    noPendingHomework: 'All homework complete 🎉',
    nextBooking: (type: string, date: string) => `Next session: ${type} — ${date}`,
    noBooking: 'No upcoming session scheduled.',
  },
} as const;

const BOOKING_TYPE_LABELS: Record<Lang, Record<string, string>> = {
  el: { assessment: 'Αξιολόγηση', private: 'Ιδιωτική', group: 'Ομαδική' },
  en: { assessment: 'Assessment', private: 'Private', group: 'Group' },
};

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; progress: ClientProgressDTO[]; homework: HomeworkDTO[]; bookings: BookingDTO[] }
  | { kind: 'error'; message: string };

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

// Next upcoming booking: a future requestedAt whose status is still live
// (not declined/cancelled/completed), earliest first. DG-3 — derived in-app.
function nextUpcomingBooking(bookings: BookingDTO[]): BookingDTO | null {
  const now = Date.now();
  const upcoming = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'requested')
    .filter((b) => {
      const ts = new Date(b.requestedAt).getTime();
      return !Number.isNaN(ts) && ts >= now;
    })
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  return upcoming[0] ?? null;
}

function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ClientScreen() {
  const { lang } = useLang();
  const c = copy[lang];
  const { data: session } = useSession();
  const name = session?.user?.name ?? '';
  // Quality floor: the reduced-motion preference is honoured (the curve renders
  // as a static final state); read here to keep the screen motion-safe.
  void useReducedMotion();

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'pending' });
    setActionError(null);
    try {
      const [progress, homework, bookings] = await Promise.all([
        getMyProgress(),
        getMyHomework(),
        getMyBookings(),
      ]);
      setStatus({ kind: 'success', progress, homework, bookings });
    } catch (err) {
      setStatus({ kind: 'error', message: messageFor(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onComplete = useCallback(async (id: string) => {
    setCompletingId(id);
    setActionError(null);
    try {
      const updated = await completeHomework(id);
      setStatus((s) =>
        s.kind === 'success'
          ? { ...s, homework: s.homework.map((h) => (h.id === updated.id ? updated : h)) }
          : s,
      );
    } catch (err) {
      setActionError(messageFor(err));
    } finally {
      setCompletingId(null);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>{c.eyebrow}</Text>
        <Text style={styles.title}>{c.greeting(name)}</Text>

        {(status.kind === 'idle' || status.kind === 'pending') && (
          <View style={[styles.card, styles.cardRow]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.cardBody}>{c.loading}</Text>
          </View>
        )}

        {status.kind === 'error' && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.cardTitle}>{c.errorTitle}</Text>
            <Text style={styles.cardBody}>{status.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ focused, pressed }) => [
                styles.retryButton,
                focused && styles.focusRing,
                pressed && styles.pressed,
                Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
              ]}
            >
              <Text style={styles.retryButtonText}>{c.retry}</Text>
            </Pressable>
          </View>
        )}

        {status.kind === 'success' && (
          <>
            {/* ── (a) Progress ──────────────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>{c.progressTitle}</Text>
            <Text style={styles.sectionHelp}>{c.progressHelp}</Text>
            {status.progress.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardBody}>{c.noDogs}</Text>
              </View>
            ) : (
              status.progress.map((p) => (
                <ProgressPanel key={p.dog.id} c={c} progress={p} />
              ))
            )}

            {/* ── (b) Homework ──────────────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>{c.homeworkTitle}</Text>
            {actionError && (
              <View style={[styles.card, styles.cardError]}>
                <Text style={styles.cardBody}>{actionError}</Text>
              </View>
            )}
            {status.homework.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardBody}>{c.noHomework}</Text>
              </View>
            ) : (
              [...status.homework]
                .sort((a, b) => Number(a.completed) - Number(b.completed))
                .map((h) => (
                  <HomeworkRow
                    key={h.id}
                    homework={h}
                    pending={completingId === h.id}
                    onComplete={() => void onComplete(h.id)}
                  />
                ))
            )}

            {/* ── (c) Reminders (derived in-app, DG-3) ──────────────────────── */}
            <RemindersCard c={c} lang={lang} homework={status.homework} bookings={status.bookings} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type Copy = (typeof copy)[Lang];

function ProgressPanel({ c, progress }: { c: Copy; progress: ClientProgressDTO }) {
  const { points, dog } = progress;
  if (points.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{dog.name}</Text>
        <Text style={styles.cardBody}>{c.noSessions}</Text>
      </View>
    );
  }
  const first = points[0].thresholdMeters;
  const last = points[points.length - 1].thresholdMeters;
  // DG-8: a FALLING threshold (coping at a closer distance) is improvement.
  const improved = last < first;
  return (
    <View style={styles.progressCard}>
      <Text style={styles.cardTitle}>{dog.name}</Text>
      <ProgressCurve data={points} height={200} style={styles.curve} />
      <Text style={styles.distanceLabel}>{c.distanceLabel(first, last)}</Text>
      <Text style={styles.distanceNote}>{improved ? c.distanceImproved : c.distanceSteady}</Text>
    </View>
  );
}

function RemindersCard({
  c,
  lang,
  homework,
  bookings,
}: {
  c: Copy;
  lang: Lang;
  homework: HomeworkDTO[];
  bookings: BookingDTO[];
}) {
  const pending = homework.filter((h) => !h.completed).length;
  const next = nextUpcomingBooking(bookings);
  return (
    <View style={styles.remindersCard}>
      <Text style={styles.remindersTitle}>{c.remindersTitle}</Text>
      <Text style={styles.reminderItem}>
        {pending > 0 ? `• ${c.pendingHomework(pending)}` : `• ${c.noPendingHomework}`}
      </Text>
      <Text style={styles.reminderItem}>
        {next
          ? `• ${c.nextBooking(BOOKING_TYPE_LABELS[lang][next.type] ?? next.type, formatDateTime(next.requestedAt, lang))}`
          : `• ${c.noBooking}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: space.md,
    gap: space.sm,
    maxWidth: layout.maxProse,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: { ...t.eyebrow },
  title: { ...t.h2, ...fontFallback.display, color: colors.text },
  sectionTitle: { ...t.h3, ...fontFallback.display, color: colors.text, marginTop: space.sm },
  sectionHelp: { ...t.caption, ...fontFallback.body, color: colors.textMuted, marginTop: -space.xs },
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
    gap: space.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardError: { backgroundColor: '#FBEAEA', borderColor: '#E4B7B7' },
  cardTitle: { ...t.h3, ...fontFallback.display, color: colors.text },
  cardBody: { ...t.body, ...fontFallback.body, color: colors.textMuted },
  progressCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
    gap: space.xs,
  },
  curve: { marginTop: space.xs },
  distanceLabel: { ...t.body, ...fontFallback.body, color: colors.text, marginTop: space.xs },
  distanceNote: { ...t.caption, ...fontFallback.body, color: colors.accent },
  remindersCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: space.md,
    gap: 6,
  },
  remindersTitle: { ...t.h3, ...fontFallback.display, color: colors.bg },
  reminderItem: { ...t.body, ...fontFallback.body, color: colors.bg },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radii.base,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: space.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  retryButtonText: { ...t.body, ...fontFallback.body, color: colors.bg },
  focusRing: { borderColor: colors.accent },
  pressed: { opacity: 0.85 },
});
