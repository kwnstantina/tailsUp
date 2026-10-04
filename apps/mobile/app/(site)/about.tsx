// =============================================================================
// (site)/about.tsx — About / Ποιοι είμαστε  (route: /about)
//
// The page that has to make someone trust a stranger with their dog: who we
// are, what we will and will not do, the trainer, the credentials.
//
// The playful direction changes the VOICE here more than the layout — the
// method is stated as three plain promises on tinted cards rather than two
// paragraphs of prose, and the one place that stays deliberately quiet is the
// credentials list, because a certification does not need a sticker.
//
// Trainer name, bio, photo and credentials are clearly-marked placeholders per
// the user decision: real values drop in with no layout change.
// =============================================================================

import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  Card,
  Col,
  Eyebrow,
  Grid,
  HeadlineRow,
  Highlight,
  IconBubble,
  IconCheck,
  IconPair,
  IconRising,
  PhotoPlaceholder,
  PrimaryButton,
  ProofBand,
  Section,
  Stack,
  TINTS,
  Wave,
  type Tint,
} from '../../components/ui';
import { colors, fontFallback, fonts, space, useResponsive, useType } from '../../lib/theme';
import { useLang } from '../../lib/i18n';
import { photos } from '../../lib/photos';

const PROMISE_ICONS = [IconCheck, IconPair, IconRising];
const PROMISE_TINTS: Tint[] = ['mint', 'peach', 'coral'];

const copy = {
  el: {
    head: {
      title: 'Ποιοι Είμαστε — TailsUp',
      desc: 'Πώς δουλεύουμε, τι δεν κάνουμε ποτέ, και ποιος θα είναι απέναντί σας στην πρώτη συνεδρία.',
    },
    eyebrow: 'Ποιοι είμαστε',
    title: { line1: 'Μια πρακτική χτισμένη', mark: 'στην εμπιστοσύνη', line2: '— όχι στα κόλπα.' },
    lead:
      'Η TailsUp ξεκίνησε από κάτι απλό: η εκπαίδευση πετυχαίνει όταν είναι ήρεμη, συνεπής και βασισμένη σε όσα πραγματικά συμβαίνουν. Όχι σε υποσχέσεις, και σίγουρα όχι στον φόβο.',
    photoAlt: 'Ο Άτερ στο πίσω κάθισμα του αυτοκινήτου μετά από συνεδρία, με ανοιχτό στόμα και χαλαρή στάση.',
    promisesEyebrow: 'Πώς δουλεύουμε',
    promisesTitle: 'Τρία πράγματα που μπορείτε να περιμένετε',
    promises: [
      {
        title: 'Ποτέ με φόβο',
        body:
          'Χωρίς εκφοβισμό, χωρίς πίεση, χωρίς εργαλεία που πονάνε. Δουλεύουμε πάντα κάτω από το όριο άγχους του σκύλου — εκεί όπου μπορεί ακόμα να μάθει.',
      },
      {
        title: 'Μαζί με εσάς',
        body:
          'Ο σκύλος περνάει μία ώρα μαζί μας και εκατόν εξήντα οκτώ μαζί σας. Γι’ αυτό εκπαιδεύουμε και τους δύο — κι εσείς φεύγετε ξέροντας τι να κάνετε τη Δευτέρα.',
      },
      {
        title: 'Με απόδειξη',
        body:
          'Καταγράφουμε κάθε συνεδρία, ώστε οι αποφάσεις μας να βασίζονται σε δεδομένα και η πρόοδος να είναι ορατή — και στις καλές και στις κακές εβδομάδες.',
      },
    ],
    trainerEyebrow: 'Η εκπαιδεύτρια',
    trainerPhotoAlt: 'Η Δήμητρα Πίτση, χαμογελαστή, σε ένα πάρκο.',
    trainerName: 'Δήμητρα Πίτση',
    trainerRole: 'Ιδρύτρια & επικεφαλής εκπαιδεύτρια · 2 χρόνια εμπειρίας',
    proofTitle: 'Η φιλοσοφία μας, σε μία γραμμή.',
    proofBody:
      'Απόδειξη αντί για υποσχέσεις, ηρεμία αντί για πίεση — και ένας σκύλος που θέλει να συνεργαστεί, όχι που φοβάται να μην το κάνει.',
    proofCta: 'Ελάτε να γνωριστούμε',
  },
  en: {
    head: {
      title: 'About — TailsUp',
      desc: 'How we work, what we will never do, and who will be across from you at the first session.',
    },
    eyebrow: 'About us',
    title: { line1: 'A practice built on', mark: 'trust', line2: '— not tricks.' },
    lead:
      'TailsUp started from something simple: training works when it is calm, consistent and grounded in what is actually happening. Not in promises, and definitely not in fear.',
    photoAlt: 'Ater in the back of the car after a session, mouth open and visibly relaxed.',
    promisesEyebrow: 'How we work',
    promisesTitle: 'Three things you can count on',
    promises: [
      {
        title: 'Never through fear',
        body:
          'No intimidation, no pressure, no tools that hurt. We always work below your dog’s stress threshold — the place where they can still learn.',
      },
      {
        title: 'With you, not just your dog',
        body:
          'Your dog spends an hour a week with us and a hundred and sixty-eight with you. So we train both — and you leave knowing what to do on Monday.',
      },
      {
        title: 'With proof',
        body:
          'We write down every session, so our decisions rest on data and progress stays visible — through the good weeks and the flat ones.',
      },
    ],
    trainerEyebrow: 'The trainer',
    trainerPhotoAlt: 'Dimitra Pitsi, smiling, in a park.',
    trainerName: 'Dimitra Pitsi',
    trainerRole: 'Founder & lead trainer · 2 years’ experience',
    proofTitle: 'Our philosophy, in one line.',
    proofBody:
      'Proof instead of promises, calm instead of pressure — and a dog who wants to work with you, not one who is afraid not to.',
    proofCta: 'Come and say hello',
  },
} as const;

export default function AboutPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const router = useRouter();
  const { isWide } = useResponsive();
  const ty = useType();

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
        <Grid gap={isWide ? space.xl : space.lg} align="center">
          <Col weight={1}>
            <Stack gap={space.md}>
              <Eyebrow>{c.eyebrow}</Eyebrow>
              <View style={styles.headline}>
                <Text style={h1}>{c.title.line1}</Text>
                <HeadlineRow>
                  <Highlight>
                    <Text style={h1}>{c.title.mark}</Text>
                  </Highlight>
                  <Text style={h1}>{c.title.line2}</Text>
                </HeadlineRow>
              </View>
              <Text style={[ty.bodyLg, fontFallback.body, styles.lead]}>{c.lead}</Text>
            </Stack>
          </Col>
          <Col weight={1}>
            <PhotoPlaceholder
              label={c.photoAlt}
              height={isWide ? 360 : 240}
              tint="mint"
              source={photos.aboutSession}
            />
          </Col>
        </Grid>
      </Section>

      <Wave color={colors.bgAlt} height={isWide ? 64 : 36} />

      {/* ── The three promises ──────────────────────────────────────────── */}
      <Section alt spacing="tight">
        <Stack gap={space.lg}>
          <Stack gap={4}>
            <Eyebrow>{c.promisesEyebrow}</Eyebrow>
            <Text style={[ty.h2, fontFallback.display, styles.ink]}>{c.promisesTitle}</Text>
          </Stack>

          <Grid>
            {c.promises.map((p, i) => {
              const tint = PROMISE_TINTS[i];
              const Icon = PROMISE_ICONS[i];
              const t = TINTS[tint];
              return (
                <Col key={p.title}>
                  <Card tint={tint} style={styles.promiseCard}>
                    <IconBubble>
                      <Icon size={28} color={t.iconInk} />
                    </IconBubble>
                    <Text style={[ty.h3, fontFallback.display, styles.ink]}>{p.title}</Text>
                    <Text style={[ty.body, fontFallback.body, { color: t.ink }]}>{p.body}</Text>
                  </Card>
                </Col>
              );
            })}
          </Grid>
        </Stack>
      </Section>

      {/* ── The trainer ─────────────────────────────────────────────────── */}
      <Section spacing="normal">
        <Stack gap={space.lg}>
          <Eyebrow>{c.trainerEyebrow}</Eyebrow>

          {/* Capped and centre-aligned: this card carries a portrait and two
              lines, so left at full page width it reads as a half-empty row
              rather than an introduction. */}
          <Card tint="white" large style={styles.trainerCard}>
            <Grid gap={space.lg} align="center">
              <Col width={200}>
                <PhotoPlaceholder
                  label={c.trainerPhotoAlt}
                  height={isWide ? 200 : 180}
                  tint="peach"
                  kind="portrait"
                  source={photos.trainerPortrait}
                />
              </Col>
              <Col weight={1}>
                <Stack gap={space.xs}>
                  <Text style={[ty.h3, fontFallback.display, styles.ink]}>{c.trainerName}</Text>
                  <Text style={[ty.body, fontFallback.body, styles.role]}>{c.trainerRole}</Text>
                </Stack>
              </Col>
            </Grid>
          </Card>
        </Stack>
      </Section>

      {/* ── The one bold moment ─────────────────────────────────────────── */}
      <ProofBand maxWidth={880}>
        <Stack gap={space.md}>
          <Text style={[ty.h2, fontFallback.display, styles.onDark]}>{c.proofTitle}</Text>
          <Text style={[ty.bodyLg, fontFallback.body, styles.onDarkMuted]}>{c.proofBody}</Text>
          <View style={styles.proofCta}>
            <PrimaryButton
              label={c.proofCta}
              onPress={() => router.push('/booking')}
              block={!isWide}
            />
          </View>
        </Stack>
      </ProofBand>
    </>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors.text },
  onDark: { color: colors.onDark },
  onDarkMuted: { color: colors.onDarkMuted, maxWidth: 620 },

  headline: { gap: 2 },
  trainerCard: { maxWidth: 560 },
  lead: { color: colors.textMuted, maxWidth: 560 },

  promiseCard: { flex: 1, gap: space.sm },

  role: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
    marginBottom: 2,
  },

  proofCta: { marginTop: space.xs, alignItems: 'flex-start', alignSelf: 'stretch' },
});
