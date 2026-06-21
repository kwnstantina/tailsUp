// =============================================================================
// (site)/index.tsx — Home / Αρχική  (route: /)
//
// STUB (Unit C1). Unit C2 replaces this with the full business-first homepage
// (headline promise + CTAs + ONE proof moment; NO ProgressCurve on Home). This
// placeholder just resolves the route and proves the (site) group + chrome.
// =============================================================================

import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow, Section } from '../../components/ui';
import { colors, fontFallback, type } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

const copy = {
  el: { eyebrow: 'TailsUp', title: 'Αρχική', note: 'Σύντομα: η πλήρης αρχική σελίδα.' },
  en: { eyebrow: 'TailsUp', title: 'Home', note: 'Coming soon: the full homepage.' },
} as const;

export default function HomePage() {
  const { lang } = useLang();
  const c = copy[lang];
  return (
    <>
      <Head>
        <title>TailsUp — Επαγγελματική Εκπαίδευση Σκύλων</title>
        <meta
          name="description"
          content="Επαγγελματική εκπαίδευση σκύλων στην Αθήνα. Αποδεδειγμένα αποτελέσματα."
        />
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
