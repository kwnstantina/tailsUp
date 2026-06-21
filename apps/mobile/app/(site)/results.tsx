// =============================================================================
// (site)/results.tsx — Results / Αποτελέσματα  (route: /results)
// STUB (Unit C1) — Unit C2 renders placeholder case studies (may reuse the
// ProgressCurve for an outcome arc).
// =============================================================================

import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow, Section } from '../../components/ui';
import { colors, fontFallback, type } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

const copy = {
  el: { eyebrow: 'Αποτελέσματα', title: 'Αποτελέσματα', note: 'Σύντομα: μετρήσιμα αποτελέσματα.' },
  en: { eyebrow: 'Results', title: 'Results', note: 'Coming soon: measurable outcomes.' },
} as const;

export default function ResultsPage() {
  const { lang } = useLang();
  const c = copy[lang];
  return (
    <>
      <Head>
        <title>Αποτελέσματα — TailsUp</title>
        <meta name="description" content="Δείτε τα μετρήσιμα αποτελέσματα της εκπαίδευσής μας." />
      </Head>
      <Section alt>
        <View style={styles.wrap}>
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <Text style={[styles.title, fontFallback.display]}>{c.title}</Text>
          <Text style={[styles.note, fontFallback.body]}>{c.note}</Text>
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { ...type.h1, color: colors.text },
  note: { ...type.bodyLg, color: colors.textMuted },
});
