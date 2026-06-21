// =============================================================================
// (site)/results.tsx — Results / Αποτελέσματα  (route: /results)
//
// 2–3 case studies with tasteful PLACEHOLDER progress data, each a short
// narrative (before → after) + a ProgressCurve outcome arc (the curve is reused
// here per DS-5). Rendered from an in-code array (D-5), clearly structured so
// real case studies replace it with no layout change.
//
// NO fabricated testimonials/quotes presented as real — the cases are clearly
// marked as representative examples. Bilingual via useLang().
// =============================================================================

import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, Section } from '../../components/ui';
import { ProgressCurve } from '../../components/ProgressCurve';
import { colors, fontFallback, space, type, useResponsive } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

type CurvePoint = { occurredAt: string; thresholdMeters: number };

interface CaseStudy {
  dogName: string;
  breed: string;
  summary: string;
  before: string;
  after: string;
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
      summary: 'Έντονη αντίδραση σε άλλους σκύλους στη βόλτα.',
      before: 'Ξεκίνημα: ανοχή μόλις στα 2 μέτρα από άλλον σκύλο.',
      after: 'Μετά από [12] εβδομάδες: ήρεμη βόλτα με προσπεράσματα στα 15 μέτρα.',
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
      summary: 'Άγχος και υπερδιέγερση με θορύβους και οχήματα.',
      before: 'Ξεκίνημα: αντίδραση σε κάθε διερχόμενο όχημα κάτω από 4 μέτρα.',
      after: 'Μετά από [10] εβδομάδες: σταθερή εστίαση στον ιδιοκτήτη στα 12 μέτρα.',
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
      summary: 'Δυσκολία αυτοσυγκράτησης σε ομαδικό περιβάλλον.',
      before: 'Ξεκίνημα: παρακολούθηση εντολών μόνο σε ήσυχο χώρο.',
      after: 'Μετά από [8] εβδομάδες: σταθερή ανταπόκριση μέσα σε ομαδικό μάθημα.',
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
      summary: 'Strong reaction to other dogs on the walk.',
      before: 'Start: tolerance only at 2 metres from another dog.',
      after: 'After [12] weeks: calm walks passing dogs at 15 metres.',
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
      summary: 'Anxiety and over-arousal around noises and vehicles.',
      before: 'Start: reacting to every passing vehicle under 4 metres.',
      after: 'After [10] weeks: steady focus on the owner at 12 metres.',
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
      summary: 'Trouble with self-control in a group setting.',
      before: 'Start: following cues only in a quiet space.',
      after: 'After [8] weeks: steady responses inside a group class.',
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
      desc: 'Ενδεικτικές μελέτες περίπτωσης: πώς εξελίσσεται η συμπεριφορά με δομημένη εκπαίδευση.',
    },
    eyebrow: 'Αποτελέσματα',
    title: 'Η πρόοδος, ορατή σε δεδομένα.',
    intro:
      'Παρακάτω βλέπετε ενδεικτικές μελέτες περίπτωσης με αντιπροσωπευτικά δεδομένα. Δείχνουν τη μορφή της προόδου που παρακολουθούμε σε κάθε σκύλο — η καμπύλη ανεβαίνει καθώς αυξάνεται το όριο ανοχής.',
    disclaimer: 'Τα ονόματα και τα δεδομένα είναι ενδεικτικά παραδείγματα.',
    beforeLabel: 'Πριν',
    afterLabel: 'Μετά',
    axisLabel: 'Όριο ανοχής (μέτρα) ανά συνεδρία',
  },
  en: {
    head: {
      title: 'Results — TailsUp',
      desc: 'Representative case studies: how behaviour develops with structured training.',
    },
    eyebrow: 'Results',
    title: 'Progress, visible in data.',
    intro:
      'Below are representative case studies with illustrative data. They show the shape of the progress we track for every dog — the curve rises as the tolerance threshold grows.',
    disclaimer: 'Names and data are illustrative examples.',
    beforeLabel: 'Before',
    afterLabel: 'After',
    axisLabel: 'Tolerance threshold (metres) per session',
  },
} as const;

export default function ResultsPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const cases = CASES[lang];
  const { isWide } = useResponsive();

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
          <Text style={[styles.disclaimer, fontFallback.body]}>{c.disclaimer}</Text>
        </View>
      </Section>

      {/* ── Case studies ── */}
      <Section alt>
        <View style={styles.cases}>
          {cases.map((cs) => (
            <Card key={cs.dogName} large>
              <View style={[styles.case, isWide ? styles.caseWide : styles.caseNarrow]}>
                <View style={styles.caseText}>
                  <Text style={[styles.dogName, fontFallback.display]}>{cs.dogName}</Text>
                  <Text style={[styles.breed, fontFallback.body]}>{cs.breed}</Text>
                  <Text style={[styles.summary, fontFallback.body]}>{cs.summary}</Text>

                  <View style={styles.beforeAfter}>
                    <View style={styles.baRow}>
                      <Text style={[styles.baLabel, fontFallback.body]}>{c.beforeLabel}</Text>
                      <Text style={[styles.baText, fontFallback.body]}>{cs.before}</Text>
                    </View>
                    <View style={styles.baRow}>
                      <Text style={[styles.baLabel, fontFallback.body]}>{c.afterLabel}</Text>
                      <Text style={[styles.baText, fontFallback.body]}>{cs.after}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.caseCurve}>
                  <ProgressCurve data={cs.curveData} height={200} />
                  <Text style={[styles.axisLabel, fontFallback.body]}>{c.axisLabel}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </Section>
    </>
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
  disclaimer: {
    ...type.caption,
    color: colors.textMuted,
  },

  // Cases
  cases: {
    gap: space.lg,
  },
  case: {
    gap: space.lg,
  },
  caseWide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caseNarrow: {
    flexDirection: 'column',
  },
  caseText: {
    flex: 1,
    gap: space.xs,
  },
  dogName: {
    ...type.h3,
    color: colors.text,
  },
  breed: {
    ...type.caption,
    color: colors.accent,
  },
  summary: {
    ...type.body,
    color: colors.text,
    marginTop: space.xs,
  },
  beforeAfter: {
    gap: space.xs,
    marginTop: space.sm,
  },
  baRow: {
    gap: 2,
  },
  baLabel: {
    ...type.eyebrow,
    color: colors.accent,
  },
  baText: {
    ...type.body,
    color: colors.textMuted,
  },

  // Curve column
  caseCurve: {
    flex: 1,
    gap: space.xs,
  },
  axisLabel: {
    ...type.caption,
    color: colors.textMuted,
  },
});
