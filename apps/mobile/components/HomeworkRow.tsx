// =============================================================================
// HomeworkRow — a Card-styled homework item for the client dashboard (C1)
//
// Shows the exercise title + instructions, and either a "mark complete" button
// (incomplete) or a completed timestamp (done). The complete action is owned by
// the parent (client.tsx): it passes `pending` while the PATCH is in flight and
// re-renders the row on success. Visible copper focus ring on the button.
// =============================================================================

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { HomeworkDTO } from '@tailsup/shared';
import { colors, fontFallback, radii, space, type as t } from '../lib/theme';
import { useLang } from '../lib/i18n';

const copy = {
  el: {
    markComplete: 'Ολοκληρώθηκε',
    marking: 'Αποθήκευση…',
    doneOn: (date: string) => `Ολοκληρώθηκε στις ${date}`,
    done: 'Ολοκληρώθηκε',
  },
  en: {
    markComplete: 'Mark complete',
    marking: 'Saving…',
    doneOn: (date: string) => `Completed on ${date}`,
    done: 'Completed',
  },
} as const;

function formatDate(iso: string | null, lang: 'el' | 'en'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function HomeworkRow({
  homework,
  onComplete,
  pending = false,
}: {
  homework: HomeworkDTO;
  onComplete: () => void;
  pending?: boolean;
}) {
  const { lang } = useLang();
  const c = copy[lang];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, fontFallback.display]}>{homework.title}</Text>
        {homework.completed && (
          <Text style={[styles.doneBadge, fontFallback.body]} accessibilityRole="text">
            ✓ {c.done}
          </Text>
        )}
      </View>

      {homework.instructions.trim() !== '' && (
        <Text style={[styles.instructions, fontFallback.body]}>{homework.instructions}</Text>
      )}

      {homework.completed ? (
        <Text style={[styles.completedAt, fontFallback.body]}>
          {c.doneOn(formatDate(homework.completedAt, lang))}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: pending, disabled: pending }}
          disabled={pending}
          onPress={onComplete}
          style={({ hovered, focused, pressed }) => [
            styles.button,
            (hovered || pressed) && styles.buttonHover,
            focused && styles.buttonFocused,
            pending && styles.buttonBlocked,
            Platform.select({ web: { cursor: pending ? 'default' : 'pointer' } as object, default: {} }),
          ]}
        >
          {pending ? (
            <View style={styles.buttonRow}>
              <ActivityIndicator color={colors.bg} />
              <Text style={[styles.buttonText, fontFallback.body]}>{c.marking}</Text>
            </View>
          ) : (
            <Text style={[styles.buttonText, fontFallback.body]}>{c.markComplete}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
    gap: space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  title: { ...t.h3, color: colors.text, flexShrink: 1 },
  doneBadge: { ...t.caption, color: colors.primary, fontSize: 12.5 },
  instructions: { ...t.body, color: colors.textMuted },
  completedAt: { ...t.caption, color: colors.textMuted, marginTop: space.xs },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radii.base,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: space.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonHover: { backgroundColor: colors.primarySoft },
  buttonFocused: { borderColor: colors.accent },
  buttonBlocked: { opacity: 0.6 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  buttonText: { ...t.body, color: colors.bg },
});
