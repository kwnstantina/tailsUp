// =============================================================================
// Root layout (Phase 3a, Unit C1)
//
// Drops the single <Stack> (now owned by (app)/_layout.tsx) and becomes the app
// shell: load the three font cuts with a splash gate, then render the matched
// route group via <Slot/> wrapped in <SafeAreaProvider> + <LanguageProvider>.
//
//   - Fonts: Fraunces 400/500 (headings) + Inter 400 (body) — only those cuts
//     (smaller bundle / faster FOUT). Native splash-gates until loaded; web
//     gets a brief acceptable FOUT (we still gate, but never block forever —
//     `useFonts` resolves quickly on web with @font-face SWAP).
//   - LanguageProvider: the bilingual (EL/EN) context (default 'el'); every
//     page and the site chrome read it via useLang().
//
// Route groups ((site) public + (app) authed trainer screens) carry their own
// chrome; this root delegates to them.
// =============================================================================

import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fraunces_400Regular, Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { LanguageProvider } from '../lib/i18n';

// Keep the native splash up until the fonts are ready (no-op-ish on web).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Inter_400Regular,
  });

  useEffect(() => {
    // Hide the splash once fonts resolve OR fail (a font error must not trap the
    // user on the splash — we fall back to Georgia/system-ui, DS-2 quality floor).
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // On native, hold render until fonts are ready (splash covers this). On web,
  // also wait briefly; the @font-face SWAP means there is no hard block, and a
  // font error still lets us through to the fallback stack.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StatusBar style="auto" />
        <Slot />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
