// =============================================================================
// (site)/results.tsx — Results / Αποτελέσματα  (route: /results)
//
// Representative case studies, each a short before→after narrative next to its
// outcome curve. Rendered from an in-code array, clearly structured so real
// case studies replace it with no layout change.
//
// NO fabricated testimonials presented as real: names are bracketed, the data
// is labelled illustrative, and the disclaimer sits in the intro rather than in
// small print at the bottom. That honesty IS the page's pitch.
//
// The playful direction gives each case its own tint and puts the before/after
// pair on chips, so the jump reads at a glance instead of needing to be read.
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
  PrimaryButton,
  Section,
  Stack,
  TINTS,
  Wave,
  tintAt,
} from '../../components/ui';
import { ProgressCurve } from '../../components/ProgressCurve';
import { colors, fontFallback, fonts, radii, space, useResponsive, useType } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

type CurvePoint = { occurredAt: string; thresholdMeters: number };

interface CaseStudy {
  dogName: string;
  breed: string;
  summary: string;
  before: string;
  after: string;
  /** The headline jump, short enough for a chip. */
  jump: string;
  curveData: CurvePoint[];
}

// Representative outcome arcs (placeholder data). thresholdMeters rises = the dog
// stays calm closer to its trigger over the weeks. Same shape as the live data a
// real case study would carry, so swapping in real numbers needs no layout change.
const CASES: { el: CaseStudy[]; en: CaseStudy[] } = {
  el: [
    {
      dogName: '[Λούνα]',
      breed: '[Border Collie, 2 ετών]',
      summary:
        'Κάθε σκύλος στη βόλτα ήταν κρίση. Η Λούνα δεν ήταν «κακή» — ήταν πάνω από το όριό της πριν καν βγει από την πόρτα.',
      before: 'Άντεχε άλλον σκύλο μόνο στα 2 μέτρα.',
      after: 'Μετά από [12] εβδομάδες: ήρεμα προσπεράσματα στα 15 μέτρα.',
      jump: '2 μ → 15 μ',
      curveData: [
        { occurredAt: '2026-01-10', thresholdMeters: 2 },
        { occurredAt: '2026-01-31', thresholdMeters: 3 },
        { occurredAt: '2026-02-21', thresholdMeters: 6 },
        { occurredAt: '2026-03-14', thresholdMeters: 10 },
        { occurredAt: '2026-04-04', thresholdMeters: 15 },
      ],
    },
    {
      dogName: '[Ρόκι]',
      breed: '[Ημίαιμος, 4 ετών]',
      summary:
        'Κάθε μηχανάκι τον έστελνε στο τέλος του λουριού. Ξεκινήσαμε σε έναν ήσυχο δρόμο και δουλέψαμε προς τα έξω.',
      before: 'Αντιδρούσε σε κάθε όχημα κάτω από 4 μέτρα.',
      after: 'Μετά από [10] εβδομάδες: σταθερή εστίαση στον ιδιοκτήτη στα 12 μέτρα.',
      jump: '4 μ → 12 μ',
      curveData: [
        { occurredAt: '2026-02-02', thresholdMeters: 4 },
        { occurredAt: '2026-02-23', thresholdMeters: 5 },
        { occurredAt: '2026-03-16', thresholdMeters: 8 },
        { occurredAt: '2026-04-06', thresholdMeters: 12 },
      ],
    },
    {
      dogName: '[Μπέλα]',
      breed: '[Λαμπραντόρ, 1 έτους]',
      summary:
        'Τέλεια στο σαλόνι, χαμένη στην ομάδα. Το ζητούμενο δεν ήταν η εντολή — ήταν η εντολή με παρέα γύρω.',
      before: 'Ανταποκρινόταν μόνο σε ήσυχο χώρο.',
      after: 'Μετά από [8] εβδομάδες: σταθερή ανταπόκριση μέσα στο ομαδικό μάθημα.',
      jump: '3 μ → 10 μ',
      curveData: [
        { occurredAt: '2026-03-01', thresholdMeters: 3 },
        { occurredAt: '2026-03-15', thresholdMeters: 5 },
        { occurredAt: '2026-03-29', thresholdMeters: 7 },
        { occurredAt: '2026-04-12', thresholdMeters: 10 },
      ],
    },
  ],
  en: [
    {
      dogName: '[Luna]',
      breed: '[Border Collie, 2 yrs]',
      summary:
        'Every dog on the walk was a crisis. Luna was not "bad" — she was over her threshold before she got out of the door.',
      before: 'Could tolerate another dog only at 2 metres.',
      after: 'After [12] weeks: calm passes at 15 metres.',
      jump: '2 m → 15 m',
      curveData: [
        { occurredAt: '2026-01-10', thresholdMeters: 2 },
        { occurredAt: '2026-01-31', thresholdMeters: 3 },
        { occurredAt: '2026-02-21', thresholdMeters: 6 },
        { occurredAt: '2026-03-14', thresholdMeters: 10 },
        { occurredAt: '2026-04-04', thresholdMeters: 15 },
      ],
    },
    {
      dogName: '[Rocky]',
      breed: '[Mixed breed, 4 yrs]',
      summary:
        'Every scooter sent him to the end of the lead. We started on a quiet street and worked outwards.',
      before: 'Reacted to every vehicle under 4 metres.',
      after: 'After [10] weeks: steady focus on his owner at 12 metres.',
      jump: '4 m → 12 m',
      curveData: [
        { occurredAt: '2026-02-02', thresholdMeters: 4 },
        { occurredAt: '2026-02-23', thresholdMeters: 5 },
        { occurredAt: '2026-03-16', thresholdMeters: 8 },
        { occurredAt: '2026-04-06', thresholdMeters: 12 },
      ],
    },
    {
      dogName: '[Bella]',
      breed: '[Labrador, 1 yr]',
      summary:
        'Perfect in the living room, lost in a group. The job was never the cue — it was the cue with company around.',
      before: 'Responded only in a quiet space.',
      after: 'After [8] weeks: steady responses inside the group class.',
      jump: '3 m → 10 m',
      curveData: [
        { occurredAt: '2026-03-01', thresholdMeters: 3 },
        { occurredAt: '2026-03-15', thresholdMeters: 5 },
        { occurredAt: '2026-03-29', thresholdMeters: 7 },
        { occurredAt: '2026-04-12', thresholdMeters: 10 },
      ],
    },
  ],
};

const copy = {
  el: {
    head: {
      title: 'Αποτελέσματα — TailsUp',
      desc: 'Ενδεικτικές περιπτώσεις: πώς μοιάζει η πρόοδος όταν την καταγράφεις εβδομάδα με εβδομάδα.',
    },
    eyebrow: 'Αποτελέσματα',
    title: { line1: 'Η πρόοδος, όταν', mark: 'τη μετράς', line2: 'στ’ αλήθεια.' },
    lead:
      'Να πώς μοιάζουν οι πρώτοι τρεις μήνες. Η καμπύλη δείχνει πόσο κοντά μπορούσε να έρθει το ερέθισμα πριν ο σκύλος χάσει την ψυχραιμία του — όσο ανεβαίνει, τόσο πιο εύκολη γίνεται η βόλτα.',
    disclaimer:
      'Τα ονόματα και τα δεδομένα είναι ενδεικτικά παραδείγματα, όχι πραγματικοί πελάτες. Η μορφή τους είναι ακριβώς αυτή που θα δείτε για τον δικό σας σκύλο.',
    beforeLabel: 'Πριν',
    afterLabel: 'Μετά',
    axisLabel: 'Όριο ανοχής (μέτρα) ανά συνεδρία',
    ctaTitle: 'Θέλετε τη δική σας καμπύλη;',
    ctaBody: 'Ξεκινά από την πρώτη γνωριμία — και από το πρώτο νούμερο που σημειώνουμε.',
    cta: 'Κλείσε την πρώτη γνωριμία',
  },
  en: {
    head: {
      title: 'Results — TailsUp',
      desc: 'Representative cases: what progress looks like when you record it week by week.',
    },
    eyebrow: 'Results',
    title: { line1: 'Progress, when you', mark: 'actually', line2: 'measure it.' },
    lead:
      'Here is what the first three months look like. The curve shows how close the trigger could get before the dog lost their composure — the higher it climbs, the easier the walk gets.',
    disclaimer:
      'Names and data are illustrative examples, not real clients. The shape is exactly what you will see for your own dog.',
    beforeLabel: 'Before',
    afterLabel: 'After',
    axisLabel: 'Tolerance threshold (metres) per session',
    ctaTitle: 'Want a curve of your own?',
    ctaBody: 'It starts at the first hello — and at the first number we write down.',
    cta: 'Book a first hello',
  },
} as const;

export default function ResultsPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const cases = CASES[lang];
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
          <Text style={[ty.body, fontFallback.body, styles.disclaimer]}>{c.disclaimer}</Text>
        </Stack>
      </Section>

      <Wave color={colors.bgAlt} height={isWide ? 64 : 36} />

      {/* ── The case studies ────────────────────────────────────────────── */}
      <Section alt spacing="tight">
        <Stack gap={space.lg}>
          {cases.map((cs, i) => {
            const tint = tintAt(i);
            const t = TINTS[tint];
            return (
              <Card key={cs.dogName} tint={tint} large>
                <Grid gap={isWide ? space.xl : space.lg} align="center">
                  <Col weight={1}>
                    <Stack gap={space.xs}>
                      <View style={styles.nameRow}>
                        <Text style={[ty.h3, fontFallback.display, styles.ink]}>{cs.dogName}</Text>
                        <View style={styles.jumpChip}>
                          <Text style={[ty.body, fontFallback.body, styles.jumpText]}>
                            {cs.jump}
                          </Text>
                        </View>
                      </View>
                      <Text style={[ty.body, fontFallback.body, { color: t.ink }]}>{cs.breed}</Text>
                      <Text style={[ty.bodyLg, fontFallback.body, styles.summary]}>
                        {cs.summary}
                      </Text>

                      <Stack gap={space.xs} style={styles.beforeAfter}>
                        <BeforeAfter label={c.beforeLabel} value={cs.before} ink={t.ink} ty={ty} />
                        <BeforeAfter label={c.afterLabel} value={cs.after} ink={t.ink} ty={ty} />
                      </Stack>
                    </Stack>
                  </Col>

                  <Col weight={1}>
                    <Stack gap={space.xs}>
                      <ProgressCurve data={cs.curveData} height={isWide ? 200 : 170} />
                      <Text style={[ty.body, fontFallback.body, { color: t.ink }, styles.axis]}>
                        {c.axisLabel}
                      </Text>
                    </Stack>
                  </Col>
                </Grid>
              </Card>
            );
          })}
        </Stack>
      </Section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <Section spacing="normal">
        <Grid gap={space.lg} align="center">
          <Col weight={1}>
            <Stack gap={space.xs}>
              <Text style={[ty.h2, fontFallback.display, styles.ink]}>{c.ctaTitle}</Text>
              <Text style={[ty.bodyLg, fontFallback.body, styles.lead]}>{c.ctaBody}</Text>
            </Stack>
          </Col>
          <Col weight={1}>
            <View style={isWide ? styles.ctaEnd : undefined}>
              <PrimaryButton label={c.cta} onPress={() => router.push('/booking')} block={!isWide} />
            </View>
          </Col>
        </Grid>
      </Section>
    </>
  );
}

// ── A labelled before/after line ─────────────────────────────────────────────
function BeforeAfter({
  label,
  value,
  ink,
  ty,
}: {
  label: string;
  value: string;
  ink: string;
  ty: ReturnType<typeof useType>;
}) {
  return (
    <View style={styles.baRow}>
      <Text style={[ty.body, fontFallback.body, styles.baLabel]}>{label}</Text>
      <Text style={[ty.body, fontFallback.body, { color: ink }, styles.baValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors.text },

  intro: { maxWidth: 760 },
  headline: { gap: 2 },
  lead: { color: colors.textMuted, maxWidth: 620 },
  disclaimer: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    maxWidth: 620,
  },

  // Case card
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  jumpChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 13,
  },
  jumpText: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  summary: {
    color: colors.text,
    marginTop: space.xs,
  },
  beforeAfter: { marginTop: space.sm },
  baRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  baLabel: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12.5,
    minWidth: 54,
  },
  baValue: { flex: 1, minWidth: 180 },
  axis: { fontSize: 13, lineHeight: 19 },

  ctaEnd: { alignItems: 'flex-end' },
});
