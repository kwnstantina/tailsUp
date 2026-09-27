// =============================================================================
// Root layout (Phase 3a, Unit C1)
//
// Drops the single <Stack> (now owned by (app)/_layout.tsx) and becomes the app
// shell: load the three font cuts with a splash gate, then render the matched
// route group via <Slot/> wrapped in <SafeAreaProvider> + <LanguageProvider>.
//
//   - Fonts: Fredoka 500/600 (headings) + Nunito Sans 400/600/700 (body/UI) —
//     the playful direction's pairing, replacing Fraunces/Inter. Only these cuts
//     are loaded. Native splash-gates until they resolve. Web is NOT gated: see
//     GATE_ON_FONTS below.
//   - LanguageProvider: the bilingual (EL/EN) context (default 'el'); every
//     page and the site chrome read it via useLang().
//
// Route groups ((site) public + (app) authed trainer screens) carry their own
// chrome; this root delegates to them.
// =============================================================================

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { LanguageProvider } from '../lib/i18n';

// Keep the native splash up until the fonts are ready (no-op-ish on web).
void SplashScreen.preventAutoHideAsync();

// Gate render on fonts only where there is a splash to cover it. Never on web —
// it would empty the static pre-render (see the comment at the guard below).
const GATE_ON_FONTS = Platform.OS !== 'web';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });

  useEffect(() => {
    // Hide the splash once fonts resolve OR fail (a font error must not trap the
    // user on the splash — we fall back to Georgia/system-ui, DS-2 quality floor).
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // On native, hold render until fonts are ready (the splash covers this).
  //
  // On WEB we must NOT gate. app.json sets web.output "static", so every route
  // is pre-rendered in Node at build time — and `useFonts` never resolves there.
  // Gating returned null during that pre-render, so all 9 routes exported at an
  // identical 22.5 kB with an empty <div id="root">: no copy for a crawler or a
  // link preview, and a blank page until the JS bundle runs. Fatal for a site
  // whose job is being found and capturing leads. The browser handles the swap
  // itself from the @font-face rules expo-font injects, so nothing is lost.
  //
  // Symptom to watch for: every exported route the same size with an empty root.
  if (GATE_ON_FONTS && !fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StatusBar style="auto" />
        <Slot />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
