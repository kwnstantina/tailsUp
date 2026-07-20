// =============================================================================
// Dog list / entry point (Phase 2, Unit C — FR-M6)
//
// Reads EXPO_PUBLIC_TRAINER_ID (static dot-access — G-1) and lists the trainer's
// dogs via GET /trainers/:trainerId/dogs. Each dog offers two actions:
//   - Open timeline  -> /dogs/[id]/timeline
//   - Start session  -> POST /dogs/:id/sessions, then /sessions/[id]/log
// Loading / empty / error states mirror the Phase 1 health screen.
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
import { useRouter, type Href } from 'expo-router';
import type { DogSummaryDTO } from '@tailsup/shared';
import { ApiError, getDogs, startSession } from '../../../lib/api';
import { useSession } from '../../../lib/auth-client';

// The trainer management routes. Cast to Href because Metro regenerates the
// typed-route union only on `expo start`/export — the new /manage/* routes are
// not yet in .expo/types/router.d.ts at typecheck time (see plan typed-route note).
const MANAGE_LEADS = '/manage/leads' as Href;
const MANAGE_BOOKINGS = '/manage/bookings' as Href;

type Status =
  | { kind: 'loading' }
  | { kind: 'success'; dogs: DogSummaryDTO[] }
  | { kind: 'error'; message: string };

export default function DogsScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  // Phase 3b: the trainer id comes from the authenticated session (retires the
  // EXPO_PUBLIC_TRAINER_ID stop-gap). A client who reaches this screen has no
  // trainerId — the load surfaces that, and the API would 403 regardless.
  const trainerId = session?.user?.trainerId ?? null;
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [startingId, setStartingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    if (!trainerId) {
      setStatus({
        kind: 'error',
        message: 'This account has no trainer profile. Sign in with a trainer account.',
      });
      return;
    }
    try {
      const dogs = await getDogs(trainerId);
      setStatus({ kind: 'success', dogs });
    } catch (err) {
      setStatus({ kind: 'error', message: messageFor(err) });
    }
  }, [trainerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onStartSession = useCallback(
    async (dogId: string) => {
      setStartingId(dogId);
      try {
        const session = await startSession(dogId);
        router.push({ pathname: '/sessions/[id]/log', params: { id: session.id } });
      } catch (err) {
        setStatus({ kind: 'error', message: messageFor(err) });
      } finally {
        setStartingId(null);
      }
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>My Dogs</Text>
        <Text style={styles.subheading}>Pick a dog to view its timeline or start a session</Text>

        <View style={styles.manageRow}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(MANAGE_LEADS)}
            style={({ focused, pressed }) => [
              styles.manageButton,
              focused && styles.manageButtonFocused,
              pressed && styles.buttonPressed,
              Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
            ]}
          >
            <Text style={styles.manageButtonText}>Leads</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(MANAGE_BOOKINGS)}
            style={({ focused, pressed }) => [
              styles.manageButton,
              focused && styles.manageButtonFocused,
              pressed && styles.buttonPressed,
              Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
            ]}
          >
            <Text style={styles.manageButtonText}>Bookings</Text>
          </Pressable>
        </View>

        {status.kind === 'loading' && (
          <View style={[styles.card, styles.cardNeutral]}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.cardTitle}>Loading dogs…</Text>
          </View>
        )}

        {status.kind === 'error' && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.cardTitle}>✕ Could not load dogs</Text>
            <Text style={styles.cardBody}>{status.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {status.kind === 'success' && status.dogs.length === 0 && (
          <View style={[styles.card, styles.cardNeutral]}>
            <Text style={styles.cardTitle}>No dogs yet</Text>
            <Text style={styles.cardBody}>
              This trainer has no dogs. Seed a client + dog, then reload.
            </Text>
          </View>
        )}

        {status.kind === 'success' &&
          status.dogs.map((dog) => (
            <View key={dog.id} style={styles.dogCard}>
              <View style={styles.dogHeader}>
                <Text style={styles.dogName}>{dog.name}</Text>
                <Text style={styles.dogMeta}>
                  {dog.breed} · {formatAge(dog.ageMonths)}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/dogs/[id]/timeline', params: { id: dog.id } })
                  }
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.secondaryButtonText}>Timeline</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={startingId === dog.id}
                  onPress={() => void onStartSession(dog.id)}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    startingId === dog.id && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {startingId === dog.id ? 'Starting…' : 'Start session'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatAge(ageMonths: number): string {
  if (ageMonths < 12) return `${ageMonths} mo`;
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return months === 0 ? `${years}y` : `${years}y ${months}mo`;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
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
  manageRow: { flexDirection: 'row', gap: 10 },
  manageButton: {
    backgroundColor: '#1B3A32',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  manageButtonFocused: { borderColor: '#B07D48' },
  manageButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
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
  dogCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12,
  },
  dogHeader: { gap: 2 },
  dogName: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  dogMeta: { fontSize: 13, color: '#64748b' },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  retryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: '#93c5fd' },
});
