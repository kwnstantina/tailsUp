// =============================================================================
// site-content.ts — the bilingual copy shared across more than one public page
//
// Page-specific copy still lives IN its page (the `copy = { el, en }` pattern).
// What lands here is the handful of things two or more pages have to agree on:
// the practice details, the service list, the trust claims and the crew strip.
// Duplicating those was how the old site ended up with three different prices
// for the same lesson.
//
// VOICE: warm and direct, the way the trainer would actually say it. Greek is
// written, not translated — "Happy dogs, happier walks" has no literal Greek,
// so the EL hero carries the same energy with its own line.
//
// Every value here is REAL and supplied by the practice — nothing is invented.
//
// Prices are a FROM figure, not a rate card: the practice quotes per case after
// the first hello, so a single number per service would be a promise it has not
// made. One shared value today, but kept per-service so they can diverge
// without a layout change.
// =============================================================================

import type { Tint } from '../components/ui';
import type { Lang } from './i18n';
import type { PhotoSlot } from './photos';

// ── The practice ─────────────────────────────────────────────────────────────

export const practice = {
  name: 'TailsUp',
  address: { el: 'Αρτέμιδα Αττικής', en: 'Artemida, Attica' },
  // Spaced for reading, not for dialling — `tel:` links build their own value.
  phone: '+30 694 305 9915',
  email: 'pitsidimitra@gmail.com',
  hours: { el: '24 ώρες το 24ωρο', en: 'Around the clock' },
  // The hero eyebrow reads "<tagline> · <city>", so this is the region rather
  // than the village: Attica tells a visitor from Athens that this is near them.
  city: { el: 'Αττική', en: 'Attica' },
  // Reads as "Απαντάμε συνήθως <replyTime>." / "We usually reply <replyTime>."
  replyTime: { el: 'μέσα σε 1 ώρα', en: 'within the hour' },
} as const;

// ── Trust claims — the sticker run under the hero ────────────────────────────
// Short enough to read at a glance while scrolling past. `tick` marks the ones
// that are promises rather than descriptions.

export interface TrustClaim {
  label: string;
  tint: Tint;
  tick: boolean;
}

export const trustClaims: Record<Lang, TrustClaim[]> = {
  el: [
    { label: 'Χωρίς εκφοβισμό. Ποτέ.', tint: 'mint', tick: true },
    { label: 'Πρώτη γνωριμία χωρίς δέσμευση', tint: 'peach', tick: true },
    { label: 'Δουλεύουμε και με εσάς, όχι μόνο με τον σκύλο', tint: 'coral', tick: false },
    { label: 'Κάθε συνεδρία καταγράφεται', tint: 'highlight', tick: true },
  ],
  en: [
    { label: 'No intimidation. Ever.', tint: 'mint', tick: true },
    { label: 'First hello, no strings', tint: 'peach', tick: true },
    { label: 'We train you too, not just the dog', tint: 'coral', tick: false },
    { label: 'Every session written down', tint: 'highlight', tick: true },
  ],
};

// ── Services — shared by the home teaser and the services catalogue ──────────
// `type` matches the BOOKING_TYPES enum where one exists, so a card's CTA can
// preselect the right option on /booking. `intensive` has no enum value yet —
// it routes to the form with the default selection.

export type ServiceKey = 'assessment' | 'private' | 'group' | 'intensive';

export interface Service {
  key: ServiceKey;
  title: string;
  summary: string;
  /** The longer pitch, used on /services only. */
  detail: string;
  /** What the owner walks away with. */
  outcomes: string[];
  price: string;
  tint: Tint;
}

export const services: Record<Lang, Service[]> = {
  el: [
    {
      key: 'assessment',
      title: 'Η πρώτη γνωριμία',
      summary:
        'Μία ώρα μαζί: γνωρίζουμε τον σκύλο σας, βλέπουμε τι πραγματικά συμβαίνει και σας λέμε ειλικρινά από πού ξεκινάμε.',
      detail:
        'Δεν ξεκινάμε με πρόγραμμα — ξεκινάμε με παρατήρηση. Βλέπουμε πώς αντιδρά ο σκύλος σας στον πραγματικό του κόσμο, καταγράφουμε το σημείο εκκίνησης και σας δίνουμε ένα ξεκάθαρο πλάνο. Αν δεν σας ταιριάζουμε, θα σας το πούμε.',
      outcomes: [
        'Καταγεγραμμένο σημείο εκκίνησης — τα νούμερα από τα οποία ξεκινάτε',
        'Ένα πλάνο τριών βημάτων, γραπτώς',
        'Μια ειλικρινής εκτίμηση για το πόσο θα πάρει',
      ],
      price: 'από 20€',
      tint: 'mint',
    },
    {
      key: 'private',
      title: 'Ιδιαίτερα μαθήματα',
      summary:
        'Ένας-προς-έναν, στον ρυθμό του σκύλου σας. Εδώ λύνονται τα δύσκολα: αντιδραστικότητα, άγχος, τράβηγμα στο λουρί.',
      detail:
        'Δουλεύουμε πάντα κάτω από το όριο άγχους του σκύλου — εκεί όπου μπορεί ακόμα να σκεφτεί. Κάθε συνεδρία χτίζει πάνω στην προηγούμενη, και φεύγετε με άσκηση για το σπίτι που παίρνει λεπτά, όχι ώρες.',
      outcomes: [
        'Άσκηση για την εβδομάδα — σύντομη, συγκεκριμένη',
        'Μετρήσιμη αλλαγή στην απόσταση ανοχής',
        'Ένα σχέδιο για τις κακές μέρες',
      ],
      price: 'από 20€',
      tint: 'peach',
    },
    {
      key: 'group',
      title: 'Ομαδικά μαθήματα',
      summary:
        'Μικρές ομάδες, ελεγχόμενο περιβάλλον. Για σκύλους που τα πάνε καλά μόνοι και δυσκολεύονται με παρέα.',
      detail:
        'Το δύσκολο δεν είναι η εντολή — είναι η εντολή όταν υπάρχουν τρεις άλλοι σκύλοι στον χώρο. Οι ομάδες μένουν μικρές επίτηδες, με απόσταση μεταξύ των σκύλων που μειώνεται μόνο όταν είναι έτοιμοι.',
      outcomes: [
        'Αυτοσυγκράτηση με περισπασμούς γύρω',
        'Κοινωνικοποίηση χωρίς υπερδιέγερση',
        'Παρέα από ιδιοκτήτες που τα ίδια περνάνε',
      ],
      price: 'από 20€',
      tint: 'coral',
    },
    {
      key: 'intensive',
      title: 'Εντατικό πρόγραμμα',
      summary:
        'Πιο πυκνές συνεδρίες για σύνθετες συμπεριφορές, με στενή καθοδήγηση και συχνή επανεκτίμηση.',
      detail:
        'Για τις περιπτώσεις όπου μία φορά την εβδομάδα δεν αρκεί. Περισσότερες συνεδρίες, πιο κοντά μεταξύ τους, με επανεκτίμηση κάθε δεκαπενθήμερο — και επικοινωνία ενδιάμεσα όταν χρειάζεται.',
      outcomes: [
        'Επανεκτίμηση κάθε δεκαπενθήμερο',
        'Επικοινωνία ανάμεσα στις συνεδρίες',
        'Πλήρες ιστορικό προόδου με δεδομένα',
      ],
      price: 'από 20€',
      tint: 'mint',
    },
  ],
  en: [
    {
      key: 'assessment',
      title: 'The first hello',
      summary:
        'An hour together: we meet your dog, see what is actually going on, and tell you honestly where we would start.',
      detail:
        'We don’t open with a programme — we open with watching. We see how your dog handles their real world, write down the starting point, and give you a clear plan. If we are not the right fit, we will say so.',
      outcomes: [
        'A recorded starting point — the numbers you begin from',
        'A three-step plan, in writing',
        'An honest estimate of how long it takes',
      ],
      price: 'from €20',
      tint: 'mint',
    },
    {
      key: 'private',
      title: 'Private sessions',
      summary:
        'One-to-one, at your dog’s pace. This is where the hard things get solved: reactivity, anxiety, pulling on the lead.',
      detail:
        'We always work below your dog’s stress threshold — the place where they can still think. Each session builds on the last, and you leave with homework that takes minutes, not hours.',
      outcomes: [
        'Homework for the week — short and specific',
        'A measurable change in tolerance distance',
        'A plan for the bad days',
      ],
      price: 'from €20',
      tint: 'peach',
    },
    {
      key: 'group',
      title: 'Group classes',
      summary:
        'Small groups, controlled setting. For dogs who are fine alone and find company hard.',
      detail:
        'The hard part is never the cue — it is the cue with three other dogs in the room. Groups stay small on purpose, and the distance between dogs only shrinks when they are ready for it.',
      outcomes: [
        'Self-control with distractions around',
        'Socialising without the over-arousal',
        'Company from owners going through the same',
      ],
      price: 'from €20',
      tint: 'coral',
    },
    {
      key: 'intensive',
      title: 'Intensive programme',
      summary:
        'Denser sessions for complex behaviour, with close guidance and frequent reassessment.',
      detail:
        'For the cases where once a week is not enough. More sessions, closer together, reassessed every fortnight — and us on the end of a message in between when you need it.',
      outcomes: [
        'A reassessment every fortnight',
        'Contact between sessions',
        'A full progress history, in data',
      ],
      price: 'from €20',
      tint: 'mint',
    },
  ],
};

// ── The crew strip — dogs we have worked with ────────────────────────────────
// REAL dogs, REAL photographs and the REAL behaviour each was worked on, all
// supplied by the practice. The same three carry the case studies on /results.

export interface CrewMember {
  name: string;
  workedOn: string;
  tint: Tint;
  /** Which entry in `lib/photos.ts` fills this circle. */
  photo: PhotoSlot;
}

export const crew: Record<Lang, CrewMember[]> = {
  el: [
    { name: 'Άτερ', workedOn: 'Φοβικότητα στη βόλτα', tint: 'mint', photo: 'crewAter' },
    { name: 'Άλμπα', workedOn: 'Άγχος αποχωρισμού', tint: 'peach', photo: 'crewAlba' },
    { name: 'Νέρο', workedOn: 'Αντιδραστικότητα στη βόλτα', tint: 'coral', photo: 'crewNero' },
  ],
  en: [
    { name: 'Ater', workedOn: 'Fear on the walk', tint: 'mint', photo: 'crewAter' },
    { name: 'Alba', workedOn: 'Separation anxiety', tint: 'peach', photo: 'crewAlba' },
    { name: 'Nero', workedOn: 'Reactivity on the walk', tint: 'coral', photo: 'crewNero' },
  ],
};

// ── Sample progress data ─────────────────────────────────────────────────────
// Illustrative threshold-over-time samples for the home page's curve. Higher
// thresholdMeters = the dog stays calm closer to a trigger = better, so the
// line rises. Clearly sample data, never presented as a claim.

export const sampleCurve: { occurredAt: string; thresholdMeters: number }[] = [
  { occurredAt: '2026-01-06', thresholdMeters: 2 },
  { occurredAt: '2026-01-20', thresholdMeters: 3 },
  { occurredAt: '2026-02-03', thresholdMeters: 4 },
  { occurredAt: '2026-02-17', thresholdMeters: 6 },
  { occurredAt: '2026-03-03', thresholdMeters: 7 },
  { occurredAt: '2026-03-17', thresholdMeters: 9 },
  { occurredAt: '2026-03-31', thresholdMeters: 11 },
  { occurredAt: '2026-04-14', thresholdMeters: 14 },
];
