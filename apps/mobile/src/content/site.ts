// ALL the real-world facts the public site needs, in one place.
//
// Everything still wrapped in [SQUARE BRACKETS] is a placeholder waiting on a
// real answer. Fill them in here and every page updates — no page component
// hard-codes a price, an address or an opening time.
//
// Copy that is genuinely design (headlines, section intros, button labels)
// lives in the page components; this file is only for facts that change when
// the business changes.

import type { BookingType } from '@tailsup/shared';

export const practice = {
  name: 'TailsUp',
  city: '[YOUR CITY]',
  /** Used in the footer and the meta description. */
  blurb: 'Force-free dog training in [YOUR CITY], with the progress written down.',
  credential: '[YOUR CREDENTIAL]',
  yearsInPractice: '[X]',
  dogsHelped: '[X]',
  since: '[YEAR]',
  maxClassSize: '[N]',
  /** How quickly you answer a lead — shown next to both forms. */
  replyTime: 'the same day',
  /** How quickly a booking request is confirmed. */
  confirmTime: '[X hours]',
} as const;

export const trainer = {
  name: '[TRAINER NAME]',
  /** One or two sentences: the dog, the problem, what changed how you work. */
  origin: '[SHORT ORIGIN — the dog, the problem, the thing that changed how you work]',
  portraitAlt: 'Portrait of [TRAINER NAME]',
} as const;

export const contactDetails = {
  email: '[EMAIL]',
  phone: '[PHONE]',
  addressLine1: '[STREET ADDRESS]',
  addressLine2: '[POSTCODE, CITY]',
  hours: '[DAYS], [OPENING HOURS]',
  hoursNote: 'Sessions by appointment only',
} as const;

export interface Service {
  /** Matches the API's BookingType so the booking form can post it directly. */
  type: BookingType;
  title: string;
  strapline: string;
  summary: string;
  /** Shown on the Services page under "You leave with" / "Good to know". */
  detailHeading: string;
  detail: string[];
  price: string;
  meta: { label: string; value: string }[];
  /** Which rotating tint this card uses. */
  tint: 'mint' | 'peach' | 'coral';
}

export const services: Service[] = [
  {
    type: 'assessment',
    title: 'First hello',
    strapline: 'Everyone starts here',
    summary:
      'An hour together, wherever the trouble usually happens. We watch, we chat, you get a first plan you can actually start on.',
    detailHeading: 'You leave with',
    detail: [
      'A plain-language read on what your dog is doing and why',
      'Two or three things to change this week — small ones',
      'An honest answer about whether we are the right people to help',
    ],
    price: '[YOUR PRICE]',
    meta: [
      { label: 'Length', value: 'About 60 minutes' },
      { label: 'Where', value: 'Your home or usual walk' },
    ],
    tint: 'mint',
  },
  {
    type: 'private',
    title: 'Private sessions',
    strapline: 'The main way we work',
    summary:
      'Just you, your dog and us, working on the hard thing. Homework that takes five minutes, not thirty.',
    detailHeading: 'Between sessions',
    detail: [
      'Two or three short exercises, five minutes each',
      'A way to tell us how they went without writing an essay',
      'Your progress logged session by session, in your own account',
    ],
    price: '[YOUR PRICE]',
    meta: [
      { label: 'Length', value: '[45–60] minutes' },
      { label: 'Usually', value: 'Every [1–2] weeks' },
    ],
    tint: 'peach',
  },
  {
    type: 'group',
    title: 'Small group classes',
    strapline: "When you're ready for company",
    summary:
      'Max [N] dogs with proper space between them. Practice, not a test — nobody gets put on the spot.',
    detailHeading: 'Good to know',
    detail: [
      "We'll usually suggest a couple of private sessions first",
      "If a group isn't right for your dog yet, we'll say so rather than sell you a place",
      'Screens and distance are used whenever a dog needs them',
    ],
    price: '[YOUR PRICE]',
    meta: [
      { label: 'Group size', value: 'Up to [N] dogs' },
      { label: 'Runs', value: '[DAY], [TIME]' },
    ],
    tint: 'coral',
  },
];

/** The "some of the crew" strip. Needs real photos AND owner permission. */
export interface CrewMember {
  name: string;
  workedOn: string;
  tint: 'mint' | 'peach' | 'coral';
}

export const crew: CrewMember[] = [
  { name: '[DOG NAME]', workedOn: 'Lead reactivity', tint: 'mint' },
  { name: '[DOG NAME]', workedOn: 'Recall', tint: 'peach' },
  { name: '[DOG NAME]', workedOn: 'Noise worries', tint: 'coral' },
  { name: '[DOG NAME]', workedOn: 'Meeting visitors', tint: 'mint' },
  { name: '[DOG NAME]', workedOn: 'Puppy start', tint: 'peach' },
];

/** Trust claims shown as rotated stickers on the home page. */
export const trustClaims = [
  { label: 'Force-free, always', tint: 'white', tick: true },
  { label: `${practice.yearsInPractice} years at it`, tint: 'mint', tick: false },
  { label: `Max ${practice.maxClassSize} dogs per class`, tint: 'white', tick: false },
  { label: practice.credential, tint: 'highlight', tick: false },
  { label: `${practice.dogsHelped} happy households`, tint: 'white', tick: false },
] as const;

/** Options for the lead form's "How did you find us?" — posted as `source`. */
export const leadSources = [
  'A friend',
  'Google',
  'Instagram',
  'My vet',
  'Somewhere else',
] as const;

/**
 * Sample progress-curve data for the Results page and the home proof band.
 * Threshold distance in metres, one reading per week. This is DEMO data and is
 * labelled as such wherever it renders — real curves come from a client's own
 * BehaviorEvents once the client dashboard exists.
 */
export const sampleCurve = [2, 2.5, 3.5, 3, 5, 6.5, 6, 8.5, 10, 9.5, 12, 14];
