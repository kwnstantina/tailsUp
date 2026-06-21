// =============================================================================
// (site)/booking.tsx — Booking / Κλείσε ραντεβού  (route: /booking)
//
// An appointment-request form → createBooking:
//   - type ∈ BOOKING_TYPES (assessment | private | group) via a segmented picker
//   - preferred date + time → combined into an ISO `requestedAt`
//   - name, contact, optional notes
// status defaults to 'requested' server-side.
//
// Discriminated Status union (idle/pending/success/error): inline validation,
// disabled-while-submitting, a clear "request received, we'll confirm" success
// message, and the ApiError message on failure. Visible focus on every control;
// prefers-reduced-motion respected (no entrance animation). Bilingual via useLang().
// =============================================================================

import { useState } from 'react';
import Head from 'expo-router/head';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { BOOKING_TYPES, type BookingType, type CreateBookingInput } from '@tailsup/shared';
import { Card, Eyebrow, PrimaryButton, Section } from '../../components/ui';
import { colors, fontFallback, radii, space, type, useResponsive } from '../../lib/theme';
import { ApiError, createBooking } from '../../lib/api';
import { useLang, type Lang } from '../../lib/i18n';

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

// Bilingual labels for the BOOKING_TYPES enum values (the enum stays the source).
const TYPE_LABELS: Record<Lang, Record<BookingType, string>> = {
  el: { assessment: 'Αξιολόγηση', private: 'Ιδιαίτερο', group: 'Ομαδικό' },
  en: { assessment: 'Assessment', private: 'Private', group: 'Group' },
};

// Build an ISO datetime from a YYYY-MM-DD date and an HH:MM time. Returns null if
// the combination is not a real date/time (so we can show an inline error).
function toIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const copy = {
  el: {
    head: {
      title: 'Κλείστε Ραντεβού — TailsUp',
      desc: 'Ζητήστε ραντεβού online: αξιολόγηση, ιδιαίτερο ή ομαδικό μάθημα.',
    },
    eyebrow: 'Ραντεβού',
    title: 'Κλείστε το πρώτο σας ραντεβού.',
    intro:
      'Συμπληρώστε τα στοιχεία σας και την προτιμώμενη ημέρα και ώρα. Θα επιβεβαιώσουμε τη διαθεσιμότητα και θα επικοινωνήσουμε μαζί σας.',
    typeLabel: 'Τύπος ραντεβού',
    dateLabel: 'Ημερομηνία (ΕΕΕΕ-ΜΜ-ΗΗ)',
    datePlaceholder: '2026-07-01',
    timeLabel: 'Ώρα (ΩΩ:ΛΛ)',
    timePlaceholder: '10:30',
    nameLabel: 'Όνομα',
    namePlaceholder: 'Το όνομά σας',
    contactLabel: 'Επικοινωνία (email ή τηλέφωνο)',
    contactPlaceholder: 'email ή τηλέφωνο',
    notesLabel: 'Σημειώσεις (προαιρετικά)',
    notesPlaceholder: 'Πείτε μας λίγα λόγια για τον σκύλο σας',
    submit: 'Ζητήστε ραντεβού',
    nameRequired: 'Συμπληρώστε το όνομά σας.',
    contactRequired: 'Συμπληρώστε ένα email ή τηλέφωνο.',
    dateRequired: 'Δώστε έγκυρη ημερομηνία και ώρα.',
    successTitle: 'Λάβαμε το αίτημά σας.',
    successBody: 'Θα ελέγξουμε τη διαθεσιμότητα και θα σας επιβεβαιώσουμε σύντομα.',
    errorPrefix: 'Κάτι πήγε στραβά: ',
  },
  en: {
    head: {
      title: 'Book an Appointment — TailsUp',
      desc: 'Request an appointment online: assessment, private or group lesson.',
    },
    eyebrow: 'Booking',
    title: 'Request your first appointment.',
    intro:
      'Fill in your details and a preferred date and time. We will check availability and get back to you.',
    typeLabel: 'Appointment type',
    dateLabel: 'Date (YYYY-MM-DD)',
    datePlaceholder: '2026-07-01',
    timeLabel: 'Time (HH:MM)',
    timePlaceholder: '10:30',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    contactLabel: 'Contact (email or phone)',
    contactPlaceholder: 'email or phone',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'Tell us a little about your dog',
    submit: 'Request appointment',
    nameRequired: 'Please enter your name.',
    contactRequired: 'Please enter an email or phone.',
    dateRequired: 'Please give a valid date and time.',
    successTitle: 'We received your request.',
    successBody: 'We will check availability and confirm with you soon.',
    errorPrefix: 'Something went wrong: ',
  },
} as const;

export default function BookingPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const { isWide } = useResponsive();

  const [bookingType, setBookingType] = useState<BookingType>('assessment');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>({ kind: 'idle' });

  const requestedAt = toIso(date.trim(), time.trim());
  const nameError = name.trim() === '' ? c.nameRequired : undefined;
  const contactError = contact.trim() === '' ? c.contactRequired : undefined;
  const dateError = requestedAt == null ? c.dateRequired : undefined;
  const hasErrors = Boolean(nameError || contactError || dateError);
  const pending = status.kind === 'pending';

  const onSubmit = async () => {
    setTouched(true);
    if (hasErrors || requestedAt == null) return;
    setStatus({ kind: 'pending' });
    const body: CreateBookingInput = {
      type: bookingType,
      requestedAt,
      name: name.trim(),
      contact: contact.trim(),
      ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
    };
    try {
      await createBooking(body);
      setStatus({ kind: 'success' });
      setDate('');
      setTime('');
      setName('');
      setContact('');
      setNotes('');
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

      {/* ── The appointment-request form ── */}
      <Section alt>
        <View style={styles.formWrap}>
          <Card large>
            {status.kind === 'success' ? (
              <View style={styles.successBox} accessibilityLiveRegion="polite">
                <Text style={[styles.successTitle, fontFallback.display]}>{c.successTitle}</Text>
                <Text style={[styles.successBody, fontFallback.body]}>{c.successBody}</Text>
              </View>
            ) : (
              <View style={styles.form}>
                {/* Type selector — segmented over BOOKING_TYPES */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, fontFallback.body]}>{c.typeLabel}</Text>
                  <View style={styles.segment} accessibilityRole="radiogroup">
                    {BOOKING_TYPES.map((t) => {
                      const active = t === bookingType;
                      return (
                        <Pressable
                          key={t}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          disabled={pending}
                          onPress={() => setBookingType(t)}
                          style={({ hovered, focused, pressed }) => [
                            styles.segmentItem,
                            active && styles.segmentItemActive,
                            (hovered || pressed) && !active && styles.segmentItemHover,
                            focused && styles.segmentItemFocused,
                            Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
                          ]}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              fontFallback.body,
                              active && styles.segmentTextActive,
                            ]}
                          >
                            {TYPE_LABELS[lang][t]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Date + time — combined into requestedAt ISO */}
                <View style={[styles.dateRow, isWide ? styles.dateRowWide : styles.dateRowNarrow]}>
                  <Field
                    label={c.dateLabel}
                    placeholder={c.datePlaceholder}
                    value={date}
                    onChangeText={setDate}
                    editable={!pending}
                    error={touched ? dateError : undefined}
                    autoCapitalize="none"
                    containerStyle={styles.dateField}
                  />
                  <Field
                    label={c.timeLabel}
                    placeholder={c.timePlaceholder}
                    value={time}
                    onChangeText={setTime}
                    editable={!pending}
                    autoCapitalize="none"
                    containerStyle={styles.dateField}
                  />
                </View>

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
                  label={c.notesLabel}
                  placeholder={c.notesPlaceholder}
                  value={notes}
                  onChangeText={setNotes}
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
      </Section>
    </>
  );
}

// ── Field — a labelled TextInput with visible focus + inline error ────────────
function Field({
  label,
  error,
  multiline = false,
  containerStyle,
  ...inputProps
}: {
  label: string;
  error?: string;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
} & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
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

  // Form
  formWrap: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
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

  // Segmented type selector
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.base,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentItemHover: {
    backgroundColor: colors.border,
  },
  segmentItemFocused: {
    borderColor: colors.accent, // visible copper focus ring
  },
  segmentText: {
    ...type.body,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.bg,
  },

  // Date + time row
  dateRow: {
    gap: space.md,
  },
  dateRowWide: {
    flexDirection: 'row',
  },
  dateRowNarrow: {
    flexDirection: 'column',
  },
  dateField: {
    flex: 1,
  },

  // Inputs
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
    borderColor: colors.accent,
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
