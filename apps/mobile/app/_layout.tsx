import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Root layout for the Expo Router app.
 * A single Stack navigator hosts the Phase 1 health screen (app/index.tsx) and
 * the Phase 2 trainer screens (dogs / timeline / 4-tap log / event detail).
 *
 * Expo Router auto-registers file-based routes; these <Stack.Screen> entries
 * only set custom header titles (the dynamic ones keep a stable title since the
 * id is in the params, not the title).
 *
 * Wrapped in <SafeAreaProvider> because the screens render <SafeAreaView>
 * from react-native-safe-area-context, which requires a SafeAreaProvider
 * ancestor (otherwise insets never resolve / it throws on native).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'TailsUp · API Health' }} />
        <Stack.Screen name="dogs/index" options={{ title: 'My Dogs' }} />
        <Stack.Screen name="dogs/[id]/timeline" options={{ title: 'Timeline' }} />
        <Stack.Screen name="sessions/[id]/log" options={{ title: 'Log Event' }} />
        <Stack.Screen name="events/[id]" options={{ title: 'Event Detail' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
