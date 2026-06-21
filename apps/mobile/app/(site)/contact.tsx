// =============================================================================
// (site)/contact.tsx — Contact / Επικοινωνία  (route: /contact)
//
// Where to find us + how to reach us: address, opening hours, phone, email
// (all clearly-marked placeholders, per the user decision) in Cards, the keyless
// <PracticeMap/>, and the LEAD FORM (name, contact, message) → createLead with
// source 'website-contact'.
//
// The form uses a discriminated Status union (idle/pending/success/error)
// mirroring the Phase 1 health screen: inline validation, disabled-while-
// submitting, a clear success confirmation, and the ApiError message on failure.
// Visible focus on every input; prefers-reduced-motion is respected (no entrance
// animation is used). Bilingual via useLang().
// =============================================================================

import { useState } from 'react';
import Head from 'expo-router/head';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CreateLeadInput } from '@tailsup/shared';
import { Card, Eyebrow, PrimaryButton, Section } from '../../components/ui';
import { PracticeMap } from '../../components/PracticeMap';
import { colors, fontFallback, radii, space, type, useResponsive } from '../../lib/theme';
import { ApiError, createLead } from '../../lib/api';
import { useLang } from '../../lib/i18n';

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const copy = {
  el: {
    head: {
      title: 'Επικοινωνία — TailsUp',
      desc: 'Βρείτε μας στην Αθήνα ή στείλτε μας μήνυμα μέσω της φόρμας επικοινωνίας.',
    },
    eyebrow: 'Επικοινωνία',
    title: 'Πού θα μας βρείτε.',
    intro: 'Ελάτε για μια πρώτη αξιολόγηση ή στείλτε μας ένα μήνυμα — απαντάμε σύντομα.',
    detailsTitle: 'Στοιχεία',
    addressLabel: 'Διεύθυνση',
    address: '[διεύθυνση], Αθήνα',
    phoneLabel: 'Τηλέφωνο',
    phone: '[τηλέφωνο]',
    emailLabel: 'Email',
    email: '[email]',
    hoursLabel: 'Ώρες λειτουργίας',
    hours: '[ώρες]',
    mapLabel: 'TailsUp — τοποθεσία πρακτικής',
    formTitle: 'Στείλτε μας μήνυμα',
    nameLabel: 'Όνομα',
    namePlaceholder: 'Το όνομά σας',
    contactLabel: 'Επικοινωνία (email ή τηλέφωνο)',
    contactPlaceholder: 'email ή τηλέφωνο',
    messageLabel: 'Μήνυμα (προαιρετικά)',
    messagePlaceholder: 'Πείτε μας λίγα λόγια για τον σκύλο σας',
    submit: 'Αποστολή',
    nameRequired: 'Συμπληρώστε το όνομά σας.',
    contactRequired: 'Συμπληρώστε ένα email ή τηλέφωνο.',
    successTitle: 'Λάβαμε το μήνυμά σας.',
    successBody: 'Θα επικοινωνήσουμε μαζί σας σύντομα. Ευχαριστούμε!',
    errorPrefix: 'Κάτι πήγε στραβά: ',
  },
  en: {
    head: {
      title: 'Contact — TailsUp',
      desc: 'Find us in Athens or send us a message through the contact form.',
    },
    eyebrow: 'Contact',
    title: 'Where to find us.',
    intro: 'Come in for a first assessment or send us a message — we reply promptly.',
    detailsTitle: 'Details',
    addressLabel: 'Address',
    address: '[address], Athens',
    phoneLabel: 'Phone',
    phone: '[phone]',
    emailLabel: 'Email',
    email: '[email]',
    hoursLabel: 'Opening hours',
    hours: '[hours]',
    mapLabel: 'TailsUp — practice location',
    formTitle: 'Send us a message',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    contactLabel: 'Contact (email or phone)',
    contactPlaceholder: 'email or phone',
    messageLabel: 'Message (optional)',
    messagePlaceholder: 'Tell us a little about your dog',
    submit: 'Send',
    nameRequired: 'Please enter your name.',
    contactRequired: 'Please enter an email or phone.',
    successTitle: 'We received your message.',
    successBody: 'We will be in touch soon. Thank you!',
    errorPrefix: 'Something went wrong: ',
  },
} as const;

export default function ContactPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const { isWide } = useResponsive();

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>({ kind: 'idle' });

  const nameError = name.trim() === '' ? c.nameRequired : undefined;
  const contactError = contact.trim() === '' ? c.contactRequired : undefined;
  const hasErrors = Boolean(nameError || contactError);
  const pending = status.kind === 'pending';

  const onSubmit = async () => {
    setTouched(true);
    if (hasErrors) return;
    setStatus({ kind: 'pending' });
    const body: CreateLeadInput = {
      name: name.trim(),
      contact: contact.trim(),
      source: 'website-contact',
      ...(message.trim() !== '' ? { message: message.trim() } : {}),
    };
    try {
      await createLead(body);
      setStatus({ kind: 'success' });
      setName('');
      setContact('');
      setMessage('');
      setTouched(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'API unreachable';
      setStatus({ kind: 'error', message: msg });
    }
  };

  return (
    <>
      <Head>
        <title>{c.head.title}</title>
        <meta name="description" content={c.head.desc} />
        <meta property="og:title" content={c.head.title} />
        <meta property="og:description" content={c.head.desc} />
      </Head>

      {/* ── Intro ── */}
      <Section>
        <View style={styles.intro}>
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <Text style={[styles.h1, fontFallback.display]}>{c.title}</Text>
          <Text style={[styles.lead, fontFallback.body]}>{c.intro}</Text>
        </View>
      </Section>

      {/* ── Details + map (left) and the lead form (right) ── */}
      <Section alt>
        <View style={[styles.cols, isWide ? styles.colsWide : styles.colsNarrow]}>
          {/* Left: practice details + map */}
          <View style={styles.col}>
            <Card large>
              <Text style={[styles.cardHeading, fontFallback.display]}>{c.detailsTitle}</Text>
              <Detail label={c.addressLabel} value={c.address} />
              <Detail label={c.phoneLabel} value={c.phone} />
              <Detail label={c.emailLabel} value={c.email} />
              <Detail label={c.hoursLabel} value={c.hours} />
            </Card>
            <View style={styles.mapWrap}>
              <PracticeMap label={c.mapLabel} />
            </View>
          </View>

          {/* Right: the lead form */}
          <View style={styles.col}>
            <Card large>
              <Text style={[styles.cardHeading, fontFallback.display]}>{c.formTitle}</Text>

              {status.kind === 'success' ? (
                <View style={styles.successBox} accessibilityLiveRegion="polite">
                  <Text style={[styles.successTitle, fontFallback.display]}>{c.successTitle}</Text>
                  <Text style={[styles.successBody, fontFallback.body]}>{c.successBody}</Text>
                </View>
              ) : (
                <View style={styles.form}>
                  <Field
                    label={c.nameLabel}
                    placeholder={c.namePlaceholder}
                    value={name}
                    onChangeText={setName}
                    editable={!pending}
                    error={touched ? nameError : undefined}
                    autoCapitalize="words"
                  />
                  <Field
                    label={c.contactLabel}
                    placeholder={c.contactPlaceholder}
                    value={contact}
                    onChangeText={setContact}
                    editable={!pending}
                    error={touched ? contactError : undefined}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <Field
                    label={c.messageLabel}
                    placeholder={c.messagePlaceholder}
                    value={message}
                    onChangeText={setMessage}
                    editable={!pending}
                    multiline
                  />

                  {status.kind === 'error' && (
                    <Text style={[styles.errorBanner, fontFallback.body]} accessibilityLiveRegion="polite">
                      {c.errorPrefix}
                      {status.message}
                    </Text>
                  )}

                  <View style={styles.submitWrap}>
                    <PrimaryButton label={c.submit} onPress={onSubmit} loading={pending} />
                  </View>
                </View>
              )}
            </Card>
          </View>
        </View>
      </Section>
    </>
  );
}

// ── Detail line (label + placeholder value) ──────────────────────────────────
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={[styles.detailLabel, fontFallback.body]}>{label}</Text>
      <Text style={[styles.detailValue, fontFallback.body]}>{value}</Text>
    </View>
  );
}

// ── Field — a labelled TextInput with visible focus + inline error ────────────
function Field({
  label,
  error,
  multiline = false,
  ...inputProps
}: {
  label: string;
  error?: string;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, fontFallback.body]}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          fontFallback.body,
          focused && styles.inputFocused,
          error != null && styles.inputError,
          // Web: remove the default UA outline (we draw our own copper ring).
          Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
        ]}
      />
      {error != null && <Text style={[styles.fieldError, fontFallback.body]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Intro
  intro: {
    maxWidth: 720,
    gap: space.md,
  },
  h1: {
    ...type.h1,
    color: colors.text,
  },
  lead: {
    ...type.bodyLg,
    color: colors.textMuted,
  },

  // Two-column layout
  cols: {
    gap: space.lg,
  },
  colsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  colsNarrow: {
    flexDirection: 'column',
  },
  col: {
    flex: 1,
    gap: space.md,
  },
  cardHeading: {
    ...type.h3,
    color: colors.text,
    marginBottom: space.sm,
  },

  // Details
  detail: {
    marginBottom: space.sm,
  },
  detailLabel: {
    ...type.eyebrow,
    color: colors.accent,
    marginBottom: 2,
  },
  detailValue: {
    ...type.body,
    color: colors.text,
  },
  mapWrap: {
    width: '100%',
  },

  // Form
  form: {
    gap: space.md,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    ...type.body,
    color: colors.text,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.base,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: colors.accent, // visible copper focus ring (quality floor)
    borderWidth: 2,
    margin: -1,
  },
  inputError: {
    borderColor: colors.accent,
  },
  fieldError: {
    ...type.caption,
    color: colors.accent,
  },
  errorBanner: {
    ...type.body,
    color: colors.accent,
  },
  submitWrap: {
    alignItems: 'flex-start',
    marginTop: space.xs,
  },

  // Success
  successBox: {
    gap: space.sm,
  },
  successTitle: {
    ...type.h3,
    color: colors.primary,
  },
  successBody: {
    ...type.body,
    color: colors.textMuted,
  },
});
