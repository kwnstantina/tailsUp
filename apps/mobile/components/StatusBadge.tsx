// =============================================================================
// StatusBadge — a small pill for a LeadStatus / BookingStatus (Phase 3b-2, C1)
//
// Reused by both trainer management screens (leads + bookings). Maps the status
// to one of three DS tones — positive (deep green), attention (copper), muted —
// and renders a bilingual (EL/EN) label via useLang(). Purely presentational.
// =============================================================================

import { StyleSheet, Text, View } from 'react-native';
import type { BookingStatus, LeadStatus } from '@tailsup/shared';
import { colors, fontFallback, radii, type as t } from '../lib/theme';
import { useLang, type Lang } from '../lib/i18n';

type AnyStatus = LeadStatus | BookingStatus;
type Tone = 'positive' | 'attention' | 'muted';

// Lead + booking status values do not overlap, so a single record is safe.
const TONE: Record<AnyStatus, Tone> = {
  // lead statuses
  new: 'attention',
  contacted: 'attention',
  converted: 'positive',
  lost: 'muted',
  // booking statuses
  requested: 'attention',
  confirmed: 'positive',
  declined: 'muted',
  completed: 'positive',
  cancelled: 'muted',
};

const LABELS: Record<Lang, Record<AnyStatus, string>> = {
  el: {
    new: 'Νέο',
    contacted: 'Επικοινωνία',
    converted: 'Μετατράπηκε',
    lost: 'Χάθηκε',
    requested: 'Αίτημα',
    confirmed: 'Επιβεβαιωμένο',
    declined: 'Απορρίφθηκε',
    completed: 'Ολοκληρώθηκε',
    cancelled: 'Ακυρώθηκε',
  },
  en: {
    new: 'New',
    contacted: 'Contacted',
    converted: 'Converted',
    lost: 'Lost',
    requested: 'Requested',
    confirmed: 'Confirmed',
    declined: 'Declined',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
};

const TONE_STYLE: Record<Tone, { backgroundColor: string; color: string }> = {
  positive: { backgroundColor: 'rgba(27,58,50,0.10)', color: colors.primary },
  attention: { backgroundColor: 'rgba(176,125,72,0.14)', color: colors.accent },
  muted: { backgroundColor: 'rgba(107,125,116,0.14)', color: colors.textMuted },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const { lang } = useLang();
  const tone = TONE_STYLE[TONE[status]];
  return (
    <View
      style={[styles.pill, { backgroundColor: tone.backgroundColor }]}
      accessibilityRole="text"
    >
      <Text style={[styles.label, fontFallback.body, { color: tone.color }]}>
        {LABELS[lang][status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.base,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    ...t.caption,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.text,
  },
});
