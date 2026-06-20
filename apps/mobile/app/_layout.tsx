import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Root layout for the Expo Router app.
 * A single Stack navigator hosts the one Phase 1 screen (app/index.tsx).
 *
 * Wrapped in <SafeAreaProvider> because app/index.tsx renders <SafeAreaView>
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
      </Stack>
    </SafeAreaProvider>
  );
}
