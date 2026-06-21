// =============================================================================
// 4-tap quick-logging screen (Phase 2, Unit C — FR-M1/M2 / NFR-1 / AC-8)
//
// The trainer's core day-to-day surface: log a behavior event in <= 4 deliberate
// taps + submit, then immediately be ready for the next capture. Speed is the
// whole point (NFR-1), so:
//   - All FOUR fields are PRE-DEFAULTED (an unchanged field needs no tap).
//   - Large tap targets, no typing, no scrolling between picking and submitting,
//     no blocking dialogs.
//   - Submit posts POST /sessions/:id/events OMITTING `intervention` (the server
//     defaults it from the dog's protocol).
//   - On 201: optimistic reset to defaults + a lightweight inline confirmation.
//   - On failure: surface the error and RETRY WITHOUT losing selections (R-5).
//     A 400 "no protocol default" case offers a one-time intervention entry
//     instead of baking a 5th tap into the common path (OQ-8).
// =============================================================================

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { OUTCOMES, TRIGGER_TYPES } from '@tailsup/shared';
import type { CreateBehaviorEventInput, Outcome, TriggerType } from '@tailsup/shared';
import { ApiError, postEvent } from '../../../../lib/api';

// Pre-defaults so an unchanged field costs zero taps (R-5).
const DEFAULT_TRIGGER: TriggerType = 'dog';
const DEFAULT_OUTCOME: Outcome = 'disengaged';
const DEFAULT_INTENSITY = 5; // 1..10
const DEFAULT_THRESHOLD = 5; // meters
const THRESHOLD_PRESETS = [2, 5, 10, 20, 50] as const;
const INTENSITY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type Submit =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string; needsIntervention: boolean };

export default function LogScreen() {
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();

  // The four tap fields — local state, all pre-defaulted.
  const [triggerType, setTriggerType] = useState<TriggerType>(DEFAULT_TRIGGER);
  const [outcome, setOutcome] = useState<Outcome>(DEFAULT_OUTCOME);
  const [intensity, setIntensity] = useState<number>(DEFAULT_INTENSITY);
  const [thresholdMeters, setThresholdMeters] = useState<number>(DEFAULT_THRESHOLD);

  const [submit, setSubmit] = useState<Submit>({ kind: 'idle' });
  // Only used for the OQ-8 no-protocol-default escape hatch.
  const [interventionOverride, setInterventionOverride] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  const resetFields = useCallback(() => {
    setTriggerType(DEFAULT_TRIGGER);
    setOutcome(DEFAULT_OUTCOME);
    setIntensity(DEFAULT_INTENSITY);
    setThresholdMeters(DEFAULT_THRESHOLD);
    setInterventionOverride('');
  }, []);

  const doSubmit = useCallback(
    async (withIntervention?: string) => {
      setSubmit({ kind: 'saving' });
      const body: CreateBehaviorEventInput = {
        triggerType,
        thresholdMeters,
        intensity,
        outcome,
        // intervention is OMITTED in the common path (server defaults it). Only
        // included when the user explicitly fills the no-default escape hatch.
        ...(withIntervention && withIntervention.trim() !== ''
          ? { intervention: withIntervention.trim() }
          : {}),
      };
      try {
        await postEvent(sessionId, body);
        setSavedCount((n) => n + 1);
        resetFields(); // optimistic reset — ready for the next capture
        setSubmit({ kind: 'saved' });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : undefined;
        const message = err instanceof ApiError ? err.message : 'Could not log the event.';
        // A 400 here most likely means the dog has no protocol default intervention
        // (OQ-8). Offer a one-time intervention entry rather than a 5th tap.
        const needsIntervention = status === 400 && !withIntervention;
        // Selections are NOT cleared on error — retry without re-tapping (R-5).
        setSubmit({ kind: 'error', message, needsIntervention });
      }
    },
    [sessionId, triggerType, thresholdMeters, intensity, outcome, resetFields],
  );

  const saving = submit.kind === 'saving';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Log event</Text>
        <Text style={styles.subheading}>Tap to adjust, then Log. Defaults are pre-selected.</Text>

        {/* 1. Trigger */}
        <Field label="Trigger">
          <View style={styles.chipRow}>
            {TRIGGER_TYPES.map((t) => (
              <Chip
                key={t}
                label={t}
                selected={triggerType === t}
                disabled={saving}
                onPress={() => setTriggerType(t)}
              />
            ))}
          </View>
        </Field>

        {/* 2. Intensity */}
        <Field label={`Intensity · ${intensity}/10`}>
          <View style={styles.chipRow}>
            {INTENSITY_VALUES.map((v) => (
              <Chip
                key={v}
                label={String(v)}
                compact
                selected={intensity === v}
                disabled={saving}
                onPress={() => setIntensity(v)}
              />
            ))}
          </View>
        </Field>

        {/* 3. Outcome */}
        <Field label="Outcome">
          <View style={styles.chipRow}>
            {OUTCOMES.map((o) => (
              <Chip
                key={o}
                label={o.replace(/_/g, ' ')}
                selected={outcome === o}
                disabled={saving}
                onPress={() => setOutcome(o)}
              />
            ))}
          </View>
        </Field>

        {/* 4. Threshold (meters) */}
        <Field label={`Threshold · ${thresholdMeters}m`}>
          <View style={styles.chipRow}>
            {THRESHOLD_PRESETS.map((m) => (
              <Chip
                key={m}
                label={`${m}m`}
                selected={thresholdMeters === m}
                disabled={saving}
                onPress={() => setThresholdMeters(m)}
              />
            ))}
          </View>
        </Field>

        {/* Submit */}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void doSubmit()}
          style={({ pressed }) => [
            styles.submitButton,
            saving && styles.submitDisabled,
            pressed && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Log event</Text>
          )}
        </Pressable>

        {/* Lightweight confirmation — non-blocking */}
        {submit.kind === 'saved' && (
          <View style={[styles.banner, styles.bannerSuccess]}>
            <Text style={styles.bannerSuccessText}>
              ✓ Logged. Ready for the next one. ({savedCount} this session)
            </Text>
          </View>
        )}

        {/* Error — selections preserved; retry inline */}
        {submit.kind === 'error' && (
          <View style={[styles.banner, styles.bannerError]}>
            <Text style={styles.bannerErrorText}>✕ {submit.message}</Text>

            {submit.needsIntervention ? (
              <View style={styles.interventionBox}>
                <Text style={styles.interventionHint}>
                  This dog has no default intervention. Enter one for this event:
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. u-turn, treat scatter"
                  value={interventionOverride}
                  onChangeText={setInterventionOverride}
                  editable={!saving}
                  autoCapitalize="none"
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || interventionOverride.trim() === ''}
                  onPress={() => void doSubmit(interventionOverride)}
                  style={({ pressed }) => [
                    styles.retryButton,
                    (saving || interventionOverride.trim() === '') && styles.submitDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.retryText}>Log with intervention</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void doSubmit()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Retry (selections kept)</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  disabled,
  compact,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: {
    padding: 20,
    gap: 16,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({ web: { minHeight: '100%' as unknown as number }, default: {} }),
  },
  heading: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subheading: { fontSize: 14, color: '#64748b', marginTop: -8 },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minWidth: 56,
    alignItems: 'center',
  },
  chipCompact: { paddingHorizontal: 0, paddingVertical: 12, minWidth: 44 },
  chipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 15, fontWeight: '600', color: '#334155', textTransform: 'capitalize' },
  chipTextSelected: { color: '#ffffff' },
  submitButton: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  banner: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 10 },
  bannerSuccess: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  bannerSuccessText: { color: '#166534', fontSize: 15, fontWeight: '600' },
  bannerError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  bannerErrorText: { color: '#991b1b', fontSize: 15, fontWeight: '600' },
  interventionBox: { gap: 8 },
  interventionHint: { fontSize: 13, color: '#7f1d1d' },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
