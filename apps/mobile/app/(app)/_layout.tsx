// =============================================================================
// (app)/_layout.tsx — the AUTHED app group (Phase 3b — FR-AUTH3).
//
// Phase 3a moved the Phase 1/2 trainer screens here. Phase 3b bolts the AUTH
// GUARD onto this layout (and only this layout): while the session resolves we
// show a spinner; with no session we redirect to /login; otherwise we render the
// screens. Public (site) routes + /login live outside this group and stay open.
//
// Screens:
//   /health                  — API health check (dev)
//   /dogs + /dogs/[id]/timeline, /sessions/[id]/log, /events/[id]  — trainer
//   /client                  — client landing (dashboard content lands in 3b-2)
//
// A Sign out control in the header calls authClient.signOut() and returns to
// /login — completing the auth loop for the foundation demo.
// =============================================================================

import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { colors, fonts } from '../../lib/theme';
import { authClient, useSession } from '../../lib/auth-client';

function SignOutButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={async () => {
        await authClient.signOut();
        router.replace('/login');
      }}
      style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 6, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={{ color: '#ffffff', fontFamily: fonts.body, fontSize: 14 }}>Sign out</Text>
    </Pressable>
  );
}

export default function AppLayout() {
  const { data: session, isPending } = useSession();

  // Session still resolving (cookie/secure-storage read) — hold with a spinner.
  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Unauthenticated → the public /login route (server also enforces per-endpoint).
  if (!session?.user) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600' },
        headerRight: () => <SignOutButton />,
      }}
    >
      <Stack.Screen name="health" options={{ title: 'TailsUp · API Health' }} />
      <Stack.Screen name="client" options={{ title: 'My Dashboard' }} />
      <Stack.Screen name="dogs/index" options={{ title: 'My Dogs' }} />
      <Stack.Screen name="dogs/[id]/timeline" options={{ title: 'Timeline' }} />
      <Stack.Screen name="sessions/[id]/log" options={{ title: 'Log Event' }} />
      <Stack.Screen name="events/[id]" options={{ title: 'Event Detail' }} />
    </Stack>
  );
}
