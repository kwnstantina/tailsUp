// =============================================================================
// (site)/booking.tsx — Booking / Κλείσε ραντεβού  (route: /booking)
//
// An appointment-request form → createBooking:
//   - type ∈ BOOKING_TYPES (assessment | private | group) via a pill picker
//   - preferred date + time → combined into an ISO `requestedAt`
//   - name, contact, optional notes
// status defaults to 'requested' server-side — which is why the success copy
// says "request received", never "booked".
//
// Discriminated Status union (idle/pending/success/error): inline validation,
// disabled-while-submitting, a clear confirmation, and the ApiError message on
// failure. The shared <Field/> owns the focus ring and the error colour.
//
// The "what happens next" card beside the form is not decoration: the single
// biggest reason someone abandons this form is not knowing what they are
// committing to.
// =============================================================================

import { useState } from 'react';
import Head from 'expo-router/head';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BOOKING_TYPES, type BookingType, type CreateBookingInput } from '@tailsup/shared';
import {
  Bullet,
  Card,
  Col,
  Eyebrow,
  Field,
  Grid,
  HeadlineRow,
  Highlight,
  Paw,
  PrimaryButton,
  Section,
  Stack,
  TINTS,
  Wave,
} from '../../components/ui';
import { colors, fontFallback, fonts, radii, space, useResponsive, useType } from '../../lib/theme';
import { ApiError, createBooking } from '../../lib/api';
import { useLang, type Lang } from '../../lib/i18n';
import { practice } from '../../lib/site-content';

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

// Bilingual labels for the BOOKING_TYPES enum values (the enum stays the source).
const TYPE_LABELS: Record<Lang, Record<BookingType, string>> = {
  el: { assessment: 'Πρώτη γνωριμία', private: 'Ιδιαίτερο', group: 'Ομαδικό' },
  en: { assessment: 'First hello', private: 'Private', group: 'Group' },
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
      desc: 'Ζητήστε ραντεβού: πρώτη γνωριμία, ιδιαίτερο ή ομαδικό μάθημα. Χωρίς δέσμευση.',
    },
    eyebrow: 'Ραντεβού',
    title: { line1: 'Ας κανονίσουμε μια', mark: 'πρώτη γνωριμία.', line2: '' },
    lead:
      'Διαλέξτε τι σας ταιριάζει και πείτε μας πότε βολεύει. Θα ελέγξουμε τη διαθεσιμότητα και θα επιβεβαιώσουμε — δεν χρεώνεται τίποτα μέχρι τότε.',
    nextTitle: 'Τι γίνεται μετά',
    nextSteps: [
      'Σας απαντάμε και κλειδώνουμε ημέρα και ώρα.',
      'Στην πρώτη συνάντηση παρατηρούμε — δεν εκπαιδεύουμε ακόμα.',
      'Φεύγετε με ένα γραπτό πλάνο και το πρώτο σας νούμερο.',
    ],
    nextNote: 'Αν δεν σας ταιριάζουμε, θα σας το πούμε ευθέως.',
    typeLabel: 'Τι σας ενδιαφέρει;',
    dateLabel: 'Ημερομηνία (ΕΕΕΕ-ΜΜ-ΗΗ)',
    datePlaceholder: '2026-07-01',
    timeLabel: 'Ώρα (ΩΩ:ΛΛ)',
    timePlaceholder: '10:30',
    nameLabel: 'Πώς σας λένε;',
    namePlaceholder: 'Το όνομά σας',
    contactLabel: 'Πού να απαντήσουμε;',
    contactPlaceholder: 'email ή τηλέφωνο',
    notesLabel: 'Κάτι που πρέπει να ξέρουμε; (προαιρετικά)',
    notesPlaceholder: 'Π.χ. «Φοβάται τους άντρες με καπέλο»',
    submit: 'Ζήτα ραντεβού',
    nameRequired: 'Πείτε μας πώς σας λένε.',
    contactRequired: 'Χρειαζόμαστε ένα email ή τηλέφωνο για να απαντήσουμε.',
    dateRequired: 'Δώστε έγκυρη ημερομηνία και ώρα.',
    successTitle: 'Το λάβαμε.',
    successBody: `Ελέγχουμε τη διαθεσιμότητα και σας επιβεβαιώνουμε ${practice.replyTime.el}. Δεν έχει χρεωθεί τίποτα.`,
    errorPrefix: 'Κάτι πήγε στραβά: ',
  },
  en: {
    head: {
      title: 'Book an Appointment — TailsUp',
      desc: 'Request an appointment: a first hello, a private session or a group class. No strings.',
    },
    eyebrow: 'Booking',
    title: { line1: 'Let’s set up a', mark: 'first hello.', line2: '' },
    lead:
      'Pick what suits you and tell us when works. We’ll check availability and confirm — nothing is charged before that.',
    nextTitle: 'What happens next',
    nextSteps: [
      'We reply and lock in a day and a time.',
      'At the first meeting we watch — we don’t train yet.',
      'You leave with a written plan and your first number.',
    ],
    nextNote: 'If we are not the right fit, we will say so plainly.',
    typeLabel: 'What are you after?',
    dateLabel: 'Date (YYYY-MM-DD)',
    datePlaceholder: '2026-07-01',
    timeLabel: 'Time (HH:MM)',
    timePlaceholder: '10:30',
    nameLabel: 'What’s your name?',
    namePlaceholder: 'Your name',
    contactLabel: 'Where should we reply?',
    contactPlaceholder: 'email or phone',
    notesLabel: 'Anything we should know? (optional)',
    notesPlaceholder: 'e.g. "Scared of men in hats"',
    submit: 'Request it',
    nameRequired: 'Let us know what to call you.',
    contactRequired: 'We need an email or phone to reply to.',
    dateRequired: 'Please give a valid date and time.',
    successTitle: 'Got it.',
    successBody: `We’ll check availability and confirm ${practice.replyTime.en}. Nothing has been charged.`,
    errorPrefix: 'Something went wrong: ',
  },
} as const;

export default function BookingPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const { isWide } = useResponsive();
  const ty = useType();

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

  const h1 = [ty.h1, fontFallback.display, styles.ink];

  return (
    <>
      <Head>
        <title>{c.head.title}</title>
        <meta name="description" content={c.head.desc} />
        <meta property="og:title" content={c.head.title} />
        <meta property="og:description" content={c.head.desc} />
      </Head>

      {/* ── Intro ───────────────────────────────────────────────────────── */}
      <Section spacing="normal">
        <Stack gap={space.md} style={styles.intro}>
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <View style={styles.headline}>
            <Text style={h1}>{c.title.line1}</Text>
            <HeadlineRow>
              <Highlight>
                <Text style={h1}>{c.title.mark}</Text>
              </Highlight>
            </HeadlineRow>
          </View>
          <Text style={[ty.bodyLg, fontFallback.body, styles.lead]}>{c.lead}</Text>
        </Stack>
      </Section>

      <Wave color={colors.bgAlt} height={isWide ? 64 : 36} />

      {/* ── The form, with "what happens next" beside it ────────────────── */}
      <Section alt spacing="tight">
        <Grid gap={space.lg} align="flex-start">
          <Col weight={3}>
            <Card tint="white" large>
              {status.kind === 'success' ? (
                <View style={styles.success} accessibilityLiveRegion="polite">
                  <Paw size={30} />
                  <Text style={[ty.h3, fontFallback.display, styles.successTitle]}>
                    {c.successTitle}
                  </Text>
                  <Text style={[ty.bodyLg, fontFallback.body, styles.muted]}>{c.successBody}</Text>
                </View>
              ) : (
                <Stack gap={space.md}>
                  {/* Type picker — pills over BOOKING_TYPES */}
                  <Stack gap={7}>
                    <Text style={[ty.body, fontFallback.body, styles.fieldLabel]}>
                      {c.typeLabel}
                    </Text>
                    <View style={styles.pills} accessibilityRole="radiogroup">
                      {BOOKING_TYPES.map((t) => (
                        <TypePill
                          key={t}
                          label={TYPE_LABELS[lang][t]}
                          active={t === bookingType}
                          disabled={pending}
                          onPress={() => setBookingType(t)}
                          ty={ty}
                        />
                      ))}
                    </View>
                  </Stack>

                  {/* Date + time — combined into requestedAt ISO */}
                  <Grid gap={space.md} keepRow={isWide}>
                    <Col weight={1}>
                      <Field
                        label={c.dateLabel}
                        placeholder={c.datePlaceholder}
                        value={date}
                        onChangeText={setDate}
                        editable={!pending}
                        error={touched ? dateError : undefined}
                        autoCapitalize="none"
                      />
                    </Col>
                    <Col weight={1}>
                      <Field
                        label={c.timeLabel}
                        placeholder={c.timePlaceholder}
                        value={time}
                        onChangeText={setTime}
                        editable={!pending}
                        autoCapitalize="none"
                      />
                    </Col>
                  </Grid>

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
                    <Text
                      style={[ty.body, fontFallback.body, styles.errorBanner]}
                      accessibilityLiveRegion="polite"
                    >
                      {c.errorPrefix}
                      {status.message}
                    </Text>
                  )}

                  <PrimaryButton label={c.submit} onPress={onSubmit} loading={pending} block />
                </Stack>
              )}
            </Card>
          </Col>

          {/* What happens next — the reason people don't abandon this form. */}
          <Col weight={2}>
            <Card tint="mint" large>
              <Stack gap={space.sm}>
                <Text style={[ty.h3, fontFallback.display, styles.ink]}>{c.nextTitle}</Text>
                {c.nextSteps.map((step) => (
                  <Bullet key={step} color={TINTS.mint.ink} tickColor={TINTS.mint.iconInk}>
                    {step}
                  </Bullet>
                ))}
                <Text style={[ty.body, fontFallback.body, styles.nextNote]}>{c.nextNote}</Text>
              </Stack>
            </Card>
          </Col>
        </Grid>
      </Section>
    </>
  );
}

// ── One pill of the booking-type picker ──────────────────────────────────────
// A radio, not a button: `accessibilityRole="radio"` + `selected` state is what
// tells a screen reader these three are one choice.
function TypePill({
  label,
  active,
  disabled,
  onPress,
  ty,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  ty: ReturnType<typeof useType>;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, focused, pressed }) => [
        styles.pill,
        active ? styles.pillActive : styles.pillIdle,
        (hovered || pressed) && !active && styles.pillHover,
        focused && styles.pillFocused,
        disabled && styles.pillDisabled,
        Platform.select({ web: { cursor: disabled ? 'default' : 'pointer' } as object, default: {} }),
      ]}
    >
      <Text
        style={[
          ty.body,
          fontFallback.body,
          styles.pillText,
          active ? styles.pillTextActive : styles.pillTextIdle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors.text },
  muted: { color: colors.textMuted },

  intro: { maxWidth: 720 },
  headline: { gap: 2 },
  lead: { color: colors.textMuted, maxWidth: 600 },

  fieldLabel: {
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },

  // Type picker
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  pill: {
    borderRadius: radii.pill,
    paddingVertical: 11,
    paddingHorizontal: 20,
    minHeight: 46,
    justifyContent: 'center',
    borderWidth: 2,
  },
  pillIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.fieldBorder,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillHover: {
    backgroundColor: colors.mintSoft,
  },
  pillFocused: {
    borderColor: colors.accentBright,
  },
  pillDisabled: {
    opacity: 0.6,
  },
  pillText: {
    fontFamily: fonts.bodySemiBold,
  },
  pillTextIdle: { color: colors.textMuted },
  pillTextActive: { color: colors.onDark },

  // Next-steps card
  nextNote: {
    color: colors.textOnMint,
    fontFamily: fonts.bodySemiBold,
    marginTop: space.xs,
  },

  // Feedback
  errorBanner: { color: colors.danger },
  success: {
    gap: space.xs,
    alignItems: 'flex-start',
  },
  successTitle: { color: colors.primary },
});
