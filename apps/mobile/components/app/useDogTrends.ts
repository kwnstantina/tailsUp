// =============================================================================
// useDogTrends — calm-distance series + last session for a list of dogs.
//
// There is no trends endpoint; each dog's timeline already carries its events,
// so fetch those in parallel. Fine at one practice's scale (tens of dogs). A
// failed timeline just leaves that dog without a sparkline — the card still
// renders.
// =============================================================================

import { useEffect, useState } from 'react';
import type { DogSummaryDTO } from '@tailsup/shared';
import { getDogTimeline } from '../../lib/api';
import type { ChartPoint } from './ThresholdChart';

export interface DogTrend {
  points: ChartPoint[];
  lastSessionAt: string | null;
}

export function useDogTrends(dogs: DogSummaryDTO[] | null): Record<string, DogTrend> {
  const [trends, setTrends] = useState<Record<string, DogTrend>>({});
  const key = dogs?.map((d) => d.id).join(',') ?? '';

  useEffect(() => {
    if (!dogs || dogs.length === 0) return;
    let live = true;
    void Promise.all(
      dogs.map(async (dog) => {
        try {
          const t = await getDogTimeline(dog.id);
          const points = t.sessions
            .flatMap((s) => s.events)
            .map((e) => ({ occurredAt: e.occurredAt, thresholdMeters: e.thresholdMeters }))
            .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
          return [dog.id, { points, lastSessionAt: t.sessions[0]?.startedAt ?? null }] as const;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (!live) return;
      const next: Record<string, DogTrend> = {};
      for (const row of rows) if (row) next[row[0]] = row[1];
      setTrends(next);
    });
    return () => {
      live = false;
    };
    // `key` stands in for `dogs`: refetch when the set of dogs changes, not on
    // every new array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return trends;
}
