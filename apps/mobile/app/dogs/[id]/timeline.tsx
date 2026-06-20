// =============================================================================
// Dog timeline (Phase 2, Unit C — FR-M5 / AC-10)
//
// GET /dogs/:id/timeline -> sessions newest-first, events newest-first within
// each session. Each event row shows the four tap fields + intervention and
// indicators for note / tags / media (count). Tapping a row -> /events/[id].
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { BehaviorEventDTO, DogTimelineDTO } from '@tailsup/shared';
import { ApiError, getDogTimeline } from '../../../lib/api';

type Status =
  | { kind: 'loading' }
  | { kind: 'success'; timeline: DogTimelineDTO }
  | { kind: 'error'; message: string };

export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const timeline = await getDogTimeline(id);
      setStatus({ kind: 'success', timeline });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Could not load the timeline.',
      });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        {status.kind === 'loading' && (
          <View style={[styles.card, styles.cardNeutral]}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.cardTitle}>Loading timeline…</Text>
          </View>
        )}

        {status.kind === 'error' && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.cardTitle}>✕ Could not load timeline</Text>
            <Text style={styles.cardBody}>{status.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {status.kind === 'success' && (
          <>
            <Text style={styles.heading}>{status.timeline.dog.name}</Text>
            <Text style={styles.subheading}>
              {status.timeline.dog.breed} · timeline (newest first)
            </Text>

            {status.timeline.sessions.length === 0 && (
              <View style={[styles.card, styles.cardNeutral]}>
                <Text style={styles.cardTitle}>No sessions yet</Text>
              </View>
            )}

            {status.timeline.sessions.map((session) => (
              <View key={session.id} style={styles.sessionBlock}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionDate}>{formatDateTime(session.startedAt)}</Text>
                  <Text style={styles.sessionLocation}>{session.location ?? 'No location'}</Text>
                </View>

                {session.events.length === 0 && (
                  <Text style={styles.emptyEvents}>No events logged in this session.</Text>
                )}

                {session.events.map((event) => (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/events/[id]', params: { id: event.id } })
                    }
                    style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
                  >
                    <EventRow event={event} />
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EventRow({ event }: { event: BehaviorEventDTO }) {
  const hasNote = event.note != null && event.note.trim() !== '';
  const tagCount = event.tags?.length ?? 0;
  return (
    <View style={styles.eventInner}>
      <View style={styles.eventTopRow}>
        <Text style={styles.eventTrigger}>{event.triggerType}</Text>
        <Text style={styles.eventTime}>{formatTime(event.occurredAt)}</Text>
      </View>
      <Text style={styles.eventLine}>
        intensity {event.intensity}/10 · {event.thresholdMeters}m · {event.outcome}
      </Text>
      <Text style={styles.eventIntervention}>intervention: {event.intervention}</Text>
      <View style={styles.indicatorRow}>
        {hasNote && <Indicator label="note" />}
        {tagCount > 0 && <Indicator label={`${tagCount} tag${tagCount > 1 ? 's' : ''}`} />}
      </View>
    </View>
  );
}

function Indicator({ label }: { label: string }) {
  return (
    <View style={styles.indicator}>
      <Text style={styles.indicatorText}>{label}</Text>
    </View>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: {
    padding: 20,
    gap: 14,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({ web: { minHeight: '100%' as unknown as number }, default: {} }),
  },
  heading: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subheading: { fontSize: 14, color: '#64748b', marginTop: -6 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1, gap: 8 },
  cardNeutral: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  cardBody: { fontSize: 14, color: '#334155' },
  sessionBlock: { gap: 8 },
  sessionHeader: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  sessionDate: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
  sessionLocation: { color: '#94a3b8', fontSize: 12 },
  emptyEvents: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingHorizontal: 4 },
  eventRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  eventInner: { gap: 4 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTrigger: { fontSize: 16, fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' },
  eventTime: { fontSize: 12, color: '#64748b' },
  eventLine: { fontSize: 14, color: '#334155' },
  eventIntervention: { fontSize: 13, color: '#475569' },
  indicatorRow: { flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  indicator: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  indicatorText: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  retryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
