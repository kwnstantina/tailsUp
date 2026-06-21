// =============================================================================
// (site)/index.tsx — Home / Αρχική  (route: /)
//
// Business-first (DS-7 / AC-3a-2): this page is about the PRACTICE — a calm,
// expert, trustworthy dog-training practice — NOT "an app" or "a data platform".
// The data-tracking platform appears only as a one-line teaser linking into
// /services. NO ProgressCurve on Home (DS-5; the curve is Services-only).
//
// One bold moment only: a single dark ProofBand with a method statement
// (DS-4 / DS-6 "spend boldness in one place"). Everything else is restrained.
// Bilingual via useLang(); responsive column→row via useResponsive().
// =============================================================================

import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, PrimaryButton, ProofBand, Section, SecondaryButton } from '../../components/ui';
import { colors, fontFallback, space, type, useResponsive } from '../../lib/theme';
import { useLang } from '../../lib/i18n';

const copy = {
  el: {
    head: {
      title: 'TailsUp — Επαγγελματική Εκπαίδευση Σκύλων',
      desc: 'Ήρεμη, επαγγελματική εκπαίδευση σκύλων με δομημένη μέθοδο και μετρήσιμη πρόοδο. Κλείστε αξιολόγηση.',
    },
    eyebrow: 'Εκπαίδευση σκύλων',
    title: 'Ήρεμη, μεθοδική εκπαίδευση που αλλάζει τη ζωή σας με τον σκύλο σας.',
    sub: 'Συνεργαζόμαστε με εσάς και τον σκύλο σας με υπομονή, σαφή δομή και σεβασμό — για συμπεριφορά που κρατά, όχι κόλπα μιας στιγμής.',
    ctaPrimary: 'Κλείσε αξιολόγηση',
    ctaSecondary: 'Δείτε τις υπηρεσίες',
    introEyebrow: 'Η προσέγγισή μας',
    introTitle: 'Μια πρακτική χτισμένη στην ηρεμία, την ακρίβεια και την απόδειξη.',
    values: [
      {
        title: 'Ήρεμη μέθοδος',
        body: 'Δουλεύουμε κάτω από το όριο του σκύλου, με θετική ενίσχυση και χωρίς πίεση — έτσι η μάθηση κρατά.',
      },
      {
        title: 'Δομημένο πλάνο',
        body: 'Κάθε σκύλος ακολουθεί ένα ξεκάθαρο πρόγραμμα με στόχους, ασκήσεις και επανεκτίμηση σε κάθε συνεδρία.',
      },
      {
        title: 'Απόδειξη, όχι υποσχέσεις',
        body: 'Καταγράφουμε την πρόοδο συστηματικά, ώστε να βλέπετε τι αλλάζει — και γιατί.',
      },
    ],
    proofEyebrow: 'Η μέθοδός μας',
    proofTitle: 'Κάθε αλλαγή συμπεριφοράς, καταγεγραμμένη και μετρήσιμη.',
    proofBody:
      'Δεν στηριζόμαστε στη μνήμη ή στην εντύπωση. Κάθε συνεδρία τεκμηριώνεται, ώστε η πρόοδος του σκύλου σας να είναι ορατή με δεδομένα — όχι ευχολόγια.',
    teaserEyebrow: 'Υπηρεσίες',
    teaserTitle: 'Από την πρώτη αξιολόγηση μέχρι τη μετρήσιμη πρόοδο.',
    teaserBody:
      'Ατομικά μαθήματα, ομαδικά προγράμματα και δομημένη παρακολούθηση συμπεριφοράς — μία premium υπηρεσία που κάνει την πρόοδο ορατή.',
    teaserLink: 'Δείτε όλες τις υπηρεσίες',
  },
  en: {
    head: {
      title: 'TailsUp — Professional Dog Training',
      desc: 'Calm, professional dog training built on a structured method and measurable progress. Book an assessment.',
    },
    eyebrow: 'Dog training',
    title: 'Calm, methodical training that changes life with your dog.',
    sub: 'We work with you and your dog through patience, clear structure and respect — for behaviour that lasts, not one-off tricks.',
    ctaPrimary: 'Book an assessment',
    ctaSecondary: 'See our services',
    introEyebrow: 'Our approach',
    introTitle: 'A practice built on calm, precision and proof.',
    values: [
      {
        title: 'Calm method',
        body: 'We work below your dog’s threshold with positive reinforcement and no pressure — so the learning holds.',
      },
      {
        title: 'A structured plan',
        body: 'Every dog follows a clear programme with goals, exercises and a reassessment at each session.',
      },
      {
        title: 'Proof, not promises',
        body: 'We record progress systematically, so you can see what is changing — and why.',
      },
    ],
    proofEyebrow: 'Our method',
    proofTitle: 'Every behaviour change, recorded and measurable.',
    proofBody:
      'We don’t rely on memory or impressions. Each session is documented, so your dog’s progress is visible in data — not wishful thinking.',
    teaserEyebrow: 'Services',
    teaserTitle: 'From the first assessment to measurable progress.',
    teaserBody:
      'Private lessons, group programmes and structured behaviour tracking — one premium service that makes progress visible.',
    teaserLink: 'See all services',
  },
} as const;

export default function HomePage() {
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

      {/* ── Hero — the practice in one line + the primary CTA ── */}
      <Section>
        <View style={styles.hero}>
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <Text style={[styles.h1, fontFallback.display]}>{c.title}</Text>
          <Text style={[styles.sub, fontFallback.body]}>{c.sub}</Text>
          <View style={[styles.ctaRow, isWide ? styles.ctaRowWide : styles.ctaRowNarrow]}>
            <PrimaryButton label={c.ctaPrimary} onPress={() => router.push('/booking')} />
            <SecondaryButton label={c.ctaSecondary} onPress={() => router.push('/services')} />
          </View>
        </View>
      </Section>

      {/* ── Intro + value/method strip (3 calm cards, no hype) ── */}
      <Section alt>
        <Eyebrow>{c.introEyebrow}</Eyebrow>
        <Text style={[styles.h2, fontFallback.display]}>{c.introTitle}</Text>
        <View style={[styles.cardGrid, isWide ? styles.cardGridWide : styles.cardGridNarrow]}>
          {c.values.map((v) => (
            <Card key={v.title} style={isWide ? styles.cardWide : undefined}>
              <Text style={[styles.cardTitle, fontFallback.display]}>{v.title}</Text>
              <Text style={[styles.cardBody, fontFallback.body]}>{v.body}</Text>
            </Card>
          ))}
        </View>
      </Section>

      {/* ── The ONE bold moment: a dark ProofBand with the method statement ── */}
      <ProofBand>
        <View style={styles.proofWrap}>
          <Eyebrow onDark>{c.proofEyebrow}</Eyebrow>
          <Text style={[styles.proofTitle, fontFallback.display]}>{c.proofTitle}</Text>
          <Text style={[styles.proofBody, fontFallback.body]}>{c.proofBody}</Text>
        </View>
      </ProofBand>

      {/* ── Services teaser — one-line glimpse + a link into /services ── */}
      <Section>
        <View style={[styles.teaser, isWide ? styles.teaserWide : styles.teaserNarrow]}>
          <View style={styles.teaserText}>
            <Eyebrow>{c.teaserEyebrow}</Eyebrow>
            <Text style={[styles.teaserTitle, fontFallback.display]}>{c.teaserTitle}</Text>
            <Text style={[styles.sub, fontFallback.body]}>{c.teaserBody}</Text>
          </View>
          <View style={styles.teaserCta}>
            <SecondaryButton label={c.teaserLink} onPress={() => router.push('/services')} />
          </View>
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  // Hero
  hero: {
    maxWidth: 760,
    gap: space.md,
  },
  h1: {
    ...type.h1,
    color: colors.text,
  },
  sub: {
    ...type.bodyLg,
    color: colors.textMuted,
    maxWidth: 620,
  },
  ctaRow: {
    gap: space.sm,
    marginTop: space.xs,
  },
  ctaRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  // Section headings
  h2: {
    ...type.h2,
    color: colors.text,
    marginBottom: space.lg,
    maxWidth: 640,
  },

  // Value/method cards
  cardGrid: {
    gap: space.md,
  },
  cardGridWide: {
    flexDirection: 'row',
  },
  cardGridNarrow: {
    flexDirection: 'column',
  },
  cardWide: {
    flex: 1,
  },
  cardTitle: {
    ...type.h3,
    color: colors.text,
    marginBottom: space.xs,
  },
  cardBody: {
    ...type.body,
    color: colors.textMuted,
  },

  // ProofBand
  proofWrap: {
    maxWidth: 720,
    gap: space.sm,
  },
  proofTitle: {
    ...type.h2,
    color: colors.bg,
  },
  proofBody: {
    ...type.bodyLg,
    color: colors.bg,
    opacity: 0.92,
  },

  // Services teaser
  teaser: {
    gap: space.lg,
  },
  teaserWide: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  teaserNarrow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  teaserText: {
    flexShrink: 1,
    gap: space.sm,
  },
  teaserTitle: {
    ...type.h2,
    color: colors.text,
    maxWidth: 640,
  },
  teaserCta: {
    flexShrink: 0,
  },
});
