// =============================================================================
// /dogs — every dog the trainer works with.
//
// A card per dog (trend sparkline + "Νέα συνεδρία"). Starting a session creates
// it (POST /dogs/:id/sessions) and drops straight into the logging screen, with
// the dog's name passed along so that screen can say whose session it is.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DogSummaryDTO } from '@tailsup/shared';
import { useLang } from '../../../lib/i18n';
import { ApiError, getDogs, startSession } from '../../../lib/api';
import { useSession } from '../../../lib/auth-client';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Muted,
  Notice,
  Screen,
  Title,
} from '../../../components/app/AppKit';
import { DogCard } from '../../../components/app/DogCard';
import { useDogTrends } from '../../../components/app/useDogTrends';

const copy = {
  el: {
    title: 'Σκύλοι',
    subtitle: 'Επιλέξτε σκύλο για να δείτε την πρόοδό του ή να ξεκινήσετε συνεδρία.',
    loading: 'Φόρτωση σκύλων…',
    errorTitle: 'Δεν ήταν δυνατή η φόρτωση',
    retry: 'Δοκίμασε ξανά',
    noTrainer: 'Ο λογαριασμός δεν έχει προφίλ εκπαιδευτή.',
    empty: 'Δεν υπάρχουν σκύλοι ακόμα. Μετατρέψτε ένα αίτημα σε πελάτη για να ξεκινήσετε.',
    startFailed: 'Η συνεδρία δεν ξεκίνησε:',
  },
  en: {
    title: 'Dogs',
    subtitle: 'Pick a dog to see their progress or start a session.',
    loading: 'Loading dogs…',
    errorTitle: 'Could not load dogs',
    retry: 'Try again',
    noTrainer: 'This account has no trainer profile.',
    empty: 'No dogs yet. Convert a request into a client to get started.',
    startFailed: 'Could not start the session:',
  },
} as const;

type Status =
  | { kind: 'loading' }
  | { kind: 'success'; dogs: DogSummaryDTO[] }
  | { kind: 'error'; message: string };

function messageFor(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

export default function DogsScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const c = copy[lang];
  const { data: session } = useSession();
  const trainerId = session?.user?.trainerId ?? null;
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    if (!trainerId) {
      setStatus({ kind: 'error', message: copy[lang].noTrainer });
      return;
    }
    try {
      setStatus({ kind: 'success', dogs: await getDogs(trainerId) });
    } catch (err) {
      setStatus({ kind: 'error', message: messageFor(err) });
    }
  }, [trainerId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const trends = useDogTrends(status.kind === 'success' ? status.dogs : null);

  const onStart = useCallback(
    async (dog: DogSummaryDTO) => {
      setStartingId(dog.id);
      setStartError(null);
      try {
        const s = await startSession(dog.id);
        router.push({ pathname: '/sessions/[id]/log', params: { id: s.id, dog: dog.name, dogId: dog.id } });
      } catch (err) {
        setStartError(`${copy[lang].startFailed} ${messageFor(err)}`);
      } finally {
        setStartingId(null);
      }
    },
    [router, lang],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Title>{c.title}</Title>
        <Muted size={16}>{c.subtitle}</Muted>
      </View>

      {startError && <Notice tone="error">{startError}</Notice>}

      {status.kind === 'loading' && <LoadingState label={c.loading} />}
      {status.kind === 'error' && (
        <ErrorState title={c.errorTitle} message={status.message} retryLabel={c.retry} onRetry={() => void load()} />
      )}
      {status.kind === 'success' && status.dogs.length === 0 && <EmptyState message={c.empty} />}
      {status.kind === 'success' && status.dogs.length > 0 && (
        <View style={styles.grid}>
          {status.dogs.map((dog) => (
            <DogCard
              key={dog.id}
              dog={dog}
              lang={lang}
              points={trends[dog.id]?.points}
              lastSessionAt={trends[dog.id]?.lastSessionAt}
              onOpen={() => router.push({ pathname: '/dogs/[id]/timeline', params: { id: dog.id } })}
              onStart={() => void onStart(dog)}
              starting={startingId === dog.id}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
