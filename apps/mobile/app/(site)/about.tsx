// =============================================================================
// (site)/about.tsx — About / Ποιοι είμαστε  (route: /about)
//
// Builds trust / justifies premium pricing: the trainer's story, the training
// philosophy, credentials, and a clearly-marked placeholder photo. Long copy
// runs at reading width (maxProse 720). "Proof, not promises" tone — calm, no
// hype. Optional single ProofBand. Bilingual via useLang().
//
// Placeholder trainer name + bio + photo (per the user decision) — clearly
// marked so a real name/photo replace them with no layout change.
// =============================================================================

import Head from 'expo-router/head';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, ProofBand, Section } from '../../components/ui';
import { colors, fontFallback, radii, space, type } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

const copy = {
  el: {
    head: {
      title: 'Ποιοι Είμαστε — TailsUp',
      desc: 'Η ιστορία, η φιλοσοφία και τα προσόντα της πρακτικής μας στην εκπαίδευση σκύλων.',
    },
    eyebrow: 'Ποιοι είμαστε',
    title: 'Μια πρακτική χτισμένη στην εμπιστοσύνη.',
    intro:
      'Η TailsUp ξεκίνησε από μια απλή πεποίθηση: η εκπαίδευση πετυχαίνει όταν είναι ήρεμη, συνεπής και βασισμένη σε όσα πραγματικά συμβαίνουν — όχι σε υποσχέσεις.',
    methodEyebrow: 'Η μέθοδός μας',
    methodTitle: 'Γιατί δουλεύουμε δομημένα και μακροπρόθεσμα.',
    methodBody:
      'Η συμπεριφορά ενός σκύλου δεν αλλάζει σε μία συνεδρία· χτίζεται σταδιακά, κάτω από το όριο του άγχους του. Γι’ αυτό κάθε πρόγραμμα έχει σαφή δομή, μετρήσιμους στόχους και τακτική επανεκτίμηση. Καταγράφουμε κάθε συνεδρία ώστε οι αποφάσεις μας να βασίζονται σε δεδομένα — και η πρόοδος να είναι ορατή σε εσάς.',
    methodBody2:
      'Δεν χρησιμοποιούμε εκφοβισμό ή πίεση. Δουλεύουμε με θετική ενίσχυση, υπομονή και σεβασμό στον ρυθμό κάθε σκύλου, ώστε η αλλαγή να κρατά πέρα από την αίθουσα εκπαίδευσης.',
    trainerEyebrow: 'Ο εκπαιδευτής',
    photoCaption: '[φωτογραφία εκπαιδευτή]',
    trainerName: '[Όνομα Εκπαιδευτή]',
    trainerRole: 'Ιδρυτής & επικεφαλής εκπαιδευτής',
    trainerBio:
      '[Σύντομο βιογραφικό]: πάνω από [Χ] χρόνια εμπειρίας στην εκπαίδευση και την τροποποίηση συμπεριφοράς σκύλων, με εξειδίκευση στις αντιδραστικές συμπεριφορές και στη συνεργασία ιδιοκτήτη–σκύλου.',
    credsTitle: 'Προσόντα & πιστοποιήσεις',
    creds: [
      '[Πιστοποίηση εκπαίδευσης συμπεριφοράς]',
      '[Μέλος επαγγελματικού συλλόγου]',
      '[Συνεχιζόμενη εκπαίδευση / σεμινάρια]',
    ],
    proofTitle: 'Η φιλοσοφία μας σε μία πρόταση.',
    proofBody: 'Απόδειξη, όχι υποσχέσεις — και ηρεμία σε κάθε βήμα.',
  },
  en: {
    head: {
      title: 'About — TailsUp',
      desc: 'The story, philosophy and credentials behind our dog-training practice.',
    },
    eyebrow: 'About us',
    title: 'A practice built on trust.',
    intro:
      'TailsUp began from a simple conviction: training works when it is calm, consistent, and grounded in what is actually happening — not in promises.',
    methodEyebrow: 'Our method',
    methodTitle: 'Why we work in a structured, long-term way.',
    methodBody:
      'A dog’s behaviour doesn’t change in a single session; it is built gradually, below the threshold of its stress. That is why every programme has clear structure, measurable goals and regular reassessment. We record each session so our decisions rest on data — and so progress is visible to you.',
    methodBody2:
      'We don’t use intimidation or pressure. We work with positive reinforcement, patience and respect for each dog’s pace, so change holds well beyond the training room.',
    trainerEyebrow: 'The trainer',
    photoCaption: '[trainer photo]',
    trainerName: '[Trainer Name]',
    trainerRole: 'Founder & lead trainer',
    trainerBio:
      '[Short bio]: over [X] years of experience in dog training and behaviour modification, specialising in reactivity and owner–dog teamwork.',
    credsTitle: 'Credentials & certifications',
    creds: [
      '[Behaviour-training certification]',
      '[Professional association membership]',
      '[Continuing education / seminars]',
    ],
    proofTitle: 'Our philosophy in one line.',
    proofBody: 'Proof, not promises — and calm at every step.',
  },
} as const;

export default function AboutPage() {
  const { lang } = useLang();
  const c = copy[lang];

  return (
    <>
      <Head>
        <title>{c.head.title}</title>
        <meta name="description" content={c.head.desc} />
        <meta property="og:title" content={c.head.title} />
        <meta property="og:description" content={c.head.desc} />
      </Head>

      {/* ── Intro (reading width) ── */}
      <Section prose>
        <View style={styles.block}>
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <Text style={[styles.h1, fontFallback.display]}>{c.title}</Text>
          <Text style={[styles.lead, fontFallback.body]}>{c.intro}</Text>
        </View>
      </Section>

      {/* ── Method / philosophy prose ── */}
      <Section alt prose>
        <View style={styles.block}>
          <Eyebrow>{c.methodEyebrow}</Eyebrow>
          <Text style={[styles.h2, fontFallback.display]}>{c.methodTitle}</Text>
          <Text style={[styles.body, fontFallback.body]}>{c.methodBody}</Text>
          <Text style={[styles.body, fontFallback.body]}>{c.methodBody2}</Text>
        </View>
      </Section>

      {/* ── Trainer + credentials ── */}
      <Section prose>
        <Eyebrow>{c.trainerEyebrow}</Eyebrow>
        <View style={styles.trainerCardWrap}>
          <Card large>
            <View style={styles.trainer}>
              {/* Clearly-marked placeholder photo (styled box, no fake image). */}
              <View style={styles.photo} accessibilityRole="image" accessibilityLabel={c.photoCaption}>
                <Text style={[styles.photoLabel, fontFallback.body]}>{c.photoCaption}</Text>
              </View>
              <View style={styles.trainerText}>
                <Text style={[styles.trainerName, fontFallback.display]}>{c.trainerName}</Text>
                <Text style={[styles.trainerRole, fontFallback.body]}>{c.trainerRole}</Text>
                <Text style={[styles.body, fontFallback.body]}>{c.trainerBio}</Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.credsWrap}>
          <Text style={[styles.credsTitle, fontFallback.display]}>{c.credsTitle}</Text>
          {c.creds.map((cr) => (
            <View key={cr} style={styles.credRow}>
              <View style={styles.credDot} />
              <Text style={[styles.credText, fontFallback.body]}>{cr}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* ── The ONE bold moment ── */}
      <ProofBand prose>
        <View style={styles.proofWrap}>
          <Text style={[styles.proofTitle, fontFallback.display]}>{c.proofTitle}</Text>
          <Text style={[styles.proofBody, fontFallback.body]}>{c.proofBody}</Text>
        </View>
      </ProofBand>
    </>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space.md,
  },
  h1: {
    ...type.h1,
    color: colors.text,
  },
  h2: {
    ...type.h2,
    color: colors.text,
  },
  lead: {
    ...type.bodyLg,
    color: colors.textMuted,
  },
  body: {
    ...type.bodyLg,
    color: colors.text,
  },

  // Trainer card
  trainerCardWrap: {
    marginTop: space.md,
    marginBottom: space.lg,
  },
  trainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
    alignItems: 'flex-start',
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: radii.lg,
    backgroundColor: colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.xs,
  },
  trainerText: {
    flex: 1,
    minWidth: 240,
    gap: space.xs,
  },
  trainerName: {
    ...type.h3,
    color: colors.text,
  },
  trainerRole: {
    ...type.body,
    color: colors.accent,
    marginBottom: space.xs,
  },

  // Credentials
  credsWrap: {
    gap: space.sm,
  },
  credsTitle: {
    ...type.h3,
    color: colors.text,
    marginBottom: space.xs,
  },
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  credDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  credText: {
    ...type.body,
    color: colors.text,
  },

  // ProofBand
  proofWrap: {
    gap: space.sm,
  },
  proofTitle: {
    ...type.h2,
    color: colors.bg,
  },
  proofBody: {
    ...type.bodyLg,
    color: colors.accentSoft,
  },
});
