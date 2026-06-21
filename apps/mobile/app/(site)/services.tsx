// =============================================================================
// (site)/services.tsx — Services / Υπηρεσίες  (route: /services)
//
// The service catalogue as peer Cards mapped to BOOKING_TYPES — Αξιολόγηση
// (assessment), Ιδιαίτερα (private), Ομαδικά (group) — plus a board-and-train
// offering. The DATA-DRIVEN PROGRESS TRACKING appears HERE as ONE premium
// service, featured with the ProgressCurve (representative threshold-over-time
// data) inside a dark ProofBand — the page's single bold moment (DS-4/DS-6).
//
// This is the ONLY page that renders the ProgressCurve (DS-5).
// Per-service CTAs route to /booking. Bilingual via useLang().
// =============================================================================

import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, PrimaryButton, ProofBand, Section, SecondaryButton } from '../../components/ui';
import { ProgressCurve } from '../../components/ProgressCurve';
import { colors, fontFallback, space, type, useResponsive } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

// Representative threshold-over-time data for the tracking-service curve. Higher
// thresholdMeters = the dog stays calm closer to a trigger = better outcome, so
// the line rises over the weeks. Clearly illustrative sample data (not a claim).
const SAMPLE_CURVE: { occurredAt: string; thresholdMeters: number }[] = [
  { occurredAt: '2026-01-06', thresholdMeters: 3 },
  { occurredAt: '2026-01-20', thresholdMeters: 4 },
  { occurredAt: '2026-02-03', thresholdMeters: 4 },
  { occurredAt: '2026-02-17', thresholdMeters: 6 },
  { occurredAt: '2026-03-03', thresholdMeters: 7 },
  { occurredAt: '2026-03-17', thresholdMeters: 9 },
  { occurredAt: '2026-03-31', thresholdMeters: 11 },
  { occurredAt: '2026-04-14', thresholdMeters: 14 },
];

const copy = {
  el: {
    head: {
      title: 'Υπηρεσίες — TailsUp',
      desc: 'Αξιολόγηση, ατομικά και ομαδικά μαθήματα, εντατικό πρόγραμμα και δομημένη παρακολούθηση προόδου.',
    },
    eyebrow: 'Υπηρεσίες',
    title: 'Προγράμματα για κάθε σκύλο — και κάθε στόχο.',
    intro:
      'Κάθε πρόγραμμα ξεκινά από μια ολοκληρωμένη αξιολόγηση και εξελίσσεται με σαφή δομή. Διαλέξτε το σημείο εκκίνησης που σας ταιριάζει.',
    services: [
      {
        name: 'Αξιολόγηση',
        body: 'Μια πρώτη, σε βάθος συνεδρία: γνωριμία, καταγραφή συμπεριφοράς και ένα ξεκάθαρο πλάνο επόμενων βημάτων.',
        cta: 'Κλείσε αξιολόγηση',
      },
      {
        name: 'Ιδιαίτερα μαθήματα',
        body: 'Εξατομικευμένη δουλειά ένας-προς-έναν, με ρυθμό προσαρμοσμένο στον σκύλο σας και στους στόχους σας.',
        cta: 'Κλείσε ραντεβού',
      },
      {
        name: 'Ομαδικά μαθήματα',
        body: 'Δομημένη εξάσκηση σε μικρές ομάδες, για κοινωνικοποίηση και αυτοσυγκράτηση σε ελεγχόμενο περιβάλλον.',
        cta: 'Κλείσε ραντεβού',
      },
      {
        name: 'Εντατικό πρόγραμμα',
        body: 'Πιο πυκνές συνεδρίες για σύνθετες συμπεριφορές, με στενή καθοδήγηση και συχνή επανεκτίμηση.',
        cta: 'Μάθε περισσότερα',
      },
    ],
    trackingEyebrow: 'Premium υπηρεσία',
    trackingTitle: 'Δομημένη παρακολούθηση προόδου',
    trackingBody:
      'Σε κάθε συνεδρία καταγράφουμε τη συμπεριφορά ως δεδομένα: απόσταση από το ερέθισμα, ένταση, έκβαση και παρέμβαση. Έτσι η πρόοδος γίνεται ορατή — μια καμπύλη που ανεβαίνει με τις εβδομάδες, όχι μια εντύπωση.',
    curveCaption: 'Ενδεικτικά δεδομένα: το όριο ανοχής (μέτρα) αυξάνεται με τον χρόνο.',
    trackingCta: 'Κλείσε αξιολόγηση',
  },
  en: {
    head: {
      title: 'Services — TailsUp',
      desc: 'Assessment, private and group lessons, an intensive programme, and structured progress tracking.',
    },
    eyebrow: 'Services',
    title: 'Programmes for every dog — and every goal.',
    intro:
      'Every programme starts from a thorough assessment and develops with clear structure. Choose the starting point that fits you.',
    services: [
      {
        name: 'Assessment',
        body: 'A first, in-depth session: getting to know you, recording behaviour, and a clear plan of next steps.',
        cta: 'Book an assessment',
      },
      {
        name: 'Private lessons',
        body: 'Personalised one-to-one work, at a pace tuned to your dog and your goals.',
        cta: 'Book a session',
      },
      {
        name: 'Group lessons',
        body: 'Structured practice in small groups, for socialisation and self-control in a controlled setting.',
        cta: 'Book a session',
      },
      {
        name: 'Intensive programme',
        body: 'Denser sessions for complex behaviours, with close guidance and frequent reassessment.',
        cta: 'Learn more',
      },
    ],
    trackingEyebrow: 'Premium service',
    trackingTitle: 'Structured progress tracking',
    trackingBody:
      'At every session we record behaviour as data: distance from the trigger, intensity, outcome and intervention. That makes progress visible — a line that rises over the weeks, not an impression.',
    curveCaption: 'Illustrative data: the tolerance threshold (metres) increases over time.',
    trackingCta: 'Book an assessment',
  },
} as const;

export default function ServicesPage() {
  const { lang } = useLang();
  const c = copy[lang];
  const router = useRouter();
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
        </View>
      </Section>

      {/* ── Service catalogue — peer cards (BOOKING_TYPES + board-and-train) ── */}
      <Section alt>
        <View style={[styles.grid, isWide ? styles.gridWide : styles.gridNarrow]}>
          {c.services.map((s) => (
            <Card key={s.name} large style={isWide ? styles.gridCell : undefined}>
              <View style={styles.serviceCard}>
                <Text style={[styles.serviceName, fontFallback.display]}>{s.name}</Text>
                <Text style={[styles.serviceBody, fontFallback.body]}>{s.body}</Text>
                <View style={styles.serviceCta}>
                  <SecondaryButton label={s.cta} onPress={() => router.push('/booking')} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      </Section>

      {/* ── The ONE bold moment: the data-driven premium service + the curve ── */}
      <ProofBand>
        <View style={[styles.tracking, isWide ? styles.trackingWide : styles.trackingNarrow]}>
          <View style={styles.trackingText}>
            <Eyebrow onDark>{c.trackingEyebrow}</Eyebrow>
            <Text style={[styles.trackingTitle, fontFallback.display]}>{c.trackingTitle}</Text>
            <Text style={[styles.trackingBody, fontFallback.body]}>{c.trackingBody}</Text>
            <View style={styles.trackingCta}>
              <PrimaryButton label={c.trackingCta} onPress={() => router.push('/booking')} />
            </View>
          </View>
          <View style={styles.trackingCurve}>
            <ProgressCurve data={SAMPLE_CURVE} height={240} />
            <Text style={[styles.curveCaption, fontFallback.body]}>{c.curveCaption}</Text>
          </View>
        </View>
      </ProofBand>
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
    maxWidth: 640,
  },

  // Catalogue grid — two columns at wide widths, stacked when narrow.
  grid: {
    gap: space.md,
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridNarrow: {
    flexDirection: 'column',
  },
  gridCell: {
    // Two per row with the md gap accounted for.
    flexBasis: '48%',
    flexGrow: 1,
  },
  serviceCard: {
    gap: space.sm,
    height: '100%',
  },
  serviceName: {
    ...type.h3,
    color: colors.text,
  },
  serviceBody: {
    ...type.body,
    color: colors.textMuted,
  },
  serviceCta: {
    marginTop: space.xs,
    alignItems: 'flex-start',
  },

  // Tracking ProofBand
  tracking: {
    gap: space.xl,
  },
  trackingWide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackingNarrow: {
    flexDirection: 'column',
  },
  trackingText: {
    flex: 1,
    gap: space.sm,
  },
  trackingTitle: {
    ...type.h2,
    color: colors.bg,
  },
  trackingBody: {
    ...type.bodyLg,
    color: colors.bg,
    opacity: 0.92,
  },
  trackingCta: {
    marginTop: space.sm,
    alignItems: 'flex-start',
  },
  trackingCurve: {
    flex: 1,
    gap: space.sm,
  },
  curveCaption: {
    ...type.caption,
    color: colors.accentSoft,
  },
});
