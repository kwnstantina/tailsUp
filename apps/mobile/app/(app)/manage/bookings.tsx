// =============================================================================
// /manage/bookings — TRAINER booking triage (Phase 3b-2, Unit C2 · AC-3b-9)
//
// Reads the trainer id from the session, lists bookings newest-first (type +
// requestedAt + StatusBadge), and offers the four status transitions (DG-4):
// confirmed | declined | completed | cancelled → PATCH /bookings/:id/status.
// The list reflects the new status on success; ApiError (400 bad status, 404
// not-theirs) surfaces inline. Discriminated-union Status loading pattern.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BookingDTO } from '@tailsup/shared';
import { colors, fontFallback, layout, radii, space, type as t } from '../../../lib/theme';
import { useLang, type Lang } from '../../../lib/i18n';
import { useSession } from '../../../lib/auth-client';
import { ApiError, getTrainerBookings, updateBookingStatus } from '../../../lib/api';
import { StatusBadge } from '../../../components/StatusBadge';

// The four valid transition targets (DG-4) — `requested` is never a target.
const ACTIONS = ['confirmed', 'declined', 'completed', 'cancelled'] as const;
type Action = (typeof ACTIONS)[number];

const copy = {
  el: {
    heading: 'Κρατήσεις',
    subheading: 'Αιτήματα κράτησης — άλλαξε την κατάστασή τους.',
    loading: 'Φόρτωση…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    noTrainer: 'Ο λογαριασμός δεν έχει προφίλ εκπαιδευτή. Συνδέσου ως εκπαιδευτής.',
    empty: 'Δεν υπάρχουν κρατήσεις ακόμη.',
    requestedAt: 'Ζητήθηκε για',
    actions: {
      confirmed: 'Επιβεβαίωση',
      declined: 'Απόρριψη',
      completed: 'Ολοκλήρωση',
      cancelled: 'Ακύρωση',
    } as Record<Action, string>,
    types: { assessment: 'Αξιολόγηση', private: 'Ιδιωτική', group: 'Ομαδική' } as Record<string, string>,
  },
  en: {
    heading: 'Bookings',
    subheading: 'Booking requests — change their status.',
    loading: 'Loading…',
    errorTitle: 'Could not load bookings',
    retry: 'Try again',
    noTrainer: 'This account has no trainer profile. Sign in as a trainer.',
    empty: 'No bookings yet.',
    requestedAt: 'Requested for',
    actions: {
      confirmed: 'Confirm',
      declined: 'Decline',
      completed: 'Complete',
      cancelled: 'Cancel',
    } as Record<Action, string>,
    types: { assessment: 'Assessment', private: 'Private', group: 'Group' } as Record<string, string>,
  },
} as const;

type Copy = (typeof copy)[Lang];

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; bookings: BookingDTO[] }
  | { kind: 'error'; message: string };

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ManageBookingsScreen() {
  const { lang } = useLang();
  const c = copy[lang];
  const { data: session } = useSession();
  const trainerId = session?.user?.trainerId ?? null;

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'pending' });
    if (!trainerId) {
      setStatus({ kind: 'error', message: copy[lang].noTrainer });
      return;
    }
    try {
      const bookings = await getTrainerBookings(trainerId);
      bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setStatus({ kind: 'success', bookings });
    } catch (err) {
      setStatus({ kind: 'error', message: messageFor(err) });
    }
  }, [trainerId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const onTransition = useCallback(async (id: string, next: Action) => {
    setUpdatingId(id);
    setActionError(null);
    try {
      const updated = await updateBookingStatus(id, { status: next });
      setStatus((s) =>
        s.kind === 'success'
          ? { ...s, bookings: s.bookings.map((b) => (b.id === updated.id ? updated : b)) }
          : s,
      );
    } catch (err) {
      setActionError({ id, message: messageFor(err) });
    } finally {
      setUpdatingId(null);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>{c.heading}</Text>
        <Text style={styles.subheading}>{c.subheading}</Text>

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
                styles.actionButton,
                focused && styles.focusRing,
                pressed && styles.pressed,
                Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
              ]}
            >
              <Text style={styles.actionButtonText}>{c.retry}</Text>
            </Pressable>
          </View>
        )}

        {status.kind === 'success' && status.bookings.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardBody}>{c.empty}</Text>
          </View>
        )}

        {status.kind === 'success' &&
          status.bookings.map((booking) => {
            const busy = updatingId === booking.id;
            return (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <Text style={styles.bookingType}>{c.types[booking.type] ?? booking.type}</Text>
                  <StatusBadge status={booking.status} />
                </View>
                <Text style={styles.bookingMeta}>
                  {c.requestedAt}: {formatDateTime(booking.requestedAt, lang)}
                </Text>
                {booking.notes ? <Text style={styles.bookingNotes}>{booking.notes}</Text> : null}

                <View style={styles.actionRow}>
                  {ACTIONS.map((action) => {
                    const isCurrent = booking.status === action;
                    return (
                      <Pressable
                        key={action}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: busy || isCurrent, busy }}
                        disabled={busy || isCurrent}
                        onPress={() => void onTransition(booking.id, action)}
                        style={({ focused, pressed }) => [
                          styles.actionButton,
                          focused && styles.focusRing,
                          pressed && styles.pressed,
                          (busy || isCurrent) && styles.blocked,
                          Platform.select({ web: { cursor: busy || isCurrent ? 'default' : 'pointer' } as object, default: {} }),
                        ]}
                      >
                        <Text style={styles.actionButtonText}>{c.actions[action]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {busy && <ActivityIndicator color={colors.primary} style={styles.busySpinner} />}
                {actionError?.id === booking.id && (
                  <Text style={styles.errorText}>{actionError.message}</Text>
                )}
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
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
  heading: { ...t.h2, ...fontFallback.display, color: colors.text },
  subheading: { ...t.body, ...fontFallback.body, color: colors.textMuted, marginTop: -space.xs },
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
  bookingCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
    gap: space.xs,
  },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  bookingType: { ...t.h3, ...fontFallback.display, color: colors.text },
  bookingMeta: { ...t.caption, ...fontFallback.body, color: colors.textMuted },
  bookingNotes: { ...t.body, ...fontFallback.body, color: colors.text, marginTop: space.xs },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.base,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  actionButtonText: { ...t.caption, ...fontFallback.body, color: colors.bg, fontSize: 13 },
  focusRing: { borderColor: colors.accent },
  pressed: { opacity: 0.85 },
  blocked: { opacity: 0.5 },
  busySpinner: { alignSelf: 'flex-start', marginTop: space.xs },
  errorText: { ...t.body, ...fontFallback.body, color: '#B00020', marginTop: space.xs },
});
