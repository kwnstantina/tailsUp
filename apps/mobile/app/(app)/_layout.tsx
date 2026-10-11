// =============================================================================
// (app)/_layout.tsx — the AUTHED app group.
//
// Auth guard (Phase 3b): spinner while the session resolves, /login without
// one. Then every screen renders inside <AppShell> — the sidebar / tab bar the
// role needs — over a header-less Stack: each screen draws its own title, so
// there is no generic "My Dogs · Sign out" bar any more.
//
// Role routing: a client only ever sees /client; a trainer who lands on
// /client (an old bookmark) goes to their Today screen. The server enforces the
// same split per endpoint — this just keeps people out of empty screens.
//
// Screens:
//   trainer — /today, /dogs, /dogs/[id]/timeline (dog profile),
//             /sessions/[id]/log (focus mode), /events/[id],
//             /manage/leads, /manage/bookings
//   client  — /client
//   dev     — /health
// =============================================================================

import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { colors } from '../../lib/theme';
import { useSession } from '../../lib/auth-client';
import { AppShell, CLIENT_HOME, TRAINER_HOME } from '../../components/app/AppShell';

export default function AppLayout() {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();

  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session?.user) {
    return <Redirect href="/login" />;
  }

  const role = session.user.role === 'trainer' ? 'trainer' : 'client';
  if (role === 'client' && pathname !== '/client') return <Redirect href={CLIENT_HOME} />;
  if (role === 'trainer' && pathname === '/client') return <Redirect href={TRAINER_HOME} />;

  return (
    <AppShell role={role} userName={session.user.name} trainerId={session.user.trainerId ?? null}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </AppShell>
  );
}
