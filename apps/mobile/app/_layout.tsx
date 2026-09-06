import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { colors } from '../src/design/tokens';

/**
 * Root layout.
 *
 * On NATIVE, nothing renders until both font families have loaded — the
 * typography is the brand in this direction, and a flash of the fallback stack
 * reads as a broken app rather than a slow one.
 *
 * On WEB we must NOT gate: `output: "static"` pre-renders every route in Node,
 * where useFonts never resolves, so gating there exports an empty <div id="root">
 * on all six pages — no copy for a crawler, and a blank page until JS runs. That
 * is fatal for a site whose entire job is being found and capturing leads. The
 * browser handles the swap itself via the @font-face rules expo-font injects.
 *
 * Headers are off across the board: these are website pages with their own
 * <SiteHeader>, not native stack screens.
 */
const GATE_ON_FONTS = Platform.OS !== 'web';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });

  useEffect(() => {
    // Hide the splash once fonts resolve — or once they've definitively failed,
    // so a font CDN problem degrades to the fallback stack instead of a
    // permanently blank app.
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (GATE_ON_FONTS && !fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </SafeAreaProvider>
  );
}
