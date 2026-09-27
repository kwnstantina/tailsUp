// =============================================================================
// (site)/contact.tsx — Contact / Επικοινωνία  (route: /contact)
//
// Where to find us and how to reach us: the practice details on a tinted card
// with drawn icons, the keyless <PracticeMap/>, and the LEAD FORM (name,
// contact, message) → createLead with source 'website-contact'.
//
// The form keeps its discriminated Status union (idle/pending/success/error):
// inline validation, disabled-while-submitting, a clear success confirmation,
// and the ApiError message on failure. The shared <Field/> owns the focus ring.
//
// Address, phone, email and hours are clearly-marked placeholders (the user
// decision) — no invented values that could be mistaken for real ones.
// =============================================================================

import { useState } from 'react';
import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import type { CreateLeadInput } from '@tailsup/shared';
import {
  Card,
  Col,
  Eyebrow,
  Field,
  Grid,
  HeadlineRow,
  Highlight,
  IconClock,
  IconMail,
  IconPhone,
  IconPin,
  Paw,
  PrimaryButton,
  Section,
  Stack,
  Sticker,
  TINTS,
  Wave,
  Wrap,
} from '../../components/ui';
import { PracticeMap } from '../../components/PracticeMap';
import { colors, fontFallback, fonts, radii, space, useResponsive, useType } from '../../lib/theme';
import { ApiError, createLead } from '../../lib/api';
import { useLang } from '../../lib/i18n';
import { practice } from '../../lib/site-content';

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const copy = {
  el: {
    head: {
      title: 'Επικοινωνία — TailsUp',
      desc: 'Βρείτε μας στην Αθήνα ή γράψτε μας δυο γραμμές για τον σκύλο σας. Απαντάμε σε άνθρωπο, όχι σε αυτόματο.',
    },
    eyebrow: 'Επικοινωνία',
    title: { line1: 'Πείτε μας για', mark: 'τον σκύλο σας.', line2: '' },
    lead:
      'Δυο-τρεις προτάσεις αρκούν. Ό,τι κι αν κάνει, μάλλον το έχουμε ξανασυναντήσει — και σίγουρα δεν θα μας σοκάρει.',
    claims: ['Απαντάει άνθρωπος', 'Χωρίς newsletter', 'Χωρίς δέσμευση'],
    detailsTitle: 'Πού θα μας βρείτε',
    addressLabel: 'Διεύθυνση',
    phoneLabel: 'Τηλέφωνο',
    emailLabel: 'Email',
    hoursLabel: 'Ώρες',
    mapLabel: 'TailsUp — τοποθεσία πρακτικής',
    formTitle: 'Γράψτε μας',
    nameLabel: 'Πώς σας λένε;',
    namePlaceholder: 'Το όνομά σας',
    contactLabel: 'Πού να απαντήσουμε;',
    contactPlaceholder: 'email ή τηλέφωνο',
    messageLabel: 'Τι συμβαίνει; (προαιρετικά)',
    messagePlaceholder: 'Π.χ. «Τραβάει σαν τρένο και γαβγίζει σε κάθε σκύλο»',
    submit: 'Στείλ’ το',
    nameRequired: 'Πείτε μας πώς σας λένε.',
    contactRequired: 'Χρειαζόμαστε ένα email ή τηλέφωνο για να απαντήσουμε.',
    successTitle: 'Το λάβαμε.',
    successBody: `Θα σας απαντήσουμε ${practice.replyTime.el}. Ευχαριστούμε!`,
    errorPrefix: 'Κάτι πήγε στραβά: ',
    replyNote: `Απαντάμε συνήθως ${practice.replyTime.el}.`,
  },
  en: {
    head: {
      title: 'Contact — TailsUp',
      desc: 'Find us in Athens, or send us a couple of lines about your dog. A person replies, not an autoresponder.',
    },
    eyebrow: 'Contact',
    title: { line1: 'Tell us about', mark: 'your dog.', line2: '' },
    lead:
      'A few sentences is plenty. Whatever they’re doing, we’ve almost certainly met it before — and nothing you write is going to shock us.',
    claims: ['A person replies', 'No newsletter', 'No strings'],
    detailsTitle: 'Where to find us',
    addressLabel: 'Address',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    hoursLabel: 'Hours',
    mapLabel: 'TailsUp — practice location',
    formTitle: 'Drop us a line',
    nameLabel: 'What’s your name?',
    namePlaceholder: 'Your name',
    contactLabel: 'Where should we reply?',
    contactPlaceholder: 'email or phone',
    messageLabel: 'What’s going on? (optional)',
    messagePlaceholder: 'e.g. "Pulls like a train and barks at every dog"',
    submit: 'Send it',
    nameRequired: 'Let us know what to call you.',
    contactRequired: 'We need an email or phone to reply to.',
    successTitle: 'Got it.',
    successBody: `We’ll come back to you ${practice.replyTime.en}. Thank you!`,
    errorPrefix: 'Something went wrong: ',
    replyNote: `We usually reply ${practice.replyTime.en}.`,
  },
} as const;

export default function ContactPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const { isWide } = useResponsive();
  const ty = useType();

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
          <Wrap gap={12}>
            {c.claims.map((claim, i) => (
              <Sticker
                key={claim}
                label={claim}
                tint={(['mint', 'peach', 'coral'] as const)[i % 3]}
                tick
                rotate={i % 2 === 0 ? -1.4 : 1.2}
              />
            ))}
          </Wrap>
        </Stack>
      </Section>

      <Wave color={colors.bgAlt} height={isWide ? 64 : 36} />

      {/* ── Details + map (left), the lead form (right) ─────────────────── */}
      <Section alt spacing="tight">
        <Grid gap={space.lg} align="flex-start">
          {/* Practice details + map */}
          <Col weight={1}>
            <Stack gap={space.md}>
              <Card tint="mint" large>
                <Stack gap={space.md}>
                  <Text style={[ty.h3, fontFallback.display, styles.ink]}>{c.detailsTitle}</Text>
                  <Detail
                    Icon={IconPin}
                    label={c.addressLabel}
                    value={practice.address[lang]}
                    ty={ty}
                  />
                  <Detail Icon={IconPhone} label={c.phoneLabel} value={practice.phone} ty={ty} />
                  <Detail Icon={IconMail} label={c.emailLabel} value={practice.email} ty={ty} />
                  <Detail
                    Icon={IconClock}
                    label={c.hoursLabel}
                    value={practice.hours[lang]}
                    ty={ty}
                  />
                </Stack>
              </Card>
              <PracticeMap label={c.mapLabel} />
            </Stack>
          </Col>

          {/* The lead form */}
          <Col weight={1}>
            <Card tint="white" large>
              <Stack gap={space.md}>
                <Text style={[ty.h3, fontFallback.display, styles.ink]}>{c.formTitle}</Text>

                {status.kind === 'success' ? (
                  <View style={styles.success} accessibilityLiveRegion="polite">
                    <Paw size={30} />
                    <Text style={[ty.h3, fontFallback.display, styles.successTitle]}>
                      {c.successTitle}
                    </Text>
                    <Text style={[ty.body, fontFallback.body, styles.muted]}>{c.successBody}</Text>
                  </View>
                ) : (
                  <Stack gap={space.md}>
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
                      <Text
                        style={[ty.body, fontFallback.body, styles.errorBanner]}
                        accessibilityLiveRegion="polite"
                      >
                        {c.errorPrefix}
                        {status.message}
                      </Text>
                    )}

                    <PrimaryButton label={c.submit} onPress={onSubmit} loading={pending} block />
                    <Text style={[ty.body, fontFallback.body, styles.replyNote]}>
                      {c.replyNote}
                    </Text>
                  </Stack>
                )}
              </Stack>
            </Card>
          </Col>
        </Grid>
      </Section>
    </>
  );
}

// ── One detail line: drawn icon, label, placeholder value ────────────────────
function Detail({
  Icon,
  label,
  value,
  ty,
}: {
  Icon: (props: { size?: number; color?: string }) => React.ReactElement;
  label: string;
  value: string;
  ty: ReturnType<typeof useType>;
}) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>
        <Icon size={20} color={TINTS.mint.iconInk} />
      </View>
      <View style={styles.detailText}>
        <Text style={[ty.body, fontFallback.body, styles.detailLabel]}>{label}</Text>
        <Text style={[ty.body, fontFallback.body, styles.detailValue]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors.text },
  muted: { color: colors.textMuted },

  intro: { maxWidth: 720 },
  headline: { gap: 2 },
  lead: { color: colors.textMuted, maxWidth: 560 },

  // Details
  detail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: { flex: 1, minWidth: 0 },
  detailLabel: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailValue: { color: colors.text },

  // Form feedback
  errorBanner: { color: colors.danger },
  replyNote: {
    color: colors.textMuted,
    fontSize: 13.5,
    textAlign: 'center',
  },
  success: {
    gap: space.xs,
    alignItems: 'flex-start',
  },
  successTitle: { color: colors.primary },
});
