// =============================================================================
// (site)/services.tsx — Services / Υπηρεσίες  (route: /services)
// STUB (Unit C1) — Unit C2 adds the service catalogue + the data-tracking
// premium service. NOTE: this is the ONLY page where ProgressCurve belongs.
// =============================================================================

import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow, Section } from '../../components/ui';
import { colors, fontFallback, type } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

const copy = {
  el: { eyebrow: 'Υπηρεσίες', title: 'Υπηρεσίες', note: 'Σύντομα: τα προγράμματα εκπαίδευσης.' },
  en: { eyebrow: 'Services', title: 'Services', note: 'Coming soon: our training programmes.' },
} as const;

export default function ServicesPage() {
  const { lang } = useLang();
  const c = copy[lang];
  return (
    <>
      <Head>
        <title>Υπηρεσίες — TailsUp</title>
        <meta name="description" content="Προγράμματα εκπαίδευσης για κάθε σκύλο και ιδιοκτήτη." />
      </Head>
      <Section>
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
