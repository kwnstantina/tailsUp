// =============================================================================
// /login (Phase 3b — FR-AUTH3) — the sign-in screen for the authed app.
//
// Top-level route (outside (site)/(app) groups) so it is reachable WITHOUT the
// auth guard. Email/password → authClient.signIn.email; on success the user's
// role decides the landing (trainer → /dogs, client → /client). Design-System
// styled + bilingual (EL/EN) to match the public site. Already-authenticated
// visitors are redirected straight to their area.
// =============================================================================

import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { colors, fontFallback, fonts, radii, space, type as t } from '../lib/theme';
import { useLang } from '../lib/i18n';
import { authClient, useSession } from '../lib/auth-client';

const copy = {
  el: {
    eyebrow: 'TailsUp',
    title: 'Είσοδος',
    subtitle: 'Συνδεθείτε στον λογαριασμό σας.',
    email: 'Email',
    password: 'Κωδικός',
    submit: 'Σύνδεση',
    submitting: 'Σύνδεση…',
    error: 'Λάθος email ή κωδικός. Δοκιμάστε ξανά.',
    back: '← Επιστροφή στον ιστότοπο',
  },
  en: {
    eyebrow: 'TailsUp',
    title: 'Sign in',
    subtitle: 'Sign in to your account.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    error: 'Wrong email or password. Please try again.',
    back: '← Back to the website',
  },
} as const;

function landingFor(role: string | null | undefined): '/dogs' | '/client' {
  return role === 'trainer' ? '/dogs' : '/client';
}

export default function LoginScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const c = copy[lang];
  const { data: session, isPending } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in → skip the form, go to the role's area.
  if (!isPending && session?.user) {
    return <Redirect href={landingFor(session.user.role)} />;
  }

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await authClient.signIn.email({ email: email.trim(), password });
    setSubmitting(false);
    if (res.error) {
      setError(c.error);
      return;
    }
    router.replace(landingFor(res.data?.user?.role));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{c.eyebrow}</Text>
          <Text style={styles.title}>{c.title}</Text>
          <Text style={styles.subtitle}>{c.subtitle}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{c.email}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              textContentType="username"
              accessibilityLabel={c.email}
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{c.password}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              accessibilityLabel={c.password}
              onSubmitEditing={() => void onSubmit()}
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {error && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => void onSubmit()}
            style={({ pressed, focused }) => [
              styles.button,
              (pressed || submitting) && styles.buttonPressed,
              focused && styles.buttonFocused,
              Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
            ]}
          >
            {submitting ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator color={colors.bg} />
                <Text style={styles.buttonText}>{c.submitting}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{c.submit}</Text>
            )}
          </Pressable>

          <Pressable accessibilityRole="link" onPress={() => router.replace('/')}>
            <Text style={styles.back}>{c.back}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.md },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.lg,
    gap: space.sm,
  },
  eyebrow: { ...t.eyebrow },
  title: { ...t.h2, ...fontFallback.display, color: colors.text },
  subtitle: { ...t.body, ...fontFallback.body, color: colors.textMuted, marginBottom: space.xs },
  field: { gap: 6 },
  label: { ...t.caption, ...fontFallback.body, color: colors.text },
  input: {
    ...t.body,
    ...fontFallback.body,
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.base,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...Platform.select({ web: { outlineColor: colors.accent } as object, default: {} }),
  },
  errorText: { ...t.body, ...fontFallback.body, color: '#B00020' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.base,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: space.xs,
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  buttonPressed: { backgroundColor: colors.primarySoft },
  buttonFocused: { borderWidth: 2, borderColor: colors.accent, margin: -2 },
  buttonText: { ...t.body, ...fontFallback.body, color: colors.bg, fontFamily: fonts.body },
  back: { ...t.caption, ...fontFallback.body, color: colors.textMuted, textAlign: 'center', marginTop: space.xs },
});
