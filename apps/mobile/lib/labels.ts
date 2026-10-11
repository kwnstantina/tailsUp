// =============================================================================
// Human labels for the domain enums (authed app).
//
// The API speaks in enum literals ('recovered_slowly', 'assessment'); people
// should never see those. Every app screen reads its labels from here so a
// trigger or a booking type is called the same thing on every screen, in both
// languages.
// =============================================================================

import type { BookingType, Outcome, TriggerType } from '@tailsup/shared';
import type { Lang } from './i18n';

export const TRIGGER_LABELS: Record<Lang, Record<TriggerType, string>> = {
  el: { dog: 'Σκύλος', human: 'Άνθρωπος', noise: 'Θόρυβος', vehicle: 'Όχημα', other: 'Άλλο' },
  en: { dog: 'Dog', human: 'Person', noise: 'Noise', vehicle: 'Vehicle', other: 'Other' },
};

// Written from the owner's side of the lead: what the dog DID, not the
// clinical term. 'disengaged' is the win — the dog turned back to the handler.
export const OUTCOME_LABELS: Record<Lang, Record<Outcome, string>> = {
  el: { disengaged: 'Γύρισε σε εμένα', recovered_slowly: 'Ηρέμησε αργά', over_threshold: 'Πάνω από το όριο' },
  en: { disengaged: 'Turned back to me', recovered_slowly: 'Settled slowly', over_threshold: 'Over threshold' },
};

export const BOOKING_TYPE_LABELS: Record<Lang, Record<BookingType, string>> = {
  el: { assessment: 'Πρώτη γνωριμία', private: 'Ιδιαίτερο μάθημα', group: 'Ομαδικό' },
  en: { assessment: 'First meeting', private: 'Private lesson', group: 'Group class' },
};

/** "Άλλο: Ποδήλατο" when the trainer typed what the other trigger was. */
export function triggerLabel(type: TriggerType, detail: string | null | undefined, lang: Lang): string {
  const base = TRIGGER_LABELS[lang][type];
  return type === 'other' && detail ? detail : base;
}

/** Intensity 1..10 in words, for the log screen's running caption. */
export function intensityWord(value: number, lang: Lang): string {
  const words =
    lang === 'el'
      ? ['ήρεμος', 'ήπια', 'μέτρια', 'έντονη', 'εκτός ελέγχου']
      : ['calm', 'mild', 'moderate', 'strong', 'out of control'];
  if (value <= 2) return words[0];
  if (value <= 4) return words[1];
  if (value <= 6) return words[2];
  if (value <= 8) return words[3];
  return words[4];
}

const LOCALE: Record<Lang, string> = { el: 'el-GR', en: 'en-GB' };

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "15:30" */
export function formatTime(iso: string, lang: Lang): string {
  const d = parse(iso);
  return d ? d.toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }) : iso;
}

/** "Δευτ 15 Ιουνίου" */
export function formatDay(iso: string, lang: Lang): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'long' }) : iso;
}

/** "Κυριακή 11 Οκτωβρίου" — the Today screen's eyebrow. */
export function formatLongDay(date: Date, lang: Lang): string {
  return date.toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "15/6" — compact axis label. */
export function formatShortDate(iso: string, lang: Lang): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'numeric' }) : iso;
}

/** "Κυρ 1 Νοε, 10:00" */
export function formatDayTime(iso: string, lang: Lang): string {
  const d = parse(iso);
  return d
    ? d.toLocaleString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : iso;
}

/** "πριν 2 ώρες" / "2 hours ago", falling back to the date after a week. */
export function formatAgo(iso: string, lang: Lang, now: number = Date.now()): string {
  const d = parse(iso);
  if (!d) return iso;
  const minutes = Math.round((now - d.getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-Math.max(minutes, 0), 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return formatDay(iso, lang);
}

export function isSameDay(iso: string, day: Date): boolean {
  const d = parse(iso);
  return (
    !!d &&
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

/**
 * Public bookings fold the visitor's name and contact into `notes` as
 * "[Name · contact] free text" (there are no columns for them). Split it back
 * out so a booking can be shown as a person, not a bracketed string.
 */
export function parseBookingNotes(notes: string | null): { name: string | null; contact: string | null; note: string } {
  const m = /^\[(.+?) · (.+?)\]\s*([\s\S]*)$/.exec(notes ?? '');
  if (!m) return { name: null, contact: null, note: (notes ?? '').trim() };
  return { name: m[1], contact: m[2], note: m[3].trim() };
}

/** Age in months → "3 ετών" / "8 μηνών". */
export function formatAge(ageMonths: number, lang: Lang): string {
  if (ageMonths < 12) return lang === 'el' ? `${ageMonths} μηνών` : `${ageMonths} months`;
  const years = Math.floor(ageMonths / 12);
  if (lang === 'el') return years === 1 ? '1 έτους' : `${years} ετών`;
  return years === 1 ? '1 year' : `${years} years`;
}
