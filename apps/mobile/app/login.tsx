// =============================================================================
// /login (Phase 3b — FR-AUTH3) — the sign-in screen for the authed app.
//
// Top-level route (outside (site)/(app) groups) so it is reachable WITHOUT the
// auth guard. Email/password → authClient.signIn.email; on success the user's
// role decides the landing (trainer → /today, client → /client). Already
// signed-in visitors are redirected straight to their area.
//
// Wide screens split into the site's hero photograph + the form; phones show
// the form alone. Copy is bilingual (EL/EN) like the rest of the app.
// =============================================================================

import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Redirect, useRouter, type Href } from 'expo-router';
import { colors, fontFallback, fonts, radii, useResponsive } from '../lib/theme';
import { useLang } from '../lib/i18n';
import { photos } from '../lib/photos';
import { authClient, useSession } from '../lib/auth-client';
import { LogoMark } from '../components/ui';
import { Button, Notice,
} from '../components/app/AppKit';
import { IconEye, IconEyeOff, IconInfo } from '../components/app/AppIcons';

const copy = {
  el: {
    title: 'Καλώς ήρθατε',
    subtitle: 'Συνδεθείτε για να δείτε την πρόοδο και τις ασκήσεις σας.',
    email: 'Email',
    password: 'Κωδικός',
    show: 'Εμφάνιση κωδικού',
    hide: 'Απόκρυψη κωδικού',
    submit: 'Σύνδεση',
    error: 'Λάθος email ή κωδικός. Δοκιμάστε ξανά.',
    noAccount: 'Δεν έχετε λογαριασμό; Τον δημιουργεί ο εκπαιδευτής σας μετά την πρώτη γνωριμία.',
    back: '← Πίσω στον ιστότοπο',
    heroTitle: 'Κάθε βόλτα μετράει.',
    heroBody: 'Η πρόοδος του σκύλου σας, συνεδρία με συνεδρία.',
  },
  en: {
    title: 'Welcome back',
    subtitle: 'Sign in to see your progress and homework.',
    email: 'Email',
    password: 'Password',
    show: 'Show password',
    hide: 'Hide password',
    submit: 'Sign in',
    error: 'Wrong email or password. Please try again.',
    noAccount: "No account yet? Your trainer creates one after your first meeting.",
    back: '← Back to the website',
    heroTitle: 'Every walk counts.',
    heroBody: "Your dog's progress, session by session.",
  },
} as const;

function landingFor(role: string | null | undefined): Href {
  return (role === 'trainer' ? '/today' : '/client') as Href;
}

const webCursor = Platform.select({ web: { cursor: 'pointer' } as object, default: {} });

export default function LoginScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const c = copy[lang];
  const { width } = useResponsive();
  const split = width >= 900;
  const { data: session, isPending } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <View style={styles.root}>
      {split && photos.heroDog && (
        <View style={styles.photoSide}>
          <Image source={photos.heroDog} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          <View style={styles.photoShade} />
          <View style={styles.photoCaption}>
            <Text style={[styles.heroTitle, fontFallback.display]}>{c.heroTitle}</Text>
            <Text style={[styles.heroBody, fontFallback.body]}>{c.heroBody}</Text>
          </View>
        </View>
      )}

      <SafeAreaView style={styles.formSide}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.brand}>
              <LogoMark size={36} />
              <Text style={[styles.brandText, fontFallback.display]}>TailsUp</Text>
            </View>

            <View style={styles.titles}>
              <Text accessibilityRole="header" style={[styles.title, fontFallback.display]}>
                {c.title}
              </Text>
              <Text style={[styles.subtitle, fontFallback.body]}>{c.subtitle}</Text>
            </View>

            <View style={styles.field}>
              <Text nativeID="email-label" style={[styles.label, fontFallback.body]}>
                {c.email}
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                textContentType="username"
                accessibilityLabel={c.email}
                accessibilityLabelledBy="email-label"
                placeholder="you@example.com"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, fontFallback.body, focused === 'email' && styles.inputFocus]}
              />
            </View>

            <View style={styles.field}>
              <Text nativeID="password-label" style={[styles.label, fontFallback.body]}>
                {c.password}
              </Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  accessibilityLabel={c.password}
                  accessibilityLabelledBy="password-label"
                  onSubmitEditing={() => void onSubmit()}
                  style={[styles.input, styles.passwordInput, fontFallback.body, focused === 'password' && styles.inputFocus]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? c.hide : c.show}
                  onPress={() => setShowPassword((v) => !v)}
                  style={[styles.eye, webCursor]}
                >
                  {showPassword ? <IconEyeOff color={colors.textMuted} /> : <IconEye color={colors.textMuted} />}
                </Pressable>
              </View>
            </View>

            {error && <Notice tone="error">{error}</Notice>}

            <Button label={c.submit} size="lg" block loading={submitting} onPress={() => void onSubmit()} />

            <View style={styles.hint}>
              <IconInfo size={18} color={colors.primary} />
              <Text style={[styles.hintText, fontFallback.body]}>{c.noAccount}</Text>
            </View>

            <Link href="/" style={[styles.back, fontFallback.body]}>
              {c.back}
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  photoSide: { flex: 1, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  photoShade: {
    ...StyleSheet.absoluteFillObject,
    ...Platform.select({
      web: { backgroundImage: 'linear-gradient(to top, rgba(31,58,48,0.88), rgba(31,58,48,0) 55%)' } as object,
      default: { backgroundColor: 'rgba(31,58,48,0.35)' },
    }),
  },
  photoCaption: { position: 'absolute', left: 48, right: 48, bottom: 44, gap: 8 },
  heroTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.onDark },
  heroBody: { fontFamily: fonts.body, fontSize: 16.5, lineHeight: 24, color: colors.onDarkMuted },
  formSide: { flex: 1, backgroundColor: colors.bg },
  formScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 400, gap: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { fontFamily: fonts.display, fontSize: 23, color: colors.text },
  titles: { gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.textMuted },
  field: { gap: 6 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  inputFocus: { borderColor: colors.primary },
  passwordWrap: { justifyContent: 'center' },
  passwordInput: { paddingRight: 52 },
  eye: { position: 'absolute', right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.mintSoft,
  },
  hintText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textOnMint },
  back: { alignSelf: 'center', fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textMuted, padding: 8, borderRadius: radii.base },
});
