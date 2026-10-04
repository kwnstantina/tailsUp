// =============================================================================
// (site)/index.tsx — Home / Αρχική  (route: /)
//
// Business-first: this page is about the PRACTICE — a warm, expert, local
// dog-training practice — not "an app" or "a data platform". The tracking
// platform earns exactly one band, as the reason to pick THIS trainer rather
// than the headline itself.
//
// The playful direction spends colour rather than rationing it: a highlighter
// mark through the hero, a run of tilted stickers, tinted service cards, a soft
// wave between bands, and one deep-green block for the proof. The restraint is
// in the rotation (±2° tilt, three tints, one wave per seam), not in the
// palette.
//
// Bilingual via useLang(); column→row via useResponsive().
// =============================================================================

import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  Card,
  CirclePhoto,
  Col,
  Container,
  Eyebrow,
  Grid,
  HeadlineRow,
  Highlight,
  IconBubble,
  IconMagnifier,
  IconPair,
  IconTrio,
  Paw,
  PhotoPlaceholder,
  PrimaryButton,
  ProofBand,
  Section,
  SecondaryButton,
  Stack,
  Sticker,
  TINTS,
  Wave,
  Wrap,
} from '../../components/ui';
import { ProgressCurve } from '../../components/ProgressCurve';
import { colors, fontFallback, fonts, radii, space, useResponsive, useType } from '../../lib/theme';
import { useLang } from '../../lib/i18n';
import { crew, practice, sampleCurve, services, trustClaims } from '../../lib/site-content';
import { photos } from '../../lib/photos';

// Card order matches `services` — the first three only; the intensive programme
// lives on /services rather than competing for room in a three-up row.
const SERVICE_ICONS = [IconMagnifier, IconPair, IconTrio];

const copy = {
  el: {
    head: {
      title: 'TailsUp — Εκπαίδευση σκύλων χωρίς εκφοβισμό',
      desc: 'Ήρεμη, μεθοδική εκπαίδευση σκύλων στην Αθήνα. Πρώτη γνωριμία χωρίς δέσμευση — και πρόοδος που φαίνεται.',
    },
    heroEyebrow: 'Εκπαίδευση σκύλων χωρίς εκφοβισμό',
    // Composed in three pieces — the middle one gets the highlighter mark.
    // RN can't paint a box behind an inline run of text (see Highlight.tsx).
    title: { line1: 'Χαρούμενοι σκύλοι,', mark: 'πιο ήρεμες', line2: 'βόλτες.' },
    lead:
      'Γαβγίσματα, τραβήγματα στο λουρί, μια Τρίτη πρωί που ξέφυγε; Θα το λύσουμε μαζί — στον ρυθμό του σκύλου σας, με πολύ λιγότερο άγχος απ’ όσο περιμένετε.',
    ctaPrimary: 'Κλείσε την πρώτη γνωριμία',
    ctaSecondary: 'Δες τι κάνουμε',
    photoAlt: 'Ο Άτερ ξαπλωμένος ήρεμα στο χορτάρι στη διάρκεια της βόλτας, με το λουρί χαλαρό δίπλα του.',
    crewEyebrow: 'Η παρέα',
    crewTitle: 'Σκύλοι που έχουμε γνωρίσει',
    servicesEyebrow: 'Τι κάνουμε',
    servicesTitle: 'Τρεις τρόποι να ξεκινήσετε',
    servicesLead:
      'Δεν ξέρετε ποιο σας ταιριάζει; Γράψτε μας δυο γραμμές για το χάος — θα σας πούμε ειλικρινά από πού να ξεκινήσετε.',
    serviceCta: 'Κλείσ’ το',
    servicesAll: 'Όλες οι υπηρεσίες',
    proofEyebrow: 'Αυτό που δεν κάνει κανείς άλλος',
    proofTitle: 'Θα το δείτε να δουλεύει',
    proofBody1:
      'Σε κάθε συνεδρία σημειώνουμε τι πραγματικά έγινε: τι πυροδότησε τον σκύλο σας, πόσο κοντά άντεξε, πόσο γρήγορα ηρέμησε. Τέσσερα χτυπήματα στην οθόνη. Δεν παίρνει τίποτα από τη συνεδρία.',
    proofBody2:
      'Μετά από λίγες εβδομάδες γίνεται αυτό εδώ. Χρήσιμο τις μέρες που νομίζετε ότι δεν αλλάζει τίποτα.',
    proofCta: 'Δείξε μου ένα αληθινό',
    curveTitle: 'Δώδεκα εβδομάδες, μία καμπύλη',
    curveRange: '2 μ → 14 μ',
    curveCaption:
      'Πόσο κοντά μπορούσε να έρθει άλλος σκύλος πριν αντιδράσει. Παράδειγμα της μορφής — όχι δεδομένα πραγματικού σκύλου.',
    closingTitle: 'Λοιπόν, πείτε μας για τον σκύλο σας.',
    closingBody:
      'Δυο-τρεις προτάσεις αρκούν. Ό,τι κι αν κάνει, μάλλον το έχουμε ξανασυναντήσει — και σίγουρα δεν θα μας σοκάρει.',
    closingNote: 'Χωρίς newsletter. Χωρίς αυτοματοποιημένα email. Μόνο μια απάντηση.',
    closingPrimary: 'Κλείσε ραντεβού',
    closingSecondary: 'Στείλε μας μήνυμα',
  },
  en: {
    head: {
      title: 'TailsUp — Force-free dog training',
      desc: 'Calm, methodical dog training in Athens. A first hello with no strings — and progress you can actually see.',
    },
    heroEyebrow: 'Force-free dog training',
    title: { line1: 'Happy dogs,', mark: 'happier', line2: 'walks.' },
    lead:
      'Barking, lunging, pulling on the lead, or just a bit much on a Tuesday morning? We’ll work it out together — at your dog’s pace, with far less stress than you’re expecting.',
    ctaPrimary: 'Book a first hello',
    ctaSecondary: 'See what we do',
    photoAlt: 'Ater lying calmly in the grass mid-walk, his lead slack beside him.',
    crewEyebrow: 'Some of the crew',
    crewTitle: 'Dogs we’ve worked with',
    servicesEyebrow: 'What we do',
    servicesTitle: 'Three ways to start',
    servicesLead:
      'Not sure which one? Send us a note describing the chaos — we’ll tell you honestly where to begin.',
    serviceCta: 'Book it',
    servicesAll: 'All services',
    proofEyebrow: 'The bit nobody else does',
    proofTitle: 'You get to watch it work',
    proofBody1:
      'Every session we tap out what actually happened — what set your dog off, how close they could get, how quickly they came back down. Four taps. It takes nothing away from the session.',
    proofBody2:
      'A few weeks in, it turns into this. Handy on the days it feels like nothing is changing.',
    proofCta: 'Show me a real one',
    curveTitle: 'Twelve weeks, one curve',
    curveRange: '2 m → 14 m',
    curveCaption:
      'How close another dog could get before the dog reacted. An example of the shape — not one real dog’s data.',
    closingTitle: 'So, tell us about your dog.',
    closingBody:
      'A few sentences is plenty. Whatever they’re doing, we’ve almost certainly met it before — and nothing you write is going to shock us.',
    closingNote: 'No newsletter. No drip campaign. Just a reply.',
    closingPrimary: 'Book an appointment',
    closingSecondary: 'Send us a message',
  },
} as const;

export default function HomePage() {
  const { lang } = useLang();
  const c = copy[lang];
  const router = useRouter();
  const { isWide } = useResponsive();
  const ty = useType();

  const h1 = [ty.h1, fontFallback.display, styles.ink];
  const h2 = [ty.h2, fontFallback.display, styles.ink];

  return (
    <>
      <Head>
        <title>{c.head.title}</title>
        <meta name="description" content={c.head.desc} />
        <meta property="og:title" content={c.head.title} />
        <meta property="og:description" content={c.head.desc} />
      </Head>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <Section spacing="normal">
        <Grid gap={isWide ? space.xl : space.lg} align="center">
          <Col weight={1}>
            <Stack gap={space.md}>
              <Eyebrow>{`${c.heroEyebrow} · ${practice.city[lang]}`}</Eyebrow>

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

              <View style={[styles.ctaRow, !isWide && styles.ctaRowNarrow]}>
                <PrimaryButton
                  label={c.ctaPrimary}
                  onPress={() => router.push('/booking')}
                  block={!isWide}
                />
                <SecondaryButton
                  label={c.ctaSecondary}
                  onPress={() => router.push('/services')}
                  block={!isWide}
                />
              </View>

              <View style={styles.replyRow}>
                <View style={styles.dot} />
                <Text style={[ty.body, fontFallback.body, styles.replyText]}>
                  {lang === 'el'
                    ? `Απαντάμε συνήθως ${practice.replyTime.el}.`
                    : `We usually reply ${practice.replyTime.en}.`}
                </Text>
              </View>
            </Stack>
          </Col>

          <Col weight={1}>
            <View style={styles.photoWrap}>
              {/*
                Decorative shapes behind the photo. Hidden with `display` rather
                than a conditional render so the element tree stays identical
                between the pre-rendered HTML and the hydrated client.
              */}
              <View style={[styles.blobMint, { display: isWide ? 'flex' : 'none' }]} />
              <View style={[styles.blobCoral, { display: isWide ? 'flex' : 'none' }]} />
              <PhotoPlaceholder
                label={c.photoAlt}
                height={isWide ? 440 : 300}
                tint="peach"
                style={isWide ? styles.photoInset : undefined}
                source={photos.heroDog}
              />
            </View>
          </Col>
        </Grid>
      </Section>

      {/* Soft seam into the peach band. One wave per transition — more and it
          stops being a signature and starts being noise. */}
      <Wave color={colors.bgAlt} height={isWide ? 64 : 36} />

      {/* ── Trust stickers ──────────────────────────────────────────────── */}
      <View style={styles.stickerBand}>
        <Container style={styles.stickerInner}>
          <Wrap gap={14} justify={isWide ? 'center' : 'flex-start'}>
            {trustClaims[lang].map((claim, i) => (
              <Sticker
                key={claim.label}
                label={claim.label}
                tint={claim.tint}
                tick={claim.tick}
                // Alternating tilt, never past 2°.
                rotate={i % 2 === 0 ? -1.5 : 1.3}
              />
            ))}
          </Wrap>
        </Container>
      </View>

      {/* ── The crew strip ──────────────────────────────────────────────── */}
      <Section alt spacing="tight">
        <Stack gap={space.md}>
          <Stack gap={4}>
            <Eyebrow>{c.crewEyebrow}</Eyebrow>
            <Text style={h2}>{c.crewTitle}</Text>
          </Stack>
          <Grid gap={isWide ? 20 : space.md}>
            {crew[lang].map((member) => (
              <Col key={member.name}>
                <CirclePhoto
                  name={member.name}
                  caption={member.workedOn}
                  tint={member.tint}
                  source={photos[member.photo]}
                />
              </Col>
            ))}
          </Grid>
        </Stack>
      </Section>

      {/* ── Services — three tinted cards ───────────────────────────────── */}
      <Section spacing="normal">
        <Stack gap={space.lg}>
          <Stack gap={4} style={isWide ? styles.centered : undefined}>
            <Eyebrow>{c.servicesEyebrow}</Eyebrow>
            <Text style={[h2, isWide && styles.centerText]}>{c.servicesTitle}</Text>
            <Text
              style={[
                ty.bodyLg,
                fontFallback.body,
                styles.lead,
                isWide && styles.centerText,
                styles.servicesLead,
              ]}
            >
              {c.servicesLead}
            </Text>
          </Stack>

          <Grid>
            {services[lang].slice(0, 3).map((service, i) => {
              const Icon = SERVICE_ICONS[i] ?? IconMagnifier;
              const t = TINTS[service.tint];
              return (
                <Col key={service.key}>
                  <Card tint={service.tint} style={styles.serviceCard}>
                    <IconBubble>
                      <Icon size={28} color={t.iconInk} />
                    </IconBubble>
                    <Text style={[ty.h3, fontFallback.display, styles.ink]}>{service.title}</Text>
                    <Text style={[ty.body, fontFallback.body, { color: t.ink }]}>
                      {service.summary}
                    </Text>
                    <View style={styles.serviceFoot}>
                      <Text style={[ty.body, fontFallback.body, styles.price]}>
                        {service.price}
                      </Text>
                      <PrimaryButton
                        label={c.serviceCta}
                        tone="green"
                        size="small"
                        onPress={() => router.push('/booking')}
                      />
                    </View>
                  </Card>
                </Col>
              );
            })}
          </Grid>

          <View style={isWide ? styles.centered : undefined}>
            <SecondaryButton
              label={c.servicesAll}
              size="small"
              onPress={() => router.push('/services')}
            />
          </View>
        </Stack>
      </Section>

      {/* ── The one bold moment: the tracking platform, as proof ────────── */}
      <ProofBand>
        <Grid gap={isWide ? space.xl : space.lg} align="center">
          <Col weight={1}>
            <Stack gap={space.md}>
              <Eyebrow onDark>{c.proofEyebrow}</Eyebrow>
              <Text style={[ty.h2, fontFallback.display, styles.onDark]}>{c.proofTitle}</Text>
              <Text style={[ty.bodyLg, fontFallback.body, styles.onDarkMuted]}>
                {c.proofBody1}
              </Text>
              <Text style={[ty.bodyLg, fontFallback.body, styles.onDarkMuted]}>
                {c.proofBody2}
              </Text>
              <View style={styles.proofCta}>
                <PrimaryButton
                  label={c.proofCta}
                  onPress={() => router.push('/results')}
                  block={!isWide}
                />
              </View>
            </Stack>
          </Col>

          <Col weight={1}>
            <View style={[styles.curveCard, { padding: isWide ? 28 : 20 }]}>
              <View style={styles.curveHead}>
                <Text
                  numberOfLines={1}
                  style={[ty.h3, fontFallback.display, styles.ink, styles.curveTitle]}
                >
                  {c.curveTitle}
                </Text>
                <Text style={[ty.body, fontFallback.body, styles.curveRange]}>{c.curveRange}</Text>
              </View>
              <ProgressCurve data={sampleCurve} height={isWide ? 200 : 170} />
              <Text style={[ty.body, fontFallback.body, styles.caption]}>{c.curveCaption}</Text>
            </View>
          </Col>
        </Grid>
      </ProofBand>

      {/* ── Closing invitation ──────────────────────────────────────────── */}
      <Section alt spacing="normal">
        <Grid gap={isWide ? space.xl : space.lg} align="center">
          <Col weight={1}>
            <Stack gap={space.md}>
              <Text style={h2}>{c.closingTitle}</Text>
              <Text style={[ty.bodyLg, fontFallback.body, styles.lead]}>{c.closingBody}</Text>
              <View style={styles.replyRow}>
                <Paw size={22} />
                <Text style={[ty.body, fontFallback.body, styles.replyText]}>{c.closingNote}</Text>
              </View>
            </Stack>
          </Col>
          <Col weight={1}>
            <Card tint="white">
              <View style={styles.closingCta}>
                <PrimaryButton
                  label={c.closingPrimary}
                  onPress={() => router.push('/booking')}
                  block
                />
                <SecondaryButton
                  label={c.closingSecondary}
                  onPress={() => router.push('/contact')}
                  block
                />
              </View>
            </Card>
          </Col>
        </Grid>
      </Section>
    </>
  );
}

// Only width-independent styles live here — anything that reads `useType()` has
// to be applied inline, because the scale changes with the window.
const styles = StyleSheet.create({
  ink: { color: colors.text },
  onDark: { color: colors.onDark },
  onDarkMuted: { color: colors.onDarkMuted, maxWidth: 470 },

  // Hero
  headline: { gap: 2 },
  lead: { color: colors.textMuted, maxWidth: 500 },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: 4,
  },
  ctaRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  replyText: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    flexShrink: 1,
  },

  // Hero photo + its decorative shapes
  photoWrap: { position: 'relative' },
  photoInset: { width: '92%', alignSelf: 'flex-end' },
  blobMint: {
    position: 'absolute',
    left: -10,
    top: 40,
    width: 150,
    height: 150,
    borderRadius: radii.pill,
    backgroundColor: colors.mint,
  },
  blobCoral: {
    position: 'absolute',
    right: 24,
    top: -34,
    width: 92,
    height: 92,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    opacity: 0.85,
  },

  // Sticker band — sits flush under the wave, so it owns its own padding
  // rather than taking a Section's rhythm.
  stickerBand: { backgroundColor: colors.bgAlt },
  stickerInner: { paddingTop: space.xs, paddingBottom: space.lg },

  // Services
  centered: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  servicesLead: { maxWidth: 560 },
  serviceCard: { flex: 1, gap: space.sm },
  serviceFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: 'auto',
    paddingTop: space.md,
  },
  price: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
  },

  // Proof band
  proofCta: { marginTop: 6, alignItems: 'flex-start', alignSelf: 'stretch' },
  curveCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    gap: 14,
  },
  curveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  curveTitle: { flex: 1 },
  curveRange: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  // Closing
  closingCta: { gap: space.sm },
});
