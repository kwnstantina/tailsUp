// =============================================================================
// /client — client landing (Phase 3b-1 placeholder).
//
// A client logs in and lands here. The real dashboard (threshold-over-time graph,
// homework, reminders) is Phase 3b-2; for the auth-foundation checkpoint this
// confirms the client role authenticates and reaches THEIR area (not the trainer
// screens). Reads the name/role from the session to prove the session resolved.
// =============================================================================

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFallback, radii, space, type as t } from '../../lib/theme';
import { useLang } from '../../lib/i18n';
import { useSession } from '../../lib/auth-client';

const copy = {
  el: {
    eyebrow: 'Ο λογαριασμός μου',
    greeting: (name: string) => `Γεια σου, ${name}`,
    soon: 'Ο πίνακας προόδου σου έρχεται σύντομα.',
    body: 'Εδώ θα βλέπεις την πρόοδο του σκύλου σου, τις ασκήσεις για το σπίτι και τις υπενθυμίσεις.',
  },
  en: {
    eyebrow: 'My account',
    greeting: (name: string) => `Hello, ${name}`,
    soon: 'Your progress dashboard is coming soon.',
    body: 'This is where you’ll see your dog’s progress, homework, and reminders.',
  },
} as const;

export default function ClientScreen() {
  const { lang } = useLang();
  const c = copy[lang];
  const { data: session } = useSession();
  const name = session?.user?.name ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>{c.eyebrow}</Text>
        <Text style={styles.title}>{c.greeting(name)}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{c.soon}</Text>
          <Text style={styles.cardBody}>{c.body}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: space.md, gap: space.sm, maxWidth: 720, width: '100%', alignSelf: 'center' },
  eyebrow: { ...t.eyebrow },
  title: { ...t.h2, ...fontFallback.display, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
    gap: space.xs,
    marginTop: space.xs,
  },
  cardTitle: { ...t.h3, ...fontFallback.display, color: colors.text },
  cardBody: { ...t.body, ...fontFallback.body, color: colors.textMuted },
});
