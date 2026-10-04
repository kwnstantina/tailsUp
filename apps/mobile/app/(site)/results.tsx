// =============================================================================
// (site)/results.tsx — Results / Αποτελέσματα  (route: /results)
//
// Three REAL case studies supplied by the practice — the same three dogs as the
// home page's crew strip — each a short before→after narrative beside the dog's
// own photograph.
//
// THERE IS NO PROGRESS CURVE ON THIS PAGE. There was, drawn from invented
// per-session threshold readings, and it had to go the moment the names and
// outcomes became real: a true story next to a fabricated chart is worse than
// either alone. The chip carries the one number the practice did measure — how
// long it took. When session data exists for a real dog, the curve earns its
// place back.
//
// Each case keeps its own tint, and the before/after pair stays on labelled
// lines so the change reads at a glance.
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
  PhotoPlaceholder,
  PrimaryButton,
  Section,
  Stack,
  TINTS,
  Wave,
  tintAt,
} from '../../components/ui';
import { colors, fontFallback, fonts, radii, space, useResponsive, useType } from '../../lib/theme';
import { useLang } from '../../lib/i18n';
import { photos, type PhotoSlot } from '../../lib/photos';

interface CaseStudy {
  dogName: string;
  breed: string;
  summary: string;
  before: string;
  after: string;
  /** How long it took, short enough for a chip. */
  duration: string;
  /** The dog's photograph, from `lib/photos.ts`. */
  photo: PhotoSlot;
}

// The practice's own three cases. Ordered as on the home page so a visitor who
// met these dogs in the crew strip meets them again in the same sequence.
const CASES: { el: CaseStudy[]; en: CaseStudy[] } = {
  el: [
    {
      dogName: 'Άτερ',
      breed: 'Ημίαιμο ποιμενικό, 2,5 ετών',
      summary:
        'Δεν έβγαινε βόλτα και δεν δεχόταν ανθρώπους. Δεν ήταν άρνηση — ήταν ένας σκύλος που δεν ένιωθε ασφαλής πουθενά έξω από το σπίτι του.',
      before: 'Δεν έβγαινε βόλτα· απέφευγε κάθε επαφή με αγνώστους.',
      after:
        'Λειτουργικός στη βόλτα, εξοικειωμένος με ανθρώπους, ζώα και τα ερεθίσματα της γειτονιάς του.',
      duration: '1 χρόνος',
      photo: 'crewAter',
    },
    {
      dogName: 'Άλμπα',
      breed: 'Λαμπραντόρ, 5 ετών',
      summary:
        'Το άγχος αποχωρισμού έβγαινε σε ζημιές κάθε φορά που έμενε μόνη. Χτίσαμε την ανοχή της στον χρόνο μοναξιάς σταδιακά, ξεκινώντας από πολύ μικρά διαστήματα.',
      before: 'Δεν άντεχε να μείνει μόνη· ζημιές σε κάθε απουσία.',
      after: 'Μένει σπίτι ήρεμη, χωρίς ζημιές.',
      duration: '5 μήνες',
      photo: 'crewAlba',
    },
    {
      dogName: 'Νέρο',
      breed: 'Λαμπραντόρ, 9 ετών',
      summary:
        'Αντιδρούσε σε κάθε σκύλο που συναντούσε στη βόλτα. Δουλέψαμε πάντα κάτω από το όριο άγχους του, με απόσταση που μίκραινε μόνο όταν ήταν έτοιμος.',
      before: 'Αντιδρούσε σε κάθε σκύλο στη διαδρομή.',
      after: 'Περνάει δίπλα από άλλους σκύλους χωρίς να αντιδρά.',
      duration: '6 μήνες',
      photo: 'crewNero',
    },
  ],
  en: [
    {
      dogName: 'Ater',
      breed: 'Shepherd mix, 2.5 years',
      summary:
        'He would not go out for a walk and would not accept people. It was not refusal — it was a dog who felt safe nowhere outside his own home.',
      before: 'Would not go out for a walk; avoided all contact with strangers.',
      after:
        'Works on the walk, and is at ease with people, other animals and the everyday goings-on of his neighbourhood.',
      duration: '1 year',
      photo: 'crewAter',
    },
    {
      dogName: 'Alba',
      breed: 'Labrador, 5 years',
      summary:
        'Separation anxiety came out as damage every time she was left alone. We built her tolerance for time on her own gradually, starting from very short stretches.',
      before: 'Could not be left alone; damage on every absence.',
      after: 'Stays home calmly, with nothing destroyed.',
      duration: '5 months',
      photo: 'crewAlba',
    },
    {
      dogName: 'Nero',
      breed: 'Labrador, 9 years',
      summary:
        'He reacted to every dog he met on the walk. We worked below his stress threshold throughout, closing the distance only when he was ready for it.',
      before: 'Reacted to every dog on the route.',
      after: 'Passes other dogs without reacting.',
      duration: '6 months',
      photo: 'crewNero',
    },
  ],
};

const copy = {
  el: {
    head: {
      title: 'Αποτελέσματα — TailsUp',
      desc: 'Τρία πραγματικά περιστατικά: τι συνέβαινε, τι άλλαξε και σε πόσο καιρό.',
    },
    eyebrow: 'Αποτελέσματα',
    title: { line1: 'Τι άλλαξε', mark: 'στ’ αλήθεια', line2: '— και σε πόσο καιρό.' },
    lead:
      'Τρεις σκύλοι με τους οποίους δουλέψαμε. Για τον καθένα: από πού ξεκινήσαμε, πού φτάσαμε και πόσο χρειάστηκε.',
    disclaimer:
      'Πραγματικά περιστατικά από τη δουλειά μας. Κάθε σκύλος έχει τον δικό του ρυθμό — οι χρόνοι εδώ είναι αυτοί που χρειάστηκαν, όχι εγγύηση.',
    beforeLabel: 'Πριν',
    afterLabel: 'Μετά',
    ctaTitle: 'Θέλετε την ίδια διαδρομή;',
    ctaBody: 'Ξεκινά από την πρώτη γνωριμία — εκεί καταγράφουμε το σημείο εκκίνησης του δικού σας σκύλου.',
    cta: 'Κλείσε την πρώτη γνωριμία',
  },
  en: {
    head: {
      title: 'Results — TailsUp',
      desc: 'Three real cases: what was happening, what changed, and how long it took.',
    },
    eyebrow: 'Results',
    title: { line1: 'What actually', mark: 'changed', line2: '— and how long it took.' },
    lead:
      'Three dogs we have worked with. For each one: where we started, where we got to, and how long it took.',
    disclaimer:
      'Real cases from our own work. Every dog moves at their own pace — the timings here are what those dogs needed, not a guarantee.',
    beforeLabel: 'Before',
    afterLabel: 'After',
    ctaTitle: 'Want the same arc?',
    ctaBody: 'It starts at the first hello — that is where we write down your dog’s starting point.',
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
                        <View style={styles.durationChip}>
                          <Text style={[ty.body, fontFallback.body, styles.durationText]}>
                            {cs.duration}
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
                    <PhotoPlaceholder
                      label={`${cs.dogName} — ${cs.breed}`}
                      height={isWide ? 280 : 220}
                      tint={tint}
                      source={photos[cs.photo]}
                    />
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
  durationChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 13,
  },
  durationText: {
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

  ctaEnd: { alignItems: 'flex-end' },
});
