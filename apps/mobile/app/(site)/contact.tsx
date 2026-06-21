// =============================================================================
// (site)/contact.tsx — Contact / Επικοινωνία  (route: /contact)
// STUB (Unit C1) — Unit C2 adds the contact details, the keyless <PracticeMap/>,
// and the lead form (createLead, source 'website-contact').
// =============================================================================

import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow, Section } from '../../components/ui';
import { colors, fontFallback, type } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

const copy = {
  el: { eyebrow: 'Επικοινωνία', title: 'Επικοινωνία', note: 'Σύντομα: χάρτης και φόρμα επικοινωνίας.' },
  en: { eyebrow: 'Contact', title: 'Contact', note: 'Coming soon: map and contact form.' },
} as const;

export default function ContactPage() {
  const { lang } = useLang();
  const c = copy[lang];
  return (
    <>
      <Head>
        <title>Επικοινωνία — TailsUp</title>
        <meta name="description" content="Βρείτε μας στην Αθήνα ή στείλτε μήνυμα." />
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
