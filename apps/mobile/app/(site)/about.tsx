// =============================================================================
// (site)/about.tsx — About / Ποιοι είμαστε  (route: /about)
// STUB (Unit C1) — Unit C2 fills in the practice/method/credentials copy.
// =============================================================================

import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow, Section } from '../../components/ui';
import { colors, fontFallback, type } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

const copy = {
  el: { eyebrow: 'Ποιοι είμαστε', title: 'Ποιοι είμαστε', note: 'Σύντομα: η ιστορία και η μέθοδός μας.' },
  en: { eyebrow: 'About', title: 'About', note: 'Coming soon: our story and method.' },
} as const;

export default function AboutPage() {
  const { lang } = useLang();
  const c = copy[lang];
  return (
    <>
      <Head>
        <title>Ποιοι Είμαστε — TailsUp</title>
        <meta name="description" content="Μάθετε για την TailsUp και τη φιλοσοφία μας στην εκπαίδευση σκύλων." />
      </Head>
      <Section prose>
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
