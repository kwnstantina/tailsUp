// =============================================================================
// (app)/_layout.tsx — the authed-trainer screen group (Phase 3a, Unit C1)
//
// Holds the existing dark <Stack> header (moved verbatim from the old root
// app/_layout.tsx). The Phase 1/2 screens live under this group now:
//   /health  (was app/index.tsx)        — API health check
//   /dogs    + /dogs/[id]/timeline      — trainer dog list + timeline
//   /sessions/[id]/log                  — 4-tap event log
//   /events/[id]                        — event detail
//
// Route groups add no URL segment, so all of those URLs are UNCHANGED except the
// old `/` health screen which is now `/health` (the site Home owns `/`).
//
// NO auth guard in 3a — Phase 3b bolts the guard onto THIS layout only.
// =============================================================================

import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="health" options={{ title: 'TailsUp · API Health' }} />
      <Stack.Screen name="dogs/index" options={{ title: 'My Dogs' }} />
      <Stack.Screen name="dogs/[id]/timeline" options={{ title: 'Timeline' }} />
      <Stack.Screen name="sessions/[id]/log" options={{ title: 'Log Event' }} />
      <Stack.Screen name="events/[id]" options={{ title: 'Event Detail' }} />
    </Stack>
  );
}
