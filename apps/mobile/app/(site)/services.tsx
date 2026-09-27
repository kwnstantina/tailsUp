// =============================================================================
// (site)/services.tsx — Services / Υπηρεσίες  (route: /services)
//
// The full catalogue: the four programmes as tinted cards, each with its icon,
// the longer pitch and a ticked "what you leave with" list — then the
// data-driven tracking as the page's ONE bold moment, in the deep-green band
// with the ProgressCurve.
//
// The service copy itself lives in lib/site-content.ts, shared with the home
// teaser, so a price or a title is written once.
// =============================================================================

import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  Bullet,
  Card,
  Col,
  Eyebrow,
  Grid,
  HeadlineRow,
  Highlight,
  IconBubble,
  IconMagnifier,
  IconPair,
  IconRising,
  IconTrio,
  PrimaryButton,
  ProofBand,
  Section,
  Stack,
  TINTS,
  Wave,
} from '../../components/ui';
import { ProgressCurve } from '../../components/ProgressCurve';
import { colors, fontFallback, fonts, radii, space, useResponsive, useType } from '../../lib/theme';
import { useLang } from '../../lib/i18n';
import { sampleCurve, services } from '../../lib/site-content';

// Same order as `services` in site-content.
const SERVICE_ICONS = [IconMagnifier, IconPair, IconTrio, IconRising];

const copy = {
  el: {
    head: {
      title: 'Υπηρεσίες — TailsUp',
      desc: 'Πρώτη γνωριμία, ιδιαίτερα και ομαδικά μαθήματα, εντατικό πρόγραμμα — και καταγραφή προόδου σε δεδομένα.',
    },
    eyebrow: 'Υπηρεσίες',
    title: { line1: 'Τέσσερις τρόποι να', mark: 'ξεκινήσετε', line2: 'σωστά.' },
    lead:
      'Όλα ξεκινούν από την πρώτη γνωριμία — εκεί καταλαβαίνουμε τι συμβαίνει πραγματικά. Από κει και πέρα, διαλέγετε ρυθμό.',
    outcomesTitle: 'Φεύγετε με:',
    cardCta: 'Κλείσ’ το',
    trackingEyebrow: 'Περιλαμβάνεται σε κάθε πρόγραμμα',
    trackingTitle: 'Η πρόοδος, σε νούμερα',
    trackingBody:
      'Σε κάθε συνεδρία καταγράφουμε τη συμπεριφορά ως δεδομένα: απόσταση από το ερέθισμα, ένταση, έκβαση, παρέμβαση. Τέσσερα χτυπήματα στην οθόνη — και μετά από λίγες εβδομάδες έχετε μια καμπύλη αντί για μια εντύπωση.',
    trackingNote: 'Δεν χρεώνεται ξεχωριστά. Είναι απλώς ο τρόπος που δουλεύουμε.',
    curveCaption: 'Ενδεικτικά δεδομένα: το όριο ανοχής (μέτρα) ανεβαίνει με τις εβδομάδες.',
    trackingCta: 'Κλείσε την πρώτη γνωριμία',
  },
  en: {
    head: {
      title: 'Services — TailsUp',
      desc: 'A first hello, private and group sessions, an intensive programme — and progress recorded as data.',
    },
    eyebrow: 'Services',
    title: { line1: 'Four ways to', mark: 'start', line2: 'properly.' },
    lead:
      'It all begins with the first hello — that is where we work out what is actually going on. After that, you pick the pace.',
    outcomesTitle: 'You leave with:',
    cardCta: 'Book it',
    trackingEyebrow: 'Included in every programme',
    trackingTitle: 'Progress, in numbers',
    trackingBody:
      'At every session we record behaviour as data: distance from the trigger, intensity, outcome, intervention. Four taps on a screen — and a few weeks later you have a curve instead of an impression.',
    trackingNote: 'It is not billed separately. It is just how we work.',
    curveCaption: 'Illustrative data: the tolerance threshold (metres) rises over the weeks.',
    trackingCta: 'Book a first hello',
  },
} as const;

export default function ServicesPage() {
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
        <Stack gap={space.md} style={styles.intro}>
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
      </Section>

      <Wave color={colors.bgAlt} height={isWide ? 64 : 36} />

      {/* ── The catalogue — two up on desktop, stacked on a phone ───────── */}
      <Section alt spacing="tight">
        <View style={styles.grid}>
          {services[lang].map((service, i) => {
            const Icon = SERVICE_ICONS[i] ?? IconMagnifier;
            const t = TINTS[service.tint];
            return (
              <View key={service.key} style={isWide ? styles.gridCell : undefined}>
                <Card tint={service.tint} large style={styles.card}>
                  <IconBubble>
                    <Icon size={28} color={t.iconInk} />
                  </IconBubble>

                  <Text style={[ty.h3, fontFallback.display, styles.ink]}>{service.title}</Text>
                  <Text style={[ty.body, fontFallback.body, { color: t.ink }]}>
                    {service.summary}
                  </Text>
                  <Text style={[ty.body, fontFallback.body, { color: t.ink }]}>
                    {service.detail}
                  </Text>

                  <Text style={[ty.body, fontFallback.body, styles.outcomesTitle]}>
                    {c.outcomesTitle}
                  </Text>
                  <Stack gap={space.xs}>
                    {service.outcomes.map((o) => (
                      <Bullet key={o} color={t.ink} tickColor={t.iconInk}>
                        {o}
                      </Bullet>
                    ))}
                  </Stack>

                  <View style={styles.cardFoot}>
                    <Text style={[ty.body, fontFallback.body, styles.price]}>{service.price}</Text>
                    <PrimaryButton
                      label={c.cardCta}
                      tone="green"
                      size="small"
                      onPress={() => router.push('/booking')}
                    />
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
      </Section>

      {/* ── The one bold moment: tracking, with the curve ───────────────── */}
      <ProofBand>
        <Grid gap={isWide ? space.xl : space.lg} align="center">
          <Col weight={1}>
            <Stack gap={space.sm}>
              <Eyebrow onDark>{c.trackingEyebrow}</Eyebrow>
              <Text style={[ty.h2, fontFallback.display, styles.onDark]}>{c.trackingTitle}</Text>
              <Text style={[ty.bodyLg, fontFallback.body, styles.onDarkMuted]}>
                {c.trackingBody}
              </Text>
              <Text style={[ty.body, fontFallback.body, styles.trackingNote]}>
                {c.trackingNote}
              </Text>
              <View style={styles.trackingCta}>
                <PrimaryButton
                  label={c.trackingCta}
                  onPress={() => router.push('/booking')}
                  block={!isWide}
                />
              </View>
            </Stack>
          </Col>

          <Col weight={1}>
            <View style={[styles.curveCard, { padding: isWide ? 24 : 18 }]}>
              <ProgressCurve data={sampleCurve} height={isWide ? 220 : 180} />
              <Text style={[ty.body, fontFallback.body, styles.caption]}>{c.curveCaption}</Text>
            </View>
          </Col>
        </Grid>
      </ProofBand>
    </>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors.text },
  onDark: { color: colors.onDark },
  onDarkMuted: { color: colors.onDarkMuted },

  intro: { maxWidth: 760 },
  headline: { gap: 2 },
  lead: { color: colors.textMuted, maxWidth: 620 },

  // Catalogue — a wrapping two-up rather than a Grid, because four cards of
  // very different heights in one flex row would stretch the short ones.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  gridCell: {
    // Two per row once the md gap is accounted for.
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
  },
  card: { flex: 1, gap: space.sm },
  outcomesTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    marginTop: space.xs,
  },
  cardFoot: {
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

  // Tracking band
  trackingNote: {
    color: colors.accentSoft,
    fontFamily: fonts.bodySemiBold,
  },
  trackingCta: { marginTop: space.sm, alignItems: 'flex-start', alignSelf: 'stretch' },
  curveCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    gap: space.sm,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
