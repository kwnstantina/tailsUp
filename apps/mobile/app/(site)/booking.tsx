// =============================================================================
// (site)/booking.tsx — Booking / Κλείσε ραντεβού  (route: /booking)
// STUB (Unit C1) — Unit C2 adds the booking form (type ∈ BOOKING_TYPES,
// requestedAt, name/contact/notes → createBooking).
// =============================================================================

import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow, Section } from '../../components/ui';
import { colors, fontFallback, type } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

const copy = {
  el: { eyebrow: 'Ραντεβού', title: 'Κλείσε ραντεβού', note: 'Σύντομα: η φόρμα κράτησης.' },
  en: { eyebrow: 'Booking', title: 'Book an appointment', note: 'Coming soon: the booking form.' },
} as const;

export default function BookingPage() {
  const { lang } = useLang();
  const c = copy[lang];
  return (
    <>
      <Head>
        <title>Κλείστε Ραντεβού — TailsUp</title>
        <meta name="description" content="Κλείστε το πρώτο σας ραντεβού εύκολα online." />
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
